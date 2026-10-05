"""
api_server.py - FastAPI Backend for Fatigue Analysis Tool
==========================================================

RESTful API exposing your Python fatigue model to frontend.

Endpoints:
- POST /api/analyze - Upload roster, get analysis
- GET /api/analysis/{id} - Get stored analysis
- GET /api/duty/{analysis_id}/{duty_id} - Detailed duty timeline
- POST /api/auth/* - Authentication (register, login, refresh, profile)
- GET /api/rosters - List user's saved rosters
- DELETE /api/rosters/{id} - Delete a saved roster

Usage:
    uvicorn api_server:app --reload --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
import math
import tempfile
import os
import json
import logging
from datetime import datetime
from uuid import UUID, uuid4
from pathlib import Path

logger = logging.getLogger(__name__)

# Import your fatigue model
from core import BorbelyFatigueModel, ModelConfig, RiskThresholds
from core.alertness import ENGINE_VERSION, KSS_ENGINE_VERSIONS, is_kss_engine, classify_kss, round_half_up
from core.easa_checks import augmentation_likely
from parsers.roster_parser import PDFRosterParser, CSVRosterParser, AirportDatabase
from models.data_models import MonthlyAnalysis, DutyTimeline, CrewComposition, RestFacilityClass, ULRCrewSet, DutyType

# Database & Auth imports
from db.session import init_db, get_db, is_db_available
from db.models import User, Roster, Analysis, FatigueState
from db.continuity import save_fatigue_state
from auth.routes import auth_router
from auth.dependencies import get_optional_user
from api.analysis_access import (analysis_store, analysis_principal, Principal, remember,
                                 authorize, load as load_analysis, evict_roster)
from api.replay import snapshot, restore
from core.sleep_edits import normalise as normalise_sleep_edits
from api.hardening import read_upload, run_compute
from admin.routes import admin_router
from company.routes import router as company_router
from company.detection import detect_airline, extract_fleet_and_role


# ============================================================================
# FASTAPI APP INITIALIZATION
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    await init_db()
    yield

app = FastAPI(
    title="Fatigue Analysis API",
    description="Fatigue estimates and scoped FTL checks; not an operational fitness determination",
    version="5.0.0",
    lifespan=lifespan,
)

# Include auth + admin + company + metrics routes
from study.routes import router as pilot_study_router
app.include_router(pilot_study_router)
from study.debriefs import router as debrief_router
app.include_router(debrief_router)
from study.inflight import router as inflight_router
app.include_router(inflight_router)
app.include_router(auth_router)
from auth.account import router as account_router
app.include_router(account_router)
from api.preview import router as preview_router
app.include_router(preview_router)
app.include_router(admin_router)
app.include_router(company_router)

from metrics.routes import router as metrics_router
app.include_router(metrics_router)

from reports.routes import router as fatigue_report_router
app.include_router(fatigue_report_router)

# CORS - Allow Aerowake frontend origins
# Production origins loaded from CORS_ORIGINS env var (comma-separated)
# e.g. CORS_ORIGINS=https://aerowake.vercel.app,https://aerowake.com
_cors_env = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
ALLOWED_ORIGINS += [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

from api.hardening import RateLimitMiddleware as _RateLimit
app.add_middleware(_RateLimit)
from api.hardening import RequestBodyLimit, RequestTelemetry
app.add_middleware(RequestBodyLimit)
app.add_middleware(RequestTelemetry)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler — catch unhandled errors and return JSON, not plain text
@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    logger.warning('Unhandled error on  ')
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please retry later."},
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
    name: Optional[str] = None      # Airport name (airportsdata)
    city: Optional[str] = None
    country: Optional[str] = None   # ISO 3166-1 alpha-2


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
    # UTC precomputed day/hour for UTC chronogram rendering
    departure_time_utc: str = ""      # HH:mm in UTC
    arrival_time_utc: str = ""        # HH:mm in UTC
    departure_day_utc: Optional[int] = None   # day of month in UTC
    departure_hour_utc: Optional[float] = None  # decimal hour in UTC (0-24)
    arrival_day_utc: Optional[int] = None     # day of month in UTC
    arrival_hour_utc: Optional[float] = None    # decimal hour in UTC (0-24)
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
    # Line training annotations (X, U, UL, L, E, ZFT) — metadata only
    line_training_codes: Optional[List[str]] = None
    # Per-segment aircraft type from PDF trailing tokens (e.g. "351", "359", "77W")
    aircraft_type: Optional[str] = None
    # Model sleepiness for this sector, from the duty timeline (engine 4.1).
    # None when the timeline has no awake point inside the sector.
    kss_peak: Optional[float] = None         # max predicted KSS, off-blocks → on-blocks
    kss_at_arrival: Optional[float] = None   # predicted KSS at on-blocks
    risk_level: Optional[str] = None         # band of kss_peak (KSS rounded to 0.1)


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

    # UTC precomputed day/hour for UTC chronogram rendering
    sleep_start_day_utc: Optional[int] = None     # day of month in UTC
    sleep_start_hour_utc: Optional[float] = None   # decimal hour in UTC (0-24)
    sleep_end_day_utc: Optional[int] = None        # day of month in UTC
    sleep_end_hour_utc: Optional[float] = None      # decimal hour in UTC (0-24)
    sleep_start_time_utc: Optional[str] = None     # HH:mm in UTC
    sleep_end_time_utc: Optional[str] = None       # HH:mm in UTC

    # Per-block quality factor breakdown (populated for all sleep types)
    quality_factors: Optional[QualityFactorsResponse] = None
    # Why this block is there (plain language with its published basis); None =
    # the entry's strategy explanation covers it.
    basis: Optional[str] = None
    # 'estimated' (model) or 'pilot' (set or added by the pilot: planned, not reported).
    source: str = 'estimated'


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

    # UTC precomputed day/hour for UTC chronogram rendering (full sleep window span)
    sleep_start_day_utc: Optional[int] = None     # day of month in UTC
    sleep_start_hour_utc: Optional[float] = None   # decimal hour in UTC (0-24)
    sleep_end_day_utc: Optional[int] = None        # day of month in UTC
    sleep_end_hour_utc: Optional[float] = None      # decimal hour in UTC (0-24)
    sleep_start_time_utc: Optional[str] = None     # HH:mm in UTC
    sleep_end_time_utc: Optional[str] = None       # HH:mm in UTC

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
    is_user_override: bool = False                 # includes sleep the pilot set or removed


class DutyResponse(BaseModel):
    peak_duty_risk: str = "unknown"
    landing_risk: str = "unknown"

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
    # UTC precomputed day/hour for UTC chronogram rendering
    report_time_hhmm_utc: Optional[str] = None   # HH:MM in UTC
    release_time_hhmm_utc: Optional[str] = None   # HH:MM in UTC
    report_day_utc: Optional[int] = None           # day of month in UTC
    report_hour_utc: Optional[float] = None        # decimal hour in UTC (0-24)
    release_day_utc: Optional[int] = None          # day of month in UTC
    release_hour_utc: Optional[float] = None       # decimal hour in UTC (0-24)
    duty_hours: float
    sectors: int
    segments: List[DutySegmentResponse]

    # Duty type classification
    duty_type: str = "flight"  # "flight", "simulator", "ground_training"
    training_code: Optional[str] = None  # Raw activity code: "OPTR", "FFS", "EBTGR", etc.
    training_annotations: Optional[List[str]] = None  # Trailing codes: ["ea"], ["aw","lpc","rh"]
    training_legend: Optional[Dict[str, str]] = None  # code -> meaning from the roster's own legend
    
    # Performance metrics
    min_performance: float
    avg_performance: float
    landing_performance: Optional[float]
    
    # Fatigue metrics
    # Deprecated for pilot-facing use: internal exponential debt ledger that
    # drives recovery-sleep length. Pilot-facing cumulative restriction is
    # sleep_deficit_7d (one ledger, one set of bands).
    sleep_debt: float  # deprecated for pilot-facing use (see comment above)
    wocl_hours: float
    prior_sleep: float                 # estimated sleep in the 24 h before report
    pre_duty_awake_hours: float = 0.0  # hours awake before report

    # KSS-anchored alertness (engine aerowake-4.1-kss)
    risk_reasons: List[str] = []                  # up to 3 plain-language reasons
    max_kss: Optional[float] = None               # headline peak KSS (window: headline_window)
    peak_time_utc: Optional[str] = None           # when the headline peak occurs (ISO)
    headline_window: str = "fdp"                  # 'fdp' (report → last on-blocks) | 'duty'
    kss_peak_fdp: Optional[float] = None          # peak, report → last operating on-blocks
    kss_peak_duty: Optional[float] = None         # peak, report → release
    kss_at_release: Optional[float] = None        # predicted KSS at release
    assumed_nap_hours: Optional[float] = None     # pre-duty nap assumed by the sleep estimate
    acclimatization_basis: Optional[str] = None   # 'determined' | 'unknown' (ORO.FTL.105(1))
    landing_kss: Optional[float] = None
    max_kss_90: Optional[float] = None            # 90th-percentile pilot
    max_p_severe_sleepiness: Optional[float] = None  # P(KSS >= 7)
    max_hours_awake: Optional[float] = None
    sleep_deficit_7d: Optional[dict] = None       # rolling cumulative restriction ledger

    # Risk
    risk_thresholds: Optional[dict] = None
    model_version: Optional[str] = None
    model_parameters: Optional[dict] = None
    risk_basis: str = "peak_kss_fdp"  # peak_kss_fdp | peak_kss_duty (headline window)
    risk_level: str  # "low", "moderate", "high", "critical", "extreme"
    is_reportable: bool  # Deprecated — use risk_advisory instead
    risk_advisory: str = "monitor"  # "routine", "monitor", "consider_reporting", "report_recommended"
    pinch_events: int
    
    # EASA FDP limits
    max_fdp_hours: Optional[float]  # Base FDP limit
    extended_fdp_hours: Optional[float]  # With captain discretion
    planned_extension_fdp_hours: Optional[float] = None  # OM-A 7.6.5 Table 7-8 (None = not allowed)
    fdp_limit_reference: Optional[str] = None  # OM-A paragraph/table of max_fdp_hours
    used_discretion: bool  # True if exceeded base limit
    actual_fdp_hours: Optional[float] = None  # Actual FDP (report to last landing + 30min)
    
    # Circadian adaptation state at duty report time
    circadian_phase_shift: Optional[float] = None  # Hours offset from home base body clock

    # Enhanced sleep quality analysis
    sleep_quality: Optional[SleepQualityResponse] = None

    # Validation warnings (NEW - BUG FIX #5)
    time_validation_warnings: List[str] = []

    # Cabin environment
    cabin_altitude_ft: Optional[float] = None  # Inferred cabin altitude from aircraft type (ft)
    aircraft_type: Optional[str] = None  # Aircraft type for cabin altitude inference (e.g. "A320")

    # Worst-point S/C/W decomposition (for immediate PerformanceSummaryCard rendering)
    worst_point: Optional[dict] = None  # {performance, sleep_pressure, circadian, sleep_inertia, time_on_task_penalty, hours_on_duty}

    # Augmented crew / ULR data
    crew_composition: str = "standard"
    rest_facility_class: Optional[str] = None
    is_ulr: bool = False
    ulr_crew_set: Optional[str] = None  # "crew_a" | "crew_b" — parser-detected or overridden
    # 2-pilot duty above the basic FDP maximum with a long sector, crew not stated:
    # probably augmented; the pilot is asked to set the crew (easa_checks.augmentation_likely).
    augmentation_suggested: bool = False
    # Where the crew size comes from: 'roster_ir' (IR sector), 'fdp' (inferred from the
    # planned FDP, core/crew_inference.py), 'pilot' (override), None = 2 pilots by default.
    crew_source: Optional[str] = None
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
    is_user_override: bool = False

    # Recovery context (for recovery strategy_type)
    recovery_night_number: Optional[int] = None           # Which recovery night (1-indexed)
    cumulative_recovery_fraction: Optional[float] = None  # 0-1 fraction of debt recovered


class AnalysisResponse(BaseModel):
    persistence_status: str = "session_only"

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
    avg_sleep_per_night: float            # estimated sleep per 24 h over sleep_coverage_days
    sleep_coverage_days: Optional[float] = None  # days of the month with sleep estimates
    max_sleep_debt: float                 # deprecated for pilot-facing use (internal ledger)
    average_sleep_debt: float = 0.0       # deprecated for pilot-facing use (internal ledger)
    # Stated assumptions of this analysis: {nap_habit, headline_risk_window}
    assumptions: Optional[dict] = None
    engine_version: Optional[str] = None

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

    # Company detection (included only on first upload when user has no company)
    company_detection: Optional[dict] = None

    # Roster verdict (engine aerowake-4.1-kss)
    duties_to_watch: List[str] = []        # duty_ids at high risk or worse, worst first
    easa_findings: List[dict] = []         # ORO.FTL.210 / .235 / .205 roster checks
    easa_summary: Optional[dict] = None    # rolling duty / block totals vs limits
    standby_periods: List[dict] = []       # home standby (not scored; 25% duty)
    alertness_timeline: List[dict] = []    # predicted KSS through the month: {t, kss, asleep, on_duty}

    # Fatigue continuity (multi-roster chaining)
    continuity_from_month: Optional[str] = None   # "2026-01" if prior state was injected
    initial_conditions: Optional[dict] = None      # {process_s, sleep_debt, circadian_phase_shift}
    # Pilot sleep changes stored with this analysis, each with ``applied``.
    sleep_edits: List[dict] = []



# ============================================================================
# IN-MEMORY STORAGE (Replace with database in production)
# ============================================================================

from api.hardening import BoundedStore, RateLimitMiddleware, validate_upload




# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _model_config(nap_habit: Optional[str] = None, stored: Optional[dict] = None,
                  usual_bedtime: Optional[str] = None, usual_wake_time: Optional[str] = None) -> ModelConfig:
    """The single model with the analysis's stated assumptions.

    Each of the nap habit, usual bedtime and usual wake-up comes from the
    request; otherwise from the assumptions stored with the analysis inputs (or
    the pilot's saved preferences, passed as ``stored``); otherwise the default.
    """
    from core.parameters import NAP_HABITS
    stored = stored or {}
    habit = (nap_habit or '').strip().lower() or stored.get('nap_habit') or None
    if habit is not None and habit not in NAP_HABITS:
        raise HTTPException(422, f"nap_habit must be one of: {', '.join(NAP_HABITS)}")
    try:
        return ModelConfig.aerowake(
            nap_habit=habit,
            usual_bedtime=(usual_bedtime or '').strip() or stored.get('usual_bedtime') or None,
            usual_wake_time=(usual_wake_time or '').strip() or stored.get('usual_wake_time') or None)
    except ValueError as exc:
        raise HTTPException(422, str(exc))


def classify_risk(performance: Optional[float], thresholds=None) -> str:
    return RiskThresholds(thresholds=thresholds).classify(performance) if thresholds else RiskThresholds().classify(performance)


def _build_segments(duty, home_tz, segment_kss: Optional[list] = None) -> list:
    """Serialize flight segments with timezone conversions.

    ``segment_kss`` (DutyTimeline.segment_kss) carries the model's per-sector
    peak and on-blocks KSS; the API never interpolates sector values.
    """
    import pytz

    segment_kss = segment_kss or []
    segments = []
    for index, seg in enumerate(duty.segments):
        kss = segment_kss[index] if index < len(segment_kss) else {}
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

        dep_utc_z = dep_utc.astimezone(pytz.utc)
        arr_utc_z = arr_utc.astimezone(pytz.utc)

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
            # UTC precomputed day/hour for UTC chronogram rendering
            departure_time_utc=dep_utc_z.strftime("%H:%M"),
            arrival_time_utc=arr_utc_z.strftime("%H:%M"),
            departure_day_utc=dep_utc_z.day,
            departure_hour_utc=dep_utc_z.hour + dep_utc_z.minute / 60.0,
            arrival_day_utc=arr_utc_z.day,
            arrival_hour_utc=arr_utc_z.hour + arr_utc_z.minute / 60.0,
            departure_time_airport_local=dep_airport_local.strftime("%H:%M"),
            arrival_time_airport_local=arr_airport_local.strftime("%H:%M"),
            departure_timezone=seg.departure_airport.timezone,
            arrival_timezone=seg.arrival_airport.timezone,
            departure_utc_offset=dep_utc_offset,
            arrival_utc_offset=arr_utc_offset,
            block_hours=seg.block_time_hours,
            activity_code=getattr(seg, 'activity_code', None),
            is_deadhead=getattr(seg, 'is_deadhead', False),
            line_training_codes=getattr(seg, 'line_training_codes', None),
            aircraft_type=getattr(seg, 'aircraft_type', None),
            kss_peak=_round_opt(kss.get('kss_peak')),
            kss_at_arrival=_round_opt(kss.get('kss_at_arrival')),
            risk_level=classify_kss(kss['kss_peak']) if kss.get('kss_peak') is not None else None,
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

    ``sleep_blocks`` lists every modelled block attributed to this duty (the
    last main sleep before report and any pre-duty nap). The top-level
    start/end fields describe the last main sleep — the block the what-if
    editor adjusts — not the span of all blocks.
    """
    if not duty_timeline.sleep_quality_data:
        return None

    sqd = duty_timeline.sleep_quality_data
    blocks = sqd.get('sleep_blocks', [])

    mains = [b for b in blocks if b.get('sleep_type') == 'main']
    earliest = latest = (mains[-1] if mains else (blocks[-1] if blocks else {}))

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
        is_user_override=bool(sqd.get('is_user_override')),
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
        # UTC precomputed day/hour for UTC chronogram rendering
        sleep_start_day_utc=earliest.get('sleep_start_day_utc'),
        sleep_start_hour_utc=earliest.get('sleep_start_hour_utc'),
        sleep_end_day_utc=latest.get('sleep_end_day_utc'),
        sleep_end_hour_utc=latest.get('sleep_end_hour_utc'),
        sleep_start_time_utc=earliest.get('sleep_start_time_utc'),
        sleep_end_time_utc=latest.get('sleep_end_time_utc'),
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

    # Every in-flight rest block the model scored is returned, so the pilot sees
    # the rest behind the number. `source` says where it comes from: 'roster_ir'
    # when the roster shows an IR (in-flight rest) sector, otherwise 'planned' —
    # the standard rotation from the rest planner (e.g. Crew A on the operating
    # leg of a 4-pilot ULR pair, or a 3-pilot crew), to be confirmed by the pilot.
    has_pdf_ir = getattr(duty, 'has_inflight_rest_segments', False)

    for i, block in enumerate(getattr(duty_timeline, 'inflight_rest_blocks', []) or []):
        period = rest_periods[i] if i < len(rest_periods) else None

        # Convert UTC block times to home-base TZ for chronogram positioning.
        # The frontend should use these pre-computed fields rather than doing
        # manual UTC→local arithmetic via departure segment offsets.
        start_utc = block.start_utc.astimezone(pytz.utc) if block.start_utc else None
        end_utc = block.end_utc.astimezone(pytz.utc) if block.end_utc else None
        start_home = start_utc.astimezone(home_tz) if start_utc else None
        end_home = end_utc.astimezone(home_tz) if end_utc else None

        inflight_blocks.append({
            # Raw UTC — canonical, unambiguous reference
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
            # UTC precomputed day/hour for UTC chronogram rendering
            'start_day_utc': start_utc.day if start_utc else None,
            'start_hour_utc': (start_utc.hour + start_utc.minute / 60.0) if start_utc else None,
            'end_day_utc': end_utc.day if end_utc else None,
            'end_hour_utc': (end_utc.hour + end_utc.minute / 60.0) if end_utc else None,
            'start_time_utc': start_utc.strftime('%H:%M') if start_utc else None,
            'end_time_utc': end_utc.strftime('%H:%M') if end_utc else None,
            # Quality metrics
            'duration_hours': block.duration_hours,
            'effective_sleep_hours': block.effective_sleep_hours,
            'quality_factor': block.quality_factor,
            'environment': block.environment,
            # ULR crew metadata
            'crew_member_id': period.crew_member_id if period else None,
            'crew_set': period.crew_set if period else None,
            'is_during_wocl': period.is_during_wocl if period else False,
            'source': 'roster_ir' if has_pdf_ir else 'planned',
            # Qatar FTL 7.18.11 figure when the rest comes from an approved city-pair plan.
            'approved_plan': (period.crew_member_id.split('_')[2]
                              if period and str(period.crew_member_id or '').startswith('qatar_fig_') else None),
        })
    return ulr_compliance_dict, inflight_blocks



RISK_ORDER = {'low': 0, 'moderate': 1, 'high': 2, 'critical': 3, 'extreme': 4, 'unknown': -1}


def _roster_insights(roster, duties_response) -> dict:
    """Roster-level verdict: duties to watch, EASA checks, standby periods."""
    import pytz
    from core.easa_checks import run_checks, HOME_STANDBY_FACTOR
    watch = [d for d in duties_response if RISK_ORDER.get(d.risk_level, 0) >= RISK_ORDER['high']]
    watch.sort(key=lambda d: (-(d.max_kss or 0), d.report_time_utc))
    try:
        easa = run_checks(roster)
    except Exception as exc:  # checks must never break the analysis
        logger.warning('EASA checks failed')
        easa = {'findings': [], 'summary': {'status': 'unavailable', 'coverage': {}}}
    home_tz = pytz.timezone(roster.home_base_timezone)
    standbys = []
    for s in getattr(roster, 'standbys', []):
        start, end = s.report_time_utc.astimezone(home_tz), s.release_time_utc.astimezone(home_tz)
        standbys.append({
            'id': s.duty_id, 'type': s.duty_type.value, 'code': s.training_code,
            'start_utc': s.report_time_utc.isoformat(), 'end_utc': s.release_time_utc.isoformat(),
            'start_home': start.strftime('%H:%M'), 'end_home': end.strftime('%H:%M'),
            'date': start.strftime('%Y-%m-%d'),
            'counted_duty_hours': round(s.duty_hours * HOME_STANDBY_FACTOR, 2),
        })
    return dict(duties_to_watch=[d.duty_id for d in watch], easa_findings=easa['findings'],
                easa_summary=easa['summary'], standby_periods=standbys,
                alertness_timeline=getattr(roster, 'alertness_timeline', []) or [],
                assumptions=getattr(roster, 'analysis_assumptions', None) or None,
                sleep_coverage_days=getattr(roster, 'sleep_coverage_days', None),
                sleep_edits=list(getattr(roster, 'sleep_edit_results', None) or []),
                engine_version=ENGINE_VERSION)


def _risk_reasons(duty_timeline, duty, roster) -> List[str]:
    """Up to three plain-language reasons behind a duty's predicted sleepiness.

    A duty rated High or above always gets at least one reason. When the sleep
    estimate assumes a pre-duty nap, its length is stated (it lowers the score).
    """
    import pytz
    home_tz = pytz.timezone(duty.home_base_timezone)
    shift = getattr(duty_timeline, 'circadian_phase_shift', 0.0) or 0.0
    reasons: List[tuple] = []

    def clock(dt):
        home = dt.astimezone(home_tz)
        body = (home.hour + home.minute / 60 + shift) % 24
        return home, body

    points = [p for p in duty_timeline.timeline if not p.is_in_rest]
    last_arrival = duty.segments[-1].scheduled_arrival_utc if duty.segments else None
    if last_arrival is not None:
        home, body = clock(last_arrival)
        if 2 <= body < 6:
            where = 'home-base time' if abs(shift) < 1 else f'home-base time ({int(body):02d}:{int(body % 1 * 60):02d} body clock)'
            reasons.append((5, f"Lands {home:%H:%M} {where}, during the body-clock low"))
    if not any(r[0] == 5 for r in reasons):
        low = [p for p in points if 2 <= clock(p.timestamp_utc)[1] < 6]
        if low:
            reasons.append((4, "On duty during the body-clock low (02:00–06:00)"))
    awake = duty_timeline.max_hours_awake
    if awake is not None and awake >= 16:
        reasons.append((4 if awake >= 18 else 3, f"About {awake:.0f}h awake by the end of the duty"))
    elif awake is not None and awake >= 14:
        late = [p for p in points if clock(p.timestamp_utc)[1] >= 23 or clock(p.timestamp_utc)[1] < 2]
        if late:
            reasons.append((3, f"Late finish after about {awake:.0f}h awake, as the body clock winds down for the night"))
    if duty_timeline.prior_sleep_hours is not None and duty_timeline.prior_sleep_hours < 6:
        reasons.append((3, f"Only about {duty_timeline.prior_sleep_hours:.1f}h estimated sleep in the 24h before report"))
    idx = roster.get_duty_index(duty.duty_id)
    if idx:
        prev = roster.duties[idx - 1]
        rest = (duty.report_time_utc - prev.release_time_utc).total_seconds() / 3600
        if rest < 12:
            reasons.append((3, f"Short rest before report ({int(rest)}h{int(rest % 1 * 60):02d})"))
    report = duty.report_time_utc.astimezone(home_tz)
    if 4 <= report.hour < 7:
        reasons.append((2, f"Early report ({report:%H:%M})"))
    deficit = getattr(duty_timeline, 'sleep_deficit_7d', None) or {}
    if deficit.get('band') in ('moderate', 'severe'):
        reasons.append((2, f"About {deficit['deficit_hours']:.0f}h sleep shortfall over the previous 7 days"))
    if duty.segments and len([s for s in duty.segments if not s.is_deadhead]) >= 4:
        reasons.append((1, f"{len(duty.segments)} sectors"))
    reasons.sort(key=lambda r: -r[0])

    risk = classify_kss(duty_timeline.max_kss) if duty_timeline.max_kss is not None else 'unknown'
    elevated = RISK_ORDER.get(risk, -1) >= RISK_ORDER['high']
    if elevated and not reasons:
        peak = getattr(duty_timeline, 'peak_time_utc', None)
        when = f" at {peak.astimezone(home_tz):%H:%M} home-base time" if peak else ''
        text = f"Predicted sleepiness peaks{when}"
        if awake is not None:
            text += f" after about {awake:.0f}h awake"
        reasons.append((1, text))
    texts = [text for _, text in reasons[:3]]
    nap = getattr(duty_timeline, 'assumed_nap_hours', None)
    if nap:
        note = f"Assumes a {round_half_up(nap, 1):.1f}h nap before report; without it the score would be higher"
        texts = texts[:2] + [note]
    elif awake is not None and awake >= 16 and 12 <= report.hour < 20:
        texts = [t + " — a 1–2h nap before report would reduce this" if t.startswith('About') and 'awake' in t else t
                 for t in texts]
    return texts

def _round_opt(value, digits=2):
    return None if value is None else round(value, digits)


def _apply_crew_overrides(roster, overrides: dict) -> None:
    """Per-duty crew overrides from the pilot, applied before simulation.

    A value is either a crew set ('crew_a' | 'crew_b') or an object
    {'composition': 'standard' | 'augmented_3' | 'augmented_4', 'crew_set': ...}.
    Crew A/B exist only with 4 pilots, so choosing a crew set without a composition
    makes the duty a 4-pilot crew of that set, whatever the roster or the FDP estimate
    said (a last-minute crew change). A composition other than 4 pilots ignores the set.
    Parser-detected values stay for duties without an override.
    """
    sets = {'crew_a': ULRCrewSet.CREW_A, 'crew_b': ULRCrewSet.CREW_B}
    comps = {'standard': CrewComposition.STANDARD, 'augmented_3': CrewComposition.AUGMENTED_3,
             'augmented_4': CrewComposition.AUGMENTED_4}
    for d in roster.duties:
        value = overrides.get(d.duty_id) if isinstance(overrides, dict) else None
        if value is None:
            continue
        if isinstance(value, str):
            value = {'crew_set': value}
        if not isinstance(value, dict):
            continue
        comp = comps.get(value.get('composition'))
        if comp is not None:
            d.crew_composition = comp
            d.crew_stated, d.crew_source = True, 'pilot'
            if comp == CrewComposition.STANDARD:
                d.is_ulr, d.ulr_crew_set, d.rest_facility_class = False, None, None
            elif d.rest_facility_class is None:
                d.rest_facility_class = RestFacilityClass.CLASS_1  # long-haul bunk, as the planner assumes
        crew_set = sets.get(value.get('crew_set'))
        if crew_set is not None:
            if comp is None and d.duty_type == DutyType.FLIGHT and d.segments:
                d.crew_composition = CrewComposition.AUGMENTED_4
                d.crew_stated, d.crew_source = True, 'pilot'
                d.rest_facility_class = d.rest_facility_class or RestFacilityClass.CLASS_1
            if d.crew_composition == CrewComposition.AUGMENTED_4:
                d.ulr_crew_set = crew_set


def _build_duty_response(duty_timeline, duty, roster) -> DutyResponse:
    """Shared serialization for a single duty — used by both POST and GET endpoints."""
    import pytz

    # Headline risk: band of the headline peak KSS, rounded to one decimal
    # (the value the client displays), lower bound inclusive.
    if duty_timeline.max_kss is not None:
        risk = classify_kss(duty_timeline.max_kss)
    else:
        risk = classify_risk(duty_timeline.min_performance, getattr(duty_timeline, "risk_thresholds", None))
    home_tz = pytz.timezone(duty.home_base_timezone)
    window = getattr(duty_timeline, 'headline_window', 'duty') or 'duty'
    peak_time = getattr(duty_timeline, 'peak_time_utc', None)

    segments = _build_segments(duty, home_tz, getattr(duty_timeline, 'segment_kss', None))
    time_warnings = _validate_duty_times(duty)
    sleep_quality = _build_sleep_quality(duty_timeline)
    ulr_compliance_dict, inflight_blocks = _build_ulr_data(duty_timeline, duty)

    # Infer cabin altitude from per-segment aircraft type (fall back to roster header)
    AIRCRAFT_CABIN_ALT = {
        'A350': 6000, 'A359': 6000, 'A35K': 6000, '351': 6000, '359': 6000,
        'A320': 7000, 'A321': 7000, 'A319': 7000, '320': 7000, '32Q': 7000, '321': 7000,
        '777': 7300, '77W': 7300, '77L': 7300,
        '787': 6000, '789': 6000, '78J': 6000,
        'A330': 6900, '330': 6900, '333': 6900, '339': 6900,
        'A380': 5000, '380': 5000, '388': 5000,
    }
    # 1. Prefer per-segment aircraft type (first operating segment)
    aircraft_type_str = None
    if duty.segments:
        for seg in duty.segments:
            if getattr(seg, 'aircraft_type', None) and not seg.is_deadhead and not seg.is_inflight_rest:
                aircraft_type_str = seg.aircraft_type
                break
        # Fall back to any segment with aircraft type
        if not aircraft_type_str:
            for seg in duty.segments:
                if getattr(seg, 'aircraft_type', None):
                    aircraft_type_str = seg.aircraft_type
                    break
    # 2. Final fallback: roster-level pilot_aircraft from PDF header
    if not aircraft_type_str and hasattr(roster, 'pilot_aircraft') and roster.pilot_aircraft:
        aircraft_type_str = roster.pilot_aircraft
    # 3. Resolve cabin altitude
    cabin_alt = None
    if aircraft_type_str:
        for key, alt in AIRCRAFT_CABIN_ALT.items():
            if key.upper() in aircraft_type_str.upper():
                cabin_alt = float(alt)
                break

    # Extract worst-point S/C/W decomposition for immediate frontend rendering
    worst_point_dict = None
    if duty_timeline.timeline:
        worst_pt = min((p for p in duty_timeline.timeline if not p.is_in_rest),
                       key=lambda p: p.raw_performance, default=duty_timeline.timeline[0])
        worst_point_dict = {
            "performance": worst_pt.raw_performance,
            "sleep_pressure": worst_pt.homeostatic_component,
            "circadian": worst_pt.circadian_component,
            "sleep_inertia": 1.0 - worst_pt.sleep_inertia_component,
            "time_on_task_penalty": 1.0 - worst_pt.time_on_task_penalty,
            "debt_penalty": worst_pt.debt_penalty,
            "hypoxia_factor": worst_pt.hypoxia_factor,
            "pvt_lapses": worst_pt.pvt_lapses,
            "microsleep_probability": worst_pt.microsleep_probability,
            "kss": worst_pt.kss,
            "kss_90": worst_pt.kss_90,
            "p_severe_sleepiness": worst_pt.p_severe_sleepiness,
            "hours_awake": worst_pt.hours_awake,
            "hours_on_duty": worst_pt.hours_on_duty,
            "timestamp": worst_pt.timestamp_utc.isoformat(),
            "timestamp_local": worst_pt.timestamp_local.isoformat(),
        }

    report_local = duty.report_time_utc.astimezone(home_tz)
    release_local = duty.release_time_utc.astimezone(home_tz)
    report_utc_z = duty.report_time_utc.astimezone(pytz.utc)
    release_utc_z = duty.release_time_utc.astimezone(pytz.utc)

    return DutyResponse(
        duty_id=duty_timeline.duty_id,
        date=duty_timeline.duty_date.strftime("%Y-%m-%d"),
        report_time_utc=duty.report_time_utc.isoformat(),
        release_time_utc=duty.release_time_utc.isoformat(),
        report_time_local=report_local.strftime("%H:%M"),
        release_time_local=release_local.strftime("%H:%M"),
        report_time_home_tz=report_local.strftime("%H:%M"),
        release_time_home_tz=release_local.strftime("%H:%M"),
        report_time_hhmm_utc=report_utc_z.strftime("%H:%M"),
        release_time_hhmm_utc=release_utc_z.strftime("%H:%M"),
        report_day_utc=report_utc_z.day,
        report_hour_utc=report_utc_z.hour + report_utc_z.minute / 60.0,
        release_day_utc=release_utc_z.day,
        release_hour_utc=release_utc_z.hour + release_utc_z.minute / 60.0,
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
        peak_duty_risk=risk,
        landing_risk=classify_risk(duty_timeline.landing_performance, getattr(duty_timeline, "risk_thresholds", None)),
        risk_reasons=_risk_reasons(duty_timeline, duty, roster),
        max_kss=_round_opt(duty_timeline.max_kss),
        peak_time_utc=peak_time.isoformat() if peak_time else None,
        headline_window=window,
        risk_basis=f"peak_kss_{window}",
        kss_peak_fdp=_round_opt(getattr(duty_timeline, 'kss_peak_fdp', None)),
        kss_peak_duty=_round_opt(getattr(duty_timeline, 'kss_peak_duty', None)),
        kss_at_release=_round_opt(getattr(duty_timeline, 'kss_at_release', None)),
        assumed_nap_hours=_round_opt(getattr(duty_timeline, 'assumed_nap_hours', None)),
        acclimatization_basis=getattr(duty_timeline, 'acclimatization_basis', None),
        landing_kss=_round_opt(duty_timeline.landing_kss),
        max_kss_90=_round_opt(duty_timeline.max_kss_90),
        max_p_severe_sleepiness=_round_opt(duty_timeline.max_p_severe_sleepiness, 3),
        max_hours_awake=_round_opt(duty_timeline.max_hours_awake),
        sleep_deficit_7d=getattr(duty_timeline, "sleep_deficit_7d", None),
        risk_thresholds=getattr(duty_timeline, "risk_thresholds", None) or None,
        model_version=getattr(duty_timeline, "model_version", None),
        model_parameters=getattr(duty_timeline, "model_parameters", None),
        is_reportable=(risk in ["critical", "extreme"]),
        risk_advisory=RiskThresholds.risk_advisory(risk),
        pinch_events=len(duty_timeline.pinch_events),
        max_fdp_hours=duty.max_fdp_hours,
        extended_fdp_hours=duty.extended_fdp_hours,
        planned_extension_fdp_hours=getattr(duty, 'planned_extension_fdp_hours', None),
        fdp_limit_reference=getattr(duty, 'fdp_limit_reference', None),
        used_discretion=duty.used_discretion,
        actual_fdp_hours=round(duty.fdp_hours, 2) if duty.segments else None,
        circadian_phase_shift=round(duty_timeline.circadian_phase_shift, 2),
        time_validation_warnings=time_warnings,
        sleep_quality=sleep_quality,
        worst_point=worst_point_dict,
        # Cabin environment
        cabin_altitude_ft=cabin_alt,
        aircraft_type=aircraft_type_str,
        # Training duty metadata
        duty_type=duty.duty_type.value if hasattr(duty, 'duty_type') else 'flight',
        training_code=getattr(duty, 'training_code', None),
        training_annotations=getattr(duty, 'training_annotations', None),
        training_legend=getattr(duty, 'training_legend', None),
        # Augmented crew / ULR
        crew_composition=duty.crew_composition.value if hasattr(duty.crew_composition, 'value') else str(getattr(duty, 'crew_composition', 'standard')),
        rest_facility_class=duty.rest_facility_class.value if getattr(duty, 'rest_facility_class', None) else None,
        is_ulr=getattr(duty_timeline, 'is_ulr', False),
        ulr_crew_set=duty.ulr_crew_set.value if getattr(duty, 'ulr_crew_set', None) else None,
        augmentation_suggested=augmentation_likely(duty),
        crew_source=getattr(duty, 'crew_source', None),
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

    # Build a per-duty suppression map: for each ULR duty key, the set of
    # ISO date strings (YYYY-MM-DD, home-base TZ) that its sleep blocks cover.
    #
    # A gap-fill rest_YYYY-MM-DD entry is suppressed only when the ULR duty
    # responsible for the SAME inter-duty gap has a block on that exact date.
    # Using a GLOBAL set across all ULR duties caused false suppression: a
    # gap-fill night between duty A and duty B was incorrectly hidden because a
    # different ULR duty C→D happened to cover that same calendar day number.
    #
    # Coverage rules per block (all dates in home-base TZ / ISO string):
    #   - The block's start ISO date is always covered (the 23:00 evening).
    #   - For genuine overnight blocks (start date != end date): also cover the
    #     end date, because the block continues into that morning and a layover
    #     hotel nap starting on end-date (e.g. GRU 23:00 local = 05:00 DOH
    #     next day) would overlap. Clamped intra-day blocks (same date) already
    #     contribute via start date, so no double-add is needed.
    #
    # ulr_duty_covered_dates: duty_key → set of YYYY-MM-DD strings
    ulr_duty_covered_dates: dict = {}   # duty_key → set[str]

    for key, data in sleep_strategies.items():
        if not key.startswith('rest_') and data.get('strategy_type') == 'ulr_pre_duty':
            covered: set = set()
            for blk in data.get('sleep_blocks', []):
                iso_start = blk.get('sleep_start_iso', '')
                iso_end   = blk.get('sleep_end_iso', '')
                start_date = iso_start[:10] if iso_start else None   # YYYY-MM-DD
                end_date   = iso_end[:10]   if iso_end   else None
                if start_date:
                    covered.add(start_date)
                if end_date and end_date != start_date:
                    covered.add(end_date)
            ulr_duty_covered_dates[key] = covered
            pass  # Detailed roster state is intentionally not logged.

    pass  # Detailed roster state is intentionally not logged.

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

            # Suppress gap-fill recovery entries that are already rendered by a
            # ULR pre-duty strategy for the same inter-duty gap.
            #
            # Match by FULL ISO date string (YYYY-MM-DD) extracted from the key
            # (rest_2026-02-05 → "2026-02-05") against the per-duty covered-dates
            # set built above.  This is unambiguous across month boundaries and
            # avoids the day-of-month integer collision that caused false suppression
            # when multiple ULR duties shared the same day number (e.g. day 5 of
            # two different months, or two ULR duties in the same month whose
            # covered-day sets merged globally).
            if key.startswith('rest_'):
                rest_date_str = key[5:]   # strip "rest_" prefix → "YYYY-MM-DD"
                suppressed = any(
                    rest_date_str in covered
                    for covered in ulr_duty_covered_dates.values()
                )
                pass  # Detailed roster state is intentionally not logged.
                if suppressed:
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
                is_user_override=bool(data.get('is_user_override')),
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
        "version": "5.0.0",
        "model": ENGINE_VERSION,
        "parser": "roster-1.1",
        "build": os.environ.get("RAILWAY_GIT_COMMIT_SHA", "local")
    }


@app.get('/health')
async def health_check():
    return {'status': 'alive'}

@app.get('/ready')
async def readiness():
    from db.session import database_ready
    ready = await database_ready()
    return JSONResponse(status_code=200 if ready else 503,
                        content={'status': 'ready' if ready else 'persistence_unavailable'})


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_roster(
    file: UploadFile = File(...),
    pilot_id: str = Form("P12345"),
    month: Optional[str] = Form(None),
    home_base: Optional[str] = Form(None),
    home_base_override: bool = Form(False),
    home_timezone: Optional[str] = Form(None),
    config_preset: str = Form("default"),
    timezone_format: str = Form("auto"),
    crew_set: str = Form("crew_b"),
    duty_crew_overrides: str = Form("{}"),
    nap_habit: Optional[str] = Form(None),
    usual_bedtime: Optional[str] = Form(None),
    usual_wake_time: Optional[str] = Form(None),
    sleep_edits: str = Form("[]"),
    user: Optional[User] = Depends(get_optional_user),
    principal: Principal = Depends(analysis_principal),
    db=Depends(get_db),
):
    """
    Upload roster file and get fatigue analysis.

    When authenticated: persists roster + analysis to database.
    When anonymous: stores in-memory only (lost on restart).

    The home base comes from the roster header; ``home_base`` is used when the
    header states none (or a CSV pattern is unclear), and replaces a header
    base only with ``home_base_override``. Missing base: 422 ``home_base_required``.
    """
    from api.preview import intake_error, parse_upload
    from parsers.base_detection import RosterIntakeError

    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Save uploaded file
        suffix = Path(file.filename).suffix.lower()
        if suffix not in ['.pdf', '.csv']:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use PDF or CSV.")
        
        content = await read_upload(file)
        from parsers.validation import resolve_home_timezone, validate_roster
        validate_upload(content, suffix)

        # Validate timezone_format parameter
        valid_tz_formats = ('auto', 'local', 'homebase', 'zulu')
        if timezone_format.lower() not in valid_tz_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timezone_format '{timezone_format}'. Must be one of: {', '.join(valid_tz_formats)}"
            )

        # Parse roster with the same base resolution as the preview (header >
        # entered > confirmed CSV pattern); empty rosters are rejected there.
        roster, parser, base_resolution, _ = await run_compute(
            parse_upload, content, suffix, home_base, home_base_override,
            timezone_format.lower(), pilot_id, month)
        if home_timezone:
            resolve_home_timezone(roster.pilot_base, home_timezone)

        # Apply per-duty crew set overrides (parser auto-detection is preserved as default)
        from models.data_models import ULRCrewSet

        overrides_dict = {}
        try:
            overrides_dict = json.loads(duty_crew_overrides) if duty_crew_overrides else {}
        except (json.JSONDecodeError, TypeError):
            logger.warning("Invalid duty_crew_overrides JSON, ignoring")

        # Only override duties that have an explicit per-duty override;
        # parser-detected defaults (from auto_detect_crew_augmentation) are preserved.
        _apply_crew_overrides(roster, overrides_dict)
        
        # ── Company detection & fleet/role extraction ──────────────────
        # Only run airline detection if user has no company yet
        company_detection_result = None
        if user is not None and user.company_id is None:
            try:
                # Gather detection signals from the parser
                roster_format = getattr(parser, 'detected_format', None) or ''
                raw_pdf_text = getattr(parser, 'raw_pdf_text', None) or ''
                flight_numbers = [
                    seg.flight_number
                    for d in roster.duties
                    for seg in d.segments
                    if hasattr(seg, 'flight_number') and seg.flight_number
                ]
                airline_guess = detect_airline(
                    roster_format=roster_format,
                    home_base=roster.pilot_base or home_base,
                    raw_pdf_text=raw_pdf_text,
                    flight_numbers=flight_numbers,
                )
                if airline_guess:
                    company_detection_result = airline_guess.to_dict()
                    pass  # Detailed roster state is intentionally not logged.
            except Exception as e:
                logger.warning('Airline detection failed')

        # Extract fleet and pilot role from parser info
        extracted_fleet = None
        extracted_pilot_role = None
        try:
            pilot_info = getattr(parser, 'pilot_info', {}) or {}
            fleet_role = extract_fleet_and_role(pilot_info)
            extracted_fleet = fleet_role.get('fleet')
            extracted_pilot_role = fleet_role.get('pilot_role')
        except Exception as e:
            logger.warning('Fleet/role extraction failed')

        # Get config
        # Single model: legacy preset names are accepted and ignored.
        # The request states the pilot's habits; a signed-in pilot's saved
        # preferences fill whatever it leaves out.
        config = _model_config(nap_habit, (getattr(user, 'sleep_preferences', None) or {}) if user else None,
                               usual_bedtime, usual_wake_time)
        roster.analysis_assumptions = dict(config.assumptions)
        # The pilot's sleep changes carried over from the previous analysis of this
        # roster; any that no longer fit the duties are dropped.
        try:
            roster.sleep_edits = normalise_sleep_edits(json.loads(sleep_edits or '[]'), roster, strict=False)
        except (ValueError, TypeError):
            raise HTTPException(422, 'sleep_edits must be a JSON list of sleep changes')

        # Use the month actually parsed from the roster (not the form default)
        effective_month = roster.month or month

        # ── Fatigue continuity: inject prior month's end state ────────
        continuity_from_month = None
        initial_conditions_dict = None
        if user is not None and db is not None:
            try:
                from sqlalchemy import select as sa_select
                prior_result = await db.execute(
                    sa_select(FatigueState)
                    .where(FatigueState.user_id == user.id)
                    .where(FatigueState.month < effective_month)
                    .where(FatigueState.engine_version.in_(KSS_ENGINE_VERSIONS))
                    .order_by(FatigueState.month.desc(), FatigueState.created_at.desc())
                    .limit(1)
                )
                prior_state = prior_result.scalar_one_or_none()
                if prior_state and roster.duties:
                    # Calculate gap days for exponential decay
                    gap_days = max(0, (roster.duties[0].report_time_utc - prior_state.period_end_utc).days)
                    decay = math.exp(-0.35 * gap_days)  # Matches sleep_debt_decay_rate

                    roster.initial_sleep_pressure = prior_state.final_process_s
                    roster.initial_sleep_debt = prior_state.final_sleep_debt * decay
                    roster.initial_circadian_phase_shift = prior_state.final_phase_shift * decay
                    roster.initial_circadian_reference_tz = prior_state.final_phase_tz
                    continuity_from_month = prior_state.month

                    initial_conditions_dict = {
                        "process_s": round(roster.initial_sleep_pressure, 4),
                        "sleep_debt": round(roster.initial_sleep_debt, 2),
                        "circadian_phase_shift": round(roster.initial_circadian_phase_shift, 2),
                        "from_month": prior_state.month,
                        "gap_days": gap_days,
                    }
                    pass  # Detailed roster state is intentionally not logged.
            except Exception as e:
                logger.warning('Fatigue continuity lookup failed')

        # Run analysis
        model = BorbelyFatigueModel(config)
        validate_roster(roster)
        import hashlib
        replay_input = snapshot(roster, {'format': suffix, 'source_sha256': hashlib.sha256(content).hexdigest(), 'timezone': roster.home_base_timezone,
                                         'home_base': roster.pilot_base, 'base_source': base_resolution.source})
        monthly_analysis = await run_compute(model.simulate_roster, roster)

        # Generate analysis ID
        analysis_id = str(uuid4())

        # Store for later retrieval (include sleep_strategies for GET endpoint)
        remember(analysis_id, (monthly_analysis, roster, model.sleep_strategies), principal)

        # Persist to database when user is authenticated
        if user is not None and db is not None:
            try:
                # Store roster with original PDF bytes
                db_roster = Roster(
                    user_id=user.id,
                    filename=file.filename or "roster.pdf",
                    month=effective_month,
                    pilot_id=pilot_id,
                    home_base=roster.pilot_base,  # the base actually analysed
                    config_preset=config_preset,
                    total_duties=roster.total_duties,
                    total_sectors=roster.total_sectors,
                    total_duty_hours=roster.total_duty_hours,
                    total_block_hours=roster.total_block_hours,
                    original_file_bytes=content,  # PDF bytes captured earlier
                    company_id=user.company_id,  # Copy from user (may be None)
                    fleet=extracted_fleet,
                    pilot_role=extracted_pilot_role,
                )
                db.add(db_roster)
                await db.flush()  # Get db_roster.id

                # Build response JSON for storage (we'll serialize AnalysisResponse)
                # Done after building duties_response below
                _pending_db_roster = db_roster
                _pending_analysis_id = analysis_id
            except Exception as e:
                logger.warning('Failed to persist roster to DB')
                await db.rollback()
                _pending_db_roster = None
                _pending_analysis_id = None
        else:
            _pending_db_roster = None
            _pending_analysis_id = None

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

        response = AnalysisResponse(
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
            average_sleep_debt=getattr(monthly_analysis, 'average_sleep_debt', 0.0),
            worst_duty_id=monthly_analysis.lowest_performance_duty,
            worst_performance=monthly_analysis.lowest_performance_value,
            duties=duties_response,
            **_roster_insights(roster, duties_response),
            rest_days_sleep=rest_days_sleep,
            body_clock_timeline=[
                {'timestamp_utc': ts, 'phase_shift_hours': ps, 'reference_timezone': tz}
                for ts, ps, tz in monthly_analysis.body_clock_timeline
            ],
            total_ulr_duties=getattr(monthly_analysis, 'total_ulr_duties', 0),
            total_augmented_duties=getattr(monthly_analysis, 'total_augmented_duties', 0),
            ulr_violations=getattr(monthly_analysis, 'ulr_violations', []),
            company_detection=company_detection_result,
            continuity_from_month=continuity_from_month,
            initial_conditions=initial_conditions_dict,
        )

        # Persist analysis JSON to database if roster was stored
        if _pending_db_roster is not None and db is not None:
            try:
                response.persistence_status = "saved"
                response.roster_id = str(_pending_db_roster.id)
                db_analysis = Analysis(
                    id=analysis_id,
                    roster_id=_pending_db_roster.id,
                    analysis_json={**response.model_dump(mode="json"), "_replay": replay_input},
                )
                db.add(db_analysis)
                await db.commit()
                remember(analysis_id, (monthly_analysis, roster, model.sleep_strategies), principal, _pending_db_roster.id)
                response.persistence_status = "saved"

                # ── Save end-of-roster fatigue state for continuity ───
                try:
                    if monthly_analysis.duty_timelines:
                        last_tl = monthly_analysis.duty_timelines[-1]
                        last_duty = roster.duties[-1]
                        fc = last_tl.final_circadian_state

                        fs = FatigueState(
                            user_id=user.id,
                            roster_id=_pending_db_roster.id,
                            month=effective_month,
                            period_end_utc=last_duty.release_time_utc,
                            engine_version=ENGINE_VERSION,
                            final_process_s=last_tl.final_process_s,
                            final_sleep_debt=last_tl.cumulative_sleep_debt,
                            final_phase_shift=fc.current_phase_shift_hours if fc else 0.0,
                            final_phase_tz=fc.reference_timezone if fc else roster.home_base_timezone,
                        )
                        await save_fatigue_state(db, fs)
                        await db.commit()
                        pass  # Detailed roster state is intentionally not logged.
                except Exception as e:
                    logger.warning('Failed to save fatigue state')
                    await db.rollback()

                # ── Trigger comparative metrics aggregation ───
                if user.company_id:
                    try:
                        from metrics.aggregator import compute_aggregate_metrics
                        await compute_aggregate_metrics(db, user.company_id, effective_month)
                    except Exception as e:
                        logger.warning('Failed to compute aggregate metrics')

            except Exception as e:
                logger.warning('Failed to persist analysis to DB')
                await db.rollback()
                response.persistence_status = "failed"

        if user is not None and response.persistence_status != "saved":
            response.persistence_status = "failed"
        return response

    except HTTPException:
        raise
    except RosterIntakeError as e:
        return intake_error(e)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception:
        logger.error('Analysis failed')
        raise HTTPException(500, "Analysis failed. Please retry or contact support.")


@app.get("/api/analysis/{analysis_id}")
async def get_analysis(analysis_id: str, db=Depends(get_db), principal=Depends(analysis_principal)):
    """Retrieve stored analysis by ID.

    Tries in-memory store first, then falls back to database.
    """

    record = await authorize(analysis_id, principal, db)
    # Saved response metadata is authoritative on both warm and cold reads.
    if record is not None:
        payload = {k: v for k, v in record.analysis_json.items() if k != '_replay'}
        payload.update(roster_id=str(record.roster_id), persistence_status='saved')
        return JSONResponse(content=payload)
    # 1. Try in-memory store (current session)
    if analysis_id in analysis_store:
        monthly_analysis, roster, sleep_strategies = analysis_store[analysis_id].value

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
            average_sleep_debt=getattr(monthly_analysis, 'average_sleep_debt', 0.0),
            worst_duty_id=monthly_analysis.lowest_performance_duty,
            worst_performance=monthly_analysis.lowest_performance_value,
            duties=duties_response,
            **_roster_insights(roster, duties_response),
            rest_days_sleep=rest_days_sleep,
            body_clock_timeline=[
                {'timestamp_utc': ts, 'phase_shift_hours': ps, 'reference_timezone': tz}
                for ts, ps, tz in monthly_analysis.body_clock_timeline
            ],
            total_ulr_duties=getattr(monthly_analysis, 'total_ulr_duties', 0),
            total_augmented_duties=getattr(monthly_analysis, 'total_augmented_duties', 0),
            ulr_violations=getattr(monthly_analysis, 'ulr_violations', []),
        )

    raise HTTPException(404, "Analysis not found")


@app.get("/api/duty/{analysis_id}/{duty_id}")
async def get_duty_detail(analysis_id: str, duty_id: str, db=Depends(get_db), principal=Depends(analysis_principal)):
    """
    Get detailed timeline data for a single duty.
    Returns all performance points for interactive charting.

    Replays versioned normalized inputs after cache eviction.
    """

    monthly_analysis, roster, _sleep_strategies = await load_analysis(analysis_id, principal, db)

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
            "debt_penalty": point.debt_penalty,
            "hypoxia_factor": point.hypoxia_factor,
            "pvt_lapses": point.pvt_lapses,
            "microsleep_probability": point.microsleep_probability,
            "kss": point.kss,
            "kss_90": point.kss_90,
            "p_severe_sleepiness": point.p_severe_sleepiness,
            "hours_awake": point.hours_awake,
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
async def get_statistics(analysis_id: str, db=Depends(get_db), principal=Depends(analysis_principal)):
    """Get summary statistics for frontend dashboard"""
    
    monthly_analysis, roster, _sleep_strategies = await load_analysis(analysis_id, principal, db)


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
            "average_sleep_debt": getattr(monthly_analysis, 'average_sleep_debt', 0.0),
        }
    }


# ============================================================================
# ROSTER MANAGEMENT ENDPOINTS (authenticated)
# ============================================================================

from auth.dependencies import get_current_user as _get_current_user


class RosterSummaryResponse(BaseModel):
    id: str
    filename: str
    month: str
    pilot_id: Optional[str] = None
    home_base: Optional[str] = None
    config_preset: Optional[str] = None
    total_duties: Optional[int] = None
    total_sectors: Optional[int] = None
    total_duty_hours: Optional[float] = None
    total_block_hours: Optional[float] = None
    analysis_id: Optional[str] = None
    created_at: str


@app.get("/api/rosters", response_model=List[RosterSummaryResponse])
async def list_rosters(
    user: User = Depends(_get_current_user),
    db=Depends(get_db),
):
    """List all rosters for the authenticated user, newest first."""
    if db is None:
        raise HTTPException(503, "Database not available")

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Roster)
        .where(Roster.user_id == user.id)
        .options(selectinload(Roster.analyses))
        .order_by(Roster.created_at.desc())
    )
    rosters = result.scalars().all()

    return [
        RosterSummaryResponse(
            id=str(r.id),
            filename=r.filename,
            month=r.month,
            pilot_id=r.pilot_id,
            home_base=r.home_base,
            config_preset=r.config_preset,
            total_duties=r.total_duties,
            total_sectors=r.total_sectors,
            total_duty_hours=r.total_duty_hours,
            total_block_hours=r.total_block_hours,
            analysis_id=r.analyses[0].id if r.analyses else None,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rosters
    ]


@app.get("/api/rosters/{roster_id}")
async def get_roster(
    roster_id: UUID,
    user: User = Depends(_get_current_user),
    db=Depends(get_db),
):
    """Get a single roster with its analysis JSON."""
    if db is None:
        raise HTTPException(503, "Database not available")

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Roster)
        .where(Roster.id == roster_id, Roster.user_id == user.id)
        .options(selectinload(Roster.analyses))
    )
    roster = result.scalar_one_or_none()

    if roster is None:
        raise HTTPException(404, "Roster not found")

    analysis_json = None
    analysis_id = None
    if roster.analyses:
        analysis_json = {k: v for k, v in roster.analyses[0].analysis_json.items() if k != "_replay"}
        analysis_json.update(roster_id=str(roster.id), persistence_status="saved")
        analysis_id = roster.analyses[0].id

    return {
        "id": str(roster.id),
        "filename": roster.filename,
        "month": roster.month,
        "pilot_id": roster.pilot_id,
        "home_base": roster.home_base,
        "config_preset": roster.config_preset,
        "total_duties": roster.total_duties,
        "total_sectors": roster.total_sectors,
        "total_duty_hours": roster.total_duty_hours,
        "total_block_hours": roster.total_block_hours,
        "analysis_id": analysis_id,
        "analysis": analysis_json,
        "created_at": roster.created_at.isoformat() if roster.created_at else "",
    }


@app.delete("/api/rosters/{roster_id}", status_code=204)
async def delete_roster(
    roster_id: UUID,
    user: User = Depends(_get_current_user),
    db=Depends(get_db),
):
    """Delete a roster and its associated analysis."""
    if db is None:
        raise HTTPException(503, "Database not available")

    from sqlalchemy import select

    result = await db.execute(
        select(Roster).where(Roster.id == roster_id, Roster.user_id == user.id)
    )
    roster = result.scalar_one_or_none()

    if roster is None:
        raise HTTPException(404, "Roster not found")

    evict_roster(roster.id)
    company_id, month = roster.company_id, roster.month
    await db.delete(roster)  # CASCADE deletes analyses
    if company_id:
        from db.models import AggregateMetrics
        from sqlalchemy import delete
        await db.execute(delete(AggregateMetrics).where(AggregateMetrics.company_id == company_id,
                                                        AggregateMetrics.month == month))
    await db.commit()
    if company_id:
        from metrics.aggregator import compute_aggregate_metrics
        await compute_aggregate_metrics(db, company_id, month)


@app.post("/api/rosters/{roster_id}/reanalyze")
async def reanalyze_roster(
    roster_id: UUID,
    config_preset: str = Form("default"),
    crew_set: str = Form("crew_b"),
    nap_habit: Optional[str] = Form(None),
    usual_bedtime: Optional[str] = Form(None),
    usual_wake_time: Optional[str] = Form(None),
    user: User = Depends(_get_current_user),
    db=Depends(get_db),
):
    """Re-run analysis on a stored roster with different settings."""
    if db is None:
        raise HTTPException(503, "Database not available")

    from sqlalchemy import select

    result = await db.execute(
        select(Roster).where(Roster.id == roster_id, Roster.user_id == user.id)
    )
    db_roster = result.scalar_one_or_none()

    if db_roster is None:
        raise HTTPException(404, "Roster not found")

    result = await db.execute(select(Analysis).where(Analysis.roster_id == db_roster.id)
                              .order_by(Analysis.created_at.desc(), Analysis.id.desc()).limit(1))
    latest = result.scalar_one_or_none()
    if latest is None or not latest.analysis_json.get('_replay'):
        raise HTTPException(409, 'Legacy roster: re-upload once to establish reproducible inputs.')
    roster_obj = restore(latest.analysis_json['_replay'])
    # Parser auto-detection provides crew set defaults — no global override needed.
    # Per-duty overrides could be added here in the future if the reanalyze
    # endpoint accepts duty_crew_overrides (currently it does not).

    # Run analysis
    # Single model: legacy preset names are accepted and ignored.
    config = _model_config(nap_habit, getattr(roster_obj, 'analysis_assumptions', None),
                           usual_bedtime, usual_wake_time)
    roster_obj.analysis_assumptions = dict(config.assumptions)

    # ── Fatigue continuity for re-analysis ────────────────────
    reanalyze_effective_month = roster_obj.month or db_roster.month or "2026-02"
    re_continuity_from_month = None
    re_initial_conditions = None
    try:
        from sqlalchemy import select as sa_select
        prior_result = await db.execute(
            sa_select(FatigueState)
            .where(FatigueState.user_id == user.id)
            .where(FatigueState.month < reanalyze_effective_month)
            .where(FatigueState.engine_version.in_(KSS_ENGINE_VERSIONS))
                    .order_by(FatigueState.month.desc(), FatigueState.created_at.desc())
            .limit(1)
        )
        prior_state = prior_result.scalar_one_or_none()
        if prior_state and roster_obj.duties:
            gap_days = max(0, (roster_obj.duties[0].report_time_utc - prior_state.period_end_utc).days)
            decay = math.exp(-0.35 * gap_days)  # Matches sleep_debt_decay_rate

            roster_obj.initial_sleep_pressure = prior_state.final_process_s
            roster_obj.initial_sleep_debt = prior_state.final_sleep_debt * decay
            roster_obj.initial_circadian_phase_shift = prior_state.final_phase_shift * decay
            roster_obj.initial_circadian_reference_tz = prior_state.final_phase_tz
            re_continuity_from_month = prior_state.month
            re_initial_conditions = {
                "process_s": round(roster_obj.initial_sleep_pressure, 4),
                "sleep_debt": round(roster_obj.initial_sleep_debt, 2),
                "circadian_phase_shift": round(roster_obj.initial_circadian_phase_shift, 2),
                "from_month": prior_state.month,
                "gap_days": gap_days,
            }
    except Exception as e:
        logger.warning('Fatigue continuity lookup on reanalyze failed')

    model = BorbelyFatigueModel(config)
    replay_input = snapshot(roster_obj, latest.analysis_json['_replay'].get('provenance'))
    monthly_analysis = await run_compute(model.simulate_roster, roster_obj)

    analysis_id = str(uuid4())

    # Store in memory
    remember(analysis_id, (monthly_analysis, roster_obj, model.sleep_strategies), Principal("user:" + str(user.id), str(user.id)), db_roster.id)

    # Build response
    duties_response = []
    for dt in monthly_analysis.duty_timelines:
        duty_idx = roster_obj.get_duty_index(dt.duty_id)
        if duty_idx is None:
            continue
        duties_response.append(
            _build_duty_response(dt, roster_obj.duties[duty_idx], roster_obj)
        )

    rest_days_sleep = _build_rest_days_sleep(model.sleep_strategies)
    effective_tz = latest.analysis_json.get("timezone_format", "auto")

    response = AnalysisResponse(
        analysis_id=analysis_id,
        roster_id=str(db_roster.id),
        pilot_id=roster_obj.pilot_id,
        pilot_name=roster_obj.pilot_name,
        pilot_base=roster_obj.pilot_base,
        pilot_aircraft=roster_obj.pilot_aircraft,
        home_base_timezone=roster_obj.home_base_timezone,
        timezone_format=effective_tz,
        month=roster_obj.month,
        total_duties=roster_obj.total_duties,
        total_sectors=roster_obj.total_sectors,
        total_duty_hours=roster_obj.total_duty_hours,
        total_block_hours=roster_obj.total_block_hours,
        high_risk_duties=monthly_analysis.high_risk_duties,
        critical_risk_duties=monthly_analysis.critical_risk_duties,
        total_pinch_events=monthly_analysis.total_pinch_events,
        avg_sleep_per_night=monthly_analysis.average_sleep_per_night,
        max_sleep_debt=monthly_analysis.max_sleep_debt,
        worst_duty_id=monthly_analysis.lowest_performance_duty,
        worst_performance=monthly_analysis.lowest_performance_value,
        duties=duties_response,
        **_roster_insights(roster_obj, duties_response),
        rest_days_sleep=rest_days_sleep,
        body_clock_timeline=[
            {"timestamp_utc": ts, "phase_shift_hours": ps, "reference_timezone": tz}
            for ts, ps, tz in monthly_analysis.body_clock_timeline
        ],
        total_ulr_duties=getattr(monthly_analysis, "total_ulr_duties", 0),
        total_augmented_duties=getattr(monthly_analysis, "total_augmented_duties", 0),
        ulr_violations=getattr(monthly_analysis, "ulr_violations", []),
        continuity_from_month=re_continuity_from_month,
        initial_conditions=re_initial_conditions,
    )

    # Update analysis in DB
    try:
        response.persistence_status = "saved"
        # Preserve previous model snapshots as an audit trail.

        db_analysis = Analysis(
            id=analysis_id,
            roster_id=db_roster.id,
            analysis_json={**response.model_dump(mode="json"), "_replay": replay_input},
        )
        db.add(db_analysis)

        # Update roster config
        db_roster.config_preset = config_preset
        await db.commit()

        # ── Save end-of-roster fatigue state (reanalyze) ─────────
        try:
            if monthly_analysis.duty_timelines:
                last_tl = monthly_analysis.duty_timelines[-1]
                last_duty = roster_obj.duties[-1]
                fc = last_tl.final_circadian_state

                fs = FatigueState(
                    user_id=user.id,
                    roster_id=db_roster.id,
                    month=reanalyze_effective_month,
                    period_end_utc=last_duty.release_time_utc,
                    engine_version=ENGINE_VERSION,
                            final_process_s=last_tl.final_process_s,
                    final_sleep_debt=last_tl.cumulative_sleep_debt,
                    final_phase_shift=fc.current_phase_shift_hours if fc else 0.0,
                    final_phase_tz=fc.reference_timezone if fc else roster_obj.home_base_timezone,
                )
                await save_fatigue_state(db, fs)
                await db.commit()
        except Exception as e:
            logger.warning('Failed to save fatigue state on reanalyze')
            await db.rollback()

        # ── Trigger comparative metrics aggregation (reanalyze) ───
        if user.company_id:
            try:
                from metrics.aggregator import compute_aggregate_metrics
                await compute_aggregate_metrics(db, user.company_id, reanalyze_effective_month)
            except Exception as e:
                logger.warning('Failed to compute aggregate metrics on reanalyze')

    except Exception as e:
        response.persistence_status = "failed"
        logger.error('Failed to persist re-analysis')
        await db.rollback()

    return response


def _assemble_response(analysis_id: str, roster, monthly_analysis, model, **extra) -> AnalysisResponse:
    """The full analysis response for a simulated roster (fields as /api/analyze)."""
    duties_response = []
    for dt in monthly_analysis.duty_timelines:
        duty_idx = roster.get_duty_index(dt.duty_id)
        if duty_idx is None:
            continue
        duties_response.append(_build_duty_response(dt, roster.duties[duty_idx], roster))
    fields = dict(
        analysis_id=analysis_id,
        roster_id=roster.roster_id,
        pilot_id=roster.pilot_id,
        pilot_name=roster.pilot_name,
        pilot_base=roster.pilot_base,
        pilot_aircraft=roster.pilot_aircraft,
        home_base_timezone=roster.home_base_timezone,
        month=roster.month,
        total_duties=len(roster.duties),
        total_sectors=sum(len(d.segments) for d in roster.duties),
        total_duty_hours=round(sum(d.duty_hours for d in roster.duties), 1),
        total_block_hours=round(sum(sum(s.block_hours for s in d.segments if hasattr(s, 'block_hours'))
                                    for d in roster.duties), 1),
        high_risk_duties=monthly_analysis.high_risk_duties,
        critical_risk_duties=monthly_analysis.critical_risk_duties,
        total_pinch_events=monthly_analysis.total_pinch_events,
        avg_sleep_per_night=monthly_analysis.average_sleep_per_night,
        max_sleep_debt=monthly_analysis.max_sleep_debt,
        average_sleep_debt=getattr(monthly_analysis, 'average_sleep_debt', 0.0),
        worst_duty_id=monthly_analysis.lowest_performance_duty,
        worst_performance=monthly_analysis.lowest_performance_value,
        duties=duties_response,
        **_roster_insights(roster, duties_response),
        rest_days_sleep=_build_rest_days_sleep(model.sleep_strategies),
        body_clock_timeline=[
            {"timestamp_utc": ts, "phase_shift_hours": ps, "reference_timezone": tz}
            for ts, ps, tz in monthly_analysis.body_clock_timeline
        ],
        total_ulr_duties=getattr(monthly_analysis, "total_ulr_duties", 0),
        total_augmented_duties=getattr(monthly_analysis, "total_augmented_duties", 0),
        ulr_violations=getattr(monthly_analysis, "ulr_violations", []),
    )
    fields.update(extra)
    return AnalysisResponse(**fields)


# ============================================================================
# WHAT-IF SCENARIO ANALYSIS
# ============================================================================


class DutyModification(BaseModel):
    """A single duty modification for what-if analysis."""
    duty_id: str
    report_shift_minutes: int = 0      # ±120 in 30-min steps
    release_shift_minutes: int = 0     # ±120 in 30-min steps
    crew_composition: Optional[str] = None   # "standard" | "augmented_4"
    crew_set: Optional[str] = None           # "crew_a" | "crew_b"
    excluded: bool = False                   # simulate day off


class SleepModification(BaseModel):
    """A single sleep override for what-if analysis.

    Overrides the auto-generated sleep block for a given duty with
    user-specified bed/wake times. The fatigue model re-runs the full
    Borbely simulation with the modified sleep, updating all downstream
    performance predictions.
    """
    duty_id: str                                 # Which duty's pre-sleep to override
    sleep_start_utc: str                         # ISO 8601 datetime
    sleep_end_utc: str                           # ISO 8601 datetime
    environment: Optional[str] = None            # "home" | "hotel" (optional override)
    # Optional: replace exactly this estimated block (its sleep_start_utc).
    # Without it the duty's last main sleep before report is replaced.
    block_start_utc: Optional[str] = None


class WhatIfRequest(BaseModel):
    """Request body for what-if scenario analysis."""
    analysis_id: str
    modifications: List[DutyModification] = []           # existing (backward compatible)
    sleep_modifications: List[SleepModification] = []    # NEW: sleep overrides
    config_preset: str = "default"
    nap_habit: Optional[str] = None   # 'usually' | 'sometimes' | 'rarely'; default: the analysis's


@app.post("/api/what-if")
async def run_what_if(request: WhatIfRequest, db=Depends(get_db), principal=Depends(analysis_principal)):
    """
    Run a what-if scenario: deep-copy the original roster, apply duty
    modifications (time shifts, crew changes, exclusions), re-run the
    fatigue model, and return the modified analysis. Ephemeral — not persisted.
    """
    import copy
    from datetime import timedelta
    from models.data_models import CrewComposition, ULRCrewSet

    analysis_id = request.analysis_id

    _monthly_analysis, original_roster, _sleep_strategies = await load_analysis(analysis_id, principal, db)

    # 2. Deep-copy the roster
    modified_roster = copy.deepcopy(original_roster)

    # 3. Build modification lookup
    mod_map = {m.duty_id: m for m in request.modifications}

    # 4. Validate shift limits
    for mod in request.modifications:
        if abs(mod.report_shift_minutes) > 240:
            raise HTTPException(400, f"Report shift for duty {mod.duty_id} exceeds ±4h limit")
        if abs(mod.release_shift_minutes) > 240:
            raise HTTPException(400, f"Release shift for duty {mod.duty_id} exceeds ±4h limit")

    # 5. Apply modifications
    excluded_ids = set()
    for mod in request.modifications:
        if mod.excluded:
            excluded_ids.add(mod.duty_id)
            continue

        duty = modified_roster.get_duty_by_id(mod.duty_id)
        if duty is None:
            raise HTTPException(400, f"Duty {mod.duty_id} not found in roster")

        # Time shifts — shift duty AND all segments by the same delta
        if mod.report_shift_minutes != 0:
            delta = timedelta(minutes=mod.report_shift_minutes)
            duty.report_time_utc += delta
            for seg in duty.segments:
                seg.scheduled_departure_utc += delta

        if mod.release_shift_minutes != 0:
            delta = timedelta(minutes=mod.release_shift_minutes)
            duty.release_time_utc += delta
            for seg in duty.segments:
                seg.scheduled_arrival_utc += delta

        # Crew composition change
        if mod.crew_composition is not None:
            crew_map = {
                "standard": CrewComposition.STANDARD,
                "augmented_3": CrewComposition.AUGMENTED_3,
                "augmented_4": CrewComposition.AUGMENTED_4,
            }
            new_comp = crew_map.get(mod.crew_composition)
            if new_comp:
                duty.crew_composition = new_comp
                duty.crew_stated, duty.crew_source = True, 'pilot'

        # Crew set change
        if mod.crew_set is not None:
            crew_set_map = {"crew_a": ULRCrewSet.CREW_A, "crew_b": ULRCrewSet.CREW_B}
            new_set = crew_set_map.get(mod.crew_set)
            if new_set:
                duty.ulr_crew_set = new_set

    # 6. Remove excluded duties
    if excluded_ids:
        modified_roster.duties = [
            d for d in modified_roster.duties if d.duty_id not in excluded_ids
        ]

    if not modified_roster.duties:
        raise HTTPException(400, "Cannot run analysis with all duties excluded")

    # 7. Re-sort by report time (in case shifts changed ordering)
    modified_roster.duties.sort(key=lambda d: d.report_time_utc)

    # 8. Parse sleep modifications into override dict
    sleep_overrides = None
    if request.sleep_modifications:
        sleep_overrides = {}
        for sm in request.sleep_modifications:
            try:
                s_start = datetime.fromisoformat(sm.sleep_start_utc.replace("Z", "+00:00"))
                s_end = datetime.fromisoformat(sm.sleep_end_utc.replace("Z", "+00:00"))
            except (ValueError, TypeError) as e:
                raise HTTPException(400, f"Invalid ISO timestamp for sleep mod duty {sm.duty_id}: {e}")

            # Ensure UTC-aware
            if s_start.tzinfo is None:
                s_start = s_start.replace(tzinfo=pytz.utc)
            if s_end.tzinfo is None:
                s_end = s_end.replace(tzinfo=pytz.utc)

            duration_hours = (s_end - s_start).total_seconds() / 3600.0
            if duration_hours < 0.5:
                raise HTTPException(400, f"Sleep duration for duty {sm.duty_id} too short ({duration_hours:.1f}h, min 0.5h)")
            if duration_hours > 14.0:
                raise HTTPException(400, f"Sleep duration for duty {sm.duty_id} too long ({duration_hours:.1f}h, max 14h)")

            # Verify duty exists in roster
            duty_obj = modified_roster.get_duty_by_id(sm.duty_id)
            if duty_obj is None:
                raise HTTPException(400, f"Duty {sm.duty_id} not found in roster (sleep override)")

            if not sm.block_start_utc and not (
                    duty_obj.report_time_utc - timedelta(hours=36) <= s_start < s_end <= duty_obj.report_time_utc):
                raise HTTPException(422, 'Pre-duty sleep must end before report and start within 36 hours of it.')
            if any(d.report_time_utc < s_end and d.release_time_utc > s_start for d in modified_roster.duties):
                raise HTTPException(422, 'Sleep overlaps a duty.')
            key = f"{sm.duty_id}@{sm.block_start_utc}" if sm.block_start_utc else sm.duty_id
            sleep_overrides[key] = {
                "duty_id": sm.duty_id,
                "start_utc": s_start,
                "end_utc": s_end,
                "environment": sm.environment,  # None = keep auto-detected
                "block_start_utc": sm.block_start_utc,
            }

    from parsers.validation import validate_roster
    try:
        validate_roster(modified_roster)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    # 9. Run fatigue model on modified roster
    # Single model: legacy preset names are accepted and ignored.
    config = _model_config(request.nap_habit, getattr(original_roster, 'analysis_assumptions', None))
    model = BorbelyFatigueModel(config)
    monthly_analysis = await run_compute(model.simulate_roster, modified_roster, sleep_overrides=sleep_overrides)

    # 10. Build response (same shape as /api/analyze); not stored.
    return _assemble_response(str(uuid4()), modified_roster, monthly_analysis, model)


class SleepEditIn(BaseModel):
    """One pilot change to the estimated sleep (core/sleep_edits.py)."""
    id: Optional[str] = Field(None, max_length=64)
    action: str                                   # 'remove' | 'replace' | 'add'
    kind: Optional[str] = None                    # 'main' | 'nap'
    environment: Optional[str] = None             # 'home' | 'hotel'
    target_start_utc: Optional[str] = None        # the estimated block it changes
    target_end_utc: Optional[str] = None
    start_utc: Optional[str] = None               # the pilot's times (replace, add)
    end_utc: Optional[str] = None


class SleepEditsRequest(BaseModel):
    edits: List[SleepEditIn] = Field(default_factory=list, max_length=200)


@app.put("/api/analysis/{analysis_id}/sleep-edits", response_model=AnalysisResponse)
async def save_sleep_edits(analysis_id: str, request: SleepEditsRequest, db=Depends(get_db),
                           principal=Depends(analysis_principal)):
    """Replace the pilot's sleep changes for an analysis and return it recalculated.

    The full list is sent each time (an empty list restores the model's
    estimates). The changes are stored with the analysis inputs, so the saved
    analysis, replays and reanalyses all use them. Same analysis id.
    """
    import copy
    record = await authorize(analysis_id, principal, db)
    _monthly, cached_roster, _strategies = await load_analysis(analysis_id, principal, db)
    replay = (record.analysis_json.get('_replay') if record is not None else None) or None
    # Start from the stored inputs when there are any (the cached roster has been
    # through a simulation already); a guest analysis has only the cache.
    roster = restore(replay) if replay else copy.deepcopy(cached_roster)
    try:
        roster.sleep_edits = normalise_sleep_edits([e.model_dump() for e in request.edits], roster)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    config = _model_config(None, getattr(roster, 'analysis_assumptions', None))
    roster.analysis_assumptions = dict(config.assumptions)
    replay_input = snapshot(roster, (replay or {}).get('provenance')) if replay else None
    model = BorbelyFatigueModel(config)
    monthly = await run_compute(model.simulate_roster, roster)

    previous = record.analysis_json if record is not None else {}
    response = _assemble_response(
        analysis_id, roster, monthly, model,
        roster_id=str(previous.get('roster_id') or roster.roster_id),
        timezone_format=previous.get('timezone_format'),
        company_detection=previous.get('company_detection'),
        continuity_from_month=previous.get('continuity_from_month'),
        initial_conditions=previous.get('initial_conditions'),
    )
    if record is not None:
        response.persistence_status = 'saved'
        record.analysis_json = {**response.model_dump(mode='json'), '_replay': replay_input}
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            logger.error('Failed to save sleep changes')
            raise HTTPException(503, 'Your sleep changes could not be saved. Try again.')
        remember(analysis_id, (monthly, roster, model.sleep_strategies), principal, record.roster_id)
    else:
        remember(analysis_id, (monthly, roster, model.sleep_strategies), principal)
    return response


# ============================================================================
# 12-MONTH ROLLING DASHBOARD
# ============================================================================


class MonthlyMetrics(BaseModel):
    """Aggregated metrics for a single month's roster analysis."""
    month: str                                # "2026-02"
    roster_id: str
    filename: str
    created_at: str

    # Activity
    total_duties: int = 0
    total_sectors: int = 0
    total_duty_hours: float = 0.0
    total_block_hours: float = 0.0

    # Performance
    avg_performance: float = 0.0              # mean of avg_performance across duties
    worst_performance: float = 0.0            # min of min_performance across duties

    # Risk distribution
    low_risk_count: int = 0
    moderate_risk_count: int = 0
    high_risk_count: int = 0
    critical_risk_count: int = 0

    # Sleep
    avg_sleep_per_night: float = 0.0
    max_sleep_debt: float = 0.0
    average_sleep_debt: float = 0.0

    # WOCL
    total_wocl_hours: float = 0.0

    # Safety
    total_pinch_events: int = 0
    high_risk_duties: int = 0
    critical_risk_duties: int = 0

    # Duty type breakdown
    flight_duties: int = 0
    simulator_duties: int = 0
    ground_training_duties: int = 0


class YearlySummary(BaseModel):
    """Rolling 12-month aggregate totals/averages."""
    total_months: int = 0
    total_duties: int = 0
    total_sectors: int = 0
    total_duty_hours: float = 0.0
    total_block_hours: float = 0.0
    avg_performance: float = 0.0
    worst_performance: float = 0.0
    avg_sleep_per_night: float = 0.0
    max_sleep_debt: float = 0.0
    total_wocl_hours: float = 0.0
    total_pinch_events: int = 0
    total_high_risk_duties: int = 0
    total_critical_risk_duties: int = 0


class YearlyDashboardResponse(BaseModel):
    """GET /api/dashboard/yearly response."""
    months: list[MonthlyMetrics]
    summary: YearlySummary


def _compute_yearly_summary(months: list[MonthlyMetrics]) -> YearlySummary:
    """Compute duty-weighted averages and totals across all months."""
    if not months:
        return YearlySummary()

    total_duties = sum(m.total_duties for m in months)
    total_sectors = sum(m.total_sectors for m in months)
    total_duty_h = sum(m.total_duty_hours for m in months)
    total_block_h = sum(m.total_block_hours for m in months)

    # Weighted average performance (by duties per month)
    weighted_perf = sum(m.avg_performance * m.total_duties for m in months)
    avg_perf = round(weighted_perf / total_duties, 1) if total_duties else 0

    # Weighted average sleep
    weighted_sleep = sum(m.avg_sleep_per_night * m.total_duties for m in months)
    avg_sleep = round(weighted_sleep / total_duties, 1) if total_duties else 0

    return YearlySummary(
        total_months=len(months),
        total_duties=total_duties,
        total_sectors=total_sectors,
        total_duty_hours=round(total_duty_h, 1),
        total_block_hours=round(total_block_h, 1),
        avg_performance=avg_perf,
        worst_performance=min(m.worst_performance for m in months) if months else 0,
        avg_sleep_per_night=avg_sleep,
        max_sleep_debt=max(m.max_sleep_debt for m in months) if months else 0,
        total_wocl_hours=round(sum(m.total_wocl_hours for m in months), 1),
        total_pinch_events=sum(m.total_pinch_events for m in months),
        total_high_risk_duties=sum(m.high_risk_duties for m in months),
        total_critical_risk_duties=sum(m.critical_risk_duties for m in months),
    )


@app.get("/api/dashboard/yearly", response_model=YearlyDashboardResponse)
async def get_yearly_dashboard(
    user: User = Depends(_get_current_user),
    db=Depends(get_db),
):
    """12-month rolling dashboard metrics for the authenticated user."""
    if db is None:
        raise HTTPException(503, "Database not available")

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    # Get all rosters for this user with their analyses
    result = await db.execute(
        select(Roster)
        .where(Roster.user_id == user.id)
        .options(selectinload(Roster.analyses))
        .order_by(Roster.month.asc(), Roster.created_at.asc(), Roster.id.asc())
    )
    all_rosters = result.scalars().all()

    # Deduplicate by month — keep newest roster per month
    month_map: dict[str, tuple] = {}
    for r in all_rosters:
        if r.analyses:
            latest_analysis = r.analyses[0]
            if r.month not in month_map or r.created_at > month_map[r.month][0].created_at:
                month_map[r.month] = (r, latest_analysis)

    # Sort by month, take last 12
    sorted_months = sorted(month_map.keys())[-12:]

    months_data: list[MonthlyMetrics] = []
    for month_key in sorted_months:
        roster, analysis = month_map[month_key]
        aj = analysis.analysis_json or {}

        # Extract per-duty metrics from stored JSONB
        duties = aj.get("duties", [])
        if not duties or any(not is_kss_engine(d.get("model_version")) for d in duties):
            continue

        risk_counts = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
        total_wocl = 0.0
        all_avg_perf = []
        all_min_perf = []
        flight_count = sim_count = ground_count = 0

        for d in duties:
            rl = d.get("risk_level") or RiskThresholds().classify(d.get("min_performance"))
            if rl in risk_counts:
                risk_counts[rl] += 1
            elif rl == "extreme":
                risk_counts["critical"] += 1

            total_wocl += d.get("wocl_hours", 0) or 0

            avg_p = d.get("avg_performance")
            if avg_p is not None:
                all_avg_perf.append(avg_p)

            min_p = d.get("min_performance")
            if min_p is not None:
                all_min_perf.append(min_p)

            dt = d.get("duty_type", "flight")
            if dt == "simulator":
                sim_count += 1
            elif dt == "ground_training":
                ground_count += 1
            else:
                flight_count += 1

        months_data.append(MonthlyMetrics(
            month=month_key,
            roster_id=str(roster.id),
            filename=roster.filename,
            created_at=roster.created_at.isoformat() if roster.created_at else "",
            total_duties=roster.total_duties or aj.get("total_duties", 0),
            total_sectors=roster.total_sectors or aj.get("total_sectors", 0),
            total_duty_hours=round(roster.total_duty_hours or aj.get("total_duty_hours", 0), 1),
            total_block_hours=round(roster.total_block_hours or aj.get("total_block_hours", 0), 1),
            avg_performance=round(sum(all_avg_perf) / len(all_avg_perf), 1) if all_avg_perf else 0,
            worst_performance=round(min(all_min_perf), 1) if all_min_perf else 0,
            low_risk_count=risk_counts["low"],
            moderate_risk_count=risk_counts["moderate"],
            high_risk_count=risk_counts["high"],
            critical_risk_count=risk_counts["critical"],
            avg_sleep_per_night=round(aj.get("avg_sleep_per_night", 0) or 0, 1),
            max_sleep_debt=round(aj.get("max_sleep_debt", 0) or 0, 1),
            average_sleep_debt=round(aj.get("average_sleep_debt", 0) or 0, 1),
            total_wocl_hours=round(total_wocl, 1),
            total_pinch_events=aj.get("total_pinch_events", 0) or 0,
            high_risk_duties=aj.get("high_risk_duties", 0) or 0,
            critical_risk_duties=aj.get("critical_risk_duties", 0) or 0,
            flight_duties=flight_count,
            simulator_duties=sim_count,
            ground_training_duties=ground_count,
        ))

    summary = _compute_yearly_summary(months_data)
    return YearlyDashboardResponse(months=months_data, summary=summary)


# ============================================================================
# AIRPORT DATABASE ENDPOINTS
# ============================================================================

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


@app.get("/api/airports/{iata_code}", response_model=AirportResponse)
async def get_airport(iata_code: str):
    """
    Look up airport by IATA code from backend's ~7,800 airport database.

    Returns timezone (IANA), coordinates, and current UTC offset.
    This eliminates the need for the frontend to maintain its own airport database.
    """
    import pytz

    from parsers.validation import known_airport
    try:
        airport = known_airport(iata_code)
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    # Calculate current UTC offset (DST-aware)
    try:
        tz = pytz.timezone(airport.timezone)
        now = datetime.now(pytz.utc)
        utc_offset = now.astimezone(tz).utcoffset().total_seconds() / 3600
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
        from parsers.validation import known_airport
        try:
            airport = known_airport(code)
        except ValueError:
            continue
        try:
            tz = pytz.timezone(airport.timezone)
            utc_offset = now.astimezone(tz).utcoffset().total_seconds() / 3600
        except Exception:
            utc_offset = None

        from parsers.roster_parser import _IATA_DB
        record = _IATA_DB.get(airport.code) or {}
        results.append(AirportResponse(
            code=airport.code,
            timezone=airport.timezone,
            utc_offset_hours=utc_offset,
            latitude=airport.latitude,
            longitude=airport.longitude,
            name=record.get('name') or None,
            city=record.get('city') or None,
            country=record.get('country') or None,
        ))

    return results




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
