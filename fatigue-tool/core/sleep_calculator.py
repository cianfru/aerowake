"""
Sleep Calculation Engine
=======================

Unified sleep estimation for airline pilots with quality analysis.

Strategy dispatch, inter-duty recovery, validation, and circadian gating
live here. Individual strategy implementations are in sleep_strategies.py;
quality calculations are in sleep_quality.py.

References: Signal et al. (2009), Gander et al. (2013), Roach et al. (2012)
"""

from datetime import datetime, timedelta, time
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
import math
import pytz
import logging

logger = logging.getLogger(__name__)

# Import data models
from models.data_models import (
    Duty, Roster, FlightSegment, SleepBlock, CircadianState,
    PerformancePoint, PinchEvent, DutyTimeline, MonthlyAnalysis, FlightPhase,
    CrewComposition
)
from core.parameters import ModelConfig
from core.sleep_quality import SleepQualityAnalysis, SleepQualityEngine
from core.sleep_strategies import SleepStrategyMixin

# Re-export for backward compatibility
SleepQualityAnalysis = SleepQualityAnalysis


@dataclass
class SleepStrategy:
    """Pilot's strategic sleep approach"""
    strategy_type: str
    sleep_blocks: List[SleepBlock]
    confidence: float
    explanation: str
    quality_analysis: List[SleepQualityAnalysis]


# ============================================================================
# UNIFIED SLEEP CALCULATOR
# ============================================================================

class UnifiedSleepCalculator(SleepStrategyMixin):
    """
    Unified sleep estimation engine for airline pilots

    Strategy dispatch, inter-duty recovery, and validation logic.
    Individual strategy implementations inherited from SleepStrategyMixin.
    Quality calculations delegated to SleepQualityEngine.

    References: Signal et al. (2009), Gander et al. (2013), Roach et al. (2012)
    """

    def __init__(self, config: ModelConfig = None):
        self.config = config or ModelConfig.default_easa_config()
        self._quality_engine = SleepQualityEngine(self.config)
        
        # Sleep timing parameters — operational defaults for working-age pilots.
        # Roenneberg et al. (2007) Sleep Med Rev 11:429-438 characterised
        # chronotype distributions (avg free-day mid-sleep ~04:00-05:00);
        # the 23:00 bedtime here reflects alarm-constrained workday timing,
        # consistent with pilot actigraphy in Signal et al. (2009) and
        # Gander et al. (2013).
        self.NORMAL_BEDTIME_HOUR = 23
        self.NORMAL_WAKE_HOUR = 7
        self.NORMAL_SLEEP_DURATION = 8.0
        
        # Minimum pre-duty preparation buffer (hours).
        # Conservative estimate: pilots need time for commute, briefing,
        # personal preparation.  1 h was unrealistic for early-morning
        # starts; 2 h gives a more representative wakefulness-at-report.
        self.MIN_WAKE_BEFORE_REPORT = 2.0

        # Operational thresholds
        self.NIGHT_FLIGHT_THRESHOLD = 20  # EASA late-type duty
        self.EARLY_REPORT_THRESHOLD = 6   # Before 06:00 local → early_bedtime
        self.AFTERNOON_REPORT_THRESHOLD = 14  # After 14:00 local → afternoon_nap
        self.ANCHOR_TIMEZONE_SHIFT = 3.0  # ≥3h timezone crossing → anchor strategy
        self.RESTRICTED_REST_HOURS = 9.0  # <9h rest → restricted strategy
        self.SPLIT_REST_HOURS = 10.0      # <10h rest → split strategy
        self.EXTENDED_REST_HOURS = 14.0   # >14h rest → extended strategy
        
        # WOCL definition — aligned with EASAFatigueFramework (02:00-05:59)
        # per EASA ORO.FTL.105(28). Using 6.0 as float boundary so that
        # hour < 6.0 covers 02:00-05:59 correctly in overlap calculations.
        self.WOCL_START = self.config.easa_framework.wocl_start_hour  # 2
        self.WOCL_END = self.config.easa_framework.wocl_end_hour + 1  # 6 (exclusive upper bound)
        
        # Base efficiency by location — aligned with SleepQualityParameters.
        # Values updated per Signal et al. (2013) PSG data and sleep research.
        # These represent sleep quality multipliers, not TST/TIB ratios.
        self.LOCATION_EFFICIENCY = {
            'home': 0.95,            # Near-optimal: Åkerstedt (2003), Van Dongen (2003)
            'hotel': 0.88,           # Signal et al. (2013) PSG: 88% measured
            'crew_rest': 0.70,       # Signal et al. (2013) PSG: 70% inflight bunk
            'airport_hotel': 0.85,   # Slightly below regular hotel due to noise
            'crew_house': 0.90       # Similar to home environment
        }
        
        # Biological limits
        self.MAX_REALISTIC_SLEEP = 10.0
        self.MIN_SLEEP_FOR_QUALITY = 6.0
        
        self.home_tz = None
        self.home_base = None

    def _home_tz_day_hour(self, dt: datetime) -> tuple:
        """Convert a timezone-aware datetime to (day, decimal_hour) in home base TZ.

        Used for SleepBlock chronogram positioning fields which must all
        reference the same timezone as duty times (home base).
        """
        home_dt = dt.astimezone(self.home_tz)
        return home_dt.day, home_dt.hour + home_dt.minute / 60.0

    def _detect_layover(
        self,
        duty: Duty,
        previous_duty: Optional[Duty],
        home_base: str
    ) -> Tuple[bool, Optional[str], str]:
        """
        Detect if pilot is at a layover location vs. home base

        Returns:
            (is_layover, layover_timezone, environment)
            - is_layover: True if pilot slept at layover location
            - layover_timezone: Timezone of layover location (None if at home)
            - environment: 'hotel' if layover, 'home' if at home base
        """
        if not previous_duty or not previous_duty.segments:
            return False, None, 'home'

        # Training duties (empty segments) are always at home base
        if not duty.segments:
            return False, None, 'home'

        # Where did previous duty end?
        prev_arrival = previous_duty.segments[-1].arrival_airport

        # Where does current duty start?
        curr_departure = duty.segments[0].departure_airport

        # Check if pilot is at layover:
        # 1. Previous duty ended at location X
        # 2. Current duty starts at same location X
        # 3. Location X is NOT the home base
        if (prev_arrival.code == curr_departure.code and
            prev_arrival.code != home_base):
            # LAYOVER SCENARIO
            return True, prev_arrival.timezone, 'hotel'

        return False, None, 'home'

    def estimate_sleep_for_duty(
        self,
        duty: Duty,
        previous_duty: Optional[Duty] = None,
        home_timezone: str = 'UTC',
        home_base: Optional[str] = None
    ) -> SleepStrategy:
        """
        Main entry point: Estimate how pilot actually slept before duty

        Args:
            duty: Current duty to estimate sleep for
            previous_duty: Previous duty (for layover detection)
            home_timezone: Pilot's home base timezone
            home_base: Pilot's home base airport code (e.g., 'DOH')
        """

        self.home_tz = pytz.timezone(home_timezone)
        # Use provided home_base, or infer from first departure if not provided
        self.home_base = home_base or (duty.segments[0].departure_airport.code if duty.segments else None)

        # Detect layover scenario
        is_layover, layover_tz, sleep_env = self._detect_layover(
            duty, previous_duty, self.home_base
        )

        # Store layover info for strategy methods to use
        self.is_layover = is_layover
        self.layover_timezone = layover_tz
        self.sleep_environment = sleep_env

        # Calculate layover duration for acclimatization logic
        self.layover_duration_hours = 0.0
        if is_layover and previous_duty:
            self.layover_duration_hours = (duty.report_time_utc - previous_duty.release_time_utc).total_seconds() / 3600

        # Use layover timezone for strategy selection ONLY after acclimatization (>48h).
        # For short layovers (<48h), pilot's circadian clock remains on home base time
        # (EASA AMC1 ORO.FTL.105). A 05:00 home-time report at a layover should use
        # home timezone for strategy selection, not local timezone.
        strategy_tz = self.home_tz  # Default to home timezone

        if is_layover and layover_tz and previous_duty:
            # Calculate layover duration from previous duty release to current duty report
            layover_duration_hours = (duty.report_time_utc - previous_duty.release_time_utc).total_seconds() / 3600
            # Only use layover timezone if pilot has been at this location >48h (acclimated)
            if layover_duration_hours > 48:
                strategy_tz = pytz.timezone(layover_tz)

        report_local = duty.report_time_utc.astimezone(strategy_tz)
        report_hour = report_local.hour

        # Calculate duty characteristics
        duty_duration = (duty.release_time_utc - duty.report_time_utc).total_seconds() / 3600
        crosses_wocl = self._duty_crosses_wocl(duty)

        # Calculate rest period before this duty
        rest_hours = None
        if previous_duty:
            rest_hours = (duty.report_time_utc - previous_duty.release_time_utc).total_seconds() / 3600

        # Calculate timezone crossing from home base
        timezone_shift = 0.0
        if duty.segments:
            dep_airport = duty.segments[0].departure_airport
            home_airport_tz = pytz.timezone(duty.home_base_timezone)
            dep_tz = pytz.timezone(dep_airport.timezone)
            # Correctly convert UTC time to each timezone to get the offset
            home_offset = duty.report_time_utc.astimezone(home_airport_tz).utcoffset().total_seconds() / 3600
            dep_offset = duty.report_time_utc.astimezone(dep_tz).utcoffset().total_seconds() / 3600
            timezone_shift = abs(dep_offset - home_offset)

        # Decision tree: match pilot behavior patterns
        # Priority order: most constrained/specific scenarios first.

        # 0. AUGMENTED_4 — 4-pilot pre-duty sleep (48h two-night protocol).
        # Dispatch is crew_composition-first; is_ulr is kept as an API/display
        # flag only (set by roster_parser.py).
        crew_comp = getattr(duty, 'crew_composition', CrewComposition.STANDARD)

        if crew_comp == CrewComposition.AUGMENTED_4:
            return self._augmented_4_sleep_strategy(duty, previous_duty)

        # 0.5. 3-pilot augmented crew — single enhanced night + optional nap
        if crew_comp == CrewComposition.AUGMENTED_3:
            return self._augmented_3_pilot_strategy(duty, previous_duty)

        # 1. Anchor sleep — large timezone shift from home base (≥3h).
        #    Pilot's circadian clock is misaligned; maintain home-base
        #    sleep window to preserve circadian anchor.
        if timezone_shift >= self.ANCHOR_TIMEZONE_SHIFT:
            return self._anchor_strategy(duty, previous_duty, timezone_shift)

        # 2. Restricted sleep — very short rest (<9h) forces truncated sleep.
        #    Takes priority because the rest period physically constrains
        #    available sleep regardless of report time.
        if rest_hours is not None and rest_hours < self.RESTRICTED_REST_HOURS:
            return self._restricted_strategy(duty, previous_duty, rest_hours)

        # 3. Split sleep — short layover (<10h) where one consolidated
        #    block is impossible. Pilot splits sleep around the gap.
        if rest_hours is not None and rest_hours < self.SPLIT_REST_HOURS:
            return self._split_strategy(duty, previous_duty, rest_hours)

        # 4. Early bedtime — report before 06:00 local.
        #    Pilot goes to bed earlier; circadian opposition limits advance.
        if report_hour < self.EARLY_REPORT_THRESHOLD:
            return self._early_morning_strategy(duty, previous_duty)

        # 5. Nap — night departure (report ≥20:00 or <04:00).
        #    Morning sleep + pre-duty nap before evening/night flight.
        if report_hour >= self.NIGHT_FLIGHT_THRESHOLD or report_hour < 4:
            return self._night_departure_strategy(duty, previous_duty)

        # 6. Afternoon nap — late report (14:00-20:00 local).
        #    Normal previous-night sleep + afternoon nap before duty.
        if report_hour >= self.AFTERNOON_REPORT_THRESHOLD:
            return self._afternoon_nap_strategy(duty, previous_duty)

        # 7. Extended sleep — long rest period (>14h) allows extra sleep.
        if rest_hours is not None and rest_hours > self.EXTENDED_REST_HOURS:
            return self._extended_strategy(duty, previous_duty, rest_hours)

        # 8. WOCL duty — crosses Window of Circadian Low with long duty.
        if crosses_wocl and duty_duration > 6:
            return self._wocl_duty_strategy(duty, previous_duty)

        # 9. Normal — standard overnight rest, no special constraints.
        return self._normal_sleep_strategy(duty, previous_duty)
    
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
        """Calculate realistic sleep quality — delegates to SleepQualityEngine."""
        return self._quality_engine.calculate_sleep_quality(
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            location=location,
            previous_duty_end=previous_duty_end,
            next_event=next_event,
            is_nap=is_nap,
            location_timezone=location_timezone,
            biological_timezone=biological_timezone,
        )
    
    # ========================================================================
    # SLEEP STRATEGIES — implementations in core/sleep_strategies.py
    # (inherited via SleepStrategyMixin)
    # ========================================================================

    # ========================================================================
    # INTER-DUTY RECOVERY SLEEP
    # ========================================================================

    def generate_inter_duty_sleep(
        self,
        previous_duty: Duty,
        next_duty: Duty,
        home_timezone: str,
        home_base: Optional[str] = None,
        cumulative_sleep_debt: float = 0.0
    ) -> SleepStrategy:
        """
        Generate a single, scientifically grounded recovery sleep block for the
        rest period between two duties.

        This replaces the previous dual-generation approach (post-duty sleep +
        pre-duty sleep) which could overlap and double-count recovery.  Instead,
        a single block is produced per inter-duty gap, with:

        1. **Onset** anchored to duty release + arrival-window delay
           (Roach et al. 2025; Signal et al. 2013)
        2. **Duration** scaled by prior wakefulness / homeostatic load
           (Banks et al. 2010; Kitamura et al. 2016)
        3. **Wake time** gated by the circadian morning signal (07:00
           biological time as a floor, not a ceiling) — extended when sleep
           starts late due to high homeostatic pressure
           (Dijk & Czeisler 1995; Borbély 1982)

        References:
            Signal et al. (2013) J Sleep Res 22(6):697-706
            Roach et al. (2025) PMC11879054
            Banks et al. (2010) Sleep 33(8):1013-1026
            Kitamura et al. (2016) Sci Rep 6:35812
            Dijk & Czeisler (1995) J Neurosci 15:3526
            Borbély (1982) Human Neurobiol 1:195-204
        """
        self.home_tz = pytz.timezone(home_timezone)
        self.home_base = home_base or (
            next_duty.segments[0].departure_airport.code
            if next_duty.segments else None
        )

        # --- Determine sleep location ---
        arrival_airport = previous_duty.segments[-1].arrival_airport if previous_duty.segments else None
        if arrival_airport and arrival_airport.code != self.home_base:
            sleep_tz = pytz.timezone(arrival_airport.timezone)
            sleep_location = 'hotel'
            is_layover = True
        else:
            sleep_tz = self.home_tz
            sleep_location = 'home'
            is_layover = False

        release_local = previous_duty.release_time_utc.astimezone(sleep_tz)
        release_hour = release_local.hour + release_local.minute / 60.0
        report_utc = next_duty.report_time_utc

        # --- Layover duration for acclimatization ---
        layover_duration_hours = (
            report_utc - previous_duty.release_time_utc
        ).total_seconds() / 3600
        acclimated = is_layover and layover_duration_hours > 48

        # Biological timezone: home for short layovers, local for acclimated
        bio_tz_str = (
            sleep_tz.zone if (not is_layover or acclimated)
            else self.home_tz.zone
        )
        bio_tz = pytz.timezone(bio_tz_str)

        # --- 1. Sleep onset: release time + arrival-window delay ---
        # Roach et al. (2025): layover sleep onset predicted by layover start
        # Signal et al. (2013): ~1-2h wind-down after duty release
        #
        # IMPORTANT: Use biological time (not local) for un-acclimated pilots.
        # A pilot landing at 14:00 local when their body says 22:00 should be
        # classified as an evening arrival, not afternoon.
        bio_release = previous_duty.release_time_utc.astimezone(bio_tz)
        bio_release_hour = bio_release.hour + bio_release.minute / 60.0

        if bio_release_hour >= 20 or bio_release_hour < 4:
            # Night on biological clock — high sleep pressure + circadian permission
            onset_delay_hours = 1.5
        elif 4 <= bio_release_hour < 12:
            # Morning on biological clock — circadian wake signal opposes sleep
            onset_delay_hours = 2.5
        elif 12 <= bio_release_hour < 17:
            # Afternoon on biological clock — wake maintenance zone.
            # Delay until ~22:00 biological time.
            hours_to_bio_evening = (22.0 - bio_release_hour) % 24
            onset_delay_hours = max(2.0, hours_to_bio_evening)
        else:
            # Evening on biological clock (17:00-20:00) — approaching biological night
            onset_delay_hours = 2.0

        # Modulate onset by sleep pressure: higher pressure → faster onset
        # Åkerstedt (2003): sleep latency shortens under high homeostatic load
        duty_duration_hours = (
            previous_duty.release_time_utc - previous_duty.report_time_utc
        ).total_seconds() / 3600
        prior_wake_estimate = duty_duration_hours + self.MIN_WAKE_BEFORE_REPORT
        if prior_wake_estimate > 18:
            onset_delay_hours = max(1.0, onset_delay_hours - 0.5)
        elif prior_wake_estimate > 14:
            onset_delay_hours = max(1.0, onset_delay_hours - 0.25)

        sleep_start = release_local + timedelta(hours=onset_delay_hours)

        # --- 2. Duration: scaled by prior wakefulness ---
        # Banks et al. (2010): recovery sleep 8.5-9.5h after restriction
        # Kitamura et al. (2016): saturates at ~8-9h
        # Signal et al. (2013): average ~7.5h for standard duty
        base_duration = 7.5
        if prior_wake_estimate > 16:
            # Extended wakefulness → longer recovery (up to 9.5h ceiling)
            base_duration = min(9.5, 7.5 + 0.25 * (prior_wake_estimate - 16))
        elif prior_wake_estimate < 10:
            # Short duty → slightly less recovery needed
            base_duration = max(6.5, 7.5 - 0.2 * (10 - prior_wake_estimate))

        # Recovery sleep rebound (Banks 2010, Kitamura 2016)
        # Cumulative sleep debt drives longer recovery sleep via
        # homeostatic rebound. Capped at ~10h by circadian wake gate.
        if cumulative_sleep_debt > 0:
            rebound_coeff = self.config.borbely_params.sleep_rebound_coeff
            max_debt = self.config.borbely_params.sleep_rebound_max_debt
            rebound_hours = rebound_coeff * min(cumulative_sleep_debt, max_debt)
            base_duration = min(10.0, base_duration + rebound_hours)

        # Morning arrivals (biological clock): circadian opposition truncates
        # daytime recovery nap.  Pilots whose body clock says morning
        # struggle to maintain sleep against the circadian wake signal.
        # National Academies (2011): ~2.5h actual sleep from a daytime nap
        # opportunity.  General sleep science: post-deprivation daytime naps
        # truncated to 3-5h by circadian opposition.  We use 3-4h as the
        # realistic range (higher end when prior wake > 16h).
        # Include pre-dawn arrivals (04:00-06:00) — functionally similar
        # to morning: pilot arrives near dawn and needs daytime nap + night.
        is_morning_arrival = 4 <= bio_release_hour < 12
        if is_morning_arrival:
            # Recovery nap: 3-4h depending on prior wakefulness
            # National Academies (2011): 2.5h actual from 3h opportunity
            # Higher pressure (>16h awake) allows slightly longer nap
            if prior_wake_estimate > 16:
                base_duration = min(base_duration, 4.0)
            else:
                base_duration = min(base_duration, 3.5)

        # --- 3. Determine if gap is long enough for nap + night sleep ---
        # For morning arrivals with a long gap, the pilot will have:
        #   (a) A short daytime recovery nap (2.5-4h, circadian-truncated)
        #   (b) A normal or anticipated night sleep before the next duty
        # For shorter gaps or evening/night arrivals, one block suffices.
        #
        # References:
        #   National Academies (2011): recovery nap + anticipated bedtime
        #   Arsintescu et al. (2022): pilots advance bedtime by 1-2h max
        #   Rempe et al. (2025): WOCL-window arrivals → ~6.8h total/24h
        total_gap_hours = (report_utc - previous_duty.release_time_utc).total_seconds() / 3600
        report_local = report_utc.astimezone(sleep_tz)
        latest_wake_utc = report_utc - timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)

        # Determine anticipated bedtime based on next duty report time.
        # Arsintescu et al. (2022) found pilots averaged 21:15 bedtime
        # before early starts — roughly 1-2h advance from habitual ~23:00.
        # National Academies (2011): attempting bed at 21:00, actual onset
        # ~22:00 due to the wake maintenance zone (WMZ, 19:00-22:00 bio).
        #
        # Strategy: use habitual bedtime (23:00) as default, then advance
        # by 1-2h when next duty requires it (report before ~07:00 bio).
        report_bio = report_utc.astimezone(bio_tz)
        report_bio_hour = report_bio.hour + report_bio.minute / 60.0

        if report_bio_hour < 7.0 or report_bio_hour >= 22.0:
            # Early/WOCL duty: anticipate bedtime by 1-2h
            # Arsintescu (2022): avg 21:15 for 05:00-07:00 starts
            # For WOCL (report 22:00-04:00): use 21:00 bio time
            anticipated_bedtime_hour = 21.0
        else:
            anticipated_bedtime_hour = float(self.NORMAL_BEDTIME_HOUR)  # 23.0

        # Compute anticipated bedtime in sleep timezone
        nap_end_time = sleep_start + timedelta(hours=base_duration)
        nap_end_bio = nap_end_time.astimezone(bio_tz)
        bio_bedtime = nap_end_bio.replace(
            hour=int(anticipated_bedtime_hour),
            minute=int((anticipated_bedtime_hour % 1) * 60),
            second=0, microsecond=0
        )
        if bio_bedtime <= nap_end_bio:
            bio_bedtime += timedelta(days=1)
        bio_bedtime_in_sleep_tz = bio_bedtime.astimezone(sleep_tz)

        # Time from nap end to anticipated bedtime (waking gap between sleeps)
        waking_gap = (bio_bedtime_in_sleep_tz - nap_end_time).total_seconds() / 3600
        # Time from anticipated bedtime to next duty latest wake
        night_available = (latest_wake_utc - bio_bedtime.astimezone(pytz.utc)).total_seconds() / 3600

        # Two-block condition: morning/daytime arrival AND enough gap for
        # a waking period of >=2h between nap and night sleep AND
        # pre-duty sleep of >=1.5h (one full NREM cycle ≈ 90 min).
        #
        # The 1.5h minimum covers pre-WOCL anticipatory sleep (e.g. report
        # 00:55 → latest wake 22:55, bedtime 21:00 → ~2h sleep). This is
        # short but realistic: pilots attempt pre-duty sleep even when
        # the window is constrained by the WMZ and early report.
        # Rempe et al. (2025): WOCL-window arrivals yield ~6.8h total/24h,
        # often split across a short daytime nap + short pre-duty sleep.
        needs_two_blocks = (
            is_morning_arrival
            and waking_gap >= 2.0
            and night_available >= 1.5
        )

        if needs_two_blocks:
            return self._two_block_recovery(
                sleep_start=sleep_start,
                nap_duration=base_duration,
                bio_bedtime=bio_bedtime_in_sleep_tz,
                report_local=report_local,
                latest_wake_utc=latest_wake_utc,
                sleep_tz=sleep_tz,
                bio_tz=bio_tz,
                bio_tz_str=bio_tz_str,
                sleep_location=sleep_location,
                is_layover=is_layover,
                previous_duty=previous_duty,
                onset_delay_hours=onset_delay_hours,
                duty_duration_hours=duty_duration_hours,
                prior_wake_estimate=prior_wake_estimate,
            )

        # --- Single block path (evening/night arrival or short gap) ---
        sleep_end = self._circadian_gated_wake(
            sleep_start=sleep_start,
            base_duration=base_duration,
            bio_tz=bio_tz,
            sleep_tz=sleep_tz,
        )

        # Cap by next duty report minus wake buffer
        if sleep_end.astimezone(pytz.utc) > latest_wake_utc:
            sleep_end = latest_wake_utc.astimezone(sleep_tz)

        # Ensure minimum viable sleep (2h)
        actual_hours = (sleep_end - sleep_start).total_seconds() / 3600
        if actual_hours < 2.0:
            # Severely constrained — use whatever is available
            sleep_start = previous_duty.release_time_utc.astimezone(sleep_tz) + timedelta(hours=0.5)
            sleep_end = latest_wake_utc.astimezone(sleep_tz)
            actual_hours = (sleep_end - sleep_start).total_seconds() / 3600
            if actual_hours < 1.0:
                # Cannot produce a meaningful sleep block
                return SleepStrategy(
                    strategy_type='restricted',
                    sleep_blocks=[],
                    confidence=0.20,
                    explanation=(
                        f"Critically insufficient rest: {actual_hours:.1f}h available "
                        f"between duties — regulatory violation likely"
                    ),
                    quality_analysis=[]
                )

        # --- Quality calculation ---
        sleep_quality = self.calculate_sleep_quality(
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            location=sleep_location,
            previous_duty_end=previous_duty.release_time_utc,
            next_event=report_local,
            location_timezone=sleep_tz.zone,
            biological_timezone=bio_tz_str if is_layover else None
        )

        ss_day, ss_hour = self._home_tz_day_hour(sleep_start)
        se_day, se_hour = self._home_tz_day_hour(sleep_end)
        recovery_block = SleepBlock(
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

        # --- Confidence ---
        actual_hours = sleep_quality.actual_sleep_hours
        if actual_hours >= 7:
            confidence = 0.80
        elif actual_hours >= 5:
            confidence = 0.65
        else:
            confidence = 0.45

        if is_layover:
            confidence *= 0.90  # More variability away from home

        if prior_wake_estimate > 16:
            confidence *= 0.95  # Extreme fatigue → less predictable behavior

        location_desc = f"{sleep_location} (layover)" if is_layover else sleep_location
        return SleepStrategy(
            strategy_type='inter_duty_recovery',
            sleep_blocks=[recovery_block],
            confidence=confidence,
            explanation=(
                f"Inter-duty recovery at {location_desc}: "
                f"{onset_delay_hours:.1f}h wind-down after {duty_duration_hours:.0f}h duty, "
                f"{sleep_quality.actual_sleep_hours:.1f}h sleep "
                f"({sleep_quality.effective_sleep_hours:.1f}h effective, "
                f"{sleep_quality.sleep_efficiency:.0%} efficiency)"
            ),
            quality_analysis=[sleep_quality]
        )

    # _two_block_recovery is inherited from SleepStrategyMixin

    def _circadian_gated_wake(
        self,
        sleep_start: datetime,
        base_duration: float,
        bio_tz: Any,
        sleep_tz: Any,
    ) -> datetime:
        """
        Compute wake time considering circadian phase and sleep duration.

        For evening onset (18:00-23:59 bio), sleep ends at whichever is
        later: sleep_start + base_duration OR biological morning (07:00),
        but never exceeds base_duration + 1h.  This prevents unrealistic
        10h blocks when bedtime is early (e.g. 21:00 → 07:00 = 10h); a
        pilot going to bed early may have delayed onset (wake maintenance
        zone) and will wake naturally after ~8-8.5h of sleep.

        For post-midnight onset, duration dominates (high homeostatic
        pressure) and the pilot sleeps through the biological morning,
        capped at MAX_REALISTIC_SLEEP.

        For daytime onset, duration dominates (circadian opposition
        prevents extended sleep).

        References:
            Dijk & Czeisler (1995) J Neurosci 15:3526
            Borbély (1982) Human Neurobiol 1:195-204
            Åkerstedt & Gillberg (1986) J Sleep Res — WMZ limits early bedtime
        """
        duration_wake = sleep_start + timedelta(hours=base_duration)

        # Determine biological time of sleep onset
        sleep_start_bio = sleep_start.astimezone(bio_tz)
        bio_hour = sleep_start_bio.hour + sleep_start_bio.minute / 60.0

        # Classify onset into biological windows:
        #   Evening/night onset (18:00-23:59): circadian gate applies (soft floor)
        #   Post-midnight onset (00:00-06:00): duration dominates (high pressure)
        #   Daytime onset (06:00-18:00): duration dominates (circadian opposition)
        is_evening_onset = 18.0 <= bio_hour <= 23.99
        is_post_midnight_onset = bio_hour < 6.0

        if is_evening_onset:
            # Normal evening sleep: circadian morning (07:00) is a soft floor.
            # Pilot won't wake before biological morning even if duration
            # would suggest earlier wake (e.g. 23:00 + 7.5h = 06:30 →
            # gate extends to 07:00).
            # However, cap the extension to avoid unrealistic durations —
            # a pilot in bed at 21:00 bio doesn't sleep 10h.  The wake
            # maintenance zone (19:00-22:00) delays actual sleep onset,
            # so effective sleep is base_duration even though time-in-bed
            # may be longer. Cap at base_duration + 1h (accounts for
            # slight circadian extension without producing absurd blocks).
            bio_morning = sleep_start_bio.replace(
                hour=self.NORMAL_WAKE_HOUR, minute=0, second=0, microsecond=0
            )
            # Morning is always the next calendar day for evening onset
            bio_morning += timedelta(days=1)
            bio_morning_in_sleep_tz = bio_morning.astimezone(sleep_tz)
            # Gate extends to bio morning, but never more than +1h beyond base
            max_wake = sleep_start + timedelta(hours=base_duration + 1.0)
            gated_wake = max(duration_wake, bio_morning_in_sleep_tz)
            return min(gated_wake, max_wake)

        elif is_post_midnight_onset:
            # Late-onset sleep: homeostatic pressure is very high.
            # Pilot sleeps through the biological morning signal.
            # Cap at MAX_REALISTIC_SLEEP (10h) as biological ceiling.
            max_duration_wake = sleep_start + timedelta(hours=self.MAX_REALISTIC_SLEEP)
            return min(duration_wake, max_duration_wake)

        else:
            # Daytime sleep (06:00-19:00 biological time):
            # Pilot is sleeping against circadian opposition.  Wake is
            # determined purely by homeostatic duration — the circadian
            # morning gate does NOT apply (it already passed or is too
            # far away to be relevant).
            return duration_wake

    # ========================================================================
    # HELPER METHODS
    # ========================================================================

    def _validate_sleep_no_overlap(
        self,
        sleep_start: datetime,
        sleep_end: datetime,
        duty: Duty,
        previous_duty: Optional[Duty] = None
    ) -> Tuple[datetime, datetime, List[str]]:
        """Validate sleep doesn't overlap with duty periods"""
        
        warnings = []
        adjusted_start = sleep_start
        adjusted_end = sleep_end
        
        # Check overlap with current duty — enforce MIN_WAKE_BEFORE_REPORT (2h)
        # gap, not just 30 minutes. Pilots need time for commute, briefing, etc.
        min_wake_gap = timedelta(hours=self.MIN_WAKE_BEFORE_REPORT)
        if adjusted_end > duty.report_time_utc - min_wake_gap:
            adjusted_end = duty.report_time_utc - min_wake_gap
            warnings.append("Sleep truncated: enforcing minimum wake period before report")
        
        # Check overlap with previous duty
        if previous_duty and adjusted_start < previous_duty.release_time_utc:
            adjusted_start = previous_duty.release_time_utc + timedelta(hours=1)
            warnings.append("Sleep delayed: previous duty not yet released")
        
        # Ensure valid sleep period
        if adjusted_start >= adjusted_end:
            if previous_duty:
                earliest_sleep = previous_duty.release_time_utc + timedelta(minutes=30)
            else:
                earliest_sleep = duty.report_time_utc - timedelta(hours=8)
            
            latest_sleep = duty.report_time_utc - min_wake_gap
            time_available = (latest_sleep - earliest_sleep).total_seconds() / 3600
            
            if time_available >= 2:
                adjusted_start = earliest_sleep
                adjusted_end = latest_sleep
                warnings.append("WARNING: Sleep severely constrained by duty schedule")
            elif time_available >= 1:
                adjusted_start = earliest_sleep
                adjusted_end = latest_sleep
                warnings.append("CRITICAL: Less than 2h rest between duties")
            else:
                adjusted_end = duty.report_time_utc - timedelta(minutes=30)
                adjusted_start = adjusted_end - timedelta(hours=1)
                warnings.append("CRITICAL: Insufficient rest period - regulatory violation likely")
        
        return adjusted_start, adjusted_end, warnings
    
    def _duty_crosses_wocl(self, duty: Duty) -> bool:
        """Check if duty encroaches on WOCL (02:00-06:00)"""
        start_local = duty.report_time_utc.astimezone(self.home_tz)
        end_local = duty.release_time_utc.astimezone(self.home_tz)
        
        current = start_local
        while current <= end_local:
            if self.WOCL_START <= current.hour < self.WOCL_END:
                return True
            current += timedelta(hours=1)
        
        return False

