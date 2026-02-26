"""
Sleep Quality Analysis Engine
=============================

Calculates realistic sleep quality using multiplicative efficiency factors
based on location, circadian alignment, sleep pressure, and schedule
constraints.

Extracted from UnifiedSleepCalculator for maintainability.

References:
    Signal et al. (2013) J Sleep Res — hotel PSG 88%, bunk 70%
    Dijk & Czeisler (1995) J Neurosci — circadian consolidation
    Kecklund & Åkerstedt (2004) J Sleep Res — anticipatory stress
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass
import pytz
import logging

logger = logging.getLogger(__name__)


@dataclass
class SleepQualityAnalysis:
    """Detailed breakdown of sleep quality factors"""
    total_sleep_hours: float
    actual_sleep_hours: float
    effective_sleep_hours: float
    sleep_efficiency: float

    # Factor breakdown
    base_efficiency: float
    wocl_penalty: float
    late_onset_penalty: float
    recovery_boost: float
    time_pressure_factor: float
    insufficient_penalty: float

    # Context
    wocl_overlap_hours: float
    sleep_start_hour: float
    hours_since_duty: Optional[float]
    hours_until_duty: Optional[float]

    # Warnings
    warnings: List[Dict[str, str]]


class SleepQualityEngine:
    """
    Computes sleep quality from multiplicative efficiency factors.

    Seven factors applied to raw sleep duration:
    1. Base location efficiency (home/hotel/bunk)
    2. Circadian alignment (WOCL overlap)
    3. Late sleep onset penalty
    4. Recovery boost (post-duty SWA rebound)
    5. Time pressure factor
    6. Insufficient sleep penalty (currently disabled — avoids double-count)
    7. Nap penalty (Stage 1-2 dominant)
    """

    def __init__(self, config):
        self.config = config

        # WOCL boundaries from EASA framework
        self.WOCL_START = config.easa_framework.wocl_start_hour  # 2
        self.WOCL_END = config.easa_framework.wocl_end_hour + 1  # 6

        # Base efficiency by location
        self.LOCATION_EFFICIENCY = {
            'home': 0.95,
            'hotel': 0.88,
            'crew_rest': 0.70,
            'airport_hotel': 0.85,
            'crew_house': 0.90,
        }

        self.MAX_REALISTIC_SLEEP = 10.0
        self.MIN_SLEEP_FOR_QUALITY = 6.0

    def calculate_sleep_quality(
        self,
        sleep_start: datetime,
        sleep_end: datetime,
        location: str,
        previous_duty_end: Optional[datetime],
        next_event: datetime,
        is_nap: bool = False,
        location_timezone: str = 'UTC',
        biological_timezone: str = None
    ) -> SleepQualityAnalysis:
        """Calculate realistic sleep quality with all factors.

        Args:
            biological_timezone: The timezone representing the pilot's current
                circadian phase.  For home-base sleep this equals
                ``location_timezone``; for layovers it is the home-base TZ
                (short layovers) or partially adapted TZ (longer layovers).
                When ``None``, defaults to ``location_timezone``.
        """

        # 1. Calculate raw duration
        total_hours = (sleep_end - sleep_start).total_seconds() / 3600

        # 2. Apply biological sleep limit
        actual_duration = min(total_hours, self.MAX_REALISTIC_SLEEP) if not is_nap else total_hours

        # 3. Base efficiency by location
        base_efficiency = self.LOCATION_EFFICIENCY.get(location, 0.85)
        if is_nap:
            base_efficiency *= 0.88

        # 4. Circadian alignment factor — BONUS for WOCL-aligned sleep only
        # Sleep that substantially covers the WOCL window (02:00-06:00) benefits
        # from concentrated slow-wave sleep. Non-WOCL sleep is NOT penalized.
        # Reference: Signal et al. (2013) — SWS concentrated during WOCL hours.
        wocl_overlap = self._calculate_wocl_overlap(sleep_start, sleep_end, location_timezone, biological_timezone)
        if wocl_overlap >= 2.0 and actual_duration > 0.5:
            wocl_boost = 1.05  # Full WOCL coverage bonus
        elif wocl_overlap >= 1.0 and actual_duration > 0.5:
            wocl_boost = 1.02  # Partial WOCL coverage bonus
        else:
            wocl_boost = 1.0   # No penalty for non-WOCL sleep

        # 5. Late sleep onset penalty
        tz = pytz.timezone(location_timezone)
        bio_tz_for_onset = pytz.timezone(biological_timezone) if biological_timezone else tz
        sleep_start_bio_local = sleep_start.astimezone(bio_tz_for_onset)
        sleep_start_hour = sleep_start_bio_local.hour + sleep_start_bio_local.minute / 60.0

        if sleep_start_hour >= 1 and sleep_start_hour < 4:
            late_onset_penalty = 0.93
        elif sleep_start_hour >= 0 and sleep_start_hour < 1:
            late_onset_penalty = 0.97
        else:
            late_onset_penalty = 1.0

        if 17 <= sleep_start_hour < 21:
            wmz_center = 19.0
            wmz_distance = abs(sleep_start_hour - wmz_center) / 2.0
            wmz_penalty = 0.93 + 0.07 * min(1.0, wmz_distance)
            late_onset_penalty = min(late_onset_penalty, wmz_penalty)

        # 6. Recovery sleep boost
        if previous_duty_end:
            hours_since_duty = (sleep_start - previous_duty_end).total_seconds() / 3600
            if hours_since_duty < 2 and not is_nap:
                recovery_boost = 1.05
            elif hours_since_duty < 4 and not is_nap:
                recovery_boost = 1.03
            else:
                recovery_boost = 1.0
        else:
            recovery_boost = 1.0
            hours_since_duty = None

        # 7. Time pressure factor
        hours_until_duty = (next_event - sleep_end).total_seconds() / 3600

        if hours_until_duty < 1.5:
            time_pressure_factor = 0.93
        elif hours_until_duty < 3:
            time_pressure_factor = 0.96
        elif hours_until_duty < 6:
            time_pressure_factor = 0.98
        else:
            time_pressure_factor = 1.0

        # 8. Insufficient sleep penalty (disabled — avoids double-counting)
        insufficient_penalty = 1.0

        # 9. Combine all factors
        combined_efficiency = (
            base_efficiency
            * wocl_boost
            * late_onset_penalty
            * recovery_boost
            * time_pressure_factor
            * insufficient_penalty
        )
        combined_efficiency = max(0.70, min(1.0, combined_efficiency))

        # 10. Calculate effective sleep
        effective_sleep_hours = actual_duration * combined_efficiency

        # 11. Generate warnings
        warnings = self._generate_sleep_warnings(
            effective_sleep_hours, actual_duration, wocl_overlap, hours_until_duty, is_nap
        )

        return SleepQualityAnalysis(
            total_sleep_hours=total_hours,
            actual_sleep_hours=actual_duration,
            effective_sleep_hours=effective_sleep_hours,
            sleep_efficiency=combined_efficiency,
            base_efficiency=base_efficiency,
            wocl_penalty=wocl_boost,
            late_onset_penalty=late_onset_penalty,
            recovery_boost=recovery_boost,
            time_pressure_factor=time_pressure_factor,
            insufficient_penalty=insufficient_penalty,
            wocl_overlap_hours=wocl_overlap,
            sleep_start_hour=sleep_start_hour,
            hours_since_duty=hours_since_duty,
            hours_until_duty=hours_until_duty,
            warnings=warnings
        )

    def _calculate_wocl_overlap(
        self,
        sleep_start: datetime,
        sleep_end: datetime,
        location_timezone: str = 'UTC',
        biological_timezone: str = None
    ) -> float:
        """Calculate hours of sleep overlapping WOCL (02:00-06:00) in biological TZ."""

        wocl_tz_str = biological_timezone or location_timezone
        wocl_tz = pytz.timezone(wocl_tz_str)

        sleep_start_bio = sleep_start.astimezone(wocl_tz)
        sleep_end_bio = sleep_end.astimezone(wocl_tz)

        sleep_start_hour = sleep_start_bio.hour + sleep_start_bio.minute / 60.0
        sleep_end_hour = sleep_end_bio.hour + sleep_end_bio.minute / 60.0

        overlap_hours = 0.0

        if sleep_end_hour < sleep_start_hour or sleep_end_bio.date() > sleep_start_bio.date():
            if sleep_start_hour < self.WOCL_END:
                day1_overlap_start = max(sleep_start_hour, self.WOCL_START)
                day1_overlap_end = min(24.0, self.WOCL_END)
                if day1_overlap_start < day1_overlap_end:
                    overlap_hours += day1_overlap_end - day1_overlap_start

            if sleep_end_hour > self.WOCL_START:
                day2_overlap_start = max(0.0, self.WOCL_START)
                day2_overlap_end = min(sleep_end_hour, self.WOCL_END)
                if day2_overlap_start < day2_overlap_end:
                    overlap_hours += day2_overlap_end - day2_overlap_start
        else:
            if sleep_start_hour < self.WOCL_END and sleep_end_hour > self.WOCL_START:
                overlap_start = max(sleep_start_hour, self.WOCL_START)
                overlap_end = min(sleep_end_hour, self.WOCL_END)
                overlap_hours = max(0.0, overlap_end - overlap_start)

        return overlap_hours

    def _generate_sleep_warnings(
        self,
        effective_sleep: float,
        actual_duration: float,
        wocl_overlap: float,
        hours_until_duty: float,
        is_nap: bool
    ) -> List[Dict[str, str]]:
        """Generate user-facing warnings about sleep quality"""

        warnings = []

        if not is_nap:
            if effective_sleep < 5:
                warnings.append({
                    'severity': 'critical',
                    'message': f'Critically insufficient sleep: {effective_sleep:.1f}h effective',
                    'recommendation': 'Consider fatigue mitigation or duty adjustment'
                })
            elif effective_sleep < 6:
                warnings.append({
                    'severity': 'high',
                    'message': f'Insufficient sleep: {effective_sleep:.1f}h effective',
                    'recommendation': 'Extra vigilance required on next duty'
                })
            elif effective_sleep < 7:
                warnings.append({
                    'severity': 'moderate',
                    'message': f'Below optimal sleep: {effective_sleep:.1f}h effective',
                    'recommendation': 'Monitor fatigue levels during duty'
                })

        if wocl_overlap > 2.5 and effective_sleep < 6:
            warnings.append({
                'severity': 'info',
                'message': f'{wocl_overlap:.1f}h sleep during WOCL may reduce quality',
                'recommendation': 'Circadian misalignment detected'
            })

        if hours_until_duty and hours_until_duty < 2 and actual_duration < 5:
            warnings.append({
                'severity': 'critical',
                'message': 'Very short turnaround with minimal sleep',
                'recommendation': 'Report fatigue concerns to operations'
            })

        return warnings
