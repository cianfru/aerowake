"""
Borbély Two-Process Fatigue Model
================================

Main biomathematical fatigue model implementation combining:
- Homeostatic Process S (sleep pressure)
- Circadian Process C (biological rhythm)
- Sleep debt tracking
- Performance prediction

Scientific Foundation:
    Borbély & Achermann (1999), Jewett & Kronauer (1999), Van Dongen et al. (2003)
"""

from datetime import datetime, timedelta, time
from typing import List, Tuple, Optional, Dict, Any
import math
import pytz
import logging

logger = logging.getLogger(__name__)

# Import data models
from models.data_models import (
    Duty, Roster, FlightSegment, SleepBlock, CircadianState,
    PerformancePoint, PinchEvent, DutyTimeline, MonthlyAnalysis, FlightPhase,
    CrewComposition, RestFacilityClass, ULRCrewSet,
    InFlightRestPeriod, InFlightRestPlan, ULRComplianceResult, DutyType
)
from core.parameters import ModelConfig
from core.sleep_calculator import UnifiedSleepCalculator, SleepStrategy
from core.compliance import EASAComplianceValidator
from core.workload import WorkloadModel
from core.extended_operations import (
    AugmentedFDPParameters, ULRParameters,
    AugmentedCrewRestPlanner, ULRRestPlanner, ULRComplianceValidator
)
from core.strategy_references import get_confidence_basis, get_strategy_references

class BorbelyFatigueModel:
    """
    Unified Biomathematical Fatigue Prediction Engine
    
    Combines:
    - Borbély two-process model (homeostatic + circadian)
    - Sleep debt vulnerability amplification
    - Sleep inertia effects
    - Dynamic circadian adaptation
    - Aviation workload integration
    """
    
    def __init__(self, config: ModelConfig = None):
        self.config = config or ModelConfig.default_easa_config()
        self.params = self.config.borbely_params
        self.adaptation_rates = self.config.adaptation_rates
        
        # Initialize subsystems
        self.sleep_calculator = UnifiedSleepCalculator(self.config)
        self.validator = EASAComplianceValidator(self.config.easa_framework)
        self.workload_model = WorkloadModel()
        
        # Model parameters
        self.s_upper = self.params.S_max
        self.s_lower = self.params.S_min + 0.1
        self.tau_i = self.params.tau_i
        self.tau_d = self.params.tau_d
        
        # Circadian parameters — operational adjustments:
        # Amplitude reduced by 0.02 to decrease over-sensitivity to circadian
        # trough effects during daytime operations. Aviation context shows
        # pilots maintain better performance during low circadian phases than
        # the base model predicts, likely due to training and operational
        # protocols (Gander et al. 2013).
        # Peak shifted from configured 17:00 to 16:00 to reflect that pilot
        # duty performance peaks tend slightly earlier than CBT acrophase
        # (~17:00-19:00, Wright et al. 2002 Am J Physiol 283:R1370).
        # Note: these are operational choices, not literature-derived values.
        self.c_amplitude = self.params.circadian_amplitude + 0.03
        self.c_peak_hour = self.params.circadian_acrophase_hours - 1.0
        
        # Storage for API access
        self.sleep_strategies = {}
    
    # ========================================================================
    # CIRCADIAN ADAPTATION
    # ========================================================================
    
    def calculate_adaptation(
        self,
        current_utc: datetime,
        last_state: CircadianState,
        current_tz_str: str,
        home_base_tz_str: str
    ) -> CircadianState:
        """Dynamic circadian phase shift adaptation"""
        elapsed_seconds = (current_utc - last_state.last_update_utc).total_seconds()
        if elapsed_seconds <= 0:
            return last_state
        
        elapsed_days = elapsed_seconds / 86400
        
        current_tz = pytz.timezone(current_tz_str)
        home_tz = pytz.timezone(home_base_tz_str)
        
        naive_time = current_utc.replace(tzinfo=None)
        home_offset = home_tz.localize(naive_time).utcoffset().total_seconds() / 3600
        current_offset = current_tz.localize(naive_time).utcoffset().total_seconds() / 3600
        
        target_shift = current_offset - home_offset
        diff = target_shift - last_state.current_phase_shift_hours
        rate = self.adaptation_rates.get_rate(diff)
        adjustment = math.copysign(min(abs(diff), rate * elapsed_days), diff)
        new_shift = last_state.current_phase_shift_hours + adjustment
        new_shift = max(-12, min(12, new_shift))
        
        return CircadianState(
            current_phase_shift_hours=new_shift,
            last_update_utc=current_utc,
            reference_timezone=current_tz_str
        )
    
    # ========================================================================
    # THREE-PROCESS MODEL
    # ========================================================================
    
    def compute_process_s(
        self,
        current_time: datetime,
        last_sleep_end: datetime,
        s_at_wake: float = 0.1
    ) -> float:
        """Process S: Homeostatic sleep pressure buildup"""
        hours_awake = (current_time - last_sleep_end).total_seconds() / 3600
        
        if hours_awake < 0:
            return s_at_wake
        
        s_current = self.params.S_max - (self.params.S_max - s_at_wake) * \
                    math.exp(-hours_awake / self.params.tau_i)
        
        return max(self.params.S_min, min(self.params.S_max, s_current))
    
    def compute_process_c(
        self,
        time_utc: datetime,
        reference_timezone: str,
        circadian_phase_shift: float = 0.0
    ) -> float:
        """Process C: Circadian alertness rhythm"""
        tz = pytz.timezone(reference_timezone)
        local_time = time_utc.astimezone(tz)
        hour_of_day = local_time.hour + local_time.minute / 60.0
        
        effective_hour = (hour_of_day - circadian_phase_shift) % 24
        angle = 2 * math.pi * (effective_hour - self.params.circadian_acrophase_hours) / 24
        c_value = (
            self.params.circadian_mesor +
            self.params.circadian_amplitude * math.cos(angle)
        )
        
        return max(0.0, min(1.0, c_value))
    
    def compute_sleep_inertia(self, time_since_wake: timedelta) -> float:
        """Process W: Sleep inertia (grogginess after waking)"""
        minutes_awake = time_since_wake.total_seconds() / 60
        
        if minutes_awake > self.params.inertia_duration_minutes:
            return 0.0
        
        inertia = self.params.inertia_max_magnitude * math.exp(
            -minutes_awake / (self.params.inertia_duration_minutes / 3)
        )
        
        return inertia
    
    def integrate_s_and_c_multiplicative(self, s: float, c: float) -> float:
        """
        Weighted average integration of S and C with pilot resilience factor
        
        The base Borbély model may over-penalize pilots during moderate sleep
        pressure states. Professional pilots undergo extensive training for
        fatigue management and demonstrate operational resilience beyond what
        the pure biomathematical model predicts.
        
        Reference: Gander et al. (2013) showed pilots maintain performance
        better than predicted during moderate fatigue states, attributed to
        professional training and operational protocols.
        """
        s_alertness = 1.0 - s
        c_alertness = (c + 1.0) / 2.0
        # Balanced 50/50 weights for better operational realism
        base_alertness = s_alertness * 0.50 + c_alertness * 0.50
        
        # Pilot resilience factor: conservative boost during moderate pressure states
        # Applies to S range 0.15-0.30 (typical after 5-7h effective sleep)
        # This represents trained pilot adaptation, not captured in the base model.
        # The boost is intentionally small to avoid masking genuine fatigue.
        if 0.15 <= s <= 0.30:
            # Maximum 5% boost at s=0.20, tapering to 0 at boundaries
            resilience_peak = 0.20
            resilience_width = 0.10
            distance_from_peak = abs(s - resilience_peak) / resilience_width
            resilience_boost = 0.05 * max(0.0, 1.0 - distance_from_peak)
            base_alertness = min(1.0, base_alertness * (1.0 + resilience_boost))
        
        return base_alertness
    
    def integrate_performance(
        self, c: float, s: float, w: float, hours_on_duty: float = 0.0
    ) -> float:
        """
        Integrate processes into performance (0-100 scale)

        Components:
          S — homeostatic sleep pressure     (Borbély 1982)
          C — circadian rhythm               (Dijk & Czeisler 1995)
          W — sleep inertia                  (Tassi & Muzet 2000)
          T — time-on-task linear decrement  (Folkard & Åkerstedt 1999)

        Weights (50/50 S/C) provide balanced operational model.
        Pilot resilience factor accounts for professional training effects.
        References: Åkerstedt & Folkard (1997) three-process model;
                    Dawson & Reid (1997) performance equivalence framework;
                    Folkard et al. (1999) J Biol Rhythms 14:577-587;
                    Gander et al. (2013) operational fatigue management.
        """
        # Input validation with graceful clamping
        c = max(0.0, min(1.0, c))
        s = max(0.0, min(1.0, s))
        w = max(0.0, min(1.0, w))

        c_phase = (c * 2.0) - 1.0
        base_alertness = self.integrate_s_and_c_multiplicative(s, c_phase)
        alertness_with_inertia = base_alertness * (1.0 - w)

        # Time-on-task: linear decrement per hour on duty
        # Folkard & Åkerstedt (1999) found ~0.7 %/h decline in subjective
        # alertness across 12-h shifts, independent of S and C.
        tot_penalty = self.params.time_on_task_rate * max(0.0, hours_on_duty)
        alertness_final = max(0.0, alertness_with_inertia - tot_penalty)

        # Performance floor of 20 (severe impairment, ~0.05% BAC equivalent)
        MIN_PERFORMANCE_FLOOR = 20.0
        performance = MIN_PERFORMANCE_FLOOR + (alertness_final * (100.0 - MIN_PERFORMANCE_FLOOR))
        performance = max(MIN_PERFORMANCE_FLOOR, min(100.0, performance))

        return performance
    
    # ========================================================================
    # FLIGHT PHASES
    # ========================================================================
    
    def get_flight_phase(self, segments: List[FlightSegment], current_time: datetime) -> FlightPhase:
        """Determine flight phase from segment schedule"""
        for segment in segments:
            dep = segment.scheduled_departure_utc
            arr = segment.scheduled_arrival_utc
            
            if current_time < dep - timedelta(minutes=30):
                return FlightPhase.PREFLIGHT
            elif current_time < dep:
                return FlightPhase.TAXI_OUT
            elif current_time < dep + timedelta(minutes=15):
                return FlightPhase.TAKEOFF
            elif current_time < dep + timedelta(minutes=30):
                return FlightPhase.CLIMB
            elif current_time < arr - timedelta(minutes=40):
                return FlightPhase.CRUISE
            elif current_time < arr - timedelta(minutes=20):
                return FlightPhase.DESCENT
            elif current_time < arr - timedelta(minutes=10):
                return FlightPhase.APPROACH
            elif current_time <= arr + timedelta(minutes=5):
                return FlightPhase.LANDING
            elif current_time <= arr + timedelta(minutes=15):
                return FlightPhase.TAXI_IN
        
        return FlightPhase.CRUISE
    
    # ========================================================================
    # DUTY SIMULATION
    # ========================================================================
    
    def simulate_duty(
        self,
        duty: Duty,
        sleep_history: List[SleepBlock],
        circadian_phase_shift: float = 0.0,
        initial_s: float = 0.3,
        resolution_minutes: int = 5,
        cached_s: Optional[float] = None
    ) -> DutyTimeline:
        """Simulate single duty with high-resolution timeline"""
        
        timeline = []
        duty_duration = (duty.release_time_utc - duty.report_time_utc).total_seconds() / 3600
        
        # Find last sleep and calculate S_0
        last_sleep = None
        for sleep in reversed(sleep_history):
            if sleep.end_utc <= duty.report_time_utc:
                last_sleep = sleep
                break
        
        if last_sleep:
            # Improved s_at_wake calculation with gentler curve
            # Reference: Van Dongen et al. (2003) - sleep recovery is non-linear
            # Good sleep (8h effective) should give s_at_wake ≈ 0.05-0.10
            # Moderate sleep (6h effective) should give s_at_wake ≈ 0.15-0.20
            # Poor sleep (4h effective) should give s_at_wake ≈ 0.30-0.35
            # Formula: use exponential-like curve for biological realism
            sleep_quality_ratio = last_sleep.effective_sleep_hours / 8.0
            # Clamp ratio to reasonable bounds
            sleep_quality_ratio = max(0.3, min(1.3, sleep_quality_ratio))
            # New formula: 0.45 - (sleep_quality_ratio^1.3 * 0.42)
            # This gives: 8h -> 0.03, 6h -> 0.15, 5.7h -> 0.18, 4h -> 0.27
            s_at_wake = max(0.03, 0.45 - (sleep_quality_ratio ** 1.3) * 0.42)
            wake_time = last_sleep.end_utc
        else:
            s_at_wake = initial_s
            wake_time = duty.report_time_utc - timedelta(hours=8)
        
        def get_current_sector(current_time: datetime) -> int:
            sector = 1
            for seg in duty.segments:
                if current_time >= seg.scheduled_departure_utc:
                    if seg == duty.segments[0]:
                        sector = 1
                    else:
                        prev_seg = duty.segments[duty.segments.index(seg) - 1]
                        if seg.scheduled_departure_utc > prev_seg.scheduled_arrival_utc:
                            sector += 1
            return sector
        
        # Initialize with pre-duty wakefulness so that hours already awake
        # before report contribute to homeostatic pressure at duty start.
        # Without this, S resets to s_at_wake regardless of how long the
        # pilot has been awake before report — a significant underestimate.
        # Reference: Dawson & Reid (1997) Nature 388:235 — 17 h awake ≈ 0.05 % BAC.
        pre_duty_awake_hours = (duty.report_time_utc - wake_time).total_seconds() / 3600
        pre_duty_awake_hours = max(0.0, pre_duty_awake_hours)
        effective_wake_hours = pre_duty_awake_hours
        s_current = self.params.S_max - (self.params.S_max - s_at_wake) * \
                    math.exp(-effective_wake_hours / self.params.tau_i)
        s_current = max(self.params.S_min, min(self.params.S_max, s_current))
        current_time = duty.report_time_utc

        # Ensure minimum duty length
        if duty_duration <= 0:
            logger.warning(f"[{duty.duty_id}] Invalid time range. Using 8-hour minimum.")
            duty.release_time_utc = duty.report_time_utc + timedelta(hours=8)

        # In-flight rest plan (for augmented crew / ULR operations)
        rest_plan = duty.inflight_rest_plan if hasattr(duty, 'inflight_rest_plan') else None
        in_rest = False
        rest_entry_s = s_at_wake
        last_rest_end = None
        inflight_rest_blocks = []
        return_to_deck_perf = None

        # Get rest facility quality for sleep recovery efficiency
        rest_quality = 0.70  # Default: Class 1 bunk (Signal et al. 2013)
        if rest_plan:
            rest_quality = rest_plan.rest_facility_quality

        tz = pytz.timezone(duty.home_base_timezone)

        # Pre-compute whether this is a training duty (no flight phases)
        is_training_duty = duty.duty_type != DutyType.FLIGHT if hasattr(duty, 'duty_type') else False
        if is_training_duty:
            training_workload = self.workload_model.get_training_multiplier(duty.duty_type.value)

        while current_time <= duty.release_time_utc:
            step_duration_hours = resolution_minutes / 60.0
            hours_on_duty = (current_time - duty.report_time_utc).total_seconds() / 3600

            if is_training_duty:
                # === TRAINING DUTY (SIM or GROUND) ===
                # Same S/C/W model as flight (BAM-aligned), but:
                # - Flat workload multiplier (no flight phases)
                # - No in-flight rest periods
                # - No deadhead detection
                # - No critical phase pinch events
                workload_multiplier = training_workload
                effective_step_duration = step_duration_hours * workload_multiplier
                effective_wake_hours += effective_step_duration

                s_current = self.params.S_max - (self.params.S_max - s_at_wake) * \
                            math.exp(-effective_wake_hours / self.params.tau_i)
                s_current = max(self.params.S_min, min(self.params.S_max, s_current))

                c = self.compute_process_c(current_time, duty.home_base_timezone, circadian_phase_shift)

                # Sleep inertia from pre-duty wake
                time_since_wake = current_time - wake_time
                w = self.compute_sleep_inertia(time_since_wake)

                tot_penalty = self.params.time_on_task_rate * max(0.0, hours_on_duty)
                performance = self.integrate_performance(c, s_current, w, hours_on_duty)

                point = PerformancePoint(
                    timestamp_utc=current_time,
                    timestamp_local=current_time.astimezone(tz),
                    circadian_component=c,
                    homeostatic_component=s_current,
                    sleep_inertia_component=w,
                    raw_performance=performance,
                    hours_on_duty=hours_on_duty,
                    time_on_task_penalty=tot_penalty,
                    current_flight_phase=FlightPhase.CRUISE,  # Placeholder — no flight phases
                    is_critical_phase=False
                )
            else:
                # === FLIGHT DUTY ===
                current_sector = get_current_sector(current_time)
                phase = self.get_flight_phase(duty.segments, current_time)

                # Check if pilot is in an in-flight rest period
                active_rest = self._is_in_rest_period(current_time, rest_plan)

                if active_rest:
                    # === PILOT IS IN CREW REST FACILITY ===
                    if not in_rest:
                        # Transition: entering rest
                        in_rest = True
                        rest_entry_s = s_current

                    # Process S DECAYS during sleep (recovery equation)
                    # Reduced efficiency in bunk: effective tau_d = tau_d / rest_quality
                    # Signal et al. (2013) Sleep 36(1):109-118: ~70% efficiency in bunk
                    effective_tau_d = self.params.tau_d / rest_quality
                    s_current = self.params.S_min + (rest_entry_s - self.params.S_min) * \
                        math.exp(-step_duration_hours / effective_tau_d)
                    # Update rest_entry_s for next step (progressive decay)
                    rest_entry_s = s_current
                    s_current = max(self.params.S_min, min(self.params.S_max, s_current))

                    c = self.compute_process_c(current_time, duty.home_base_timezone, circadian_phase_shift)

                    # Pilot not on deck — record rest status in timeline
                    point = PerformancePoint(
                        timestamp_utc=current_time,
                        timestamp_local=current_time.astimezone(tz),
                        circadian_component=c,
                        homeostatic_component=s_current,
                        sleep_inertia_component=0.0,
                        raw_performance=100.0,  # Not on deck — no performance relevance
                        hours_on_duty=hours_on_duty,
                        time_on_task_penalty=0.0,
                        current_flight_phase=FlightPhase.CRUISE,
                        is_critical_phase=False,
                        is_in_rest=True
                    )
                else:
                    # === PILOT IS ON FLIGHT DECK ===
                    if in_rest:
                        # Transition: waking from in-flight rest
                        in_rest = False
                        last_rest_end = current_time
                        # Reset effective wake hours after rest
                        s_at_wake = s_current
                        effective_wake_hours = 0.0
                        wake_time = current_time

                    # Check if pilot is on a deadhead segment (passenger, no cockpit tasks).
                    # DH counts toward time awake but at reduced workload — no monitoring,
                    # no decision-making, just passive travel fatigue.
                    is_on_deadhead = self._is_on_deadhead_segment(duty.segments, current_time)
                    if is_on_deadhead:
                        workload_multiplier = 0.3  # Passive travel fatigue only
                    else:
                        workload_multiplier = self.workload_model.get_combined_multiplier(phase, current_sector)
                    effective_step_duration = step_duration_hours * workload_multiplier
                    effective_wake_hours += effective_step_duration

                    s_current = self.params.S_max - (self.params.S_max - s_at_wake) * \
                                math.exp(-effective_wake_hours / self.params.tau_i)
                    s_current = max(self.params.S_min, min(self.params.S_max, s_current))

                    c = self.compute_process_c(current_time, duty.home_base_timezone, circadian_phase_shift)

                    # Sleep inertia: from last rest wake or from pre-duty wake
                    if last_rest_end:
                        time_since_wake = current_time - last_rest_end
                    else:
                        time_since_wake = current_time - wake_time
                    w = self.compute_sleep_inertia(time_since_wake)

                    tot_penalty = self.params.time_on_task_rate * max(0.0, hours_on_duty)
                    performance = self.integrate_performance(c, s_current, w, hours_on_duty)

                    # Track return-to-deck performance (first point after rest)
                    if last_rest_end and return_to_deck_perf is None:
                        return_to_deck_perf = performance

                    point = PerformancePoint(
                        timestamp_utc=current_time,
                        timestamp_local=current_time.astimezone(tz),
                        circadian_component=c,
                        homeostatic_component=s_current,
                        sleep_inertia_component=w,
                        raw_performance=performance,
                        hours_on_duty=hours_on_duty,
                        time_on_task_penalty=tot_penalty,
                        current_flight_phase=phase,
                        is_critical_phase=(phase in [FlightPhase.TAKEOFF, FlightPhase.LANDING, FlightPhase.APPROACH])
                    )

            timeline.append(point)
            current_time += timedelta(minutes=resolution_minutes)

        duty_timeline = self._build_duty_timeline(duty, timeline, sleep_history, circadian_phase_shift)
        duty_timeline.final_process_s = s_current
        duty_timeline.pre_duty_awake_hours = pre_duty_awake_hours

        # Attach augmented crew / ULR metadata
        if rest_plan:
            duty_timeline.is_ulr = getattr(duty, 'is_ulr', False)
            duty_timeline.crew_composition = getattr(duty, 'crew_composition', CrewComposition.STANDARD)
            duty_timeline.return_to_deck_performance = return_to_deck_perf
            # Build inflight rest SleepBlocks for the timeline
            for period in rest_plan.rest_periods:
                if period.start_utc and period.end_utc:
                    duration = period.duration_hours
                    inflight_block = SleepBlock(
                        start_utc=period.start_utc,
                        end_utc=period.end_utc,
                        location_timezone=duty.home_base_timezone,
                        duration_hours=duration,
                        quality_factor=rest_quality,
                        effective_sleep_hours=duration * rest_quality,
                        is_inflight_rest=True,
                        environment='crew_rest',
                    )
                    inflight_rest_blocks.append(inflight_block)
            duty_timeline.inflight_rest_blocks = inflight_rest_blocks

        return duty_timeline
    
    def _build_duty_timeline(
        self,
        duty: Duty,
        timeline: List[PerformancePoint],
        sleep_history: List[SleepBlock],
        phase_shift: float
    ) -> DutyTimeline:
        """Build duty timeline with summary statistics"""
        
        if not timeline:
            logger.warning(f"[{duty.duty_id}] Empty timeline - using fallback calculation")
            tz = pytz.timezone(duty.home_base_timezone)
            mid_duty_time = duty.report_time_utc + (duty.release_time_utc - duty.report_time_utc) / 2
            
            s_estimate = 0.3
            for sleep in reversed(sleep_history):
                if sleep.end_utc <= duty.report_time_utc:
                    sleep_quality_ratio = sleep.effective_sleep_hours / 8.0
                    # Clamp ratio to reasonable bounds
                    sleep_quality_ratio = max(0.3, min(1.3, sleep_quality_ratio))
                    # New formula: 0.45 - (sleep_quality_ratio^1.3 * 0.42)
                    # This gives: 8h -> 0.03, 6h -> 0.15, 5.7h -> 0.18, 4h -> 0.27
                    s_estimate = max(0.03, 0.45 - (sleep_quality_ratio ** 1.3) * 0.42)
                    break
            
            c_estimate = self.compute_process_c(mid_duty_time, duty.home_base_timezone, phase_shift)
            default_performance = self.integrate_performance(c_estimate, s_estimate, 0.0)
            
            return DutyTimeline(
                duty_id=duty.duty_id,
                duty_date=duty.date,
                timeline=[],
                min_performance=default_performance,
                average_performance=default_performance,
                landing_performance=default_performance,
                prior_sleep_hours=sum(s.effective_sleep_hours for s in sleep_history[-3:] if s.end_utc <= duty.report_time_utc),
                wocl_encroachment_hours=self.validator.is_disruptive_duty(duty).get('wocl_hours', 0.0)
            )
        
        min_perf = min(p.raw_performance for p in timeline)
        min_point = min(timeline, key=lambda p: p.raw_performance)
        avg_perf = sum(p.raw_performance for p in timeline) / len(timeline)
        
        landing_points = [p for p in timeline if p.current_flight_phase == FlightPhase.LANDING]
        landing_perf = min(p.raw_performance for p in landing_points) if landing_points else None
        landing_time = landing_points[-1].timestamp_utc if landing_points else None
        
        recent_sleep = [s for s in sleep_history if s.end_utc <= duty.report_time_utc][-3:]
        total_prior_sleep = sum(s.effective_sleep_hours for s in recent_sleep)
        
        disruption = self.validator.is_disruptive_duty(duty)
        pinch_events = self._detect_pinch_events(timeline)
        
        return DutyTimeline(
            duty_id=duty.duty_id,
            duty_date=duty.date,
            timeline=timeline,
            min_performance=min_perf,
            min_performance_time=min_point.timestamp_utc,
            average_performance=avg_perf,
            landing_performance=landing_perf,
            landing_time=landing_time,
            prior_sleep_hours=total_prior_sleep,
            easa_compliant=True,
            wocl_encroachment_hours=disruption['wocl_hours'],
            pinch_events=pinch_events,
            circadian_phase_shift=phase_shift
        )
    
    def _detect_pinch_events(self, timeline: List[PerformancePoint]) -> List[PinchEvent]:
        """
        Detect high-risk moments (high sleep pressure + low circadian during critical phases)
        
        A "pinch" is a scientifically-defined convergence of:
        1. Critical flight phase (takeoff, approach, landing)
        2. High homeostatic sleep pressure (S > 0.75 = ~12+ hours awake or sleep-deprived)
        3. Low circadian alertness (C < 0.35 = deep in WOCL, 02:00-06:00)
        
        These thresholds are based on:
        - Dawson & Reid (1997): Performance impairment equivalent to 0.05% BAC
        - EASA AMC1 ORO.FTL.105(10): WOCL 02:00-05:59
        - Van Dongen et al. (2003): Cumulative effects of sleep restriction
        
        We also require BOTH conditions to be significantly exceeded to avoid
        false positives from normal night operations with adequate rest.
        
        Only one pinch event is flagged per critical phase of flight.
        """
        pinch_events = []

        # Thresholds are configurable per airline/preset via parameters.py
        CIRCADIAN_THRESHOLD = self.params.pinch_circadian_threshold
        SLEEP_PRESSURE_THRESHOLD = self.params.pinch_sleep_pressure_threshold
        
        current_critical_phase = None
        current_phase_worst_point = None
        
        for point in timeline:
            if point.is_critical_phase:
                # Check if conditions are met for a pinch event
                if point.circadian_component < CIRCADIAN_THRESHOLD and point.homeostatic_component > SLEEP_PRESSURE_THRESHOLD:
                    # If this is a new critical phase, start tracking it
                    if current_critical_phase != point.current_flight_phase:
                        # Save the previous phase's worst point if any
                        if current_phase_worst_point is not None:
                            pinch_events.append(current_phase_worst_point)
                        
                        # Start tracking this new phase
                        current_critical_phase = point.current_flight_phase
                        current_phase_worst_point = self._create_pinch_event(point)
                    else:
                        # Same phase - update if this point is worse
                        if current_phase_worst_point and point.raw_performance < current_phase_worst_point.performance:
                            current_phase_worst_point = self._create_pinch_event(point)
                else:
                    # Conditions not met, but we might be exiting a critical phase
                    if current_phase_worst_point is not None:
                        pinch_events.append(current_phase_worst_point)
                        current_phase_worst_point = None
                        current_critical_phase = None
            else:
                # Not in critical phase - save any pending pinch event
                if current_phase_worst_point is not None:
                    pinch_events.append(current_phase_worst_point)
                    current_phase_worst_point = None
                    current_critical_phase = None
        
        # Don't forget the last one if we ended during a critical phase
        if current_phase_worst_point is not None:
            pinch_events.append(current_phase_worst_point)
        
        return pinch_events
    
    def _create_pinch_event(self, point: PerformancePoint) -> PinchEvent:
        """Helper to create a PinchEvent from a PerformancePoint"""
        # Severity based on performance score
        if point.raw_performance < 45:
            severity = 'critical'
        elif point.raw_performance < 55:
            severity = 'high'
        else:
            severity = 'moderate'
        
        return PinchEvent(
            time_utc=point.timestamp_utc,
            time_local=point.timestamp_local,
            flight_phase=point.current_flight_phase,
            performance=point.raw_performance,
            circadian=point.circadian_component,
            sleep_pressure=point.homeostatic_component,
            severity=severity
        )
    
    @staticmethod
    def _is_in_rest_period(
        current_time: datetime,
        rest_plan: Optional[InFlightRestPlan]
    ) -> Optional[InFlightRestPeriod]:
        """Check if current time falls within an in-flight rest period."""
        if not rest_plan:
            return None
        for period in rest_plan.rest_periods:
            if period.start_utc and period.end_utc:
                if period.start_utc <= current_time < period.end_utc:
                    return period
        return None

    @staticmethod
    def _is_on_deadhead_segment(segments: list, current_time: datetime) -> bool:
        """Check if current time falls within a deadhead (DH) segment."""
        for seg in segments:
            if (getattr(seg, 'is_deadhead', False)
                    and seg.scheduled_departure_utc <= current_time <= seg.scheduled_arrival_utc):
                return True
        return False

    # ========================================================================
    # ROSTER SIMULATION
    # ========================================================================

    def simulate_roster(self, roster: Roster) -> MonthlyAnalysis:
        """Process entire roster with cumulative tracking"""
        if not roster.duties or len(roster.duties) == 0:
            raise ValueError("Cannot simulate roster: No duties found.")
        
        duty_timelines = []
        current_s = roster.initial_sleep_pressure
        cumulative_sleep_debt = roster.initial_sleep_debt
        
        # Initialize circadian tracking
        body_clock = CircadianState(
            current_phase_shift_hours=0.0,
            last_update_utc=roster.duties[0].report_time_utc - timedelta(days=1),
            reference_timezone=roster.home_base_timezone
        )
        
        body_clock_timeline = [(body_clock.last_update_utc, body_clock)]
        
        # Track circadian adaptation across duties
        for duty in roster.duties:
            if duty.segments:
                departure_tz = duty.segments[0].departure_airport.timezone
            else:
                # Training duties: no airport — pilot stays at home base
                departure_tz = roster.home_base_timezone
            body_clock = self.calculate_adaptation(
                duty.report_time_utc, body_clock, departure_tz, roster.home_base_timezone
            )
            body_clock_timeline.append((duty.report_time_utc, body_clock))
        
        # Extract all sleep opportunities
        all_sleep, sleep_strategies = self._extract_sleep_from_roster(roster, body_clock_timeline)
        self.sleep_strategies = sleep_strategies
        
        previous_duty = None
        previous_timeline = None
        
        # Simulate each duty
        for i, duty in enumerate(roster.duties):
            phase_shift = self._get_phase_shift_at_time(duty.report_time_utc, body_clock_timeline)
            
            # Get relevant sleep (last 48h)
            relevant_sleep = [
                s for s in all_sleep
                if s.end_utc <= duty.report_time_utc and
                   s.end_utc >= duty.report_time_utc - timedelta(hours=48)
            ]
            
            cached_s_value = None
            if previous_timeline and previous_timeline.final_process_s > 0:
                cached_s_value = previous_timeline.final_process_s
            
            timeline_obj = self.simulate_duty(
                duty, relevant_sleep, phase_shift, 
                initial_s=current_s,
                cached_s=cached_s_value
            )
            previous_timeline = timeline_obj
            
            # Calculate EASA FDP limits (augmented-crew-aware)
            # Training duties are "other duty" per EASA — not FDP, no FDP limits.
            if duty.duty_type == DutyType.FLIGHT:
                fdp_limits = self.validator.calculate_fdp_limits(
                    duty,
                    augmented_params=self.config.augmented_fdp_params if hasattr(self.config, 'augmented_fdp_params') else None,
                    ulr_params=self.config.ulr_params if hasattr(self.config, 'ulr_params') else None,
                )
                duty.max_fdp_hours = fdp_limits['max_fdp']
                duty.extended_fdp_hours = fdp_limits['extended_fdp']
                duty.used_discretion = fdp_limits['used_discretion']
            else:
                duty.max_fdp_hours = None
                duty.extended_fdp_hours = None
                duty.used_discretion = False

            # Qatar FTL 7.18 compliance validation for AUGMENTED_4 duties
            if duty.crew_composition == CrewComposition.AUGMENTED_4:
                ulr_params = self.config.ulr_params if hasattr(self.config, 'ulr_params') else None
                ulr_validator = ULRComplianceValidator(ulr_params)
                ulr_result = ulr_validator.validate_ulr_duty(duty, roster, i)
                timeline_obj.ulr_compliance = ulr_result
            
            # Track cumulative sleep debt
            # ── Three-step model ──────────────────────────────────────
            #  1. Exponential recovery of existing debt (time-based)
            #  2. Compute sleep balance for the period using effective sleep
            #     hours with 1.15x recovery credit multiplier vs scaled daily
            #     need. Effective hours drive both Process S recovery AND debt
            #     reduction, creating consistency. Recovery credit accounts for
            #     biological efficiency of consolidated, quality sleep.
            #  3. Deficit adds to debt; surplus reduces debt 1:1.
            # References:
            #   Van Dongen et al. (2003) Sleep 26(2):117-126
            #   Belenky et al. (2003) J Sleep Res 12:1-12
            #   Kitamura et al. (2016) Sci Rep 6:35812
            #   Banks & Dinges (2007) Prog Brain Res 185:41-53
            if previous_duty:
                days_since_last = max(1, (duty.date - previous_duty.date).days)
                cumulative_sleep_debt *= math.exp(
                    -self.params.sleep_debt_decay_rate * days_since_last
                )
            else:
                days_since_last = 1

            # Use RAW (duration) sleep hours for debt accounting.
            #
            # Previous code used effective_sleep_hours (= duration × quality_factor),
            # which double-penalised sleep: quality_factor reduced the hours
            # counted toward the 8 h baseline, AND the recovery-inefficiency
            # divisor (1.30) further reduced surplus credit.  Quality_factor
            # already feeds into Process S recovery calculations, so applying
            # it again here overstated cumulative debt.
            #
            # Using duration_hours means the debt ledger tracks *actual time
            # in bed*.  Recovery inefficiency (÷1.30) is the sole penalty on
            # the repayment side, consistent with Banks et al. (2010, 2023).
            period_sleep_raw = sum(
                s.duration_hours for s in relevant_sleep
                if s.start_utc >= (
                    previous_duty.release_time_utc
                    if previous_duty
                    else duty.report_time_utc - timedelta(days=1)
                )
            )
            period_sleep = period_sleep_raw

            # Scale need by gap length so multi-day rest periods
            # are evaluated fairly (8 h × N days, not a flat 8 h).
            period_need = (
                self.params.baseline_sleep_need_hours * days_since_last
            )
            sleep_balance = period_sleep - period_need

            if sleep_balance < 0:
                # Deficit: add shortfall to cumulative debt
                cumulative_sleep_debt += abs(sleep_balance)
            elif sleep_balance > 0 and cumulative_sleep_debt > 0:
                # Surplus: actively reduce existing debt with recovery inefficiency.
                # Banks et al. (2010, 2023) show recovery is significantly less
                # efficient than 1:1 — 1 h of debt requires ~1.3 h of recovery
                # sleep. This aligns with the finding that one night of 10 h TIB
                # was insufficient to restore baseline after chronic restriction.
                debt_reduction = sleep_balance / 1.30
                cumulative_sleep_debt = max(
                    0.0, cumulative_sleep_debt - debt_reduction
                )

            timeline_obj.cumulative_sleep_debt = cumulative_sleep_debt
            
            # Attach sleep strategy data
            if duty.duty_id in sleep_strategies:
                strategy_data = sleep_strategies[duty.duty_id]
                timeline_obj.sleep_strategy_type = strategy_data.get('strategy_type')
                timeline_obj.sleep_confidence = strategy_data.get('confidence')
                timeline_obj.sleep_quality_data = strategy_data
            
            # Update current S for next iteration
            if timeline_obj.timeline:
                current_s = timeline_obj.timeline[-1].homeostatic_component
            
            duty_timelines.append(timeline_obj)
            previous_duty = duty
        
        return self._build_monthly_analysis(roster, duty_timelines, body_clock_timeline)
    
    def _extract_sleep_from_roster(
        self,
        roster: Roster,
        body_clock_timeline: List[Tuple[datetime, CircadianState]]
    ) -> Tuple[List[SleepBlock], Dict[str, Any]]:
        """
        Auto-generate sleep opportunities from duty gaps.

        Architecture (v2):
        - First duty: pre-duty sleep via estimate_sleep_for_duty (no prior context)
        - Inter-duty gaps: single recovery block via generate_inter_duty_sleep
          (replaces the old dual post-duty + pre-duty approach that could overlap)
        - Multi-day home gaps: additional rest-day blocks (23:00-07:00)
        """
        sleep_blocks = []
        sleep_strategies = {}
        home_tz = pytz.timezone(roster.home_base_timezone)

        # --- Pre-roster ROFF/off-day recovery fill ---
        # Days off (ROFF/LVE/OFF) before the first duty are skipped by the
        # parser and produce no Duty objects. Fill in a standard 23:00-07:00
        # home recovery block for each calendar night between the roster
        # start (day 1 of roster.month) and the night before the first duty.
        if roster.duties and roster.month:
            try:
                year_m, mon_m = int(roster.month[:4]), int(roster.month[5:7])
                from datetime import date as _date
                fill_date = _date(year_m, mon_m, 1)
                # Use report time (not duty date) as the fill boundary so the
                # cutoff is robust to any report hour (e.g. 02:00 early report).
                # A 23:00→07:00 ROFF block on fill_date ends at 07:00 on
                # fill_date+1. Only generate it when fill_date+1 is strictly
                # before the report date in home-base TZ, i.e.:
                #   fill_date < roff_fill_cutoff - 1 day
                # This guarantees the ROFF block never crosses into the night
                # already owned by estimate_sleep_for_duty.
                first_duty_report_home = roster.duties[0].report_time_utc.astimezone(home_tz)
                roff_fill_cutoff = first_duty_report_home.date()
                night_number = 1
                while fill_date < roff_fill_cutoff - timedelta(days=1):
                    sleep_start = home_tz.localize(
                        datetime.combine(fill_date, time(23, 0))
                    )
                    sleep_end = home_tz.localize(
                        datetime.combine(fill_date + timedelta(days=1), time(7, 0))
                    )
                    rest_day_key = f"rest_{fill_date.isoformat()}"
                    rest_quality = self.sleep_calculator.calculate_sleep_quality(
                        sleep_start=sleep_start,
                        sleep_end=sleep_end,
                        location='home',
                        previous_duty_end=None,
                        next_event=sleep_end + timedelta(hours=12),
                        location_timezone=home_tz.zone
                    )
                    recovery_block = SleepBlock(
                        start_utc=sleep_start.astimezone(pytz.utc),
                        end_utc=sleep_end.astimezone(pytz.utc),
                        location_timezone=home_tz.zone,
                        duration_hours=rest_quality.actual_sleep_hours,
                        quality_factor=rest_quality.sleep_efficiency,
                        effective_sleep_hours=rest_quality.effective_sleep_hours,
                        environment='home'
                    )
                    sleep_blocks.append(recovery_block)

                    ss_home = sleep_start.astimezone(home_tz)
                    se_home = sleep_end.astimezone(home_tz)
                    ss_utc = sleep_start.astimezone(pytz.utc)
                    se_utc = sleep_end.astimezone(pytz.utc)
                    recovery_fraction = 1.0 - math.exp(-night_number / 2.5)
                    qf = {
                        'base_efficiency': rest_quality.base_efficiency,
                        'wocl_boost': rest_quality.wocl_penalty,
                        'late_onset_penalty': rest_quality.late_onset_penalty,
                        'recovery_boost': rest_quality.recovery_boost,
                        'time_pressure_factor': rest_quality.time_pressure_factor,
                        'insufficient_penalty': rest_quality.insufficient_penalty,
                    }
                    logger.info(f"[ROFF-FILL] key={rest_day_key} sleep={ss_utc.isoformat()[:16]}→{se_utc.isoformat()[:16]}")
                    if rest_day_key not in sleep_strategies:
                        sleep_strategies[rest_day_key] = {
                            'strategy_type': 'recovery',
                            'confidence': 0.95,
                            'recovery_night_number': night_number,
                            'cumulative_recovery_fraction': round(recovery_fraction, 2),
                            'total_sleep_hours': rest_quality.total_sleep_hours,
                            'effective_sleep_hours': rest_quality.effective_sleep_hours,
                            'sleep_efficiency': rest_quality.sleep_efficiency,
                            'wocl_overlap_hours': rest_quality.wocl_overlap_hours,
                            'warnings': [w['message'] for w in rest_quality.warnings],
                            'sleep_start_time': ss_home.strftime('%H:%M'),
                            'sleep_end_time': se_home.strftime('%H:%M'),
                            'sleep_blocks': [{
                                'sleep_start_time': ss_home.strftime('%H:%M'),
                                'sleep_end_time': se_home.strftime('%H:%M'),
                                'sleep_start_iso': ss_home.isoformat(),
                                'sleep_end_iso': se_home.isoformat(),
                                'sleep_start_utc': ss_utc.isoformat(),
                                'sleep_end_utc': se_utc.isoformat(),
                                'sleep_start_day': ss_home.day,
                                'sleep_start_hour': ss_home.hour + ss_home.minute / 60.0,
                                'sleep_end_day': se_home.day,
                                'sleep_end_hour': se_home.hour + se_home.minute / 60.0,
                                'location_timezone': home_tz.zone,
                                'environment': 'home',
                                'sleep_start_time_home_tz': ss_home.strftime('%H:%M'),
                                'sleep_end_time_home_tz': se_home.strftime('%H:%M'),
                                'sleep_start_day_home_tz': ss_home.day,
                                'sleep_start_hour_home_tz': ss_home.hour + ss_home.minute / 60.0,
                                'sleep_end_day_home_tz': se_home.day,
                                'sleep_end_hour_home_tz': se_home.hour + se_home.minute / 60.0,
                                'sleep_start_day_utc': ss_utc.day,
                                'sleep_start_hour_utc': ss_utc.hour + ss_utc.minute / 60.0,
                                'sleep_end_day_utc': se_utc.day,
                                'sleep_end_hour_utc': se_utc.hour + se_utc.minute / 60.0,
                                'sleep_start_time_utc': ss_utc.strftime('%H:%M'),
                                'sleep_end_time_utc': se_utc.strftime('%H:%M'),
                                'sleep_start_time_location_tz': sleep_start.strftime('%H:%M'),
                                'sleep_end_time_location_tz': sleep_end.strftime('%H:%M'),
                                'sleep_type': 'main',
                                'duration_hours': rest_quality.actual_sleep_hours,
                                'effective_hours': rest_quality.effective_sleep_hours,
                                'quality_factor': rest_quality.sleep_efficiency,
                                'quality_factors': qf,
                            }],
                            'explanation': (
                                f'Day off (ROFF): standard home recovery sleep '
                                f'(23:00-07:00, {rest_quality.sleep_efficiency:.0%} efficiency).'
                            ),
                            'confidence_basis': 'High confidence — home environment, no duty constraints.',
                            'quality_factors': qf,
                            'references': get_strategy_references('recovery'),
                        }
                    night_number += 1
                    fill_date += timedelta(days=1)
            except (ValueError, IndexError, AttributeError):
                pass  # Malformed month string — skip silently

        for i, duty in enumerate(roster.duties):
            previous_duty = roster.duties[i - 1] if i > 0 else None
            next_duty = roster.duties[i + 1] if i < len(roster.duties) - 1 else None

            # Generate in-flight rest plan for augmented crew duties
            if duty.crew_composition == CrewComposition.AUGMENTED_4:
                if not duty.rest_facility_class:
                    duty.rest_facility_class = RestFacilityClass.CLASS_1
                ulr_params = self.config.ulr_params if hasattr(self.config, 'ulr_params') else None
                ulr_planner = ULRRestPlanner(ulr_params)
                crew_set = getattr(duty, 'ulr_crew_set', None) or ULRCrewSet.CREW_B
                duty.inflight_rest_plan = ulr_planner.generate_rest_plan(
                    duty=duty,
                    crew_set=crew_set,
                    home_timezone=roster.home_base_timezone,
                )
            elif duty.crew_composition == CrewComposition.AUGMENTED_3:
                if not duty.rest_facility_class:
                    duty.rest_facility_class = RestFacilityClass.CLASS_1
                aug_params = self.config.augmented_fdp_params if hasattr(self.config, 'augmented_fdp_params') else None
                aug_planner = AugmentedCrewRestPlanner(aug_params)
                duty.inflight_rest_plan = aug_planner.generate_rest_plan(
                    duty=duty,
                    rest_facility_class=duty.rest_facility_class,
                    home_timezone=roster.home_base_timezone,
                )

            if i == 0:
                # First duty: pre-duty sleep (no previous duty context)
                strategy = self.sleep_calculator.estimate_sleep_for_duty(
                    duty=duty,
                    previous_duty=None,
                    home_timezone=roster.home_base_timezone,
                    home_base=roster.pilot_base
                )
                strategy_key = duty.duty_id
            elif duty.is_augmented_crew:
                # Augmented duties need crew-specific pre-duty sleep strategies
                # (NOT generic inter_duty_recovery which ignores crew composition).
                # estimate_sleep_for_duty() dispatches on crew_composition:
                #   AUGMENTED_4 → _augmented_4_sleep_strategy()
                #   AUGMENTED_3 → _augmented_3_pilot_strategy()
                strategy = self.sleep_calculator.estimate_sleep_for_duty(
                    duty=duty,
                    previous_duty=previous_duty,
                    home_timezone=roster.home_base_timezone,
                    home_base=roster.pilot_base
                )
                strategy_key = duty.duty_id
            else:
                # Standard duties: inter-duty recovery block
                strategy = self.sleep_calculator.generate_inter_duty_sleep(
                    previous_duty=previous_duty,
                    next_duty=duty,
                    home_timezone=roster.home_base_timezone,
                    home_base=roster.pilot_base
                )
                strategy_key = duty.duty_id

            for sleep_block in strategy.sleep_blocks:
                sleep_blocks.append(sleep_block)

            if getattr(duty, 'is_augmented_crew', False):
                blk_dates = [(b.start_utc.isoformat()[:10], b.end_utc.isoformat()[:10]) for b in strategy.sleep_blocks]
                logger.info(f"[ULR-STRATEGY] duty={strategy_key} type={strategy.strategy_type} blocks={blk_dates}")

            # Store strategy data for API exposure
            self._store_strategy_response(
                strategy, strategy_key, sleep_strategies, home_tz
            )

            # Generate additional night sleep blocks for multi-day gaps.
            # Works for both home base and layover locations.
            # Instead of assuming the inter-duty block covers "night 1",
            # we find the first uncovered night AFTER the last sleep block.
            #
            # IMPORTANT: This covers the gap BEFORE duty[i] (same gap as
            # the inter-duty sleep above), using previous_duty's arrival
            # airport as the sleep location.
            if i > 0 and previous_duty:
                # Determine where the pilot sleeps (previous duty arrival)
                prev_arrival = previous_duty.segments[-1].arrival_airport if previous_duty.segments else None
                arrival_code = prev_arrival.code if prev_arrival else None
                is_at_home = (arrival_code == roster.pilot_base)

                if is_at_home:
                    rest_tz = home_tz
                    rest_env = 'home'
                elif prev_arrival:
                    rest_tz = pytz.timezone(prev_arrival.timezone)
                    rest_env = 'hotel'
                else:
                    rest_tz = home_tz
                    rest_env = 'home'

                # Find the last sleep block generated for this gap.
                #
                # For AUGMENTED_4 / ULR duties, strategy.sleep_blocks come from
                # _ulr_sleep_strategy(), which anchors blocks at
                # `report_time - 2 nights` (i.e. immediately before the duty).
                # Using those as the anchor here would skip all the nights in the
                # middle of a long home rest (e.g. days 6-9 of a day-5-to-day-11
                # gap), so we always start the gap fill from previous_duty
                # release_time for augmented duties.
                #
                # For standard duties, strategy.sleep_blocks are the inter-duty
                # recovery blocks already placed in the gap, so we advance the
                # anchor past them to avoid overlap.
                last_block_end_utc = previous_duty.release_time_utc
                if not getattr(duty, 'is_augmented_crew', False) and strategy.sleep_blocks:
                    last_block_end_utc = max(
                        b.end_utc for b in strategy.sleep_blocks
                    )

                # Latest possible wake time before current duty
                latest_wake_utc = duty.report_time_utc - timedelta(
                    hours=self.sleep_calculator.MIN_WAKE_BEFORE_REPORT
                )

                # Generate 23:00-07:00 blocks for each uncovered night
                # Start from the evening after the last sleep block ends
                last_block_end_local = last_block_end_utc.astimezone(rest_tz)

                # First candidate night: 23:00 on the day the last block ends
                # If last block ends after 23:00, generate a truncated
                # post-arrival sleep block (arrival + 1h wind-down → 07:00)
                # before advancing to the next full night.
                candidate_date = last_block_end_local.date()
                candidate_bedtime = rest_tz.localize(
                    datetime.combine(candidate_date, time(23, 0))
                )

                recovery_night_number = 1

                if candidate_bedtime <= last_block_end_local:
                    # Pilot arrived after 23:00 local — generate truncated
                    # post-arrival recovery block: (arrival + 1h) → 07:00.
                    trunc_start = last_block_end_local + timedelta(hours=1)
                    trunc_end = rest_tz.localize(
                        datetime.combine(
                            last_block_end_local.date() + timedelta(days=1),
                            time(7, 0)
                        )
                    )
                    # Cap by next duty report buffer
                    if trunc_end.astimezone(pytz.utc) > latest_wake_utc:
                        trunc_end = latest_wake_utc.astimezone(rest_tz)
                    trunc_hours = (trunc_end - trunc_start).total_seconds() / 3600

                    if trunc_hours >= 3.0 and trunc_start.astimezone(pytz.utc) < latest_wake_utc:
                        trunc_quality = self.sleep_calculator.calculate_sleep_quality(
                            sleep_start=trunc_start,
                            sleep_end=trunc_end,
                            location=rest_env,
                            previous_duty_end=last_block_end_utc,
                            next_event=trunc_end + timedelta(hours=12),
                            location_timezone=rest_tz.zone
                        )
                        trunc_block = SleepBlock(
                            start_utc=trunc_start.astimezone(pytz.utc),
                            end_utc=trunc_end.astimezone(pytz.utc),
                            location_timezone=rest_tz.zone,
                            duration_hours=trunc_quality.actual_sleep_hours,
                            quality_factor=trunc_quality.sleep_efficiency,
                            effective_sleep_hours=trunc_quality.effective_sleep_hours,
                            environment=rest_env
                        )
                        sleep_blocks.append(trunc_block)

                        trunc_qf = {
                            'base_efficiency': trunc_quality.base_efficiency,
                            'wocl_boost': trunc_quality.wocl_penalty,
                            'late_onset_penalty': trunc_quality.late_onset_penalty,
                            'recovery_boost': trunc_quality.recovery_boost,
                            'time_pressure_factor': trunc_quality.time_pressure_factor,
                            'insufficient_penalty': trunc_quality.insufficient_penalty,
                        }
                        trunc_start_home = trunc_start.astimezone(home_tz)
                        trunc_end_home = trunc_end.astimezone(home_tz)
                        trunc_start_utc = trunc_start.astimezone(pytz.utc)
                        trunc_end_utc = trunc_end.astimezone(pytz.utc)
                        sleep_start_home_date = trunc_start.astimezone(home_tz).date()
                        rest_day_key = f"rest_{sleep_start_home_date.isoformat()}"
                        recovery_fraction = 1.0 - math.exp(-recovery_night_number / 2.5)

                        logger.info(
                            f"[GAP-FILL] truncated post-arrival key={rest_day_key} "
                            f"sleep={trunc_start_utc.isoformat()[:16]}→{trunc_end_utc.isoformat()[:16]}"
                        )
                        if rest_day_key not in sleep_strategies:
                            sleep_strategies[rest_day_key] = {
                                'strategy_type': 'recovery',
                                'confidence': 0.90 if is_at_home else 0.80,
                                'recovery_night_number': recovery_night_number,
                                'cumulative_recovery_fraction': round(recovery_fraction, 2),
                                'total_sleep_hours': trunc_quality.total_sleep_hours,
                                'effective_sleep_hours': trunc_quality.effective_sleep_hours,
                                'sleep_efficiency': trunc_quality.sleep_efficiency,
                                'wocl_overlap_hours': trunc_quality.wocl_overlap_hours,
                                'warnings': [w['message'] for w in trunc_quality.warnings],
                                'sleep_start_time': trunc_start_home.strftime('%H:%M'),
                                'sleep_end_time': trunc_end_home.strftime('%H:%M'),
                                'sleep_blocks': [{
                                    'sleep_start_time': trunc_start_home.strftime('%H:%M'),
                                    'sleep_end_time': trunc_end_home.strftime('%H:%M'),
                                    'sleep_start_iso': trunc_start_home.isoformat(),
                                    'sleep_end_iso': trunc_end_home.isoformat(),
                                    'sleep_start_utc': trunc_start_utc.isoformat(),
                                    'sleep_end_utc': trunc_end_utc.isoformat(),
                                    'sleep_start_day': trunc_start_home.day,
                                    'sleep_start_hour': trunc_start_home.hour + trunc_start_home.minute / 60.0,
                                    'sleep_end_day': trunc_end_home.day,
                                    'sleep_end_hour': trunc_end_home.hour + trunc_end_home.minute / 60.0,
                                    'location_timezone': rest_tz.zone,
                                    'environment': rest_env,
                                    'sleep_start_time_home_tz': trunc_start_home.strftime('%H:%M'),
                                    'sleep_end_time_home_tz': trunc_end_home.strftime('%H:%M'),
                                    'sleep_start_day_home_tz': trunc_start_home.day,
                                    'sleep_start_hour_home_tz': trunc_start_home.hour + trunc_start_home.minute / 60.0,
                                    'sleep_end_day_home_tz': trunc_end_home.day,
                                    'sleep_end_hour_home_tz': trunc_end_home.hour + trunc_end_home.minute / 60.0,
                                    'sleep_start_day_utc': trunc_start_utc.day,
                                    'sleep_start_hour_utc': trunc_start_utc.hour + trunc_start_utc.minute / 60.0,
                                    'sleep_end_day_utc': trunc_end_utc.day,
                                    'sleep_end_hour_utc': trunc_end_utc.hour + trunc_end_utc.minute / 60.0,
                                    'sleep_start_time_utc': trunc_start_utc.strftime('%H:%M'),
                                    'sleep_end_time_utc': trunc_end_utc.strftime('%H:%M'),
                                    'sleep_start_time_location_tz': trunc_start.strftime('%H:%M'),
                                    'sleep_end_time_location_tz': trunc_end.strftime('%H:%M'),
                                    'sleep_type': 'main',
                                    'duration_hours': trunc_quality.actual_sleep_hours,
                                    'effective_hours': trunc_quality.effective_sleep_hours,
                                    'quality_factor': trunc_quality.sleep_efficiency,
                                    'quality_factors': trunc_qf,
                                }],
                                'explanation': (
                                    f'Post-arrival recovery: truncated {rest_env} sleep '
                                    f'({trunc_start.strftime("%H:%M")}-{trunc_end.strftime("%H:%M")} local, '
                                    f'{trunc_quality.sleep_efficiency:.0%} efficiency). '
                                    f'Late arrival after 23:00 — shortened first recovery night.'
                                ),
                                'confidence_basis': (
                                    f'{"Good" if is_at_home else "Moderate"} confidence — '
                                    f'{rest_env} environment, truncated by late arrival. '
                                    f'Recovery night {recovery_night_number}'
                                ),
                                'quality_factors': trunc_qf,
                                'references': get_strategy_references('recovery'),
                            }
                        recovery_night_number += 1

                    # Advance to next full night for the main loop
                    candidate_date = last_block_end_local.date() + timedelta(days=1)
                    candidate_bedtime = rest_tz.localize(
                        datetime.combine(candidate_date, time(23, 0))
                    )
                while True:
                    sleep_start = candidate_bedtime
                    sleep_end = rest_tz.localize(
                        datetime.combine(
                            candidate_date + timedelta(days=1), time(7, 0)
                        )
                    )

                    # Stop if bedtime is past latest wake (no room for sleep)
                    if sleep_start.astimezone(pytz.utc) >= latest_wake_utc:
                        break

                    # Cap wake time by next duty report buffer
                    if sleep_end.astimezone(pytz.utc) > latest_wake_utc:
                        sleep_end = latest_wake_utc.astimezone(rest_tz)

                    # Need at least 3h for a meaningful night block
                    block_hours = (sleep_end - sleep_start).total_seconds() / 3600
                    if block_hours < 3.0:
                        break

                    # Key by HOME BASE TZ date so RestDaySleepResponse.date aligns
                    # with the chronogram row (which is always in home base time).
                    # candidate_date is in rest_tz (layover or home), so convert the
                    # sleep start to home TZ to get the correct calendar date.
                    sleep_start_home_date = sleep_start.astimezone(home_tz).date()
                    rest_day_key = f"rest_{sleep_start_home_date.isoformat()}"

                    rest_quality = self.sleep_calculator.calculate_sleep_quality(
                        sleep_start=sleep_start,
                        sleep_end=sleep_end,
                        location=rest_env,
                        previous_duty_end=None,
                        next_event=sleep_end + timedelta(hours=12),
                        location_timezone=rest_tz.zone
                    )

                    recovery_block = SleepBlock(
                        start_utc=sleep_start.astimezone(pytz.utc),
                        end_utc=sleep_end.astimezone(pytz.utc),
                        location_timezone=rest_tz.zone,
                        duration_hours=rest_quality.actual_sleep_hours,
                        quality_factor=rest_quality.sleep_efficiency,
                        effective_sleep_hours=rest_quality.effective_sleep_hours,
                        environment=rest_env
                    )

                    sleep_blocks.append(recovery_block)

                    rest_qf = {
                        'base_efficiency': rest_quality.base_efficiency,
                        'wocl_boost': rest_quality.wocl_penalty,
                        'late_onset_penalty': rest_quality.late_onset_penalty,
                        'recovery_boost': rest_quality.recovery_boost,
                        'time_pressure_factor': rest_quality.time_pressure_factor,
                        'insufficient_penalty': rest_quality.insufficient_penalty,
                    }

                    # Recovery fraction model — Banks et al. (2010, 2023):
                    # tau_recovery ≈ 2.5 nights (calibrated to Banks 2010)
                    recovery_fraction = 1.0 - math.exp(-recovery_night_number / 2.5)

                    sleep_start_home = sleep_start.astimezone(home_tz)
                    sleep_end_home = sleep_end.astimezone(home_tz)
                    sleep_start_local = sleep_start
                    sleep_end_local = sleep_end

                    logger.info(f"[GAP-FILL] generated key={rest_day_key} sleep={sleep_start.astimezone(pytz.utc).isoformat()[:16]}→{sleep_end.astimezone(pytz.utc).isoformat()[:16]}")
                    if rest_day_key not in sleep_strategies:
                        sleep_strategies[rest_day_key] = {
                            'strategy_type': 'recovery',
                            'confidence': 0.95 if is_at_home else 0.85,
                            'recovery_night_number': recovery_night_number,
                            'cumulative_recovery_fraction': round(recovery_fraction, 2),
                            'total_sleep_hours': rest_quality.total_sleep_hours,
                            'effective_sleep_hours': rest_quality.effective_sleep_hours,
                            'sleep_efficiency': rest_quality.sleep_efficiency,
                            'wocl_overlap_hours': rest_quality.wocl_overlap_hours,
                            'warnings': [w['message'] for w in rest_quality.warnings],
                            'sleep_start_time': sleep_start_home.strftime('%H:%M'),
                            'sleep_end_time': sleep_end_home.strftime('%H:%M'),
                            'sleep_blocks': [{
                                # Primary fields: HOME BASE timezone for chronogram positioning
                                'sleep_start_time': sleep_start_home.strftime('%H:%M'),
                                'sleep_end_time': sleep_end_home.strftime('%H:%M'),
                                'sleep_start_iso': sleep_start_home.isoformat(),
                                'sleep_end_iso': sleep_end_home.isoformat(),
                                # UTC — canonical, unambiguous reference
                                'sleep_start_utc': sleep_start.astimezone(pytz.utc).isoformat(),
                                'sleep_end_utc': sleep_end.astimezone(pytz.utc).isoformat(),
                                'sleep_start_day': sleep_start_home.day,
                                'sleep_start_hour': sleep_start_home.hour + sleep_start_home.minute / 60.0,
                                'sleep_end_day': sleep_end_home.day,
                                'sleep_end_hour': sleep_end_home.hour + sleep_end_home.minute / 60.0,
                                'location_timezone': rest_tz.zone,
                                'environment': rest_env,
                                # Explicit home base timezone (backward compat, same as primary)
                                'sleep_start_time_home_tz': sleep_start_home.strftime('%H:%M'),
                                'sleep_end_time_home_tz': sleep_end_home.strftime('%H:%M'),
                                'sleep_start_day_home_tz': sleep_start_home.day,
                                'sleep_start_hour_home_tz': sleep_start_home.hour + sleep_start_home.minute / 60.0,
                                'sleep_end_day_home_tz': sleep_end_home.day,
                                'sleep_end_hour_home_tz': sleep_end_home.hour + sleep_end_home.minute / 60.0,
                                # UTC precomputed day/hour for UTC chronogram rendering
                                'sleep_start_day_utc': sleep_start.astimezone(pytz.utc).day,
                                'sleep_start_hour_utc': sleep_start.astimezone(pytz.utc).hour + sleep_start.astimezone(pytz.utc).minute / 60.0,
                                'sleep_end_day_utc': sleep_end.astimezone(pytz.utc).day,
                                'sleep_end_hour_utc': sleep_end.astimezone(pytz.utc).hour + sleep_end.astimezone(pytz.utc).minute / 60.0,
                                'sleep_start_time_utc': sleep_start.astimezone(pytz.utc).strftime('%H:%M'),
                                'sleep_end_time_utc': sleep_end.astimezone(pytz.utc).strftime('%H:%M'),
                                # Location timezone (actual local time where pilot sleeps)
                                'sleep_start_time_location_tz': sleep_start_local.strftime('%H:%M'),
                                'sleep_end_time_location_tz': sleep_end_local.strftime('%H:%M'),
                                'sleep_type': 'main',
                                'duration_hours': rest_quality.actual_sleep_hours,
                                'effective_hours': rest_quality.effective_sleep_hours,
                                'quality_factor': rest_quality.sleep_efficiency,
                                'quality_factors': rest_qf,
                            }],
                            'explanation': (
                                f'Recovery night {recovery_night_number}: {rest_env} sleep '
                                f'({sleep_start_local.strftime("%H:%M")}-{sleep_end_local.strftime("%H:%M")}, '
                                f'{rest_quality.sleep_efficiency:.0%} efficiency). '
                                f'Cumulative recovery ~{recovery_fraction:.0%} of prior debt '
                                f'(Banks et al. 2010: exponential multi-night recovery)'
                            ),
                            'confidence_basis': (
                                f'{"High" if is_at_home else "Moderate"} confidence — '
                                f'{rest_env} environment, no duty constraints. '
                                f'Recovery night {recovery_night_number} '
                                f'(~{recovery_fraction:.0%} cumulative debt recovery)'
                            ),
                            'quality_factors': rest_qf,
                            'references': get_strategy_references('recovery'),
                        }

                    recovery_night_number += 1
                    candidate_date += timedelta(days=1)
                    candidate_bedtime = rest_tz.localize(
                        datetime.combine(candidate_date, time(23, 0))
                    )

        # Resolve overlapping sleep blocks with SWS-aware truncation.
        # First hours of sleep contain disproportionate SWS recovery
        # (Borbély 1982; Dijk & Czeisler 1995: ~65% of SWS in first 3h).
        sleep_blocks.sort(key=lambda s: s.start_utc)
        resolved_blocks = []
        for block in sleep_blocks:
            if resolved_blocks:
                prev = resolved_blocks[-1]
                if block.start_utc < prev.end_utc:
                    overlap_hours = (prev.end_utc - block.start_utc).total_seconds() / 3600
                    new_duration = prev.duration_hours - overlap_hours
                    if new_duration >= 1.0:
                        # SWS-aware scaling: first hours are most restorative
                        # Exponential recovery model — ~65% of SWS occurs in
                        # the first 3h (Dijk & Czeisler 1995 J Neurosci 15:3526)
                        tau_sws = 3.0  # SWS time constant (hours)
                        original_recovery = 1.0 - math.exp(-prev.duration_hours / tau_sws)
                        truncated_recovery = 1.0 - math.exp(-new_duration / tau_sws)
                        if original_recovery > 0:
                            scale = truncated_recovery / original_recovery
                        else:
                            scale = new_duration / prev.duration_hours if prev.duration_hours > 0 else 1.0
                        new_effective = min(
                            prev.effective_sleep_hours * scale,
                            new_duration  # effective cannot exceed duration
                        )
                        # Recalculate home-base TZ positioning for truncated end.
                        # Start position is unchanged; only end moves earlier.
                        new_end_home = block.start_utc.astimezone(home_tz)
                        resolved_blocks[-1] = SleepBlock(
                            start_utc=prev.start_utc,
                            end_utc=block.start_utc,
                            location_timezone=prev.location_timezone,
                            duration_hours=new_duration,
                            quality_factor=prev.quality_factor,
                            effective_sleep_hours=new_effective,
                            circadian_misalignment_hours=prev.circadian_misalignment_hours,
                            is_anchor_sleep=prev.is_anchor_sleep,
                            is_inflight_rest=prev.is_inflight_rest,
                            environment=prev.environment,
                            sleep_start_day=prev.sleep_start_day,
                            sleep_start_hour=prev.sleep_start_hour,
                            sleep_end_day=new_end_home.day,
                            sleep_end_hour=new_end_home.hour + new_end_home.minute / 60.0,
                        )
                    else:
                        resolved_blocks.pop()
            resolved_blocks.append(block)
        sleep_blocks = resolved_blocks

        return sleep_blocks, sleep_strategies

    def _store_strategy_response(
        self,
        strategy: 'SleepStrategy',
        key: str,
        sleep_strategies: Dict[str, Any],
        home_tz: Any
    ) -> None:
        """Build and store the API response dict for a sleep strategy."""
        if not strategy.quality_analysis:
            return

        quality = strategy.quality_analysis[0]
        sleep_blocks_response = []

        if strategy.sleep_blocks:
            for idx, block in enumerate(strategy.sleep_blocks):
                location_tz = pytz.timezone(block.location_timezone)
                sleep_start_local = block.start_utc.astimezone(location_tz)
                sleep_end_local = block.end_utc.astimezone(location_tz)
                sleep_start_home = block.start_utc.astimezone(home_tz)
                sleep_end_home = block.end_utc.astimezone(home_tz)

                sleep_type = 'main'
                if hasattr(block, 'is_anchor_sleep') and not block.is_anchor_sleep:
                    sleep_type = 'nap'
                elif hasattr(block, 'is_inflight_rest') and block.is_inflight_rest:
                    sleep_type = 'inflight'

                block_qf = None
                if idx < len(strategy.quality_analysis):
                    qa = strategy.quality_analysis[idx]
                    block_qf = {
                        'base_efficiency': qa.base_efficiency,
                        'wocl_boost': qa.wocl_penalty,
                        'late_onset_penalty': qa.late_onset_penalty,
                        'recovery_boost': qa.recovery_boost,
                        'time_pressure_factor': qa.time_pressure_factor,
                        'insufficient_penalty': qa.insufficient_penalty,
                    }

                sleep_start_utc_dt = block.start_utc.astimezone(pytz.utc)
                sleep_end_utc_dt = block.end_utc.astimezone(pytz.utc)

                sleep_blocks_response.append({
                    # Primary fields: HOME BASE timezone for chronogram positioning.
                    # All sleep times use the same reference TZ as duty times,
                    # preventing misalignment when pilot sleeps at a layover
                    # location in a different timezone.
                    'sleep_start_time': sleep_start_home.strftime('%H:%M'),
                    'sleep_end_time': sleep_end_home.strftime('%H:%M'),
                    'sleep_start_iso': sleep_start_home.isoformat(),
                    'sleep_end_iso': sleep_end_home.isoformat(),
                    # UTC — canonical, unambiguous reference
                    'sleep_start_utc': sleep_start_utc_dt.isoformat(),
                    'sleep_end_utc': sleep_end_utc_dt.isoformat(),
                    'sleep_start_day': sleep_start_home.day,
                    'sleep_start_hour': sleep_start_home.hour + sleep_start_home.minute / 60.0,
                    'sleep_end_day': sleep_end_home.day,
                    'sleep_end_hour': sleep_end_home.hour + sleep_end_home.minute / 60.0,
                    'location_timezone': block.location_timezone,
                    'environment': block.environment,
                    # Explicit home base timezone (backward compat, same as primary)
                    'sleep_start_time_home_tz': sleep_start_home.strftime('%H:%M'),
                    'sleep_end_time_home_tz': sleep_end_home.strftime('%H:%M'),
                    'sleep_start_day_home_tz': sleep_start_home.day,
                    'sleep_start_hour_home_tz': sleep_start_home.hour + sleep_start_home.minute / 60.0,
                    'sleep_end_day_home_tz': sleep_end_home.day,
                    'sleep_end_hour_home_tz': sleep_end_home.hour + sleep_end_home.minute / 60.0,
                    # UTC precomputed day/hour for UTC chronogram rendering
                    'sleep_start_day_utc': sleep_start_utc_dt.day,
                    'sleep_start_hour_utc': sleep_start_utc_dt.hour + sleep_start_utc_dt.minute / 60.0,
                    'sleep_end_day_utc': sleep_end_utc_dt.day,
                    'sleep_end_hour_utc': sleep_end_utc_dt.hour + sleep_end_utc_dt.minute / 60.0,
                    'sleep_start_time_utc': sleep_start_utc_dt.strftime('%H:%M'),
                    'sleep_end_time_utc': sleep_end_utc_dt.strftime('%H:%M'),
                    # Location timezone (actual local time where pilot sleeps)
                    'sleep_start_time_location_tz': sleep_start_local.strftime('%H:%M'),
                    'sleep_end_time_location_tz': sleep_end_local.strftime('%H:%M'),
                    'sleep_type': sleep_type,
                    'duration_hours': block.duration_hours,
                    'effective_hours': block.effective_sleep_hours,
                    'quality_factor': block.quality_factor,
                    'quality_factors': block_qf,
                })

            first_block = strategy.sleep_blocks[0]
            sleep_start_home_top = first_block.start_utc.astimezone(home_tz)
            sleep_end_home_top = first_block.end_utc.astimezone(home_tz)
            sleep_start_time = sleep_start_home_top.strftime('%H:%M')
            sleep_end_time = sleep_end_home_top.strftime('%H:%M')
        else:
            sleep_start_time = None
            sleep_end_time = None

        sleep_strategies[key] = {
            'strategy_type': strategy.strategy_type,
            'confidence': strategy.confidence,
            'total_sleep_hours': quality.total_sleep_hours,
            'effective_sleep_hours': quality.effective_sleep_hours,
            'sleep_efficiency': quality.sleep_efficiency,
            'wocl_overlap_hours': quality.wocl_overlap_hours,
            'warnings': [w['message'] for w in quality.warnings],
            'sleep_start_time': sleep_start_time,
            'sleep_end_time': sleep_end_time,
            'sleep_blocks': sleep_blocks_response,
            'explanation': strategy.explanation,
            'confidence_basis': get_confidence_basis(strategy),
            'quality_factors': {
                'base_efficiency': quality.base_efficiency,
                'wocl_boost': quality.wocl_penalty,
                'late_onset_penalty': quality.late_onset_penalty,
                'recovery_boost': quality.recovery_boost,
                'time_pressure_factor': quality.time_pressure_factor,
                'insufficient_penalty': quality.insufficient_penalty,
            },
            'references': get_strategy_references(strategy.strategy_type),
        }

    # NOTE: _generate_post_duty_sleep() was removed in cleanup.
    # All sleep generation routes through UnifiedSleepCalculator and
    # generate_inter_duty_sleep().  The removed method was dead code
    # (~110 lines) never called from any active code path.

    # _get_confidence_basis and _get_strategy_references have been
    # extracted to core/strategy_references.py for maintainability.
    # Thin wrappers retained for backward compatibility of any
    # subclass or external code that calls the old method names.

    @staticmethod
    def _get_confidence_basis(strategy: SleepStrategy) -> str:
        return get_confidence_basis(strategy)

    @staticmethod
    def _get_strategy_references(strategy_type: str) -> list:
        return get_strategy_references(strategy_type)

    def _get_phase_shift_at_time(
        self,
        target_time: datetime,
        body_clock_timeline: List[Tuple[datetime, CircadianState]]
    ) -> float:
        """Get circadian phase shift at specific time"""
        for timestamp, state in reversed(body_clock_timeline):
            if timestamp <= target_time:
                return state.current_phase_shift_hours
        return 0.0
    
    def _build_monthly_analysis(self, roster: Roster, duty_timelines: List[DutyTimeline],
                                body_clock_timeline: list = None) -> MonthlyAnalysis:
        """Build monthly summary with aggregate statistics"""
        
        risk_thresholds = self.config.risk_thresholds
        
        high_risk = sum(
            1 for dt in duty_timelines
            if dt.landing_performance and risk_thresholds.classify(dt.landing_performance) == 'high'
        )
        critical_risk = sum(
            1 for dt in duty_timelines
            if dt.landing_performance and risk_thresholds.classify(dt.landing_performance) in ['critical', 'extreme']
        )
        
        total_pinch = sum(len(dt.pinch_events) for dt in duty_timelines)
        
        all_sleep = [dt.prior_sleep_hours for dt in duty_timelines if dt.prior_sleep_hours > 0]
        avg_sleep = sum(all_sleep) / len(all_sleep) if all_sleep else 0.0
        
        max_debt = max(dt.cumulative_sleep_debt for dt in duty_timelines)
        
        worst_duty = min(duty_timelines, key=lambda dt: dt.min_performance)
        
        # Serialize body clock timeline for API exposure
        bcl = []
        if body_clock_timeline:
            for timestamp, state in body_clock_timeline:
                bcl.append((
                    timestamp.isoformat(),
                    round(state.current_phase_shift_hours, 2),
                    state.reference_timezone,
                ))

        # ULR / augmented crew statistics
        total_ulr = sum(1 for dt in duty_timelines if getattr(dt, 'is_ulr', False))
        total_augmented = sum(
            1 for dt in duty_timelines
            if getattr(dt, 'crew_composition', CrewComposition.STANDARD) in (
                CrewComposition.AUGMENTED_3, CrewComposition.AUGMENTED_4
            )
        )
        ulr_violations = []
        for dt in duty_timelines:
            if getattr(dt, 'ulr_compliance', None) and dt.ulr_compliance.violations:
                ulr_violations.extend(dt.ulr_compliance.violations)

        return MonthlyAnalysis(
            roster=roster,
            duty_timelines=duty_timelines,
            high_risk_duties=high_risk,
            critical_risk_duties=critical_risk,
            total_pinch_events=total_pinch,
            average_sleep_per_night=avg_sleep,
            max_sleep_debt=max_debt,
            lowest_performance_duty=worst_duty.duty_id,
            lowest_performance_value=worst_duty.min_performance,
            body_clock_timeline=bcl,
            total_ulr_duties=total_ulr,
            total_augmented_duties=total_augmented,
            ulr_violations=ulr_violations,
        )


# ============================================================================
# MODULE EXPORTS
# ============================================================================

__all__ = [
    # Configuration
    'EASAFatigueFramework',
    'BorbelyParameters',
    'SleepQualityParameters',
    'AdaptationRates',
    'RiskThresholds',
    'ModelConfig',
    
    # Sleep Calculation
    'UnifiedSleepCalculator',
    'SleepQualityAnalysis',
    'SleepStrategy',
    
    # EASA Compliance
    'EASAComplianceValidator',
    
    # Workload
    'WorkloadParameters',
    'WorkloadModel',
    
    # Main Model
    'BorbelyFatigueModel',
]
