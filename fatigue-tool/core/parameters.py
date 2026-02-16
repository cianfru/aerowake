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

    # Performance integration — operational weighting choice.
    # The Åkerstedt-Folkard three-process model uses additive S+C
    # combination; these explicit weights are an operational adaptation,
    # not directly from the literature. Research config uses 50/50.
    # Adjusted to 50/50 to provide better balance and reduce over-sensitivity
    # to homeostatic pressure during normal daytime operations while maintaining
    # sensitivity to true sleep deprivation.
    weight_circadian: float = 0.50
    weight_homeostatic: float = 0.50
    interaction_exponent: float = 1.5

    # Sleep inertia (Tassi & Muzet 2000)
    inertia_duration_minutes: float = 30.0
    inertia_max_magnitude: float = 0.30

    # Time-on-task (Folkard & Åkerstedt 1999, J Biol Rhythms 14:577)
    # Linear alertness decrement per hour on shift, independent of S & C.
    # Folkard (1999) identified ~0.7 % / h decline in subjective alertness
    # ratings across 12-h shifts. We use 0.003 / h on a 0-1 scale
    # (≈ 0.24 % performance / h on the 20-100 scale), calibrated for aviation.
    # Aviation operations have structured rest periods and crew coordination
    # that mitigate some time-on-task effects compared to continuous shifts.
    time_on_task_rate: float = 0.003  # per hour on duty

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
    ulr_params: 'Any' = None            # ULRParameters (from core.extended_operations)

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
