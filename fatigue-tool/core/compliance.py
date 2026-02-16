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
        sectors = len(duty.segments)
        actual_fdp = (duty.release_time_utc - duty.report_time_utc).total_seconds() / 3600

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

        # Standard 2-pilot operations — EASA ORO.FTL.205 Table 1
        fdp_table = {
            6: {1: 13.0, 2: 12.5, 3: 12.0, 4: 11.5, 5: 11.0, 6: 10.5, 7: 10.0, 8: 10.0, 9: 9.5},
            7: {1: 13.0, 2: 12.5, 3: 12.0, 4: 11.5, 5: 11.0, 6: 10.5, 7: 10.0, 8: 10.0, 9: 9.5},
            8: {1: 13.0, 2: 12.5, 3: 12.0, 4: 11.5, 5: 11.0, 6: 10.5, 7: 10.0, 8: 10.0, 9: 9.5},
            9: {1: 13.0, 2: 13.0, 3: 12.5, 4: 12.0, 5: 11.5, 6: 11.0, 7: 10.5, 8: 10.0, 9: 10.0},
            10: {1: 13.0, 2: 13.0, 3: 13.0, 4: 12.5, 5: 12.0, 6: 11.5, 7: 11.0, 8: 10.5, 9: 10.0},
            11: {1: 13.0, 2: 13.0, 3: 13.0, 4: 13.0, 5: 12.5, 6: 12.0, 7: 11.5, 8: 11.0, 9: 10.5},
            12: {1: 13.0, 2: 13.0, 3: 13.0, 4: 13.0, 5: 12.5, 6: 12.0, 7: 11.5, 8: 11.0, 9: 10.5},
            13: {1: 12.5, 2: 12.5, 3: 13.0, 4: 13.0, 5: 12.5, 6: 12.0, 7: 11.5, 8: 11.0, 9: 10.5},
            14: {1: 12.0, 2: 12.0, 3: 12.5, 4: 12.5, 5: 12.5, 6: 12.0, 7: 11.5, 8: 11.0, 9: 10.5},
            15: {1: 11.5, 2: 11.5, 3: 12.0, 4: 12.0, 5: 12.0, 6: 11.5, 7: 11.0, 8: 10.5, 9: 10.0},
            16: {1: 11.0, 2: 11.0, 3: 11.5, 4: 11.5, 5: 11.5, 6: 11.0, 7: 10.5, 8: 10.0, 9: 10.0},
            17: {1: 10.5, 2: 10.5, 3: 11.0, 4: 11.0, 5: 11.0, 6: 10.5, 7: 10.0, 8: 10.0, 9: 9.5},
            0: {1: 10.0, 2: 10.0, 3: 10.5, 4: 10.5, 5: 10.5, 6: 10.0, 7: 10.0, 8: 9.5, 9: 9.5},
            1: {1: 10.0, 2: 10.0, 3: 10.0, 4: 10.0, 5: 10.0, 6: 10.0, 7: 9.5, 8: 9.5, 9: 9.5},
            2: {1: 10.0, 2: 10.0, 3: 10.0, 4: 10.0, 5: 10.0, 6: 10.0, 7: 9.5, 8: 9.5, 9: 9.5},
            3: {1: 10.0, 2: 10.0, 3: 10.0, 4: 10.0, 5: 10.0, 6: 10.0, 7: 9.5, 8: 9.5, 9: 9.5},
            4: {1: 11.0, 2: 11.0, 3: 10.5, 4: 10.0, 5: 10.0, 6: 10.0, 7: 9.5, 8: 9.5, 9: 9.5},
            5: {1: 12.0, 2: 12.0, 3: 11.5, 4: 11.0, 5: 10.5, 6: 10.0, 7: 10.0, 8: 9.5, 9: 9.5},
        }

        sectors_capped = min(sectors, 9)
        max_fdp = fdp_table.get(report_hour, {}).get(sectors_capped, 13.0)
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
            ).replace(tzinfo=tz)
            
            wocl_end = datetime.combine(
                current_day, time(self.framework.wocl_end_hour, self.framework.wocl_end_minute, 59)
            ).replace(tzinfo=tz)
            
            overlap_start = max(duty_start_local, wocl_start)
            overlap_end = min(duty_end_local, wocl_end)
            
            if overlap_start < overlap_end:
                total_encroachment += (overlap_end - overlap_start)
            
            current_day += timedelta(days=1)
        
        return total_encroachment
    
    def is_disruptive_duty(self, duty: Duty) -> Dict[str, any]:
        """Check if duty qualifies as disruptive per EASA GM1 ORO.FTL.235"""
        wocl_encroachment = self.calculate_wocl_encroachment(
            duty.report_time_utc, duty.release_time_utc, duty.home_base_timezone
        )
        wocl_hours = wocl_encroachment.total_seconds() / 3600
        
        return {
            'wocl_encroachment': wocl_hours > 0,
            'wocl_hours': wocl_hours,
            'early_start': duty.report_time_local.hour < self.framework.early_start_threshold_hour,
            'late_finish': self.framework.late_finish_threshold_hour <= duty.release_time_local.hour < self.framework.local_night_end_hour,
            'is_disruptive': (
                wocl_hours > 0 or
                duty.report_time_local.hour < self.framework.early_start_threshold_hour or
                (self.framework.late_finish_threshold_hour <= duty.release_time_local.hour < self.framework.local_night_end_hour)
            )
        }
