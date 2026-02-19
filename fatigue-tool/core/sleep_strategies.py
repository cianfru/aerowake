"""
Sleep Strategy Implementations
==============================

Individual sleep strategy methods for different duty scenarios.
Each strategy follows the same pattern:
1. Determine sleep location (home vs layover)
2. Calculate sleep block timing
3. Validate for duty overlaps
4. Compute quality factors
5. Return SleepStrategy with sleep blocks and confidence

Used as a mixin by UnifiedSleepCalculator.

References:
    Signal et al. (2009, 2013, 2014), Gander et al. (2013, 2014),
    Roach et al. (2012), Arsintescu et al. (2022),
    Dijk & Czeisler (1994, 1995), Dinges et al. (1987)
"""

from datetime import datetime, timedelta
from typing import Optional, Any
import pytz

from models.data_models import Duty, SleepBlock
from core.sleep_quality import SleepQualityAnalysis


# Forward reference — the actual SleepStrategy dataclass is defined
# in sleep_calculator.py to avoid circular imports.  At runtime the
# mixin methods are called on an instance that has the class in scope.


class SleepStrategyMixin:
    """
    Mixin providing all sleep strategy implementations.

    Expects the host class to provide:
        self.home_tz, self.home_base, self.is_layover,
        self.layover_timezone, self.sleep_environment,
        self.layover_duration_hours,
        self.NORMAL_BEDTIME_HOUR, self.NORMAL_WAKE_HOUR,
        self.NORMAL_SLEEP_DURATION, self.MIN_WAKE_BEFORE_REPORT,
        self.MAX_REALISTIC_SLEEP,
        self.calculate_sleep_quality(), self._validate_sleep_no_overlap(),
        self._circadian_gated_wake(), self._home_tz_day_hour()
    """

    def _night_departure_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty]
    ) -> 'SleepStrategy':
        """
        Night flight strategy: morning sleep + pre-duty nap

        Signal et al. (2014) found 54% of crew napped before evening
        departures, with typical nap durations of 1-2 hours. Gander et al.
        (2014) reported ~7.8h total pre-trip sleep (including naps).

        References:
            Signal et al. (2014) Aviat Space Environ Med 85:1199-1208
            Gander et al. (2014) Aviat Space Environ Med 85(8):833-40
        """
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        morning_sleep_start = report_local.replace(hour=self.NORMAL_BEDTIME_HOUR, minute=0) - timedelta(days=1)
        morning_sleep_end = report_local.replace(hour=7, minute=0)

        morning_sleep_start_utc, morning_sleep_end_utc, morning_warnings = self._validate_sleep_no_overlap(
            morning_sleep_start.astimezone(pytz.utc), morning_sleep_end.astimezone(pytz.utc), duty, previous_duty
        )
        morning_sleep_start = morning_sleep_start_utc.astimezone(sleep_tz)
        morning_sleep_end = morning_sleep_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        morning_quality = self.calculate_sleep_quality(
            sleep_start=morning_sleep_start,
            sleep_end=morning_sleep_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ms_day, ms_hour = self._home_tz_day_hour(morning_sleep_start)
        me_day, me_hour = self._home_tz_day_hour(morning_sleep_end)
        morning_sleep = SleepBlock(
            start_utc=morning_sleep_start.astimezone(pytz.utc),
            end_utc=morning_sleep_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=morning_quality.actual_sleep_hours,
            quality_factor=morning_quality.sleep_efficiency,
            effective_sleep_hours=morning_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=ms_day,
            sleep_start_hour=ms_hour,
            sleep_end_day=me_day,
            sleep_end_hour=me_hour
        )

        nap_end = report_local - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        nap_start = nap_end - timedelta(hours=2.0)

        nap_start_utc, nap_end_utc, nap_warnings = self._validate_sleep_no_overlap(
            nap_start.astimezone(pytz.utc), nap_end.astimezone(pytz.utc), duty, previous_duty
        )
        nap_start = nap_start_utc.astimezone(sleep_tz)
        nap_end = nap_end_utc.astimezone(sleep_tz)

        nap_quality = self.calculate_sleep_quality(
            sleep_start=nap_start,
            sleep_end=nap_end,
            location=sleep_location,
            previous_duty_end=morning_sleep_end.astimezone(pytz.utc),
            next_event=report_local,
            is_nap=True,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ns_day, ns_hour = self._home_tz_day_hour(nap_start)
        ne_day, ne_hour = self._home_tz_day_hour(nap_end)
        afternoon_nap = SleepBlock(
            start_utc=nap_start.astimezone(pytz.utc),
            end_utc=nap_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=nap_quality.actual_sleep_hours,
            quality_factor=nap_quality.sleep_efficiency,
            effective_sleep_hours=nap_quality.effective_sleep_hours,
            is_anchor_sleep=False,
            environment=sleep_location,
            sleep_start_day=ns_day,
            sleep_start_hour=ns_hour,
            sleep_end_day=ne_day,
            sleep_end_hour=ne_hour
        )

        total_effective = morning_quality.effective_sleep_hours + nap_quality.effective_sleep_hours
        confidence = 0.60 if not (morning_warnings or nap_warnings) else 0.45
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='nap',
            sleep_blocks=[morning_sleep, afternoon_nap],
            confidence=confidence,
            explanation=f"Night departure at {location_desc}: {morning_quality.actual_sleep_hours:.1f}h + "
                       f"{nap_quality.actual_sleep_hours:.1f}h nap = {total_effective:.1f}h effective",
            quality_analysis=[morning_quality, nap_quality]
        )

    def _early_morning_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty]
    ) -> 'SleepStrategy':
        """
        Early report strategy: constrained early bedtime

        References:
            Roach et al. (2012) Accid Anal Prev 45 Suppl:22-26
            Arsintescu et al. (2022) J Sleep Res 31(3):e13521
        """
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        report_hour = report_local.hour + report_local.minute / 60.0
        sleep_duration = max(4.0, 6.6 - 0.25 * max(0, 9.0 - report_hour))

        wake_time = report_local - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        sleep_end = wake_time
        earliest_bedtime = report_local.replace(hour=21, minute=30) - timedelta(days=1)
        sleep_start = max(earliest_bedtime, sleep_end - timedelta(hours=sleep_duration))

        sleep_start_utc, sleep_end_utc, sleep_warnings = self._validate_sleep_no_overlap(
            sleep_start.astimezone(pytz.utc), sleep_end.astimezone(pytz.utc), duty, previous_duty
        )
        sleep_start = sleep_start_utc.astimezone(sleep_tz)
        sleep_end = sleep_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        sleep_quality = self.calculate_sleep_quality(
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ss_day, ss_hour = self._home_tz_day_hour(sleep_start)
        se_day, se_hour = self._home_tz_day_hour(sleep_end)
        early_sleep = SleepBlock(
            start_utc=sleep_start.astimezone(pytz.utc),
            end_utc=sleep_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=sleep_quality.actual_sleep_hours,
            quality_factor=sleep_quality.sleep_efficiency,
            effective_sleep_hours=sleep_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=ss_day,
            sleep_start_hour=ss_hour,
            sleep_end_day=se_day,
            sleep_end_hour=se_hour
        )

        confidence = 0.55 if not sleep_warnings else 0.40
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='early_bedtime',
            sleep_blocks=[early_sleep],
            confidence=confidence,
            explanation=f"Early report at {location_desc}: Constrained bedtime = {sleep_quality.effective_sleep_hours:.1f}h effective "
                       f"(Roach 2012 regression: {sleep_duration:.1f}h predicted)",
            quality_analysis=[sleep_quality]
        )

    def _wocl_duty_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty]
    ) -> 'SleepStrategy':
        """WOCL duty strategy: anchor sleep before duty"""
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        anchor_end = report_local - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        anchor_start = anchor_end - timedelta(hours=4.5)

        anchor_start_utc, anchor_end_utc, anchor_warnings = self._validate_sleep_no_overlap(
            anchor_start.astimezone(pytz.utc), anchor_end.astimezone(pytz.utc), duty, previous_duty
        )
        anchor_start = anchor_start_utc.astimezone(sleep_tz)
        anchor_end = anchor_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        anchor_quality = self.calculate_sleep_quality(
            sleep_start=anchor_start,
            sleep_end=anchor_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        as_day, as_hour = self._home_tz_day_hour(anchor_start)
        ae_day, ae_hour = self._home_tz_day_hour(anchor_end)
        anchor_sleep = SleepBlock(
            start_utc=anchor_start.astimezone(pytz.utc),
            end_utc=anchor_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=anchor_quality.actual_sleep_hours,
            quality_factor=anchor_quality.sleep_efficiency,
            effective_sleep_hours=anchor_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=as_day,
            sleep_start_hour=as_hour,
            sleep_end_day=ae_day,
            sleep_end_hour=ae_hour
        )

        confidence = 0.50 if not anchor_warnings else 0.35
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='split',
            sleep_blocks=[anchor_sleep],
            confidence=confidence,
            explanation=f"WOCL duty at {location_desc}: Split sleep = {anchor_quality.effective_sleep_hours:.1f}h effective",
            quality_analysis=[anchor_quality]
        )

    def _normal_sleep_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty]
    ) -> 'SleepStrategy':
        """Normal daytime duty - standard sleep pattern"""
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)
        sleep_start = report_local.replace(hour=self.NORMAL_BEDTIME_HOUR, minute=0) - timedelta(days=1)

        bio_tz = pytz.timezone(
            self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48)
            else sleep_tz.zone
        )

        sleep_end = self._circadian_gated_wake(
            sleep_start=sleep_start,
            base_duration=self.NORMAL_SLEEP_DURATION,
            bio_tz=bio_tz,
            sleep_tz=sleep_tz,
        )

        latest_wake = report_local - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        if sleep_end > latest_wake:
            sleep_end = latest_wake

        sleep_start_utc, sleep_end_utc, sleep_warnings = self._validate_sleep_no_overlap(
            sleep_start.astimezone(pytz.utc), sleep_end.astimezone(pytz.utc), duty, previous_duty
        )
        sleep_start = sleep_start_utc.astimezone(sleep_tz)
        sleep_end = sleep_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        sleep_quality = self.calculate_sleep_quality(
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ss_day, ss_hour = self._home_tz_day_hour(sleep_start)
        se_day, se_hour = self._home_tz_day_hour(sleep_end)
        normal_sleep = SleepBlock(
            start_utc=sleep_start.astimezone(pytz.utc),
            end_utc=sleep_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=sleep_quality.actual_sleep_hours,
            quality_factor=sleep_quality.sleep_efficiency,
            effective_sleep_hours=sleep_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=ss_day,
            sleep_start_hour=ss_hour,
            sleep_end_day=se_day,
            sleep_end_hour=se_hour
        )

        awake_hours = (report_local - sleep_end).total_seconds() / 3600

        if awake_hours < 2:
            confidence = 0.95
        elif awake_hours < 6:
            confidence = 0.90
        elif awake_hours < 10:
            confidence = 0.80
        else:
            confidence = 0.70

        if sleep_warnings:
            confidence *= 0.8
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='normal',
            sleep_blocks=[normal_sleep],
            confidence=confidence,
            explanation=f"Normal sleep at {location_desc} ({sleep_quality.effective_sleep_hours:.1f}h effective), {awake_hours:.1f}h awake before duty",
            quality_analysis=[sleep_quality]
        )

    def _ulr_sleep_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty]
    ) -> 'SleepStrategy':
        """ULR pre-duty sleep strategy per Qatar FTL 7.18.4.3.

        Layover-aware: for return ULR legs (e.g. MIA→DOH), sleep blocks
        are anchored to the LOCAL timezone where the pilot physically
        sleeps (hotel at layover station), not the home base timezone.
        The biological_timezone parameter captures circadian misalignment
        for sleep quality calculations.
        """
        from core.sleep_calculator import SleepStrategy

        # Determine where the pilot actually sleeps before this ULR duty.
        # Outbound (at home base): home_tz, 'home' environment.
        # Return (at layover station): layover_tz, 'hotel' environment.
        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment  # 'hotel'
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        # Biological timezone: if on layover <48h, body clock is still
        # on home base time (EASA AMC1 ORO.FTL.105 acclimatisation).
        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        blocks = []
        quality_analyses = []

        # Earliest permissible sleep start — cannot begin before previous duty ends.
        # Compare in UTC throughout to avoid DST / pytz ambiguity.
        earliest_sleep_utc = (
            previous_duty.release_time_utc if previous_duty is not None
            else None
        )

        # Night 1: 2 nights before duty (in local sleep timezone)
        night1_start = report_local.replace(hour=23, minute=0, second=0) - timedelta(days=2)
        night1_end = report_local.replace(hour=7, minute=0, second=0) - timedelta(days=1)

        # Clamp Night 1 start to previous duty release (UTC comparison).
        if earliest_sleep_utc is not None:
            if night1_start.astimezone(pytz.utc) < earliest_sleep_utc:
                night1_start = earliest_sleep_utc.astimezone(sleep_tz)

        # Only emit Night 1 if at least 30 minutes of sleep remain.
        if night1_end - night1_start >= timedelta(minutes=30):
            night1_quality = self.calculate_sleep_quality(
                sleep_start=night1_start,
                sleep_end=night1_end,
                location=sleep_location,
                previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
                next_event=night1_end + timedelta(hours=12),
                location_timezone=sleep_tz.zone,
                biological_timezone=bio_tz
            )
            quality_analyses.append(night1_quality)

            n1s_day, n1s_hour = self._home_tz_day_hour(night1_start)
            n1e_day, n1e_hour = self._home_tz_day_hour(night1_end)
            blocks.append(SleepBlock(
                start_utc=night1_start.astimezone(pytz.utc),
                end_utc=night1_end.astimezone(pytz.utc),
                location_timezone=sleep_tz.zone,
                duration_hours=night1_quality.actual_sleep_hours,
                quality_factor=night1_quality.sleep_efficiency,
                effective_sleep_hours=night1_quality.effective_sleep_hours,
                environment=sleep_location,
                sleep_start_day=n1s_day,
                sleep_start_hour=n1s_hour,
                sleep_end_day=n1e_day,
                sleep_end_hour=n1e_hour,
            ))

        # Night 2: night before duty (in local sleep timezone)
        night2_start = report_local.replace(hour=23, minute=0, second=0) - timedelta(days=1)
        night2_end = report_local.replace(hour=7, minute=0, second=0)

        # Cap night2_end at report_time - MIN_WAKE_BEFORE_REPORT (2h).
        # For early-morning departures (e.g. report 06:30) the hard-coded
        # 07:00 wake would put the sleep bar 30 min past duty start.
        latest_wake_utc = duty.report_time_utc - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        latest_wake_local = latest_wake_utc.astimezone(sleep_tz)
        if night2_end > latest_wake_local:
            night2_end = latest_wake_local

        # Clamp night2_start so it cannot begin before previous duty ends.
        # Compare in UTC to avoid DST / pytz ambiguity.
        if earliest_sleep_utc is not None:
            if night2_start.astimezone(pytz.utc) < earliest_sleep_utc:
                night2_start = earliest_sleep_utc.astimezone(sleep_tz)

        # Only emit Night 2 if there is at least 30 minutes of sleep available.
        if night2_end - night2_start >= timedelta(minutes=30):
            night2_quality = self.calculate_sleep_quality(
                sleep_start=night2_start,
                sleep_end=night2_end,
                location=sleep_location,
                previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
                next_event=report_local,
                location_timezone=sleep_tz.zone,
                biological_timezone=bio_tz
            )
            quality_analyses.append(night2_quality)

            n2s_day, n2s_hour = self._home_tz_day_hour(night2_start)
            n2e_day, n2e_hour = self._home_tz_day_hour(night2_end)
            blocks.append(SleepBlock(
                start_utc=night2_start.astimezone(pytz.utc),
                end_utc=night2_end.astimezone(pytz.utc),
                location_timezone=sleep_tz.zone,
                duration_hours=night2_quality.actual_sleep_hours,
                quality_factor=night2_quality.sleep_efficiency,
                effective_sleep_hours=night2_quality.effective_sleep_hours,
                environment=sleep_location,
                sleep_start_day=n2s_day,
                sleep_start_hour=n2s_hour,
                sleep_end_day=n2e_day,
                sleep_end_hour=n2e_hour,
            ))

        # Optional pre-departure nap for evening departures.
        # Skip the nap if it would start before the previous duty releases.
        report_hour = report_local.hour
        if report_hour >= 18 or report_hour < 2:
            nap_start = report_local - timedelta(hours=4)
            nap_end = report_local - timedelta(hours=2)

            # Guard: nap cannot start before previous duty ends (UTC comparison).
            if earliest_sleep_utc is not None:
                if nap_start.astimezone(pytz.utc) < earliest_sleep_utc:
                    nap_start = earliest_sleep_utc.astimezone(sleep_tz)

            # Only emit nap if at least 20 minutes remain.
            if nap_end - nap_start >= timedelta(minutes=20):
                nap_quality = self.calculate_sleep_quality(
                    sleep_start=nap_start,
                    sleep_end=nap_end,
                    location=sleep_location,
                    previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
                    next_event=report_local,
                    is_nap=True,
                    location_timezone=sleep_tz.zone,
                    biological_timezone=bio_tz
                )
                quality_analyses.append(nap_quality)

                nps_day, nps_hour = self._home_tz_day_hour(nap_start)
                npe_day, npe_hour = self._home_tz_day_hour(nap_end)
                blocks.append(SleepBlock(
                    start_utc=nap_start.astimezone(pytz.utc),
                    end_utc=nap_end.astimezone(pytz.utc),
                    location_timezone=sleep_tz.zone,
                    duration_hours=nap_quality.actual_sleep_hours,
                    quality_factor=nap_quality.sleep_efficiency,
                    effective_sleep_hours=nap_quality.effective_sleep_hours,
                    is_anchor_sleep=False,
                    environment=sleep_location,
                    sleep_start_day=nps_day,
                    sleep_start_hour=nps_hour,
                    sleep_end_day=npe_day,
                    sleep_end_hour=npe_hour,
                ))

        total_effective = sum(q.effective_sleep_hours for q in quality_analyses)
        location_desc = f"{sleep_location} ({sleep_tz.zone})" if self.is_layover else "home"

        return SleepStrategy(
            strategy_type='ulr_pre_duty',
            sleep_blocks=blocks,
            confidence=0.85 if not self.is_layover else 0.75,
            explanation=(
                f"ULR pre-duty: 2 nights {location_desc} sleep + "
                f"{'pre-departure nap' if len(blocks) > 2 else 'no nap'} "
                f"({total_effective:.1f}h effective). "
                f"48h duty-free per Qatar FTL 7.18.4.3"
            ),
            quality_analysis=quality_analyses
        )

    def _augmented_3_pilot_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty]
    ) -> 'SleepStrategy':
        """
        Sleep strategy for 3-pilot augmented crews (AUGMENTED_3).

        Layover-aware: for return legs departing from a layover station,
        sleep is anchored to the local timezone where the pilot
        physically sleeps (hotel), not the home base timezone.

        Different from ULR (4-pilot) strategy:
        - Single night of enhanced sleep (not 48h protocol)
        - May include pre-duty nap for night departures
        - EASA CS-FTL.1.205 allows FDP extension to 16h with 3 pilots

        References:
            EASA CS FTL.1.205(c)(2) - 3-pilot augmented crew requirements
        """
        from core.sleep_calculator import SleepStrategy

        # Determine where the pilot actually sleeps before this duty.
        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment  # 'hotel'
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        # Biological timezone for circadian quality calculation.
        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        blocks = []
        quality_analyses = []

        # Single night: night before duty (enhanced quality for augmented crew)
        night_start = report_local.replace(hour=22, minute=0, second=0) - timedelta(days=1)
        night_end = report_local.replace(hour=7, minute=0, second=0)

        # Validate against duty overlaps
        night_start_utc, night_end_utc, warnings = self._validate_sleep_no_overlap(
            night_start.astimezone(pytz.utc),
            night_end.astimezone(pytz.utc),
            duty,
            previous_duty
        )
        night_start = night_start_utc.astimezone(sleep_tz)
        night_end = night_end_utc.astimezone(sleep_tz)

        night_quality = self.calculate_sleep_quality(
            sleep_start=night_start,
            sleep_end=night_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )
        quality_analyses.append(night_quality)

        n_day, n_hour = self._home_tz_day_hour(night_start)
        ne_day, ne_hour = self._home_tz_day_hour(night_end)
        blocks.append(SleepBlock(
            start_utc=night_start.astimezone(pytz.utc),
            end_utc=night_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=night_quality.actual_sleep_hours,
            quality_factor=night_quality.sleep_efficiency,
            effective_sleep_hours=night_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=n_day,
            sleep_start_hour=n_hour,
            sleep_end_day=ne_day,
            sleep_end_hour=ne_hour,
        ))

        # Optional pre-duty nap for night departures (report ≥20:00 or <04:00)
        report_hour = report_local.hour
        if report_hour >= 20 or report_hour < 4:
            nap_start = report_local - timedelta(hours=3)
            nap_end = report_local - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)

            nap_start_utc, nap_end_utc, nap_warnings = self._validate_sleep_no_overlap(
                nap_start.astimezone(pytz.utc),
                nap_end.astimezone(pytz.utc),
                duty,
                previous_duty
            )
            nap_start = nap_start_utc.astimezone(sleep_tz)
            nap_end = nap_end_utc.astimezone(sleep_tz)

            nap_quality = self.calculate_sleep_quality(
                sleep_start=nap_start,
                sleep_end=nap_end,
                location=sleep_location,
                previous_duty_end=None,
                next_event=report_local,
                is_nap=True,
                location_timezone=sleep_tz.zone,
                biological_timezone=bio_tz
            )
            quality_analyses.append(nap_quality)

            nps_day, nps_hour = self._home_tz_day_hour(nap_start)
            npe_day, npe_hour = self._home_tz_day_hour(nap_end)
            blocks.append(SleepBlock(
                start_utc=nap_start.astimezone(pytz.utc),
                end_utc=nap_end.astimezone(pytz.utc),
                location_timezone=sleep_tz.zone,
                duration_hours=nap_quality.actual_sleep_hours,
                quality_factor=nap_quality.sleep_efficiency,
                effective_sleep_hours=nap_quality.effective_sleep_hours,
                is_anchor_sleep=False,
                environment=sleep_location,
                sleep_start_day=nps_day,
                sleep_start_hour=nps_hour,
                sleep_end_day=npe_day,
                sleep_end_hour=npe_hour,
            ))

        total_effective = sum(q.effective_sleep_hours for q in quality_analyses)
        location_desc = f"{sleep_location} ({sleep_tz.zone})" if self.is_layover else "home"

        return SleepStrategy(
            strategy_type='augmented_3_pilot',
            sleep_blocks=blocks,
            confidence=0.80 if not self.is_layover else 0.70,
            explanation=(
                f"3-pilot augmented crew: Enhanced night sleep at {location_desc} + "
                f"{'pre-duty nap' if len(blocks) > 1 else 'no nap'} "
                f"({total_effective:.1f}h effective). "
                f"EASA CS-FTL.1.205 augmented crew operation"
            ),
            quality_analysis=quality_analyses
        )

    def _anchor_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty],
        timezone_shift: float
    ) -> 'SleepStrategy':
        """Anchor sleep: maintain home-base sleep window across timezones."""
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)
        report_home = duty.report_time_utc.astimezone(self.home_tz)

        home_bedtime = report_home.replace(hour=self.NORMAL_BEDTIME_HOUR, minute=0) - timedelta(days=1)
        home_wake = report_home.replace(hour=self.NORMAL_WAKE_HOUR, minute=0)

        if home_wake.astimezone(pytz.utc) > duty.report_time_utc - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT):
            home_wake = (duty.report_time_utc - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)).astimezone(self.home_tz)

        sleep_start = home_bedtime.astimezone(sleep_tz)
        sleep_end = home_wake.astimezone(sleep_tz)

        sleep_start_utc, sleep_end_utc, sleep_warnings = self._validate_sleep_no_overlap(
            sleep_start.astimezone(pytz.utc), sleep_end.astimezone(pytz.utc), duty, previous_duty
        )
        sleep_start = sleep_start_utc.astimezone(sleep_tz)
        sleep_end = sleep_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone

        sleep_quality = self.calculate_sleep_quality(
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ss_day, ss_hour = self._home_tz_day_hour(sleep_start)
        se_day, se_hour = self._home_tz_day_hour(sleep_end)
        anchor_sleep = SleepBlock(
            start_utc=sleep_start.astimezone(pytz.utc),
            end_utc=sleep_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=sleep_quality.actual_sleep_hours,
            quality_factor=sleep_quality.sleep_efficiency,
            effective_sleep_hours=sleep_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=ss_day,
            sleep_start_hour=ss_hour,
            sleep_end_day=se_day,
            sleep_end_hour=se_hour
        )

        if timezone_shift < 5:
            confidence = 0.55
        elif timezone_shift < 8:
            confidence = 0.45
        else:
            confidence = 0.35

        if sleep_warnings:
            confidence *= 0.80
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='anchor',
            sleep_blocks=[anchor_sleep],
            confidence=confidence,
            explanation=(
                f"Anchor sleep at {location_desc}: {timezone_shift:.1f}h timezone shift, "
                f"maintaining home-base sleep window "
                f"({sleep_quality.effective_sleep_hours:.1f}h effective)"
            ),
            quality_analysis=[sleep_quality]
        )

    def _restricted_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty],
        rest_hours: float
    ) -> 'SleepStrategy':
        """Restricted sleep: short rest period (<9h) forces truncated sleep."""
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        if previous_duty:
            sleep_start = previous_duty.release_time_utc + timedelta(hours=1)
        else:
            sleep_start = duty.report_time_utc - timedelta(hours=rest_hours - 1)

        sleep_end = duty.report_time_utc - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)

        sleep_start_local = sleep_start.astimezone(sleep_tz)
        sleep_end_local = sleep_end.astimezone(sleep_tz)

        sleep_start_utc, sleep_end_utc, sleep_warnings = self._validate_sleep_no_overlap(
            sleep_start, sleep_end, duty, previous_duty
        )
        sleep_start_local = sleep_start_utc.astimezone(sleep_tz)
        sleep_end_local = sleep_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        sleep_quality = self.calculate_sleep_quality(
            sleep_start=sleep_start_local,
            sleep_end=sleep_end_local,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ss_day, ss_hour = self._home_tz_day_hour(sleep_start_local)
        se_day, se_hour = self._home_tz_day_hour(sleep_end_local)
        restricted_sleep = SleepBlock(
            start_utc=sleep_start_utc,
            end_utc=sleep_end_utc,
            location_timezone=sleep_tz.zone,
            duration_hours=sleep_quality.actual_sleep_hours,
            quality_factor=sleep_quality.sleep_efficiency,
            effective_sleep_hours=sleep_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=ss_day,
            sleep_start_hour=ss_hour,
            sleep_end_day=se_day,
            sleep_end_hour=se_hour
        )

        confidence = 0.45 if not sleep_warnings else 0.30
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='restricted',
            sleep_blocks=[restricted_sleep],
            confidence=confidence,
            explanation=(
                f"Restricted sleep at {location_desc}: only {rest_hours:.1f}h rest period, "
                f"{sleep_quality.effective_sleep_hours:.1f}h effective sleep "
                f"(truncated by schedule constraints)"
            ),
            quality_analysis=[sleep_quality]
        )

    def _split_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty],
        rest_hours: float
    ) -> 'SleepStrategy':
        """Split sleep: short layover (9-10h rest) with main block + nap."""
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        if previous_duty:
            main_start = previous_duty.release_time_utc + timedelta(hours=1)
        else:
            main_start = duty.report_time_utc - timedelta(hours=rest_hours - 1)

        available_sleep_hours = rest_hours - 1.0 - self.MIN_WAKE_BEFORE_REPORT
        main_duration = min(6.0, available_sleep_hours * 0.70)
        main_end = main_start + timedelta(hours=main_duration)

        main_start_local = main_start.astimezone(sleep_tz)
        main_end_local = main_end.astimezone(sleep_tz)

        main_start_utc, main_end_utc, main_warnings = self._validate_sleep_no_overlap(
            main_start, main_end, duty, previous_duty
        )
        main_start_local = main_start_utc.astimezone(sleep_tz)
        main_end_local = main_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        main_quality = self.calculate_sleep_quality(
            sleep_start=main_start_local,
            sleep_end=main_end_local,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ms_day, ms_hour = self._home_tz_day_hour(main_start_local)
        me_day, me_hour = self._home_tz_day_hour(main_end_local)
        main_sleep = SleepBlock(
            start_utc=main_start_utc,
            end_utc=main_end_utc,
            location_timezone=sleep_tz.zone,
            duration_hours=main_quality.actual_sleep_hours,
            quality_factor=main_quality.sleep_efficiency,
            effective_sleep_hours=main_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=ms_day,
            sleep_start_hour=ms_hour,
            sleep_end_day=me_day,
            sleep_end_hour=me_hour
        )

        nap_end = duty.report_time_utc - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        nap_duration = min(2.0, available_sleep_hours - main_duration)
        if nap_duration < 0.5:
            confidence = 0.40 if not main_warnings else 0.30
            if self.is_layover:
                confidence *= 0.90
            location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
            return SleepStrategy(
                strategy_type='split',
                sleep_blocks=[main_sleep],
                confidence=confidence,
                explanation=(
                    f"Split sleep at {location_desc}: {rest_hours:.1f}h rest, "
                    f"{main_quality.effective_sleep_hours:.1f}h effective "
                    f"(insufficient time for nap block)"
                ),
                quality_analysis=[main_quality]
            )

        nap_start = nap_end - timedelta(hours=nap_duration)
        nap_start_local = nap_start.astimezone(sleep_tz)
        nap_end_local = nap_end.astimezone(sleep_tz)

        if nap_start < main_end_utc:
            nap_start = main_end_utc + timedelta(minutes=30)
            nap_start_local = nap_start.astimezone(sleep_tz)

        if nap_start >= nap_end:
            confidence = 0.40 if not main_warnings else 0.30
            if self.is_layover:
                confidence *= 0.90
            location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
            return SleepStrategy(
                strategy_type='split',
                sleep_blocks=[main_sleep],
                confidence=confidence,
                explanation=(
                    f"Split sleep at {location_desc}: {rest_hours:.1f}h rest, "
                    f"{main_quality.effective_sleep_hours:.1f}h effective "
                    f"(no room for second block)"
                ),
                quality_analysis=[main_quality]
            )

        nap_quality = self.calculate_sleep_quality(
            sleep_start=nap_start_local,
            sleep_end=nap_end_local,
            location=sleep_location,
            previous_duty_end=main_end_utc,
            next_event=report_local,
            is_nap=True,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ns_day, ns_hour = self._home_tz_day_hour(nap_start_local)
        ne_day, ne_hour = self._home_tz_day_hour(nap_end_local)
        nap_block = SleepBlock(
            start_utc=nap_start,
            end_utc=nap_end,
            location_timezone=sleep_tz.zone,
            duration_hours=nap_quality.actual_sleep_hours,
            quality_factor=nap_quality.sleep_efficiency,
            effective_sleep_hours=nap_quality.effective_sleep_hours,
            is_anchor_sleep=False,
            environment=sleep_location,
            sleep_start_day=ns_day,
            sleep_start_hour=ns_hour,
            sleep_end_day=ne_day,
            sleep_end_hour=ne_hour
        )

        total_effective = main_quality.effective_sleep_hours + nap_quality.effective_sleep_hours
        confidence = 0.50 if not (main_warnings) else 0.35
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='split',
            sleep_blocks=[main_sleep, nap_block],
            confidence=confidence,
            explanation=(
                f"Split sleep at {location_desc}: {rest_hours:.1f}h rest, "
                f"{main_quality.effective_sleep_hours:.1f}h + "
                f"{nap_quality.effective_sleep_hours:.1f}h nap = "
                f"{total_effective:.1f}h effective"
            ),
            quality_analysis=[main_quality, nap_quality]
        )

    def _afternoon_nap_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty]
    ) -> 'SleepStrategy':
        """Afternoon nap: late report (14:00-20:00) with night sleep + nap."""
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        night_start = report_local.replace(hour=self.NORMAL_BEDTIME_HOUR, minute=0) - timedelta(days=1)
        night_end = report_local.replace(hour=self.NORMAL_WAKE_HOUR, minute=0)

        night_start_utc, night_end_utc, night_warnings = self._validate_sleep_no_overlap(
            night_start.astimezone(pytz.utc), night_end.astimezone(pytz.utc), duty, previous_duty
        )
        night_start = night_start_utc.astimezone(sleep_tz)
        night_end = night_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        night_quality = self.calculate_sleep_quality(
            sleep_start=night_start,
            sleep_end=night_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        nts_day, nts_hour = self._home_tz_day_hour(night_start)
        nte_day, nte_hour = self._home_tz_day_hour(night_end)
        night_sleep = SleepBlock(
            start_utc=night_start.astimezone(pytz.utc),
            end_utc=night_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=night_quality.actual_sleep_hours,
            quality_factor=night_quality.sleep_efficiency,
            effective_sleep_hours=night_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=nts_day,
            sleep_start_hour=nts_hour,
            sleep_end_day=nte_day,
            sleep_end_hour=nte_hour
        )

        nap_end = report_local - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        nap_start = nap_end - timedelta(hours=1.5)

        nap_start_utc, nap_end_utc, nap_warnings = self._validate_sleep_no_overlap(
            nap_start.astimezone(pytz.utc), nap_end.astimezone(pytz.utc), duty, previous_duty
        )
        nap_start = nap_start_utc.astimezone(sleep_tz)
        nap_end = nap_end_utc.astimezone(sleep_tz)

        nap_quality = self.calculate_sleep_quality(
            sleep_start=nap_start,
            sleep_end=nap_end,
            location=sleep_location,
            previous_duty_end=night_end.astimezone(pytz.utc),
            next_event=report_local,
            is_nap=True,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        nps_day, nps_hour = self._home_tz_day_hour(nap_start)
        npe_day, npe_hour = self._home_tz_day_hour(nap_end)
        nap_block = SleepBlock(
            start_utc=nap_start.astimezone(pytz.utc),
            end_utc=nap_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=nap_quality.actual_sleep_hours,
            quality_factor=nap_quality.sleep_efficiency,
            effective_sleep_hours=nap_quality.effective_sleep_hours,
            is_anchor_sleep=False,
            environment=sleep_location,
            sleep_start_day=nps_day,
            sleep_start_hour=nps_hour,
            sleep_end_day=npe_day,
            sleep_end_hour=npe_hour
        )

        total_effective = night_quality.effective_sleep_hours + nap_quality.effective_sleep_hours
        confidence = 0.60 if not (night_warnings or nap_warnings) else 0.45
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='afternoon_nap',
            sleep_blocks=[night_sleep, nap_block],
            confidence=confidence,
            explanation=(
                f"Afternoon nap at {location_desc}: "
                f"{night_quality.actual_sleep_hours:.1f}h night + "
                f"{nap_quality.actual_sleep_hours:.1f}h nap = "
                f"{total_effective:.1f}h effective (late {report_local.strftime('%H:%M')} report)"
            ),
            quality_analysis=[night_quality, nap_quality]
        )

    def _extended_strategy(
        self,
        duty: Duty,
        previous_duty: Optional[Duty],
        rest_hours: float
    ) -> 'SleepStrategy':
        """Extended sleep: long rest period (>14h) allows recovery opportunity."""
        from core.sleep_calculator import SleepStrategy

        if self.is_layover and self.layover_timezone:
            sleep_tz = pytz.timezone(self.layover_timezone)
            sleep_location = self.sleep_environment
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'

        report_local = duty.report_time_utc.astimezone(sleep_tz)

        sleep_start = report_local.replace(hour=self.NORMAL_BEDTIME_HOUR, minute=0) - timedelta(days=1)

        extended_duration = min(9.0, self.MAX_REALISTIC_SLEEP)
        bio_tz_obj = pytz.timezone(
            self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48)
            else sleep_tz.zone
        )
        sleep_end = self._circadian_gated_wake(
            sleep_start=sleep_start,
            base_duration=extended_duration,
            bio_tz=bio_tz_obj,
            sleep_tz=sleep_tz,
        )
        latest_wake = report_local - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        if sleep_end > latest_wake:
            sleep_end = latest_wake

        sleep_start_utc, sleep_end_utc, sleep_warnings = self._validate_sleep_no_overlap(
            sleep_start.astimezone(pytz.utc), sleep_end.astimezone(pytz.utc), duty, previous_duty
        )
        sleep_start = sleep_start_utc.astimezone(sleep_tz)
        sleep_end = sleep_end_utc.astimezone(sleep_tz)

        bio_tz = self.home_tz.zone if (self.is_layover and self.layover_duration_hours <= 48) else None

        sleep_quality = self.calculate_sleep_quality(
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc if previous_duty else None,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz
        )

        ss_day, ss_hour = self._home_tz_day_hour(sleep_start)
        se_day, se_hour = self._home_tz_day_hour(sleep_end)
        extended_sleep = SleepBlock(
            start_utc=sleep_start.astimezone(pytz.utc),
            end_utc=sleep_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=sleep_quality.actual_sleep_hours,
            quality_factor=sleep_quality.sleep_efficiency,
            effective_sleep_hours=sleep_quality.effective_sleep_hours,
            environment=sleep_location,
            sleep_start_day=ss_day,
            sleep_start_hour=ss_hour,
            sleep_end_day=se_day,
            sleep_end_hour=se_hour
        )

        confidence = 0.85 if not sleep_warnings else 0.70
        if self.is_layover:
            confidence *= 0.90

        location_desc = f"{sleep_location} (layover)" if self.is_layover else sleep_location
        return SleepStrategy(
            strategy_type='extended',
            sleep_blocks=[extended_sleep],
            confidence=confidence,
            explanation=(
                f"Extended sleep at {location_desc}: {rest_hours:.1f}h rest period, "
                f"{sleep_quality.effective_sleep_hours:.1f}h effective "
                f"(recovery opportunity)"
            ),
            quality_analysis=[sleep_quality]
        )

    def _two_block_recovery(
        self,
        sleep_start: datetime,
        nap_duration: float,
        bio_bedtime: datetime,
        report_local: datetime,
        latest_wake_utc: datetime,
        sleep_tz: Any,
        bio_tz: Any,
        bio_tz_str: str,
        sleep_location: str,
        is_layover: bool,
        previous_duty: Duty,
        onset_delay_hours: float,
        duty_duration_hours: float,
        prior_wake_estimate: float,
    ) -> 'SleepStrategy':
        """
        Two-block recovery for morning arrivals with long inter-duty gaps:
        daytime recovery nap + normal night sleep.
        """
        from core.sleep_calculator import SleepStrategy

        bio_tz_for_quality = bio_tz_str if is_layover else None

        # Block 1: Daytime recovery nap
        nap_end = sleep_start + timedelta(hours=nap_duration)

        nap_quality = self.calculate_sleep_quality(
            sleep_start=sleep_start,
            sleep_end=nap_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc,
            next_event=bio_bedtime,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz_for_quality
        )

        ss_day, ss_hour = self._home_tz_day_hour(sleep_start)
        ne_day, ne_hour = self._home_tz_day_hour(nap_end)
        nap_block = SleepBlock(
            start_utc=sleep_start.astimezone(pytz.utc),
            end_utc=nap_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=nap_quality.actual_sleep_hours,
            quality_factor=nap_quality.sleep_efficiency,
            effective_sleep_hours=nap_quality.effective_sleep_hours,
            environment=sleep_location,
            is_anchor_sleep=False,
            sleep_start_day=ss_day,
            sleep_start_hour=ss_hour,
            sleep_end_day=ne_day,
            sleep_end_hour=ne_hour
        )

        # Block 2: Night sleep
        night_start = bio_bedtime
        night_end = self._circadian_gated_wake(
            sleep_start=night_start,
            base_duration=self.NORMAL_SLEEP_DURATION,
            bio_tz=bio_tz,
            sleep_tz=sleep_tz,
        )
        if night_end.astimezone(pytz.utc) > latest_wake_utc:
            night_end = latest_wake_utc.astimezone(sleep_tz)

        night_quality = self.calculate_sleep_quality(
            sleep_start=night_start,
            sleep_end=night_end,
            location=sleep_location,
            previous_duty_end=nap_end.astimezone(pytz.utc),
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz_for_quality
        )

        nts_day, nts_hour = self._home_tz_day_hour(night_start)
        nte_day, nte_hour = self._home_tz_day_hour(night_end)
        night_block = SleepBlock(
            start_utc=night_start.astimezone(pytz.utc),
            end_utc=night_end.astimezone(pytz.utc),
            location_timezone=sleep_tz.zone,
            duration_hours=night_quality.actual_sleep_hours,
            quality_factor=night_quality.sleep_efficiency,
            effective_sleep_hours=night_quality.effective_sleep_hours,
            environment=sleep_location,
            is_anchor_sleep=True,
            sleep_start_day=nts_day,
            sleep_start_hour=nts_hour,
            sleep_end_day=nte_day,
            sleep_end_hour=nte_hour
        )

        total_effective = nap_quality.effective_sleep_hours + night_quality.effective_sleep_hours
        confidence = 0.70
        if is_layover:
            confidence *= 0.90
        if prior_wake_estimate > 16:
            confidence *= 0.95

        location_desc = f"{sleep_location} (layover)" if is_layover else sleep_location
        return SleepStrategy(
            strategy_type='inter_duty_recovery',
            sleep_blocks=[nap_block, night_block],
            confidence=confidence,
            explanation=(
                f"Inter-duty recovery at {location_desc}: "
                f"{onset_delay_hours:.1f}h wind-down after {duty_duration_hours:.0f}h duty, "
                f"{nap_quality.actual_sleep_hours:.1f}h daytime nap + "
                f"{night_quality.actual_sleep_hours:.1f}h night sleep = "
                f"{total_effective:.1f}h effective"
            ),
            quality_analysis=[nap_quality, night_quality]
        )
