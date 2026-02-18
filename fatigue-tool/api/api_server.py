"""
api_server.py - FastAPI Backend for Fatigue Analysis Tool
==========================================================

RESTful API exposing your Python fatigue model to frontend.

Endpoints:
- POST /api/analyze - Upload roster, get analysis
- GET /api/analysis/{id} - Get stored analysis
- GET /api/duty/{analysis_id}/{duty_id} - Detailed duty timeline

Usage:
    uvicorn api_server:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
import tempfile
import os
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Import your fatigue model
from core import BorbelyFatigueModel, ModelConfig
from parsers.roster_parser import PDFRosterParser, CSVRosterParser, AirportDatabase
from models.data_models import MonthlyAnalysis, DutyTimeline

# ============================================================================
# FASTAPI APP INITIALIZATION
# ============================================================================

app = FastAPI(
    title="Fatigue Analysis API",
    description="EASA-compliant biomathematical fatigue analysis with sleep quality modeling",
    version="4.2.0"
)

# CORS - Allow Aerowake frontend origins
# Production origins loaded from CORS_ORIGINS env var (comma-separated)
# e.g. CORS_ORIGINS=https://aerowake.vercel.app,https://aerowake.com
_cors_env = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
ALLOWED_ORIGINS += [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class AnalysisRequest(BaseModel):
    pilot_id: str
    month: str  # Format: "2026-02"
    home_base: str  # Airport code (e.g., "DOH")
    home_timezone: str  # e.g., "Asia/Qatar"
    config_preset: str = "default"  # "default", "conservative", "liberal", "research"


class AirportResponse(BaseModel):
    """Airport information from the backend's ~7,800 airport database"""
    code: str           # IATA code (e.g., "LHR")
    timezone: str       # IANA timezone (e.g., "Europe/London")
    utc_offset_hours: Optional[float] = None  # Current UTC offset (accounts for DST)
    latitude: float = 0.0
    longitude: float = 0.0


class DutySegmentResponse(BaseModel):
    flight_number: str
    departure: str
    arrival: str
    departure_time: str  # UTC ISO format
    arrival_time: str    # UTC ISO format
    # DEPRECATED: use _home_tz fields below (identical values, clearer name).
    departure_time_local: str  # Home base TZ HH:mm (backward compat)
    arrival_time_local: str    # Home base TZ HH:mm (backward compat)
    # Canonical home-base timezone times
    departure_time_home_tz: str = ""  # HH:mm in home base timezone
    arrival_time_home_tz: str = ""    # HH:mm in home base timezone
    # Airport-local times (in the actual departure/arrival airport timezone)
    departure_time_airport_local: str = ""  # HH:mm in departure airport local TZ
    arrival_time_airport_local: str = ""    # HH:mm in arrival airport local TZ
    # Timezone metadata for each airport
    departure_timezone: str = ""  # IANA timezone of departure airport
    arrival_timezone: str = ""    # IANA timezone of arrival airport
    departure_utc_offset: Optional[float] = None  # UTC offset at departure (hours, e.g. +3.0)
    arrival_utc_offset: Optional[float] = None     # UTC offset at arrival (hours, e.g. +5.5)
    block_hours: float
    # Activity code from roster PDF (IR = inflight rest, DH = deadhead)
    activity_code: Optional[str] = None
    is_deadhead: bool = False


class QualityFactorsResponse(BaseModel):
    """Breakdown of multiplicative quality factors applied to raw sleep duration.
    Each factor is a multiplier around 1.0 (>1 = boost, <1 = penalty).
    effective_sleep = duration * product(all factors), clamped to [0.65, 1.0]."""
    base_efficiency: float        # Location-based: home 0.90, hotel 0.85, crew_rest 0.70
    wocl_boost: float             # WOCL-aligned sleep consolidation boost (1.0-1.15)
    late_onset_penalty: float     # Penalty for sleep starting after 01:00 (0.93-1.0)
    recovery_boost: float         # Post-duty homeostatic drive boost (1.0-1.10)
    time_pressure_factor: float   # Proximity to next duty (0.88-1.03)
    insufficient_penalty: float   # Penalty for <6h sleep (0.75-1.0)


class SleepBlockResponse(BaseModel):
    """Individual sleep period with timing and optional quality breakdown.

    Timezone convention:
    - Primary fields (sleep_start_time, _iso, _day, _hour) are in HOME BASE TZ.
    - _home_tz suffixed fields are IDENTICAL to the primary fields and exist
      only for backward compatibility.  Frontend should prefer _home_tz fields;
      base fields will be removed in a future release.
    - _location_tz fields are in the IANA timezone where the pilot physically
      sleeps (hotel/home).
    """
    sleep_start_time: str  # HH:mm in home-base timezone
    sleep_end_time: str    # HH:mm in home-base timezone
    sleep_start_iso: str   # ISO format with date (home-base TZ)
    sleep_end_iso: str     # ISO format with date (home-base TZ)
    sleep_type: str        # 'main', 'nap', 'anchor', 'inflight'
    duration_hours: float
    effective_hours: float
    quality_factor: float

    # Location context — needed for local-time labels on chronogram
    location_timezone: Optional[str] = None    # IANA tz where pilot physically sleeps
    environment: Optional[str] = None          # 'home', 'hotel', 'crew_rest'
    sleep_start_time_location_tz: Optional[str] = None  # HH:mm in location timezone
    sleep_end_time_location_tz: Optional[str] = None    # HH:mm in location timezone

    # DEPRECATED: use _home_tz fields below instead (identical values).
    # Kept for backward compatibility; will be removed in a future release.
    sleep_start_day: Optional[int] = None      # Day of month (1-31) — home-base TZ
    sleep_start_hour: Optional[float] = None   # Decimal hour (0-24) — home-base TZ
    sleep_end_day: Optional[int] = None
    sleep_end_hour: Optional[float] = None

    # Canonical home-base timezone positioning (preferred by frontend)
    sleep_start_day_home_tz: Optional[int] = None
    sleep_start_hour_home_tz: Optional[float] = None
    sleep_end_day_home_tz: Optional[int] = None
    sleep_end_hour_home_tz: Optional[float] = None
    sleep_start_time_home_tz: Optional[str] = None    # HH:mm
    sleep_end_time_home_tz: Optional[str] = None      # HH:mm

    # UTC ISO timestamps — always Z-suffixed, timezone-unambiguous.
    # Use these as the canonical source for any future timezone-toggle rendering.
    sleep_start_utc: Optional[str] = None  # e.g. "2026-02-01T22:00:00+00:00"
    sleep_end_utc: Optional[str] = None    # e.g. "2026-02-02T06:30:00+00:00"

    # Per-block quality factor breakdown (populated for all sleep types)
    quality_factors: Optional[QualityFactorsResponse] = None


class ReferenceResponse(BaseModel):
    """Peer-reviewed scientific reference supporting the calculation"""
    key: str     # e.g. 'roach_2012'
    short: str   # e.g. 'Roach et al. (2012)'
    full: str    # Full citation


class SleepQualityResponse(BaseModel):
    """Sleep quality analysis with scientific methodology transparency.

    Top-level positioning fields represent the FULL sleep window across all
    blocks (earliest start → latest end).  Individual block positions are
    in the sleep_blocks array.
    """
    total_sleep_hours: float
    effective_sleep_hours: float
    sleep_efficiency: float
    wocl_overlap_hours: float
    sleep_strategy: str  # 'anchor', 'split', 'nap', 'early_bedtime', 'afternoon_nap', 'extended', 'restricted', 'normal', 'recovery', 'post_duty_recovery'
    confidence: float
    warnings: List[str]
    sleep_blocks: List[SleepBlockResponse] = []  # All sleep periods
    sleep_start_time: Optional[str] = None  # HH:mm of earliest block (home-base TZ)
    sleep_end_time: Optional[str] = None    # HH:mm of latest block (home-base TZ)
    sleep_start_iso: Optional[str] = None   # Earliest block start (ISO, home-base TZ)
    sleep_end_iso: Optional[str] = None     # Latest block end (ISO, home-base TZ)

    # UTC span of the full sleep window (earliest start → latest end).
    # Always +00:00 offset — use for future timezone-toggle rendering.
    sleep_start_utc: Optional[str] = None   # e.g. "2026-02-01T22:00:00+00:00"
    sleep_end_utc: Optional[str] = None     # e.g. "2026-02-02T06:30:00+00:00"

    # DEPRECATED: use _home_tz fields below instead (identical values).
    sleep_start_day: Optional[int] = None       # Day of month (1-31) — home-base TZ
    sleep_start_hour: Optional[float] = None    # Decimal hour (0-24) — home-base TZ
    sleep_end_day: Optional[int] = None
    sleep_end_hour: Optional[float] = None

    # Canonical home-base timezone positioning (preferred by frontend)
    sleep_start_day_home_tz: Optional[int] = None
    sleep_start_hour_home_tz: Optional[float] = None
    sleep_end_day_home_tz: Optional[int] = None
    sleep_end_hour_home_tz: Optional[float] = None
    sleep_start_time_home_tz: Optional[str] = None    # HH:mm
    sleep_end_time_home_tz: Optional[str] = None      # HH:mm

    # Scientific methodology (surfaces calculation transparency)
    explanation: Optional[str] = None              # Human-readable strategy description
    confidence_basis: Optional[str] = None         # Why confidence is at this level
    quality_factors: Optional[QualityFactorsResponse] = None  # Factor breakdown
    references: List[ReferenceResponse] = []       # Supporting literature


class DutyResponse(BaseModel):
    duty_id: str
    date: str
    report_time_utc: str
    release_time_utc: str
    # Local time strings for direct display (HH:MM in home timezone)
    report_time_local: Optional[str] = None    # Kept for backward compat
    release_time_local: Optional[str] = None   # Kept for backward compat
    # Explicit home-base timezone times (identical to _local, unambiguous naming)
    report_time_home_tz: Optional[str] = None  # HH:MM in home base timezone
    release_time_home_tz: Optional[str] = None # HH:MM in home base timezone
    duty_hours: float
    sectors: int
    segments: List[DutySegmentResponse]
    
    # Performance metrics
    min_performance: float
    avg_performance: float
    landing_performance: Optional[float]
    
    # Fatigue metrics
    sleep_debt: float
    wocl_hours: float
    prior_sleep: float
    pre_duty_awake_hours: float = 0.0  # hours awake before report
    
    # Risk
    risk_level: str  # "low", "moderate", "high", "critical", "extreme"
    is_reportable: bool
    pinch_events: int
    
    # EASA FDP limits
    max_fdp_hours: Optional[float]  # Base FDP limit
    extended_fdp_hours: Optional[float]  # With captain discretion
    used_discretion: bool  # True if exceeded base limit
    
    # Circadian adaptation state at duty report time
    circadian_phase_shift: Optional[float] = None  # Hours offset from home base body clock

    # Enhanced sleep quality analysis
    sleep_quality: Optional[SleepQualityResponse] = None

    # Validation warnings (NEW - BUG FIX #5)
    time_validation_warnings: List[str] = []

    # Augmented crew / ULR data
    crew_composition: str = "standard"
    rest_facility_class: Optional[str] = None
    is_ulr: bool = False
    acclimatization_state: str = "acclimatized"
    ulr_compliance: Optional[dict] = None
    inflight_rest_blocks: List[dict] = []
    return_to_deck_performance: Optional[float] = None


class RestDaySleepResponse(BaseModel):
    """Sleep pattern for a rest day (no duties) with full scientific methodology"""
    date: str  # YYYY-MM-DD
    sleep_blocks: List[SleepBlockResponse]
    total_sleep_hours: float
    effective_sleep_hours: float
    sleep_efficiency: float
    strategy_type: str  # 'recovery', 'post_duty_recovery', or other strategy types
    confidence: float

    # Scientific methodology — consistent with SleepQualityResponse
    explanation: Optional[str] = None
    confidence_basis: Optional[str] = None
    quality_factors: Optional[QualityFactorsResponse] = None
    references: List[ReferenceResponse] = []

    # Recovery context (for recovery strategy_type)
    recovery_night_number: Optional[int] = None           # Which recovery night (1-indexed)
    cumulative_recovery_fraction: Optional[float] = None  # 0-1 fraction of debt recovered


class AnalysisResponse(BaseModel):
    analysis_id: str
    roster_id: str
    pilot_id: str
    pilot_name: Optional[str]  # Extracted from PDF
    pilot_base: Optional[str]  # Home base airport
    pilot_aircraft: Optional[str]  # Aircraft type
    home_base_timezone: Optional[str] = None  # IANA timezone (e.g., "Asia/Qatar")
    timezone_format: Optional[str] = None  # 'auto', 'local', 'homebase', 'zulu' — how roster times were interpreted
    month: str
    
    # Summary
    total_duties: int
    total_sectors: int
    total_duty_hours: float
    total_block_hours: float
    
    # Risk summary
    high_risk_duties: int
    critical_risk_duties: int
    total_pinch_events: int
    
    # Sleep metrics
    avg_sleep_per_night: float
    max_sleep_debt: float
    
    # Worst case
    worst_duty_id: str
    worst_performance: float
    
    # Detailed duties
    duties: List[DutyResponse]
    
    # Rest days sleep patterns
    rest_days_sleep: List[RestDaySleepResponse] = []

    # Circadian adaptation curve for body-clock chronogram
    # List of {timestamp_utc, phase_shift_hours, reference_timezone}
    body_clock_timeline: List[dict] = []

    # Augmented crew / ULR summary
    total_ulr_duties: int = 0
    total_augmented_duties: int = 0
    ulr_violations: List[str] = []



# ============================================================================
# IN-MEMORY STORAGE (Replace with database in production)
# ============================================================================

analysis_store = {}  # analysis_id -> (MonthlyAnalysis, Roster)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def classify_risk(performance: Optional[float]) -> str:
    """Classify risk level based on performance score"""
    if performance is None:
        return "unknown"
    if performance >= 75:
        return "low"
    elif performance >= 65:
        return "moderate"
    elif performance >= 55:
        return "high"
    elif performance >= 45:
        return "critical"
    else:
        return "extreme"


def _build_segments(duty, home_tz) -> list:
    """Serialize flight segments with timezone conversions."""
    import pytz

    segments = []
    for seg in duty.segments:
        dep_utc = seg.scheduled_departure_utc
        arr_utc = seg.scheduled_arrival_utc

        # Home base timezone for chronogram alignment
        dep_home = dep_utc.astimezone(home_tz)
        arr_home = arr_utc.astimezone(home_tz)

        # Actual airport-local timezone for display
        dep_airport_tz = pytz.timezone(seg.departure_airport.timezone)
        arr_airport_tz = pytz.timezone(seg.arrival_airport.timezone)
        dep_airport_local = dep_utc.astimezone(dep_airport_tz)
        arr_airport_local = arr_utc.astimezone(arr_airport_tz)

        dep_utc_offset = dep_airport_local.utcoffset().total_seconds() / 3600
        arr_utc_offset = arr_airport_local.utcoffset().total_seconds() / 3600

        segments.append(DutySegmentResponse(
            flight_number=seg.flight_number,
            departure=seg.departure_airport.code,
            arrival=seg.arrival_airport.code,
            departure_time=dep_utc.isoformat(),
            arrival_time=arr_utc.isoformat(),
            departure_time_local=dep_home.strftime("%H:%M"),
            arrival_time_local=arr_home.strftime("%H:%M"),
            departure_time_home_tz=dep_home.strftime("%H:%M"),
            arrival_time_home_tz=arr_home.strftime("%H:%M"),
            departure_time_airport_local=dep_airport_local.strftime("%H:%M"),
            arrival_time_airport_local=arr_airport_local.strftime("%H:%M"),
            departure_timezone=seg.departure_airport.timezone,
            arrival_timezone=seg.arrival_airport.timezone,
            departure_utc_offset=dep_utc_offset,
            arrival_utc_offset=arr_utc_offset,
            block_hours=seg.block_time_hours,
            activity_code=getattr(seg, 'activity_code', None),
            is_deadhead=getattr(seg, 'is_deadhead', False),
        ))
    return segments


def _validate_duty_times(duty) -> list:
    """Return time-validation warnings for a single duty."""
    warnings = []
    if duty.report_time_utc >= duty.release_time_utc:
        warnings.append("Invalid duty: report time >= release time")
    if duty.duty_hours > 24 and not getattr(duty, 'is_ulr', False):
        warnings.append(f"Unusual duty length: {duty.duty_hours:.1f} hours")
    elif duty.duty_hours > 23 and getattr(duty, 'is_ulr', False):
        warnings.append(f"ULR duty exceeds max discretion limit: {duty.duty_hours:.1f} hours")
    if duty.duty_hours < 0.5:
        warnings.append(f"Very short duty: {duty.duty_hours:.1f} hours")
    return warnings


def _build_sleep_quality(duty_timeline) -> Optional[SleepQualityResponse]:
    """Assemble SleepQualityResponse from strategy data.

    Top-level positioning spans the full sleep window (earliest start → latest
    end) so multi-block strategies are represented correctly.
    """
    if not duty_timeline.sleep_quality_data:
        return None

    sqd = duty_timeline.sleep_quality_data
    blocks = sqd.get('sleep_blocks', [])

    if blocks:
        earliest = blocks[0]
        latest = blocks[0]
        for b in blocks[1:]:
            if (b.get('sleep_start_iso') or '') < (earliest.get('sleep_start_iso') or ''):
                earliest = b
            if (b.get('sleep_end_iso') or '') > (latest.get('sleep_end_iso') or ''):
                latest = b
    else:
        earliest = {}
        latest = {}

    return SleepQualityResponse(
        total_sleep_hours=sqd.get('total_sleep_hours', 0.0),
        effective_sleep_hours=sqd.get('effective_sleep_hours', 0.0),
        sleep_efficiency=sqd.get('sleep_efficiency', 0.0),
        wocl_overlap_hours=sqd.get('wocl_overlap_hours', 0.0),
        sleep_strategy=sqd.get('strategy_type', 'unknown'),
        confidence=sqd.get('confidence', 0.0),
        warnings=sqd.get('warnings', []),
        sleep_blocks=blocks,
        sleep_start_time=sqd.get('sleep_start_time'),
        sleep_end_time=sqd.get('sleep_end_time'),
        explanation=sqd.get('explanation'),
        confidence_basis=sqd.get('confidence_basis'),
        quality_factors=sqd.get('quality_factors'),
        references=sqd.get('references', []),
        sleep_start_iso=earliest.get('sleep_start_iso'),
        sleep_end_iso=latest.get('sleep_end_iso'),
        sleep_start_utc=earliest.get('sleep_start_utc'),
        sleep_end_utc=latest.get('sleep_end_utc'),
        sleep_start_day=earliest.get('sleep_start_day'),
        sleep_start_hour=earliest.get('sleep_start_hour'),
        sleep_end_day=latest.get('sleep_end_day'),
        sleep_end_hour=latest.get('sleep_end_hour'),
        sleep_start_day_home_tz=earliest.get('sleep_start_day_home_tz'),
        sleep_start_hour_home_tz=earliest.get('sleep_start_hour_home_tz'),
        sleep_end_day_home_tz=latest.get('sleep_end_day_home_tz'),
        sleep_end_hour_home_tz=latest.get('sleep_end_hour_home_tz'),
        sleep_start_time_home_tz=earliest.get('sleep_start_time_home_tz'),
        sleep_end_time_home_tz=latest.get('sleep_end_time_home_tz'),
    )


def _build_ulr_data(duty_timeline, duty) -> tuple:
    """Extract ULR compliance dict and inflight rest blocks."""
    import pytz

    ulr_compliance_dict = None
    if getattr(duty_timeline, 'ulr_compliance', None):
        uc = duty_timeline.ulr_compliance
        ulr_compliance_dict = {
            'is_ulr': uc.is_ulr,
            'pre_rest_compliant': uc.pre_ulr_rest_compliant,
            'post_rest_compliant': uc.post_ulr_rest_compliant,
            'monthly_count': uc.monthly_ulr_count,
            'monthly_compliant': uc.monthly_ulr_compliant,
            'fdp_within_limit': uc.fdp_within_limit,
            'rest_periods_valid': uc.rest_periods_valid,
            'violations': uc.violations,
            'warnings': uc.warnings,
        }

    home_tz = pytz.timezone(duty.home_base_timezone)

    inflight_blocks = []
    rest_periods = []
    if hasattr(duty, 'inflight_rest_plan') and duty.inflight_rest_plan:
        rest_periods = duty.inflight_rest_plan.rest_periods

    # Only emit IR overlay bars when the PDF actually contained an `IR` activity code
    # on at least one segment.  For AUGMENTED_3 duties with no IR marker (e.g. the
    # outbound operating leg of a ULR pair), AugmentedCrewRestPlanner still generates
    # internal rest blocks to drive the fatigue model, but these should NOT appear as
    # IR overlay bars on the chronogram — the pilot is on the flight deck, not resting.
    has_pdf_ir = getattr(duty, 'has_inflight_rest_segments', False)

    for i, block in enumerate(getattr(duty_timeline, 'inflight_rest_blocks', []) if has_pdf_ir else []):
        period = rest_periods[i] if i < len(rest_periods) else None

        # Convert UTC block times to home-base TZ for chronogram positioning.
        # The frontend should use these pre-computed fields rather than doing
        # manual UTC→local arithmetic via departure segment offsets.
        start_utc = block.start_utc.astimezone(pytz.utc) if block.start_utc else None
        end_utc = block.end_utc.astimezone(pytz.utc) if block.end_utc else None
        start_home = start_utc.astimezone(home_tz) if start_utc else None
        end_home = end_utc.astimezone(home_tz) if end_utc else None

        inflight_blocks.append({
            # Raw UTC — always unambiguous
            'start_utc': start_utc.isoformat() if start_utc else None,
            'end_utc': end_utc.isoformat() if end_utc else None,
            # Home-base TZ positioning — mirrors SleepBlockResponse fields.
            # Use these for chronogram bar placement (same reference as duty bars).
            'start_home_tz': start_home.strftime('%H:%M') if start_home else None,
            'end_home_tz': end_home.strftime('%H:%M') if end_home else None,
            'start_day_home_tz': start_home.day if start_home else None,
            'start_hour_home_tz': (start_home.hour + start_home.minute / 60.0) if start_home else None,
            'end_day_home_tz': end_home.day if end_home else None,
            'end_hour_home_tz': (end_home.hour + end_home.minute / 60.0) if end_home else None,
            'start_iso_home_tz': start_home.isoformat() if start_home else None,
            'end_iso_home_tz': end_home.isoformat() if end_home else None,
            # Quality metrics
            'duration_hours': block.duration_hours,
            'effective_sleep_hours': block.effective_sleep_hours,
            'quality_factor': block.quality_factor,
            'environment': block.environment,
            # ULR crew metadata
            'crew_member_id': period.crew_member_id if period else None,
            'crew_set': period.crew_set if period else None,
            'is_during_wocl': period.is_during_wocl if period else False,
        })
    return ulr_compliance_dict, inflight_blocks


def _build_duty_response(duty_timeline, duty, roster) -> DutyResponse:
    """Shared serialization for a single duty — used by both POST and GET endpoints."""
    import pytz

    risk = classify_risk(duty_timeline.landing_performance)
    home_tz = pytz.timezone(duty.home_base_timezone)

    segments = _build_segments(duty, home_tz)
    time_warnings = _validate_duty_times(duty)
    sleep_quality = _build_sleep_quality(duty_timeline)
    ulr_compliance_dict, inflight_blocks = _build_ulr_data(duty_timeline, duty)

    report_local = duty.report_time_utc.astimezone(home_tz)
    release_local = duty.release_time_utc.astimezone(home_tz)

    return DutyResponse(
        duty_id=duty_timeline.duty_id,
        date=duty_timeline.duty_date.strftime("%Y-%m-%d"),
        report_time_utc=duty.report_time_utc.isoformat(),
        release_time_utc=duty.release_time_utc.isoformat(),
        report_time_local=report_local.strftime("%H:%M"),
        release_time_local=release_local.strftime("%H:%M"),
        report_time_home_tz=report_local.strftime("%H:%M"),
        release_time_home_tz=release_local.strftime("%H:%M"),
        duty_hours=duty.duty_hours,
        sectors=len(duty.segments),
        segments=segments,
        min_performance=duty_timeline.min_performance,
        avg_performance=duty_timeline.average_performance,
        landing_performance=duty_timeline.landing_performance,
        sleep_debt=duty_timeline.cumulative_sleep_debt,
        wocl_hours=duty_timeline.wocl_encroachment_hours,
        prior_sleep=duty_timeline.prior_sleep_hours,
        pre_duty_awake_hours=duty_timeline.pre_duty_awake_hours,
        risk_level=risk,
        is_reportable=(risk in ["critical", "extreme"]),
        pinch_events=len(duty_timeline.pinch_events),
        max_fdp_hours=duty.max_fdp_hours,
        extended_fdp_hours=duty.extended_fdp_hours,
        used_discretion=duty.used_discretion,
        circadian_phase_shift=round(duty_timeline.circadian_phase_shift, 2),
        time_validation_warnings=time_warnings,
        sleep_quality=sleep_quality,
        # Augmented crew / ULR
        crew_composition=duty.crew_composition.value if hasattr(duty.crew_composition, 'value') else str(getattr(duty, 'crew_composition', 'standard')),
        rest_facility_class=duty.rest_facility_class.value if getattr(duty, 'rest_facility_class', None) else None,
        is_ulr=getattr(duty_timeline, 'is_ulr', False),
        acclimatization_state=duty_timeline.acclimatization_state.value if hasattr(getattr(duty_timeline, 'acclimatization_state', None), 'value') else str(getattr(duty_timeline, 'acclimatization_state', 'acclimatized')),
        ulr_compliance=ulr_compliance_dict,
        inflight_rest_blocks=inflight_blocks,
        return_to_deck_performance=getattr(duty_timeline, 'return_to_deck_performance', None),
    )


def _build_rest_days_sleep(sleep_strategies: dict) -> List[RestDaySleepResponse]:
    """
    Extract rest-day sleep AND post-duty layover sleep from sleep_strategies dict.

    Post-duty sleep (e.g., hotel rest after landing at 2AM) is included here
    so the frontend can display it in the chronogram even though it's technically
    not a "rest day" - it's recovery sleep after a duty.

    De-duplication: gap-fill `rest_YYYY-MM-DD` entries whose night is already
    covered by a ULR `ulr_pre_duty` strategy block for the same duty are
    suppressed.  Without this, the last 1-2 nights before a ULR departure
    appear twice (once as "recovery", once as "ulr_pre_duty"), producing
    overlapping sleep bars on the chronogram for those nights.
    """
    rest_days = []

    # Build the set of calendar days already covered by duty-keyed ULR
    # pre-duty strategies, so we can suppress gap-fill recovery entries
    # that overlap those days.
    #
    # We store every day touched by a ULR block (start_day AND end_day),
    # not just (start_day, start_hour), because the gap-fill may place
    # a layover hotel nap (e.g. GRU 05:00→13:00 DOH) on the same day
    # as the continuation (0:00→7:00) of a ULR overnight block, causing
    # a visual overlap even though the start hours differ.
    ulr_covered_days: set = set()          # calendar days touched by ULR blocks
    ulr_covered_nights: set = set()        # (start_day, start_hour) for exact-match
    for key, data in sleep_strategies.items():
        if not key.startswith('rest_') and data.get('strategy_type') == 'ulr_pre_duty':
            for blk in data.get('sleep_blocks', []):
                sd = blk.get('sleep_start_day')
                ed = blk.get('sleep_end_day')
                sh = blk.get('sleep_start_hour')
                if sd is not None:
                    ulr_covered_days.add(sd)
                if ed is not None:
                    ulr_covered_days.add(ed)
                if sd is not None and sh is not None:
                    ulr_covered_nights.add((sd, round(sh, 1)))

    # Include rest day sleep (rest_*), post-duty sleep (post_duty_*), AND
    # duty-keyed ULR pre-duty sleep (e.g. 'D20260116').  The ULR blocks are
    # stored per-duty so the frontend duties-loop path skips them (it can't
    # handle the multi-night aggregate correctly); emitting them here lets
    # the restDaysSleep path render each night individually.
    for key, data in sleep_strategies.items():
        is_ulr_duty_key = (
            not key.startswith('rest_')
            and not key.startswith('post_duty_')
            and data.get('strategy_type') == 'ulr_pre_duty'
        )
        if key.startswith('rest_') or key.startswith('post_duty_') or is_ulr_duty_key:
            # Extract date from key (rest_2024-01-15, post_duty_D001, or duty-ID)
            if key.startswith('rest_'):
                date_str = key.replace('rest_', '')
            else:
                # For post-duty and ULR duty keys: derive date from first sleep block
                blocks = data.get('sleep_blocks', [])
                if blocks and blocks[0].get('sleep_start_iso'):
                    # Extract date from ISO timestamp (YYYY-MM-DDTHH:mm...)
                    date_str = blocks[0]['sleep_start_iso'].split('T')[0]
                else:
                    continue  # Skip if no date info available

            # Suppress gap-fill recovery entries that would overlap a ULR pre-duty
            # block on the same calendar day.  We check both the exact night
            # match (23:00 start) and any day touched by a ULR block, because
            # layover hotel naps (e.g. GRU 05:00→13:00 DOH) can land on the
            # same day as a ULR block's continuation (0:00→7:00).
            if key.startswith('rest_'):
                blocks = data.get('sleep_blocks', [])
                if blocks:
                    sd = blocks[0].get('sleep_start_day')
                    ed = blocks[0].get('sleep_end_day')
                    sh = blocks[0].get('sleep_start_hour')
                    exact_match = (sd is not None and sh is not None
                                   and (sd, round(sh, 1)) in ulr_covered_nights)
                    day_overlap = (sd in ulr_covered_days or ed in ulr_covered_days)
                    if exact_match or day_overlap:
                        continue  # Already rendered by the ULR pre-duty strategy

            rest_days.append(RestDaySleepResponse(
                date=date_str,
                sleep_blocks=data.get('sleep_blocks', []),
                total_sleep_hours=data.get('total_sleep_hours', 0.0),
                effective_sleep_hours=data.get('effective_sleep_hours', 0.0),
                sleep_efficiency=data.get('sleep_efficiency', 0.0),
                strategy_type=data.get('strategy_type', 'recovery'),
                confidence=data.get('confidence', 0.0),
                # Scientific methodology — now always populated
                explanation=data.get('explanation'),
                confidence_basis=data.get('confidence_basis'),
                quality_factors=data.get('quality_factors'),
                references=data.get('references', []),
                # Recovery context
                recovery_night_number=data.get('recovery_night_number'),
                cumulative_recovery_fraction=data.get('cumulative_recovery_fraction'),
            ))
    return rest_days


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "service": "Fatigue Analysis API",
        "version": "4.2.0",
        "model": "Borbély Two-Process + Workload Integration"
    }


@app.get("/debug/timezone-test")
async def timezone_test():
    """Debug endpoint to test timezone conversions"""
    import pytz
    from datetime import datetime

    # Test case from screenshot: CCJ → DOH
    dep_utc_str = "2026-02-01T22:25:00Z"
    arr_utc_str = "2026-02-01T02:55:00Z"

    dep_utc = datetime.fromisoformat(dep_utc_str.replace('Z', '+00:00'))
    arr_utc = datetime.fromisoformat(arr_utc_str.replace('Z', '+00:00'))

    # Convert to different timezones
    india_tz = pytz.timezone("Asia/Kolkata")
    qatar_tz = pytz.timezone("Asia/Qatar")

    return {
        "departure_utc": dep_utc_str,
        "arrival_utc": arr_utc_str,
        "conversions": {
            "departure_india": dep_utc.astimezone(india_tz).strftime("%H:%M"),
            "departure_qatar": dep_utc.astimezone(qatar_tz).strftime("%H:%M"),
            "arrival_india": arr_utc.astimezone(india_tz).strftime("%H:%M"),
            "arrival_qatar": arr_utc.astimezone(qatar_tz).strftime("%H:%M"),
        },
        "expected_for_home_base_chronogram": {
            "departure": "01:25 (Qatar time)",
            "arrival": "05:55 (Qatar time)"
        },
        "what_screenshot_shows": {
            "departure": "03:55 (India time - WRONG)",
            "arrival": "08:25 (India time - WRONG)"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_roster(
    file: UploadFile = File(...),
    pilot_id: str = Form("P12345"),
    month: str = Form("2026-02"),
    home_base: str = Form("DOH"),
    home_timezone: str = Form("Asia/Qatar"),
    config_preset: str = Form("default"),
    timezone_format: str = Form("auto"),
    crew_set: str = Form("crew_b"),
    duty_crew_overrides: str = Form("{}")
):
    """
    Upload roster file and get fatigue analysis
    
    Returns complete analysis with duty-by-duty breakdown
    """
    
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Save uploaded file
        suffix = Path(file.filename).suffix.lower()
        if suffix not in ['.pdf', '.csv']:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use PDF or CSV.")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Validate timezone_format parameter
            valid_tz_formats = ('auto', 'local', 'homebase', 'zulu')
            if timezone_format.lower() not in valid_tz_formats:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timezone_format '{timezone_format}'. Must be one of: {', '.join(valid_tz_formats)}"
                )

            # Parse roster
            if suffix == '.pdf':
                parser = PDFRosterParser(
                    home_base=home_base,
                    home_timezone=home_timezone,
                    timezone_format=timezone_format.lower()
                )
                roster = parser.parse_pdf(tmp_path, pilot_id, month)
            else:  # CSV
                parser = CSVRosterParser(
                    home_base=home_base,
                    home_timezone=home_timezone
                )
                roster = parser.parse_csv(tmp_path, pilot_id, month)
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
        
        # Validate roster
        if not roster.duties:
            raise HTTPException(status_code=400, detail="No duties found in roster")

        # Set crew set for ULR duties (Crew A or Crew B) with per-duty override support
        import json
        from models.data_models import ULRCrewSet

        # Parse per-duty crew overrides
        overrides_dict = {}
        try:
            overrides_dict = json.loads(duty_crew_overrides) if duty_crew_overrides else {}
        except (json.JSONDecodeError, TypeError):
            logger.warning("Invalid duty_crew_overrides JSON, using global setting")

        # Apply crew set to each duty (with per-duty override support)
        valid_crew_sets = {'crew_a': ULRCrewSet.CREW_A, 'crew_b': ULRCrewSet.CREW_B}

        for d in roster.duties:
            if hasattr(d, 'ulr_crew_set'):
                # Priority: duty-specific override > global setting
                crew_set_key = overrides_dict.get(d.duty_id, crew_set.lower())
                d.ulr_crew_set = valid_crew_sets.get(crew_set_key, ULRCrewSet.CREW_B)
        
        # Get config
        config_map = {
            "default": ModelConfig.default_easa_config,
            "conservative": ModelConfig.conservative_config,
            "liberal": ModelConfig.liberal_config,
            "research": ModelConfig.research_config
        }
        config_func = config_map.get(config_preset, ModelConfig.default_easa_config)
        config = config_func()
        
        # Run analysis
        model = BorbelyFatigueModel(config)
        monthly_analysis = model.simulate_roster(roster)
        
        # Generate analysis ID
        analysis_id = f"{pilot_id}_{month}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Store for later retrieval (include sleep_strategies for GET endpoint)
        analysis_store[analysis_id] = (monthly_analysis, roster, model.sleep_strategies)
        
        # Build response using shared helper
        duties_response = []
        for duty_timeline in monthly_analysis.duty_timelines:
            duty_idx = roster.get_duty_index(duty_timeline.duty_id)
            if duty_idx is None:
                continue
            duties_response.append(
                _build_duty_response(duty_timeline, roster.duties[duty_idx], roster)
            )

        rest_days_sleep = _build_rest_days_sleep(model.sleep_strategies)
        
        # Get effective timezone format (what the parser actually used)
        effective_tz_format = getattr(parser, 'effective_timezone_format', timezone_format)

        return AnalysisResponse(
            analysis_id=analysis_id,
            roster_id=roster.roster_id,
            pilot_id=roster.pilot_id,
            pilot_name=roster.pilot_name,
            pilot_base=roster.pilot_base,
            pilot_aircraft=roster.pilot_aircraft,
            home_base_timezone=roster.home_base_timezone,
            timezone_format=effective_tz_format,
            month=roster.month,
            total_duties=roster.total_duties,
            total_sectors=roster.total_sectors,
            total_duty_hours=roster.total_duty_hours,
            total_block_hours=roster.total_block_hours,
            high_risk_duties=monthly_analysis.high_risk_duties,
            critical_risk_duties=monthly_analysis.critical_risk_duties,
            total_pinch_events=monthly_analysis.total_pinch_events,
            avg_sleep_per_night=monthly_analysis.average_sleep_per_night,
            max_sleep_debt=monthly_analysis.max_sleep_debt,
            worst_duty_id=monthly_analysis.lowest_performance_duty,
            worst_performance=monthly_analysis.lowest_performance_value,
            duties=duties_response,
            rest_days_sleep=rest_days_sleep,
            body_clock_timeline=[
                {'timestamp_utc': ts, 'phase_shift_hours': ps, 'reference_timezone': tz}
                for ts, ps, tz in monthly_analysis.body_clock_timeline
            ],
            total_ulr_duties=getattr(monthly_analysis, 'total_ulr_duties', 0),
            total_augmented_duties=getattr(monthly_analysis, 'total_augmented_duties', 0),
            ulr_violations=getattr(monthly_analysis, 'ulr_violations', []),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/api/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Retrieve stored analysis by ID"""

    if analysis_id not in analysis_store:
        raise HTTPException(status_code=404, detail="Analysis not found")

    monthly_analysis, roster, sleep_strategies = analysis_store[analysis_id]

    # Build duties response using shared helper
    duties_response = []
    for duty_timeline in monthly_analysis.duty_timelines:
        duty_idx = roster.get_duty_index(duty_timeline.duty_id)
        if duty_idx is None:
            continue
        duties_response.append(
            _build_duty_response(duty_timeline, roster.duties[duty_idx], roster)
        )

    rest_days_sleep = _build_rest_days_sleep(sleep_strategies)

    return AnalysisResponse(
        analysis_id=analysis_id,
        roster_id=roster.roster_id,
        pilot_id=roster.pilot_id,
        pilot_name=roster.pilot_name,
        pilot_base=roster.pilot_base,
        pilot_aircraft=roster.pilot_aircraft,
        home_base_timezone=roster.home_base_timezone,
        month=roster.month,
        total_duties=roster.total_duties,
        total_sectors=roster.total_sectors,
        total_duty_hours=roster.total_duty_hours,
        total_block_hours=roster.total_block_hours,
        high_risk_duties=monthly_analysis.high_risk_duties,
        critical_risk_duties=monthly_analysis.critical_risk_duties,
        total_pinch_events=monthly_analysis.total_pinch_events,
        avg_sleep_per_night=monthly_analysis.average_sleep_per_night,
        max_sleep_debt=monthly_analysis.max_sleep_debt,
        worst_duty_id=monthly_analysis.lowest_performance_duty,
        worst_performance=monthly_analysis.lowest_performance_value,
        duties=duties_response,
        rest_days_sleep=rest_days_sleep,
        body_clock_timeline=[
            {'timestamp_utc': ts, 'phase_shift_hours': ps, 'reference_timezone': tz}
            for ts, ps, tz in monthly_analysis.body_clock_timeline
        ],
        total_ulr_duties=getattr(monthly_analysis, 'total_ulr_duties', 0),
        total_augmented_duties=getattr(monthly_analysis, 'total_augmented_duties', 0),
        ulr_violations=getattr(monthly_analysis, 'ulr_violations', []),
    )


@app.get("/api/duty/{analysis_id}/{duty_id}")
async def get_duty_detail(analysis_id: str, duty_id: str):
    """
    Get detailed timeline data for a single duty
    Returns all performance points for interactive charting
    """
    
    if analysis_id not in analysis_store:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    monthly_analysis, roster, _sleep_strategies = analysis_store[analysis_id]

    # Find duty
    duty_timeline = None
    for dt in monthly_analysis.duty_timelines:
        if dt.duty_id == duty_id:
            duty_timeline = dt
            break
    
    if not duty_timeline:
        raise HTTPException(status_code=404, detail="Duty not found")
    
    # Build timeline data for frontend charting
    timeline_data = []
    
    for point in duty_timeline.timeline:
        timeline_data.append({
            "timestamp": point.timestamp_utc.isoformat(),
            "timestamp_local": point.timestamp_local.isoformat(),
            "performance": point.raw_performance,
            "sleep_pressure": point.homeostatic_component,
            "circadian": point.circadian_component,
            # Factor form: 1.0 = no effect, <1.0 = degradation.
            # The frontend displays (factor - 1.0) * 100 as a percentage.
            "sleep_inertia": 1.0 - point.sleep_inertia_component,
            "hours_on_duty": point.hours_on_duty,
            "time_on_task_penalty": 1.0 - point.time_on_task_penalty,
            "flight_phase": point.current_flight_phase.value if point.current_flight_phase else None,
            "is_critical": point.is_critical_phase,
            "is_in_rest": getattr(point, 'is_in_rest', False),
        })

    return {
        "duty_id": duty_id,
        "timeline": timeline_data,
        "summary": {
            "min_performance": duty_timeline.min_performance,
            "avg_performance": duty_timeline.average_performance,
            "landing_performance": duty_timeline.landing_performance,
            "wocl_hours": duty_timeline.wocl_encroachment_hours,
            "prior_sleep": duty_timeline.prior_sleep_hours,
            "pre_duty_awake_hours": duty_timeline.pre_duty_awake_hours,
            "sleep_debt": duty_timeline.cumulative_sleep_debt
        },
        "pinch_events": [
            {
                "timestamp": pe.timestamp_utc.isoformat(),
                "performance": pe.performance_value,
                "phase": pe.flight_phase.value if pe.flight_phase else None,
                "cause": pe.cause
            }
            for pe in duty_timeline.pinch_events
        ]
    }


@app.get("/api/statistics/{analysis_id}")
async def get_statistics(analysis_id: str):
    """Get summary statistics for frontend dashboard"""
    
    if analysis_id not in analysis_store:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    monthly_analysis, roster, _sleep_strategies = analysis_store[analysis_id]

    # Calculate additional statistics
    all_perfs = [dt.landing_performance for dt in monthly_analysis.duty_timelines 
                 if dt.landing_performance is not None]
    
    return {
        "analysis_id": analysis_id,
        "summary": {
            "total_duties": roster.total_duties,
            "total_sectors": roster.total_sectors,
            "total_duty_hours": roster.total_duty_hours,
            "total_block_hours": roster.total_block_hours,
        },
        "risk": {
            "high_risk_duties": monthly_analysis.high_risk_duties,
            "critical_risk_duties": monthly_analysis.critical_risk_duties,
            "total_pinch_events": monthly_analysis.total_pinch_events,
        },
        "performance": {
            "average_landing_performance": sum(all_perfs) / len(all_perfs) if all_perfs else None,
            "min_landing_performance": min(all_perfs) if all_perfs else None,
            "max_landing_performance": max(all_perfs) if all_perfs else None,
            "worst_duty_id": monthly_analysis.lowest_performance_duty,
            "worst_performance": monthly_analysis.lowest_performance_value,
        },
        "sleep": {
            "avg_sleep_per_night": monthly_analysis.average_sleep_per_night,
            "max_sleep_debt": monthly_analysis.max_sleep_debt,
        }
    }


# ============================================================================
# AIRPORT DATABASE ENDPOINTS
# ============================================================================

@app.get("/api/airports/{iata_code}", response_model=AirportResponse)
async def get_airport(iata_code: str):
    """
    Look up airport by IATA code from backend's ~7,800 airport database.

    Returns timezone (IANA), coordinates, and current UTC offset.
    This eliminates the need for the frontend to maintain its own airport database.
    """
    import pytz

    airport = AirportDatabase.get_airport(iata_code)

    # Calculate current UTC offset (DST-aware)
    try:
        tz = pytz.timezone(airport.timezone)
        now = datetime.now(pytz.utc)
        utc_offset = tz.utcoffset(now).total_seconds() / 3600
    except Exception:
        utc_offset = None

    return AirportResponse(
        code=airport.code,
        timezone=airport.timezone,
        utc_offset_hours=utc_offset,
        latitude=airport.latitude,
        longitude=airport.longitude,
    )


class BatchAirportRequest(BaseModel):
    codes: List[str]  # List of IATA codes


@app.post("/api/airports/batch", response_model=List[AirportResponse])
async def get_airports_batch(request: BatchAirportRequest):
    """
    Batch lookup for multiple airports.

    Accepts up to 50 IATA codes and returns timezone + coordinate data for each.
    Use this to populate the frontend's airport data for a whole roster in one call.
    """
    import pytz

    if len(request.codes) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 airports per batch request")

    now = datetime.now(pytz.utc)
    results = []

    for code in request.codes:
        airport = AirportDatabase.get_airport(code)
        try:
            tz = pytz.timezone(airport.timezone)
            utc_offset = tz.utcoffset(now).total_seconds() / 3600
        except Exception:
            utc_offset = None

        results.append(AirportResponse(
            code=airport.code,
            timezone=airport.timezone,
            utc_offset_hours=utc_offset,
            latitude=airport.latitude,
            longitude=airport.longitude,
        ))

    return results


@app.get("/api/airports/search")
async def search_airports(q: str = Query(..., min_length=2, max_length=10)):
    """
    Search airports by IATA code prefix.

    Returns matching airports from the ~7,800 airport database.
    Useful for autocomplete in the frontend.
    """
    import airportsdata

    _db = airportsdata.load('IATA')
    q_upper = q.upper()
    matches = []

    for code, entry in _db.items():
        if code.startswith(q_upper):
            matches.append({
                "code": entry['iata'],
                "name": entry.get('name', ''),
                "city": entry.get('city', ''),
                "country": entry.get('country', ''),
                "timezone": entry['tz'],
                "latitude": entry['lat'],
                "longitude": entry['lon'],
            })
        if len(matches) >= 20:
            break

    return {"results": matches, "total": len(matches)}


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    # Use Railway's PORT env var or default to 8000 for local dev
    port = int(os.environ.get("PORT", 8000))
    
    print("=" * 70)
    print("FATIGUE ANALYSIS API SERVER")
    print("=" * 70)
    print()
    print("Starting FastAPI server...")
    print(f"API will be available at: http://localhost:{port}")
    print(f"API docs at: http://localhost:{port}/docs")
    print()
    print("Frontend can now connect to:")
    print(f"  POST http://localhost:{port}/api/analyze")
    print(f"  POST http://localhost:{port}/api/visualize/chronogram")
    print(f"  GET  http://localhost:{port}/api/duty/{{analysis_id}}/{{duty_id}}")
    print()
    
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
