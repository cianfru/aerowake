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
from typing import Any, Dict, Optional, Tuple


@dataclass
class EASAFatigueFramework:
    """EASA FTL regulatory definitions (EU Regulation 965/2012)"""

    # WOCL definition - ORO.FTL.105(28)
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
    Legacy two-process parameters retained for compatibility and sleep estimation.

    Historical research: Borbély (1982, 1999), Jewett & Kronauer (1999),
    Van Dongen (2003). These application coefficients are not all published
    values. Current KSS scoring uses core/published_tpm.py; workload, resilience,
    hypoxia, PVT and time-on-task terms below do not modify that score.
    """

    # Process S bounds
    workload_enabled: bool = True
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

    # Legacy wake-maintenance approximation. Dijk & Czeisler (1994),
    # Neurosci Lett 166:63-68, and Lavie (1986), Electroencephalogr Clin
    # Neurophysiol 63:414-425, describe timing mechanisms. The amplitude,
    # phase and numerical ratio here are application assumptions.
    circadian_second_harmonic_amplitude: float = 0.08  # A2 ≈ 0.3 × A1
    circadian_second_harmonic_phase: float = 20.0      # Peak at ~20:00

    # Legacy integration weights: application choices, not published
    # coefficients or an established trained-pilot advantage.
    weight_circadian: float = 0.45
    weight_homeostatic: float = 0.55
    interaction_exponent: float = 1.5

    # Legacy resilience heuristic, not established by Gander et al. (2013).
    # Excluded from the current KSS score.
    resilience_boost_magnitude: float = 0.07   # 7% max boost (default/research)
    resilience_boost_peak_s: float = 0.20      # Peak at S=0.20 (recently woken)
    resilience_boost_sigma: float = 0.18       # Gaussian width

    # PVT (Psychomotor Vigilance Task) prediction coefficients
    # Van Dongen et al. (2003) Sleep 26(2):117-126 dose-response curves.
    # Basner & Dinges (2011) Sleep 34(5):581-591.
    # Formula: lapses = baseline + debt_coeff × debt + wake_coeff × max(0, awake − threshold)
    # Default values calibrated for unselected lab subjects.
    # Operational preset reduces coefficients ~30% for trained crew
    # (Gander et al. 2013: pilots maintain vigilance better).
    pvt_baseline_lapses: float = 1.5          # Well-rested baseline lapses/10min
    pvt_debt_coefficient: float = 0.4         # Lapses per hour of cumulative debt
    pvt_wake_coefficient: float = 1.2         # Lapses per hour awake beyond threshold
    pvt_wake_threshold_hours: float = 16.0    # Extended wakefulness onset

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

    # Legacy nonlinear recovery heuristic. Borbély & Achermann (1999),
    # J Biol Rhythms 14:557-568, reviews homeostasis; it does not validate
    # this coefficient or a fixed comparative value of successive sleep hours.
    swa_diminishing_coeff: float = 0.15

    # Legacy cabin-altitude multiplier; excluded from current KSS.
    # Muhm et al. (2007), N Engl J Med 357:18-27, studied passenger discomfort.
    # It does not validate a 1-3% cognitive penalty. The old Nesthus citation
    # could not be established (see SCIENCE_SOURCE_AUDIT.md).
    hypoxia_coeff: float = 0.01
    default_cabin_altitude_ft: float = 7000.0

    # Legacy circadian-dampening heuristic, excluded from current KSS.
    # McCauley et al. (2009), J Theor Biol 256:227-239, describes a different
    # model. It does not validate the coefficients retained here.
    circadian_dampening_coeff: float = 0.25
    circadian_dampening_max_debt: float = 20.0

    # Legacy sleep-debt penalty, excluded from current KSS. Van Dongen
    # et al. (2003) distinguishes subjective adaptation from cumulative
    # performance decline; it does not justify this saturating penalty.
    sleep_debt_vulnerability_coeff: float = 0.08
    sleep_debt_vulnerability_floor: float = 0.85

    # Legacy individual-difference settings, not personal calibration.
    # Background: Roenneberg et al. (2007), Sleep Med Rev 11:429-438;
    # Van Dongen et al. (2004), Sleep 27:423-433. These do not validate
    # the fixed offsets or vulnerability multipliers below.
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

    Application assumptions, not measured efficiencies for the current pilot.
    Signal et al. (2013), Sleep 36:109-115, doi:10.5665/sleep.2312, studied
    in-flight rest; it does not establish the hotel values below. Environment,
    nap, split-sleep and timing coefficients require independent calibration.
    """

    # Environment quality factors (aligned with LOCATION_EFFICIENCY in
    # UnifiedSleepCalculator to avoid duplicate definitions)
    quality_home: float = 1.0
    quality_hotel_quiet: float = 0.88   # Application assumption
    quality_hotel_typical: float = 0.85
    quality_hotel_airport: float = 0.82
    quality_crew_rest_facility: float = 0.70  # Application assumption

    # Circadian timing penalties
    max_circadian_quality_penalty: float = 0.25
    early_wake_penalty_per_hour: float = 0.05
    late_sleep_start_penalty_per_hour: float = 0.03

    # Assumed sleep-onset latency function and bounds. Mechanistic context:
    # Lavie (1986), Electroencephalogr Clin Neurophysiol 63:414-425;
    # Dijk & Czeisler (1994), Neurosci Lett 166:63-68. The former
    # Akerstedt (2008) citation was unresolved; it does not validate this curve.
    sol_base_minutes: float = 15.0
    sol_wmz_amplitude: float = 0.8  # How much WMZ extends SOL (0-1 scale)

    # Duration-dependent nap factors are application choices. Brooks & Lack
    # (2006), Sleep 29:831-840, and Tietzel & Lack (2002), J Sleep Res
    # 11:213-218, provide experimental context, not these exact coefficients.
    nap_efficiency_under_10: float = 0.75
    nap_efficiency_10_20: float = 0.90
    nap_efficiency_20_30: float = 0.92
    nap_efficiency_30_60: float = 0.88
    nap_efficiency_over_60: float = 0.85

    # First-night effect
    # Agnew et al. (1966) Psychophysiology 2:263-266 — first night in a
    # novel environment shows increased SOL, reduced SWS%, and more WASO.
    # Tamaki et al. (2016) Curr Biol 26:1190-1194 — unihemispheric slow
    # wave activity on first night (brain remains vigilant in new space).
    # The extra minutes below are assumptions, not individual predictions.
    first_night_sol_extra_minutes: float = 12.0
    second_night_sol_extra_minutes: float = 5.0

    # Split-sleep quality factors are assumptions, not published percentages.
    # Jackson et al. (2014), Chronobiol Int 31:1218-1230, and
    # Kosmadopoulos et al. (2014), Chronobiol Int 31:1209-1217, examine
    # sleep/performance but do not validate this exact lookup table.
    split_efficiency_4h_plus: float = 0.92   # Each block ≥4h
    split_efficiency_3h_plus: float = 0.85   # Each block ≥3h, <4h
    split_efficiency_under_3h: float = 0.78  # Any block <3h

    # Anticipatory arousal: Kecklund & Akerstedt (2004), Biol Psychol
    # 66:169-176, relates next-day apprehension to slow-wave sleep.
    # The report-time cut-off and 0.97 multiplier are application assumptions.
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


# ---------------------------------------------------------------------------
# Headline duty risk window
# ---------------------------------------------------------------------------
# 'fdp'  — peak predicted KSS from report to the last operating on-blocks
#          (the flight duty period, ORO.FTL.105(17)). Owner decision
#          (September 2026): the post-flight period after on-blocks is inferred
#          by the parser (+30 min), so it should not set a duty's band.
# 'duty' — peak from report to release (the whole duty period).
# Both peaks are returned by the API (kss_peak_fdp and kss_peak_duty); this
# only chooses which one is the headline (max_kss / risk_level).
HEADLINE_RISK_WINDOWS = ('duty', 'fdp')
HEADLINE_RISK_WINDOW = 'fdp'

# Pre-duty nap habit (owner decision, September 2026: "I can't nap, others
# do — strike something sensible in between"). Selected per analysis.
NAP_HABITS = ('usually', 'sometimes', 'rarely')
DEFAULT_NAP_HABIT = 'sometimes'


@dataclass
class PreDutyNapAssumptions:
    """Modelling assumption for a nap before a late or night report.

    Evidence: about half of crews nap before an evening departure and half
    do not. Signal et al. (2014), Aviat Space Environ Med 85:1199-1208
    (52 pilots, westward ultra-long-range trip): 54 % napped before the
    outbound flight, without reducing their later in-flight sleep. Signal et
    al. (2024), Front Environ Health 2:1329203 (ultra-long-range): 50 %
    napped before outbound and 30 % before inbound flights, noting that
    evening departures make an afternoon nap easier (also Holmes et al.
    2012). These are group findings from long-haul crews; individuals differ
    (some pilots cannot nap at all), so the pilot can state their own habit.

    Default ('sometimes'): the population-average nap, i.e. the full nap
    weighted by the 54 % prevalence of Signal et al. (2014). The full-nap
    length (``max_nap_hours``) is a modelling choice, not a published value,
    and like the ramp it should be calibrated with pilot debrief data.

    Shape: the assumed nap length rises linearly with report time on the body
    clock, from 0 h at ``ramp_start_hour`` (14:00, the start of the late-report
    afternoon nap) to the full nap at ``ramp_full_hour`` (20:00, where the
    night-departure nap began) and stays full for reports up to 04:00. An
    afternoon or evening report therefore keeps a pre-duty nap, without a step
    change in risk for a small change in report time. The full nap is the existing
    night-departure nap: up to ``max_nap_hours``, limited by the window
    between the last wake-up (plus ``min_wake_before_nap_hours``) and the
    wake buffer before report.

    Habits: 'usually' = the ramp; 'sometimes' (default) = the ramp scaled by
    ``sometimes_fraction`` (about 1.3 h at most); 'rarely' = no nap.
    """

    ramp_start_hour: float = 14.0
    ramp_full_hour: float = 20.0
    ramp_end_hour: float = 4.0            # reports 04:00+ use the early-start rules
    max_nap_hours: float = 2.5            # one NREM–REM cycle plus margin
    min_wake_before_nap_hours: float = 6.0
    min_nap_hours: float = 1.0 / 3.0      # shorter naps are not modelled
    sometimes_fraction: float = 0.54      # nap prevalence, Signal et al. (2014)
    habit: str = DEFAULT_NAP_HABIT

    def ramp_fraction(self, report_body_hour: float) -> float:
        """0–1 share of the full nap for a report at this body-clock hour."""
        h = report_body_hour % 24
        if h < self.ramp_end_hour:
            return 1.0
        if h < self.ramp_start_hour:
            return 0.0
        return min(1.0, (h - self.ramp_start_hour) / (self.ramp_full_hour - self.ramp_start_hour))

    def full_nap_hours(self, available_hours: float) -> float:
        """Night-departure nap limited by the window since the last wake-up."""
        return max(0.0, min(self.max_nap_hours, available_hours - self.min_wake_before_nap_hours))

    def nap_hours(self, report_body_hour: float, available_hours: float, habit: str = None) -> float:
        """Assumed nap length (hours); 0 when no nap is modelled."""
        habit = habit or self.habit
        if habit == 'rarely':
            return 0.0
        full = self.full_nap_hours(available_hours)
        hours = full * self.ramp_fraction(report_body_hour)
        if habit == 'sometimes':
            # Population average: the nap weighted by how many crews take one.
            hours *= self.sometimes_fraction
        # Whole minutes, so nap times read cleanly (14:30, not 14:30:18).
        hours = round(hours * 60) / 60
        return hours if hours >= self.min_nap_hours else 0.0

    def describe(self, report_body_hour: float, available_hours: float, habit: str = None) -> str:
        """Plain-language basis for an assumed pre-duty nap (shown to the pilot)."""
        habit = habit or self.habit
        h = report_body_hour % 24
        clock = f"{int(h):02d}:{int(round((h % 1) * 60)) % 60:02d}"
        fraction = self.ramp_fraction(report_body_hour)
        full = self.full_nap_hours(available_hours)
        parts = [
            "About half of crews nap before an evening or night departure: 54 % of 52 long-haul "
            "pilots napped before the outbound flight (Signal et al. 2014); evening departures "
            "make an afternoon nap easier (Signal et al. 2024; Holmes et al. 2012).",
            f"The assumed nap grows from none for a {self.ramp_start_hour:02.0f}:00 report to the full "
            f"nap (up to {self.max_nap_hours:g} h) from {self.ramp_full_hour:02.0f}:00; a report at "
            f"{clock} body-clock time gives {fraction:.0%} of it.",
        ]
        if full < self.max_nap_hours:
            parts.append(f"It is limited to {full:.1f} h because the model places a nap only after "
                         f"{self.min_wake_before_nap_hours:g} h awake since the main sleep (a modelling choice).")
        if habit == 'sometimes':
            parts.append(f"Your nap setting is 'sometimes', so the length is the average across crews "
                         f"({self.sometimes_fraction:.0%} of that nap).")
        elif habit == 'usually':
            parts.append("Your nap setting is 'usually', so the full nap for this report time is assumed.")
        parts.append("Nap length and timing are modelling assumptions to be calibrated with pilot data; "
                     "remove or change the nap if it does not match what you do.")
        return ' '.join(parts)


def _clock_hours(value: str, name: str) -> float:
    """'HH:MM' (24-hour) → hours after midnight."""
    try:
        hh, mm = str(value).strip().split(':')
        h, m = int(hh), int(mm)
    except (ValueError, AttributeError):
        raise ValueError(f'{name} must be a 24-hour time like 23:00')
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError(f'{name} must be a 24-hour time like 23:00')
    return h + m / 60.0


def clock_label(hours: float) -> str:
    """Hours after midnight (may be ≥ 24) → 'HH:MM'."""
    minutes = int(round(hours * 60)) % (24 * 60)
    return f'{minutes // 60:02d}:{minutes % 60:02d}'


@dataclass
class SleepHabits:
    """The pilot's usual night at home, stated per analysis (a preference).

    Default 23:00–07:00 is an editable application assumption, not a measured
    population norm. Chronotypes differ widely
    (Roenneberg et al. 2007, Sleep Med Rev 11:429-438), so a pilot can state their
    own times. They set the habitual night (home, rest days, the night before a
    duty), the bedtime from which early-report advances are counted, the body-clock
    morning that ends an evening sleep, and the usual sleep length.

    ``bedtime_hour`` is hours after midnight of the evening before, so 00:30 is
    24.5. Accepted: bedtime 20:00–02:00, wake-up 04:00–11:00, 5–11 h apart.
    """
    bedtime_hour: float = 23.0
    wake_hour: float = 7.0

    def __post_init__(self):
        if not 20.0 <= self.bedtime_hour <= 26.0:
            raise ValueError('Usual bedtime must be between 20:00 and 02:00')
        if not 4.0 <= self.wake_hour <= 11.0:
            raise ValueError('Usual wake-up must be between 04:00 and 11:00')
        if not 5.0 <= self.duration_hours <= 11.0:
            raise ValueError('Usual night must last 5–11 hours')

    @property
    def duration_hours(self) -> float:
        return self.wake_hour + 24.0 - self.bedtime_hour

    @property
    def is_default(self) -> bool:
        return self.bedtime_hour == 23.0 and self.wake_hour == 7.0

    @classmethod
    def from_clock(cls, bedtime: Optional[str] = None, wake: Optional[str] = None) -> 'SleepHabits':
        bed = _clock_hours(bedtime, 'Usual bedtime') if bedtime else 23.0
        if bed < 12.0:
            bed += 24.0   # 00:30 is after midnight of the evening before
        return cls(bedtime_hour=bed, wake_hour=_clock_hours(wake, 'Usual wake-up') if wake else 7.0)

    @property
    def labels(self) -> Dict[str, str]:
        return {'usual_bedtime': clock_label(self.bedtime_hour), 'usual_wake_time': clock_label(self.wake_hour)}


@dataclass
class DaytimeSleepBounds:
    """Bounds for sleep after an afternoon release before a night report.

    Sleep that starts in the afternoon runs against the circadian wake
    signal and the evening wake maintenance zone (Lavie 1986, Electroenceph
    Clin Neurophysiol 63:414-425; Dijk & Czeisler 1994, Neurosci Lett
    166:63-68), so a long afternoon sleep is not plausible. Daytime naps
    after deprivation are typically truncated to a few hours (National
    Academies 2011 review). The values are modelling assumptions:

    - an afternoon recovery nap of at most ``nap_max_hours`` that ends by
      ``nap_latest_end_bio_hour`` on the body clock and at least
      ``gap_before_evening_hours`` before evening sleep;
    - evening sleep no earlier than ``evening_earliest_bio_hour``;
    - the nap only tops total sleep up to ``target_total_hours``, so it is
      assumed only when the evening sleep before a night report is short,
      and it shrinks smoothly as that evening sleep gets longer.
    """

    nap_onset_delay_hours: float = 0.5
    nap_max_hours: float = 2.5
    nap_latest_end_bio_hour: float = 18.0
    gap_before_evening_hours: float = 3.0
    evening_earliest_bio_hour: float = 21.0
    target_total_hours: float = 4.5
    min_block_hours: float = 1.0 / 3.0


# KSS-anchored bands on the 20–100 index (index = 110 − 10·KSS; see
# core/alertness.py). Band edges are the midpoints between KSS verbal
# anchors: 5.5 / 6.5 / 7.5 / 8.5 → index 55 / 45 / 35 / 25.
KSS_INDEX_THRESHOLDS = {
    'low': (55, 100),       # KSS < 5.5  alert … neither alert nor sleepy
    'moderate': (45, 55),   # KSS 5.5–6.5 some signs of sleepiness
    'high': (35, 45),       # KSS 6.5–7.5 sleepy, no effort to stay awake
    'critical': (25, 35),   # KSS 7.5–8.5 sleepy, some effort to stay awake
    'extreme': (0, 25),     # KSS ≥ 8.5  fighting sleep
}

KSS_RISK_ACTIONS = {
    'low': {'action': 'None required',
            'description': 'Predicted KSS below 5.5: alert to neither alert nor sleepy'},
    'moderate': {'action': 'Self-monitor',
                 'description': 'Predicted KSS ≈ 6: some signs of sleepiness'},
    'high': {'action': 'Active countermeasures',
             'description': 'Predicted KSS ≈ 7: sleepy — consider controlled rest, caffeine timing, crew cross-check'},
    'critical': {'action': 'Fatigue report recommended',
                 'description': 'Predicted KSS ≈ 8: sleepy with effort to stay awake — lapses become likely'},
    'extreme': {'action': 'Fatigue report recommended',
                'description': 'Predicted KSS ≥ 8.5: fighting sleep — serious safety concern'},
}


@dataclass
class RiskThresholds:
    """Risk bands on the KSS-anchored 20–100 alertness index.

    References: Åkerstedt & Gillberg (1990) KSS; Åkerstedt et al. (2014)
    J Sleep Res 23:240-252 (KSS ≥ 7 and impaired waking function);
    Ingre et al. (2014) PLoS ONE e108679 (model 5c transfer function).
    """

    thresholds: Dict[str, Tuple[float, float]] = field(
        default_factory=lambda: dict(KSS_INDEX_THRESHOLDS))

    actions: Dict[str, Dict[str, str]] = field(
        default_factory=lambda: {k: dict(v) for k, v in KSS_RISK_ACTIONS.items()})

    def classify(self, performance: float) -> str:
        if performance is None or not 0 <= performance <= 100:
            return 'unknown'
        if self.thresholds == KSS_INDEX_THRESHOLDS:
            # One convention everywhere: band on KSS rounded to one decimal.
            from core.alertness import classify_kss, index_to_kss
            return classify_kss(index_to_kss(performance))
        for level, (low, high) in self.thresholds.items():
            if low < performance <= high or (performance == 0 and low == 0):
                return level
        return 'extreme'

    def get_action(self, risk_level: str) -> Dict[str, str]:
        return self.actions.get(risk_level, self.actions['extreme'])

    @staticmethod
    def risk_advisory(risk_level: str) -> str:
        """
        Graduated advisory tier based on risk level.

        Returns one of:
          'routine'            — LOW: no action needed
          'monitor'            — MODERATE: pilot self-awareness
          'consider_reporting' — HIGH: suggest FRMS report
          'report_recommended' — CRITICAL/EXTREME: strongly recommend reporting
        """
        mapping = {
            'low': 'routine',
            'moderate': 'monitor',
            'high': 'consider_reporting',
            'critical': 'report_recommended',
            'extreme': 'report_recommended',
        }
        return mapping.get(risk_level, 'monitor')


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
    nap_assumptions: PreDutyNapAssumptions = field(default_factory=PreDutyNapAssumptions)
    daytime_sleep_bounds: DaytimeSleepBounds = field(default_factory=DaytimeSleepBounds)
    headline_risk_window: str = HEADLINE_RISK_WINDOW
    sleep_habits: SleepHabits = field(default_factory=SleepHabits)

    @property
    def assumptions(self) -> Dict[str, str]:
        """Analysis-level assumptions echoed in API responses."""
        return {'nap_habit': self.nap_assumptions.habit,
                'headline_risk_window': self.headline_risk_window,
                **self.sleep_habits.labels}

    def __post_init__(self):
        if self.nap_assumptions.habit not in NAP_HABITS:
            raise ValueError(f'nap_habit must be one of {NAP_HABITS}')
        if self.headline_risk_window not in HEADLINE_RISK_WINDOWS:
            raise ValueError(f'headline_risk_window must be one of {HEADLINE_RISK_WINDOWS}')
        # Lazy import to avoid circular dependency
        if self.augmented_fdp_params is None:
            from core.extended_operations import AugmentedFDPParameters
            self.augmented_fdp_params = AugmentedFDPParameters()
        if self.ulr_params is None:
            from core.extended_operations import ULRParameters
            self.ulr_params = ULRParameters()

    @classmethod
    def aerowake(cls, nap_habit: str = None, headline_risk_window: str = None,
                 usual_bedtime: str = None, usual_wake_time: str = None):
        """
        The single AeroWake model configuration (engine aerowake-4.2-kss).

        ``nap_habit`` ('usually' | 'sometimes' | 'rarely') and
        ``headline_risk_window`` ('fdp' | 'duty') are stated assumptions, not
        separate models; both are echoed with every analysis.

        There is deliberately one model: the KSS core (core/alertness.py) is
        fixed to published parameters, and one set of sleep-estimation
        assumptions and risk bands is used for every analysis so results are
        comparable across pilots, months and research. The legacy notes below
        describe BorbelyParameters that now only affect sleep estimation.

        The values below preserve the legacy preset for reproducibility and
        sleep estimation. They are application assumptions; claims of a fixed
        trained-pilot resilience advantage, EASA-mandated scientific parameters,
        or universal hotel quality are unsupported. Current KSS scoring uses
        the published model-5c parameter set instead.
        """
        return cls(
            easa_framework=EASAFatigueFramework(),
            borbely_params=BorbelyParameters(
                tau_i=21.0,   # Legacy application assumption
                tau_d=3.8,    # Faster recovery during consolidated sleep
                baseline_sleep_need_hours=7.5,
                sleep_debt_vulnerability_coeff=0.018,
                inertia_duration_minutes=22.0,
                inertia_max_magnitude=0.25,
                # Legacy application assumption; not a current KSS coefficient.
                weight_homeostatic=0.60,
                weight_circadian=0.40,
                # Legacy application assumption; not a current KSS coefficient.
                circadian_amplitude=0.22,
                # Legacy application assumption; not a current KSS coefficient.
                circadian_second_harmonic_amplitude=0.06,
                # Legacy application assumption; not a current KSS coefficient.
                resilience_boost_magnitude=0.12,
                resilience_boost_sigma=0.25,
                # ULR buffer: shift fatigue cliff past mid-point of 14h FDP
                tot_inflection_hours=10.5,
                # Halved non-linear degradation (was 0.0005)
                tot_quadratic_coeff=0.00025,
                # Pinch events only at genuine impairment (>17h awake)
                pinch_sleep_pressure_threshold=0.78,
                # Legacy application assumption; not a current KSS coefficient.
                pvt_baseline_lapses=1.0,       # Was 1.5 (trained crew, less variability)
                pvt_debt_coefficient=0.25,     # Was 0.4 (manage moderate debt better)
                pvt_wake_coefficient=0.8,      # Was 1.2 (less wakefulness sensitivity)
                pvt_wake_threshold_hours=17.0, # Was 16h (vigilance maintained ~1h longer)
            ),
            risk_thresholds=RiskThresholds(),
            adaptation_rates=AdaptationRates(),
            sleep_quality_params=SleepQualityParameters(
                quality_hotel_typical=0.87,
            ),
            nap_assumptions=PreDutyNapAssumptions(habit=nap_habit or DEFAULT_NAP_HABIT),
            headline_risk_window=headline_risk_window or HEADLINE_RISK_WINDOW,
            sleep_habits=SleepHabits.from_clock(usual_bedtime, usual_wake_time),
        )

    # Legacy preset names resolve to the single model so stored analyses
    # and older clients keep working. Do not add new presets.
    @classmethod
    def operational_config(cls):
        return cls.aerowake()

    @classmethod
    def default_easa_config(cls):
        return cls.aerowake()

    @classmethod
    def from_preset(cls, _preset: str = None):
        """Accepts any legacy preset name; always returns the single model."""
        return cls.aerowake()
