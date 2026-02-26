"""
Configuration & Parameters for Fatigue Model
============================================

All configuration dataclasses for the Borbély Two-Process Model:
- EASAFatigueFramework: EASA FTL regulatory definitions
- BorbelyParameters: Two-process model parameters
- SleepQualityParameters: Sleep quality multipliers
- AdaptationRates: Circadian adaptation rates
- RiskThresholds: Performance score thresholds
- ModelConfig: Master configuration container

Scientific Foundation:
    Borbély & Achermann (1999), Jewett & Kronauer (1999), Van Dongen et al. (2003),
    Signal et al. (2009), Gander et al. (2013), Bourgeois-Bougrine et al. (2003)
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Tuple


@dataclass
class EASAFatigueFramework:
    """EASA FTL regulatory definitions (EU Regulation 965/2012)"""

    # WOCL definition - AMC1 ORO.FTL.105(10)
    wocl_start_hour: int = 2
    wocl_end_hour: int = 5
    wocl_end_minute: int = 59

    # Acclimatization thresholds - AMC1 ORO.FTL.105(1)
    acclimatization_timezone_band_hours: float = 2.0
    acclimatization_required_local_nights: int = 3

    # Duty time definitions
    local_night_start_hour: int = 22
    local_night_end_hour: int = 8
    early_start_threshold_hour: int = 6
    late_finish_threshold_hour: int = 2

    # Rest requirements - ORO.FTL.235
    minimum_rest_hours: float = 12.0
    minimum_sleep_opportunity_hours: float = 8.0

    # FDP limits - ORO.FTL.205
    max_fdp_basic_hours: float = 13.0
    max_duty_hours: float = 14.0


@dataclass
class BorbelyParameters:
    """
    Two-process sleep regulation model parameters
    References: Borbély (1982, 1999), Jewett & Kronauer (1999), Van Dongen (2003)
    """

    # Process S bounds
    S_max: float = 1.0
    S_min: float = 0.0

    # Time constants (Jewett & Kronauer 1999)
    tau_i: float = 18.2  # Buildup during wake (hours)
    tau_d: float = 4.2   # Decay during sleep (hours)

    # Process C parameters
    circadian_amplitude: float = 0.25
    circadian_mesor: float = 0.5
    circadian_period_hours: float = 24.0
    circadian_acrophase_hours: float = 17.0  # Peak alertness time

    # Second harmonic — Wake Maintenance Zone (WMZ)
    # Dijk & Czeisler (1994) J Sleep Res 3:73-82 showed the circadian
    # alertness signal is NOT a pure sinusoid.  A second harmonic with
    # 12-h period creates the "forbidden zone for sleep" (Lavie 1986)
    # between ~18:00-21:00 — a paradoxical alertness plateau in the
    # evening despite rising homeostatic pressure.  The amplitude of the
    # second harmonic is approximately 30% of the fundamental (A2/A1≈0.3),
    # and its phase peaks around 20:00 local time.
    # Strogatz et al. (1987) Am J Physiol 253:R173 confirmed the
    # bimodal structure of the sleep propensity curve.
    circadian_second_harmonic_amplitude: float = 0.08  # A2 ≈ 0.3 × A1
    circadian_second_harmonic_phase: float = 20.0      # Peak at ~20:00

    # Performance integration — operational weighting choice.
    # The Åkerstedt-Folkard three-process model uses additive S+C
    # combination; these explicit weights are an operational adaptation,
    # not directly from the literature. Homeostatic component weighted
    # slightly higher (55%) because sleep recovery should dominate over
    # circadian phase for well-rested pilots — Gander et al. (2013)
    # showed trained pilots maintain performance better than predicted
    # during moderate circadian lows. Research config retains 50/50.
    weight_circadian: float = 0.45
    weight_homeostatic: float = 0.55
    interaction_exponent: float = 1.5

    # Sleep inertia (Tassi & Muzet 2000)
    inertia_duration_minutes: float = 30.0
    inertia_max_magnitude: float = 0.30

    # Time-on-task (non-linear model)
    # Folkard & Åkerstedt (1999) J Biol Rhythms 14:577 — linear component.
    # Cabon et al. (2008) Int J Ind Ergon 38:885-891 — demonstrated that
    # time-on-task fatigue accelerates non-linearly beyond ~8h, especially
    # in cockpit environments with sustained attention demands.
    # Model: tot = k1·log(1+h) + k2·max(0, h−h_inf)²
    #   k1 (log coefficient): captures gentle initial fatigue ramp
    #   k2 (quadratic coefficient): accelerating fatigue after inflection
    #   h_inf (inflection hours): point beyond which fatigue accelerates
    # For h=4: tot≈0.019, h=8: tot≈0.026, h=12: tot≈0.039, h=16: tot≈0.058
    # This replaces the flat linear rate while maintaining similar magnitudes
    # for normal-length duties (<10h).
    time_on_task_rate: float = 0.003  # kept for compatibility / fallback
    tot_log_coeff: float = 0.012     # Logarithmic ramp coefficient
    tot_quadratic_coeff: float = 0.0005  # Quadratic acceleration coefficient
    tot_inflection_hours: float = 8.0    # Inflection point for acceleration

    # Sleep debt
    # Baseline 8h need: Van Dongen et al. (2003) Sleep 26(2):117-126
    # Decay rate 0.35/day ≈ half-life 2.0 days.
    #   Banks et al. (2010) showed one night of 10 h TIB insufficient to
    #   restore baseline after 5 days of 4 h/night restriction.
    #   Kitamura et al. (2016) Sci Rep 6:35812 found 1 h of debt needs
    #   ~4 days of optimal sleep for full recovery → exp(-0.35*4)=0.247
    #   (75 % recovered in 4 d).  Belenky et al. (2003) J Sleep Res
    #   12:1-12 showed substantial but incomplete recovery after 3 × 8 h
    #   nights → exp(-0.35*3)=0.35 (65 % recovered in 3 d).
    # Previous value of 0.50 was too generous — implied near-full recovery
    # in ~2 nights, inconsistent with Banks (2010) findings.
    # Debt is calculated against RAW sleep duration (time in bed).
    # Quality factor feeds into Process S recovery separately.
    baseline_sleep_need_hours: float = 8.0
    sleep_debt_decay_rate: float = 0.35

    # Recovery sleep rebound (debt-driven extension)
    # Banks et al. (2010) Sleep 33(8):1013-1026 — following chronic
    # restriction (5 nights of 4h TIB), recovery sleep averaged 9.0h
    # despite only 10h TIB opportunity.
    # Kitamura et al. (2016) Sci Rep 6:35812 — recovery sleep duration
    # scales with cumulative debt but saturates around 9-10h (circadian
    # wake signal terminates sleep regardless of remaining debt).
    # Formula: recovery_duration = base + rebound_coeff × min(debt, max_debt)
    # At 10h debt: +1.5h (→ 9.0h total). At 20h debt: +3.0h (→ 10.5h, but
    # capped by circadian wake gate at ~10h).
    sleep_rebound_coeff: float = 0.15  # Extra hours per hour of debt
    sleep_rebound_max_debt: float = 20.0  # Debt cap for rebound formula

    # Non-linear S recovery (SWA diminishing returns)
    # Borbély & Achermann (1999) Pharmacopsychiatry 32:56-67 — SWA
    # (slow-wave activity) power declines exponentially during sleep,
    # making the FIRST hours of sleep the most restorative. After ~5-6h,
    # recovery becomes increasingly dominated by lighter stages (Stage 2,
    # REM), which contribute less to S recovery.
    # Formula: tau_d_effective = tau_d × (1 + swa_coeff × t_sleep / 8.0)
    # After 8h of sleep: effective tau_d is 15% longer (slower recovery).
    # After 4h: only ~7.5% longer. This makes the first 4h of sleep
    # substantially more valuable than hours 5-8.
    swa_diminishing_coeff: float = 0.15

    # Cabin altitude hypoxia
    # Nesthus et al. (2007) DOT/FAA/AM-07/21 — mild hypoxia at cabin
    # altitude reduces cognitive performance 1-3% depending on altitude.
    # Muhm et al. (2007) Aviat Space Environ Med 78:B13-B18 — cabin
    # altitudes of 6,000-8,000 ft equivalent pressure produce measurable
    # SpO2 reduction and subtle cognitive impairment.
    # Formula: hypoxia_factor = 1.0 - coeff × max(0, cabin_alt - 5000) / 1000
    # At 7000 ft: −2%, at 8000 ft: −3%. Below 5000 ft: no effect.
    hypoxia_coeff: float = 0.01
    default_cabin_altitude_ft: float = 7000.0

    # Circadian amplitude dampening under chronic sleep debt
    # McCauley et al. (2013) Proc Natl Acad Sci 110:E2380-E2389 —
    # demonstrated that chronic sleep restriction dampens the amplitude
    # of the circadian performance rhythm: well-rested subjects show
    # large day-night alertness differences, while sleep-deprived subjects
    # show a flattened rhythm (less circadian variation).
    # Formula: effective_amplitude = base × (1 - dampening_coeff × min(debt, max_debt) / max_debt)
    # At 10h debt: amplitude reduced by ~12.5%, at 20h: by 25%.
    circadian_dampening_coeff: float = 0.25
    circadian_dampening_max_debt: float = 20.0

    # Sleep debt vulnerability — chronic restriction amplification
    # Van Dongen et al. (2003) Sleep 26(2):117-126 showed that chronic
    # sleep restriction (4-6h/night) produces cumulative cognitive deficits
    # that grow linearly with each day of restriction and are NOT offset
    # by circadian recovery.  The "dose-response" relationship means that
    # even moderate nightly shortfalls compound into significant impairment.
    # Banks & Dinges (2007) Prog Brain Res 185:41-53 confirmed that
    # performance degrades proportionally to accumulated debt hours.
    # The coefficient 0.025 per hour of debt means:
    #   4h debt → −10% alertness, 8h debt → −20%, capped at floor.
    # Floor of 0.80 prevents unrealistically low values (debt alone cannot
    # reduce performance below 80% of its debt-free value).
    sleep_debt_vulnerability_coeff: float = 0.025
    sleep_debt_vulnerability_floor: float = 0.80

    # Chronotype offset and individual vulnerability
    # Roenneberg et al. (2007) Curr Biol 17:R44-R45 — chronotype (morningness-
    # eveningness) shifts the circadian acrophase by ±2h. Morning types
    # ("larks") peak ~15:00, evening types ("owls") peak ~19:00.
    # Van Dongen et al. (2004) Sleep 27(3):423-433 — inter-individual
    # differences in vulnerability to sleep deprivation are trait-like and
    # stable: some individuals show 3× greater impairment under identical
    # restriction. The vulnerability factor scales the performance deficit
    # (not the S/C processes themselves) to capture this variability.
    # Default: 0.0 offset (average chronotype), 1.0 vulnerability (average).
    chronotype_offset_hours: float = 0.0   # Shifts acrophase ±2h
    individual_vulnerability: float = 1.0  # 0.7 = resilient, 1.3 = sensitive

    # Pinch event detection thresholds.
    # A "pinch" occurs when high sleep pressure coincides with circadian low,
    # creating a dangerous fatigue state during critical flight phases.
    # C < threshold = circadian low period (roughly 23:00-08:00 biological time)
    # S > threshold = elevated sleep pressure (~10+ hours awake)
    # Calibrated to avoid false positives from normal night operations with
    # adequate rest, while catching genuinely dangerous combinations.
    pinch_circadian_threshold: float = 0.40
    pinch_sleep_pressure_threshold: float = 0.70


@dataclass
class SleepQualityParameters:
    """
    Sleep quality multipliers by environment

    Primary reference: Signal et al. (2013) Sleep 36(1):109-118
    — PSG-measured hotel efficiency 88%, inflight bunk 70%.
    Values below are operational estimates calibrated to Signal (2013).
    Note: Åkerstedt (2003) Occup Med 53:89-94 covers shift-work sleep
    disruption but does not provide hotel-specific efficiency values.
    """

    # Environment quality factors (aligned with LOCATION_EFFICIENCY in
    # UnifiedSleepCalculator to avoid duplicate definitions)
    quality_home: float = 1.0
    quality_hotel_quiet: float = 0.88   # Signal et al. (2013) PSG: 88%
    quality_hotel_typical: float = 0.85
    quality_hotel_airport: float = 0.82
    quality_crew_rest_facility: float = 0.70  # Signal et al. (2013) PSG: 70%

    # Circadian timing penalties
    max_circadian_quality_penalty: float = 0.25
    early_wake_penalty_per_hour: float = 0.05
    late_sleep_start_penalty_per_hour: float = 0.03

    # Sleep onset latency (SOL) model
    # Åkerstedt et al. (2008) J Sleep Res 17:295-304 — SOL varies with
    # circadian phase and homeostatic pressure.  Sleep initiation is
    # hardest during the Wake Maintenance Zone (~18:00-21:00) when the
    # circadian signal opposes sleep ("forbidden zone for sleep").
    # Lavie (1986) Sleep 9:355-366 — circadian gates for sleep onset.
    # Formula: SOL = base × circadian_gate / max(0.3, S_pressure)
    #   - Higher S (more sleep pressure) → shorter SOL
    #   - WMZ timing → longer SOL (circadian gate closes)
    # Clamped to 5-60 minutes (physiological bounds).
    sol_base_minutes: float = 15.0
    sol_wmz_amplitude: float = 0.8  # How much WMZ extends SOL (0-1 scale)

    # Nap recovery efficiency by duration
    # Brooks & Lack (2006) J Sleep Res 15:378-385 — 10-min nap optimal
    # for alertness restoration; 30+ min naps risk sleep inertia.
    # Tietzel & Lack (2002) Psychophysiology 39:17-24 — brief naps
    # (<20 min) show rapid improvement without SWS inertia.
    # Replaces the flat 0.88 nap penalty with duration-dependent lookup:
    #   ≤10 min → 0.75 (mostly Stage 1, limited restoration)
    #   10-20 min → 0.90 (optimal: Stage 2 without SWS)
    #   20-30 min → 0.92 (some SWS entry, slight inertia risk)
    #   30-60 min → 0.88 (SWS → inertia reduces net benefit)
    #   >60 min → 0.85 (full cycle but high inertia risk on wake)
    nap_efficiency_under_10: float = 0.75
    nap_efficiency_10_20: float = 0.90
    nap_efficiency_20_30: float = 0.92
    nap_efficiency_30_60: float = 0.88
    nap_efficiency_over_60: float = 0.85

    # First-night effect
    # Agnew et al. (1966) Psychophysiology 3:263-266 — first night in a
    # novel environment shows increased SOL, reduced SWS%, and more WASO.
    # Tamaki et al. (2016) Curr Biol 26:1190-1194 — unihemispheric slow
    # wave activity on first night (brain remains vigilant in new space).
    # Effect attenuates on second night, negligible by third.
    first_night_sol_extra_minutes: float = 12.0
    second_night_sol_extra_minutes: float = 5.0

    # Split sleep quality differential
    # Jackson et al. (2014) Sleep Med Rev 18:425-440 — split sleep
    # maintains cognitive performance better than equivalent total sleep
    # in a single block ONLY when each fragment is ≥4h (allowing at least
    # one full SWS cycle per fragment).
    # Kosmadopoulos et al. (2017) Chronobiol Int 34:885-896 — confirmed
    # that 4+4h split provided ~92% of consolidated 8h effectiveness.
    # Fragments <3h are too short for meaningful SWS entry.
    split_efficiency_4h_plus: float = 0.92   # Each block ≥4h
    split_efficiency_3h_plus: float = 0.85   # Each block ≥3h, <4h
    split_efficiency_under_3h: float = 0.78  # Any block <3h

    # Anticipatory arousal (pre-duty alarm anxiety)
    # Kecklund & Åkerstedt (2004) J Sleep Res 13:1-6 — early morning
    # report times (<06:00) truncate sleep via anticipatory arousal:
    # pilots set earlier alarms and sleep is lighter due to anxiety
    # about oversleeping.  The 0.97 multiplier (−3%) reflects the
    # measured sleep efficiency reduction for early-start workers.
    early_report_hour: float = 6.0    # Report before this hour triggers penalty
    alarm_anxiety_penalty: float = 0.97  # −3% sleep quality


@dataclass
class AdaptationRates:
    """
    Circadian adaptation rates for timezone shifts
    Reference: Waterhouse et al. (2007)
    """

    westward_hours_per_day: float = 1.5  # Phase delay (easier)
    eastward_hours_per_day: float = 1.0  # Phase advance (harder)

    def get_rate(self, timezone_shift_hours: float) -> float:
        return self.westward_hours_per_day if timezone_shift_hours < 0 else self.eastward_hours_per_day


@dataclass
class RiskThresholds:
    """Performance score thresholds with EASA references"""

    thresholds: Dict[str, Tuple[float, float]] = field(default_factory=lambda: {
        'low': (75, 100),
        'moderate': (65, 75),
        'high': (55, 65),
        'critical': (45, 55),
        'extreme': (0, 45)
    })

    actions: Dict[str, Dict[str, str]] = field(default_factory=lambda: {
        'low': {'action': 'None required', 'description': 'Well-rested state'},
        'moderate': {'action': 'Enhanced monitoring', 'description': 'Equivalent to ~6h sleep'},
        'high': {'action': 'Mitigation required', 'description': 'Equivalent to ~5h sleep'},
        'critical': {'action': 'MANDATORY roster modification', 'description': 'Equivalent to ~4h sleep'},
        'extreme': {'action': 'UNSAFE - Do not fly', 'description': 'Severe impairment'}
    })

    def classify(self, performance: float) -> str:
        if performance is None:
            return 'unknown'
        for level, (low, high) in self.thresholds.items():
            if low <= performance < high:
                return level
        return 'extreme'

    def get_action(self, risk_level: str) -> Dict[str, str]:
        return self.actions.get(risk_level, self.actions['extreme'])


@dataclass
class ModelConfig:
    """Master configuration container"""
    easa_framework: EASAFatigueFramework
    borbely_params: BorbelyParameters
    risk_thresholds: RiskThresholds
    adaptation_rates: AdaptationRates
    sleep_quality_params: SleepQualityParameters
    augmented_fdp_params: 'Any' = None  # AugmentedFDPParameters (from core.extended_operations)
    ulr_params: 'Any' = None            # QatarFTL718Parameters (Qatar FTL 7.18)

    def __post_init__(self):
        # Lazy import to avoid circular dependency
        if self.augmented_fdp_params is None:
            from core.extended_operations import AugmentedFDPParameters
            self.augmented_fdp_params = AugmentedFDPParameters()
        if self.ulr_params is None:
            from core.extended_operations import ULRParameters
            self.ulr_params = ULRParameters()

    @classmethod
    def default_easa_config(cls):
        return cls(
            easa_framework=EASAFatigueFramework(),
            borbely_params=BorbelyParameters(),
            risk_thresholds=RiskThresholds(),
            adaptation_rates=AdaptationRates(),
            sleep_quality_params=SleepQualityParameters(),
        )

    @classmethod
    def conservative_config(cls):
        """
        Stricter thresholds for safety-first analysis.
        - Faster homeostatic pressure buildup (shorter tau_i)
        - Slower recovery during sleep (longer tau_d)
        - Higher baseline sleep need
        - Stronger circadian penalties on sleep quality
        - Tighter risk thresholds (scores shift up by ~5 points)
        """
        return cls(
            easa_framework=EASAFatigueFramework(),
            borbely_params=BorbelyParameters(
                tau_i=16.0,
                tau_d=4.8,
                baseline_sleep_need_hours=8.5,
                inertia_duration_minutes=40.0,
                inertia_max_magnitude=0.35,
            ),
            risk_thresholds=RiskThresholds(thresholds={
                'low': (80, 100),
                'moderate': (70, 80),
                'high': (60, 70),
                'critical': (50, 60),
                'extreme': (0, 50)
            }),
            adaptation_rates=AdaptationRates(
                westward_hours_per_day=1.0,
                eastward_hours_per_day=0.7,
            ),
            sleep_quality_params=SleepQualityParameters(
                quality_hotel_typical=0.75,
                quality_hotel_airport=0.70,
                quality_crew_rest_facility=0.60,
                max_circadian_quality_penalty=0.30,
            )
        )

    @classmethod
    def liberal_config(cls):
        """
        Relaxed thresholds for experienced-crew / low-risk route analysis.
        - Slower homeostatic pressure buildup (longer tau_i)
        - Faster recovery during sleep (shorter tau_d)
        - Lower baseline sleep need
        - Looser risk thresholds (scores shift down by ~5 points)
        """
        return cls(
            easa_framework=EASAFatigueFramework(),
            borbely_params=BorbelyParameters(
                tau_i=20.0,
                tau_d=3.8,
                baseline_sleep_need_hours=7.5,
                inertia_duration_minutes=20.0,
                inertia_max_magnitude=0.25,
            ),
            risk_thresholds=RiskThresholds(thresholds={
                'low': (70, 100),
                'moderate': (60, 70),
                'high': (50, 60),
                'critical': (40, 50),
                'extreme': (0, 40)
            }),
            adaptation_rates=AdaptationRates(
                westward_hours_per_day=1.8,
                eastward_hours_per_day=1.2,
            ),
            sleep_quality_params=SleepQualityParameters(
                quality_hotel_typical=0.85,
                quality_hotel_airport=0.80,
                quality_crew_rest_facility=0.70,
            )
        )

    @classmethod
    def research_config(cls):
        """
        Textbook Borbély two-process parameters for academic comparison.
        Uses values from Jewett & Kronauer (1999) and Van Dongen (2003)
        without operational adjustments.
        """
        return cls(
            easa_framework=EASAFatigueFramework(),
            borbely_params=BorbelyParameters(
                tau_i=18.2,
                tau_d=4.2,
                circadian_amplitude=0.30,
                weight_circadian=0.5,
                weight_homeostatic=0.5,
                interaction_exponent=1.0,
                baseline_sleep_need_hours=8.0,
            ),
            risk_thresholds=RiskThresholds(),
            adaptation_rates=AdaptationRates(),
            sleep_quality_params=SleepQualityParameters()
        )
