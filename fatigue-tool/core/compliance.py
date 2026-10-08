"""
EASA Compliance Validation
=========================

Validates duties against EASA FTL regulations (EU Regulation 965/2012).

References: EASA ORO.FTL, AMC1 ORO.FTL
"""

from datetime import datetime, timedelta, time
from typing import Dict, List, Optional
import pytz

from models.data_models import Duty, CrewComposition, RestFacilityClass
from core.parameters import EASAFatigueFramework

def _offset_hours(tz_name: str, at_utc: datetime) -> float:
    return at_utc.astimezone(pytz.timezone(tz_name)).utcoffset().total_seconds() / 3600


def determine_acclimatisation(duties: List[Duty], home_timezone: str) -> Dict[str, Dict]:
    """State of acclimatisation per duty — ORO.FTL.105(1) and Table 1 of
    AMC1 ORO.FTL.105(1) (via AcclimatizationCalculator).

    The reference is the place where the crew member was last acclimatised;
    the crew member is acclimatised to a 2-hour-wide band around it. When a
    duty takes them more than 2 h away, the clock starts at the report for
    that duty ("time elapsed since reporting at reference time"). Each later
    departure is looked up in Table 1 by time-zone difference to the
    reference and elapsed time: B keeps the reference, D makes the current
    location the new reference, X is unknown (Table 3 applies).

    Assumption (disclosed in the FDP check coverage): before the roster's
    first duty the crew member is acclimatised to the home base. A duty that
    departs more than 2 h from the reference with no known time of leaving
    it (e.g. the roster starts at an outstation) gets ``basis='unknown'`` and
    no FDP verdict.

    Returns {duty_id: {'state', 'reference_timezone', 'basis'}}.
    """
    from core.extended_operations import AcclimatizationCalculator
    from models.data_models import AcclimatizationState

    band = 2.0
    ref_tz, left_at = home_timezone, None
    result: Dict[str, Dict] = {}
    for duty in sorted(duties, key=lambda d: d.report_time_utc):
        report = duty.report_time_utc
        dep_tz = duty.segments[0].departure_airport.timezone if duty.segments else ref_tz
        diff = abs(_offset_hours(dep_tz, report) - _offset_hours(ref_tz, report))
        basis = 'determined'
        if diff <= band:
            state, table_tz, left_at = AcclimatizationState.ACCLIMATIZED, ref_tz, None
        elif left_at is None:
            # Away from the reference with no known time of leaving it
            # (e.g. the roster starts at an outstation).
            state, table_tz, basis = AcclimatizationState.UNKNOWN, None, 'unknown'
        else:
            elapsed = (report - left_at).total_seconds() / 3600
            state = AcclimatizationCalculator.determine_state(diff, elapsed)
            table_tz = ref_tz if state == AcclimatizationState.ACCLIMATIZED else None
            if state == AcclimatizationState.DEPARTED:
                ref_tz, left_at, table_tz = dep_tz, None, dep_tz
        result[duty.duty_id] = {'state': state, 'reference_timezone': table_tz, 'basis': basis}
        # Leaving the reference band starts the elapsed-time clock.
        if duty.segments and left_at is None and basis == 'determined':
            arr_tz = duty.segments[-1].arrival_airport.timezone
            if abs(_offset_hours(arr_tz, report) - _offset_hours(ref_tz, report)) > band:
                left_at = report
    return result


class EASAComplianceValidator:
    """Validate duties against EASA FTL regulations"""

    def __init__(self, framework: EASAFatigueFramework = None):
        self.framework = framework or EASAFatigueFramework()

    def calculate_fdp_limits(self, duty: Duty, augmented_params=None, ulr_params=None,
                             reference_timezone: Optional[str] = None) -> Dict[str, float]:
        """
        Calculate EASA FDP limits based on ORO.FTL.205.

        Supports:
        - Standard 2-pilot operations (Table 2 at reference time; Table 3
          when the state of acclimatisation is unknown)
        - Augmented crew 3/4-pilot operations (CS FTL.1.205(c)(2))
        - ULR operations (Operator OM-A 7.18)

        ``reference_timezone`` is the time zone the crew member is
        acclimatised to (determine_acclimatisation); home base by default.
        """
        tz = pytz.timezone(reference_timezone or duty.home_base_timezone)
        report_local = duty.report_time_utc.astimezone(tz)
        report_hour = report_local.hour
        sectors = sum(not seg.is_deadhead for seg in duty.segments)
        actual_fdp = duty.fdp_hours

        # CS FTL.1.205(c) in-flight-rest extension is limited to three sectors.
        # Do not grant an augmented allowance to an unsupported multi-sector duty.
        if duty.is_augmented_crew and sectors > (augmented_params.max_sectors_augmented if augmented_params else 3):
            return {
                'max_fdp': None, 'extended_fdp': None, 'actual_fdp': actual_fdp,
                'used_discretion': False, 'exceeds_discretion': False,
                'planned_extension_fdp': None,
                'reference': 'FDP not assessed: augmented in-flight-rest limits cover at most 3 operating sectors (CS FTL.1.205(c))',
                'is_ulr': bool(duty.is_ulr), 'crew_composition': duty.crew_composition.value,
            }

        # ULR operations — Operator OM-A 7.18
        if getattr(duty, 'is_ulr', False) or (
            getattr(duty, 'is_ulr_operation', False) and
            getattr(duty, 'crew_composition', CrewComposition.STANDARD) == CrewComposition.AUGMENTED_4
        ):
            if duty.rest_facility_class not in (None, RestFacilityClass.CLASS_1):
                return {
                    'max_fdp': None, 'extended_fdp': None, 'actual_fdp': actual_fdp,
                    'used_discretion': False, 'exceeds_discretion': False,
                    'planned_extension_fdp': None,
                    'reference': 'ULR FDP not assessed: configured scheme requires class-1 rest facility',
                    'is_ulr': True, 'crew_composition': duty.crew_composition.value,
                }
            if ulr_params:
                max_fdp = ulr_params.ulr_max_planned_fdp_hours
                discretion = ulr_params.ulr_discretion_max_hours
            else:
                max_fdp = 20.0
                discretion = 3.0
            return {
                'max_fdp': max_fdp,
                'extended_fdp': max_fdp + discretion,
                'actual_fdp': actual_fdp,
                'used_discretion': actual_fdp > max_fdp,
                'exceeds_discretion': actual_fdp > max_fdp + discretion,
                'planned_extension_fdp': None,
                'reference': 'Configured ULR scheme (approval unverified)',
                'is_ulr': True,
                'crew_composition': getattr(duty, 'crew_composition', CrewComposition.STANDARD).value
                    if hasattr(getattr(duty, 'crew_composition', None), 'value') else 'standard',
            }

        # Augmented crew (3 or 4 pilots, non-ULR) — CS FTL.1.205(c)(2)
        if getattr(duty, 'is_augmented_crew', False) and augmented_params:
            facility = getattr(duty, 'rest_facility_class', None) or RestFacilityClass.CLASS_1
            max_fdp = augmented_params.get_max_fdp(
                duty.crew_composition, facility, duty.segments
            )
            discretion = augmented_params.augmented_discretion_hours
            return {
                'max_fdp': max_fdp,
                'extended_fdp': max_fdp + discretion,
                'actual_fdp': actual_fdp,
                'used_discretion': actual_fdp > max_fdp,
                'exceeds_discretion': actual_fdp > max_fdp + discretion,
                'planned_extension_fdp': None,  # 7.6.5(4): not combined with in-flight rest
                'reference': ('CS FTL.1.205(c), in-flight rest, long sector' if sectors <= augmented_params.long_sector_max_sectors and any(
                    s.block_time_hours > augmented_params.long_sector_min_flight_hours for s in duty.segments)
                    else 'CS FTL.1.205(c), in-flight rest'),
                'is_ulr': False,
                'crew_composition': duty.crew_composition.value
                    if hasattr(duty.crew_composition, 'value') else 'standard',
            }

        # Operator OM-A 7.6.3 Table 7-6 (same rows as ORO.FTL.205(b) Table 2) at reference time;
        # Table 7-7 under the supplied operator FRM scheme in an unknown state of acclimatisation.
        from models.data_models import AcclimatizationState
        from core.qatar_ftl import basic_max_fdp, extension_max_fdp, DISCRETION_HOURS
        minute = report_local.hour * 60 + report_local.minute
        unknown = duty.acclimatization_state == AcclimatizationState.UNKNOWN
        max_fdp = basic_max_fdp(minute, sectors, unknown) if sectors else 0.0
        # 7.6.5 Table 7-8: planned extension without in-flight rest (acclimatised only).
        planned_extension = None if unknown or not sectors else extension_max_fdp(minute, sectors)
        extended_fdp = max_fdp + DISCRETION_HOURS  # 7.7.1.2(2)-(3): discretion from the basic maximum
        used_discretion = actual_fdp > max_fdp

        return {
            'max_fdp': max_fdp,
            'extended_fdp': extended_fdp,
            'actual_fdp': actual_fdp,
            'used_discretion': used_discretion,
            'exceeds_discretion': actual_fdp > extended_fdp,
            'planned_extension_fdp': planned_extension,
            'reference': 'Configured scheme Table 7-7, unknown acclimatisation (FRM approval unverified)' if unknown else 'ORO.FTL.205(b) Table 2',
            'is_ulr': False,
            'crew_composition': getattr(duty, 'crew_composition', CrewComposition.STANDARD).value
                if hasattr(getattr(duty, 'crew_composition', None), 'value') else 'standard',
        }
    
    def calculate_wocl_encroachment(
        self,
        duty_start: datetime,
        duty_end: datetime,
        reference_timezone: str
    ) -> timedelta:
        """Calculate overlap with WOCL (02:00-05:59 reference time)"""
        tz = pytz.timezone(reference_timezone)
        duty_start_local = duty_start.astimezone(tz)
        duty_end_local = duty_end.astimezone(tz)
        
        total_encroachment = timedelta()
        current_day = duty_start_local.date()
        end_day = duty_end_local.date()
        
        while current_day <= end_day:
            wocl_start = datetime.combine(
                current_day, time(self.framework.wocl_start_hour, 0, 0)
            )
            wocl_start = tz.localize(wocl_start)
            
            wocl_end = datetime.combine(
                current_day, time(self.framework.wocl_end_hour, self.framework.wocl_end_minute, 59)
            )
            wocl_end = tz.localize(wocl_end)
            
            overlap_start = max(duty_start_local, wocl_start)
            overlap_end = min(duty_end_local, wocl_end)
            
            if overlap_start < overlap_end:
                total_encroachment += (overlap_end - overlap_start)
            
            current_day += timedelta(days=1)
        
        return total_encroachment
    
    def is_disruptive_duty(self, duty: Duty) -> Dict[str, any]:
        """Disruptive schedule elements — Regulation (EU) 965/2012 ORO.FTL.105(8).

        On home-base time ('early type' definitions):
          early start  — duty starting 05:00–05:59
          late finish  — duty finishing 23:00–01:59
          night duty   — duty encroaching any portion of 02:00–04:59
        Reports 02:00–04:59 are night duties (not early starts).
        WOCL encroachment (02:00–05:59, ORO.FTL.105(28)) is reported
        separately as ``wocl_hours``.
        """
        wocl_encroachment = self.calculate_wocl_encroachment(
            duty.report_time_utc, duty.release_time_utc, duty.home_base_timezone
        )
        wocl_hours = wocl_encroachment.total_seconds() / 3600
        tz = pytz.timezone(duty.home_base_timezone)
        report = duty.report_time_utc.astimezone(tz)
        release = duty.release_time_utc.astimezone(tz)
        rep_h = report.hour + report.minute / 60
        rel_h = release.hour + release.minute / 60
        early_start = 5.0 <= rep_h < 6.0
        late_finish = rel_h >= 23.0 or rel_h < 2.0
        night_duty = False
        t = duty.report_time_utc
        while t < duty.release_time_utc:
            h = t.astimezone(tz)
            if 2 <= h.hour < 5:
                night_duty = True
                break
            t += timedelta(minutes=5)
        return {
            'wocl_encroachment': wocl_hours > 0,
            'wocl_hours': wocl_hours,
            'early_start': early_start,
            'late_finish': late_finish,
            'night_duty': night_duty,
            'is_disruptive': early_start or late_finish or night_duty,
        }

