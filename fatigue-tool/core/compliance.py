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

class EASAComplianceValidator:
    """Validate duties against EASA FTL regulations"""
    
    def __init__(self, framework: EASAFatigueFramework = None):
        self.framework = framework or EASAFatigueFramework()
    
    def calculate_fdp_limits(self, duty: Duty, augmented_params=None, ulr_params=None) -> Dict[str, float]:
        """
        Calculate EASA FDP limits based on ORO.FTL.205.

        Supports:
        - Standard 2-pilot operations (Table 1)
        - Augmented crew 3/4-pilot operations (CS FTL.1.205(c)(2))
        - ULR operations (Qatar FTL 7.18)
        """
        tz = pytz.timezone(duty.home_base_timezone)
        report_local = duty.report_time_utc.astimezone(tz)
        report_hour = report_local.hour
        sectors = sum(not seg.is_deadhead for seg in duty.segments)
        actual_fdp = duty.fdp_hours

        # ULR operations — Qatar FTL 7.18
        if getattr(duty, 'is_ulr', False) or (
            getattr(duty, 'is_ulr_operation', False) and
            getattr(duty, 'crew_composition', CrewComposition.STANDARD) == CrewComposition.AUGMENTED_4
        ):
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
                'is_ulr': False,
                'crew_composition': duty.crew_composition.value
                    if hasattr(duty.crew_composition, 'value') else 'standard',
            }

        # ORO.FTL.205(b), Table 2 (EASA Air Operations, March 2026).
        # Rows change at 15/30-minute boundaries, not whole hours.
        minute = report_local.hour * 60 + report_local.minute
        if 360 <= minute < 810:
            base = 13.0
        elif 810 <= minute < 1020:
            base = 12.75 - 0.25 * ((minute - 810) // 30)
        elif 300 <= minute < 360:
            base = 12.0 + 0.25 * ((minute - 300) // 15)
        else:
            base = 11.0
        from models.data_models import AcclimatizationState
        if duty.acclimatization_state != AcclimatizationState.ACCLIMATIZED:
            base = 11.0  # Table 3; no assumption of an approved FRM extension.
        max_fdp = max(9.0, base - 0.5 * max(0, sectors - 2)) if sectors else 0.0
        extended_fdp = max_fdp + 2.0
        used_discretion = actual_fdp > max_fdp

        return {
            'max_fdp': max_fdp,
            'extended_fdp': extended_fdp,
            'actual_fdp': actual_fdp,
            'used_discretion': used_discretion,
            'exceeds_discretion': actual_fdp > extended_fdp,
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
        WOCL encroachment (02:00–05:59, AMC1 ORO.FTL.105(10)) is reported
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

