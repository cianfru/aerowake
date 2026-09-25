"""
AeroWake alertness core (engine ``aerowake-4.0-kss``)
=====================================================

Replaces the legacy weighted S/C "performance" index, whose output range was
compressed into 50–75 for ordinary duties (a rested 09:00 duty scored
"moderate") while being almost insensitive to repeated short sleep.

Scientific basis — open, peer-reviewed, fitted on airline crew:
    Ingre M, Van Leeuwen W, Klemets T, et al. (2014) Validating and extending
    the Three Process Model of alertness in airline operations. PLoS ONE
    9(10): e108679. https://doi.org/10.1371/journal.pone.0108679

    * Homeostatic process with the "brake" (S_B, eq. 1.1, 1.3–1.5) and
      circadian C + ultradian U (eq. 1.7–1.8) — model 5c, the best validated
      model with the default phase (residual SD 1.42 KSS units).
    * Transfer to the Karolinska Sleepiness Scale: KSS = 9.68 − 0.46·X
      where X = S + C + U (eq. 1.9 with model-5c coefficients).
    * Probability of any KSS level via the published ordinal-logistic model
      (eq. 1.17): P(KSS > k) = logistic(−0.599·X − K_k + offset).
    * Individual-difference reference limits (eq. 1.16/1.17): offsets for
      the 75th and 90th percentile pilot.
    * Acclimatization process A (eq. 1.10) with the empirically optimal
      daily rate of ~30 % of the remaining difference.

What is deliberately NOT in the score (not validated in this model family):
workload acceleration of sleep pressure, "pilot resilience" boosts, cabin
hypoxia, time-on-task, and sleep inertia (the paper found the default
inertia function made fit worse). Duty length, sectors and early/late/night
timing are reported as separate, transparent contributing factors instead.

Output scale. The 20–100 "performance" field kept for API compatibility is
a direct linear re-expression of predicted KSS:

    index = 110 − 10 · KSS      (KSS 1 → 100, KSS 5 → 60, KSS 9 → 20)

Risk bands follow the KSS verbal anchors (rounded predicted KSS):
    low       KSS < 5.5   "alert" … "neither alert nor sleepy"
    moderate  5.5 – 6.5   "some signs of sleepiness"
    high      6.5 – 7.5   "sleepy, no effort to stay awake"
    critical  7.5 – 8.5   "sleepy, some effort to stay awake"
    extreme   ≥ 8.5       "very sleepy, fighting sleep"
KSS ≥ 7 is associated with physiological signs of sleepiness and impaired
waking function (Åkerstedt, Anund, Axelsson & Kecklund 2014, J Sleep Res
23:240-252); KSS 8–9 with sharply increased lapses and lane departures in
driving studies (Ingre et al. 2006, J Sleep Res 15:47-53).

The predictions describe a group-average pilot. They are not a fitness-to-fly
determination: a pilot's own assessment always takes precedence.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import pytz

from core import published_tpm as tpm

ENGINE_VERSION = "aerowake-4.0-kss"

P = tpm.PARAMETERS
HA, LA = P['ha'], P['la']

# Ordinal-logistic cut points for P(KSS > k), k = 1..8 — Ingre et al. (2014),
# model 5c, text preceding eq. 1.17.
KSS_CUT_POINTS = (-10.99, -8.95, -7.67, -6.66, -5.64, -4.30, -3.05, -0.58)
KSS_LOGIT_SLOPE = -0.599

# Reference-limit offsets (eq. 1.16 linear KSS; eq. 1.17 logit scale).
KSS_OFFSET = {50: 0.0, 75: 0.57, 90: 1.07}
LOGIT_OFFSET = {50: 0.0, 75: 0.74, 90: 1.41}

# Acclimatization, eq. 1.10 — optimal daily rate ≈ 30 % (Ingre et al. 2014).
ACCLIMATIZATION_DAILY_RATE = 0.30

# Residual error of predicted vs rated KSS (model 5c).
KSS_RESIDUAL_SD = 1.42

KSS_LABELS = {
    1: "Extremely alert", 2: "Very alert", 3: "Alert", 4: "Rather alert",
    5: "Neither alert nor sleepy", 6: "Some signs of sleepiness",
    7: "Sleepy, but no effort to keep awake",
    8: "Sleepy, some effort to keep awake",
    9: "Very sleepy, great effort to keep awake, fighting sleep",
}

# Bands on predicted KSS (upper bound exclusive).
KSS_BANDS: Tuple[Tuple[str, float], ...] = (
    ('low', 5.5), ('moderate', 6.5), ('high', 7.5), ('critical', 8.5), ('extreme', 99.0),
)


def kss_to_index(kss: float) -> float:
    """Linear re-expression of KSS on the legacy 20–100 scale."""
    return max(20.0, min(100.0, 110.0 - 10.0 * kss))


def index_to_kss(index: float) -> float:
    return (110.0 - index) / 10.0


def index_thresholds() -> Dict[str, Tuple[float, float]]:
    """Risk thresholds expressed on the 20–100 index (lower bound inclusive)."""
    return {
        'low': (kss_to_index(5.5), 100.0),       # 55–100
        'moderate': (kss_to_index(6.5), kss_to_index(5.5)),  # 45–55
        'high': (kss_to_index(7.5), kss_to_index(6.5)),      # 35–45
        'critical': (kss_to_index(8.5), kss_to_index(7.5)),  # 25–35
        'extreme': (0.0, kss_to_index(8.5)),                 # 0–25
    }


def classify_kss(kss: float) -> str:
    if kss is None or not math.isfinite(kss):
        return 'unknown'
    for name, upper in KSS_BANDS:
        if kss < upper:
            return name
    return 'extreme'


def alertness_to_kss(x: float, percentile: int = 50) -> float:
    """Model-5c transfer function (eq. 1.9/1.16), unbounded."""
    return P['kss_intercept'] + P['kss_slope'] * x + KSS_OFFSET[percentile]


def prob_kss_above(x: float, k: int, percentile: int = 50) -> float:
    """P(KSS > k) from the ordinal-logistic model (eq. 1.17)."""
    z = KSS_LOGIT_SLOPE * x - KSS_CUT_POINTS[k - 1] + LOGIT_OFFSET[percentile]
    return 1.0 / (1.0 + math.exp(-z))


def prob_severe(x: float, percentile: int = 50) -> float:
    """P(KSS ≥ 7): probability of rating oneself sleepy or worse."""
    return prob_kss_above(x, 6, percentile)


# ---------------------------------------------------------------------------
# Homeostatic process (native TPM units: 2.4 = depleted, 14.3 = fully rested)
# ---------------------------------------------------------------------------

def wake(s: float, hours: float) -> float:
    return tpm.wake(s, max(0.0, hours))


def sleep(s: float, hours: float) -> float:
    return tpm.sleep(s, max(0.0, hours))


def pressure_from_s(s: float) -> float:
    """Normalise S to 0–1 sleep pressure (0 = fully rested, 1 = depleted)."""
    return max(0.0, min(1.0, (HA - s) / (HA - LA)))


def s_from_pressure(pressure: float) -> float:
    return HA - max(0.0, min(1.0, pressure)) * (HA - LA)


# ---------------------------------------------------------------------------
# Circadian process with acclimatization
# ---------------------------------------------------------------------------

def body_clock_hour(at_utc: datetime, home_tz: str, phase_shift_hours: float = 0.0) -> float:
    """Internal (body-clock) time of day in hours.

    ``phase_shift_hours`` is the acclimatized offset from home base time,
    positive when the body clock has moved east (e.g. +3 when fully adapted
    to a destination three hours ahead of home). The body clock therefore
    reads home time *plus* the shift.
    """
    local = at_utc.astimezone(pytz.timezone(home_tz))
    tod = local.hour + local.minute / 60.0 + local.second / 3600.0
    return (tod + phase_shift_hours) % 24.0


def circadian_terms(at_utc: datetime, home_tz: str, phase_shift_hours: float = 0.0) -> Tuple[float, float]:
    """Return (C, U) in TPM alertness units (eq. 1.7, 1.8)."""
    tod = body_clock_hour(at_utc, home_tz, phase_shift_hours)
    c = P['ca'] * math.cos(2 * math.pi / 24 * (tod - P['phase']))
    u = P['um'] + P['ua'] * math.cos(2 * math.pi / 12 * (tod - P['phase'] - 3))
    return c, u


def circadian_normalised(c: float) -> float:
    """C mapped to 0–1 (1 = circadian peak alertness) for display."""
    return max(0.0, min(1.0, (c + P['ca']) / (2 * P['ca'])))


def utc_offset_hours(tz: str, at_utc: datetime) -> float:
    return at_utc.astimezone(pytz.timezone(tz)).utcoffset().total_seconds() / 3600.0


def wrap_offset(hours: float) -> float:
    """Shortest signed difference in hours, in (−12, 12]."""
    h = (hours + 12.0) % 24.0 - 12.0
    return 12.0 if h == -12.0 else h


def acclimatize(previous_shift: float, target_shift: float, elapsed_days: float,
                daily_rate: float = ACCLIMATIZATION_DAILY_RATE) -> float:
    """Process A (eq. 1.10): move a fraction of the remaining difference."""
    if elapsed_days <= 0:
        return previous_shift
    diff = wrap_offset(target_shift - previous_shift)
    fraction = 1.0 - (1.0 - daily_rate) ** elapsed_days
    return max(-12.0, min(12.0, previous_shift + fraction * diff))


# ---------------------------------------------------------------------------
# Point prediction
# ---------------------------------------------------------------------------

@dataclass
class AlertnessPoint:
    time_utc: datetime
    s: float
    c: float
    u: float
    kss: float
    kss_90: float
    p_severe: float
    p_severe_90: float
    hours_awake: float

    @property
    def alertness_score(self) -> float:
        return self.s + self.c + self.u

    @property
    def index(self) -> float:
        return kss_to_index(self.kss)

    @property
    def risk_level(self) -> str:
        return classify_kss(self.kss)


def predict_point(at_utc: datetime, s: float, home_tz: str, phase_shift: float = 0.0,
                  hours_awake: float = 0.0) -> AlertnessPoint:
    c, u = circadian_terms(at_utc, home_tz, phase_shift)
    x = s + c + u
    raw = alertness_to_kss(x)
    return AlertnessPoint(
        time_utc=at_utc, s=s, c=c, u=u,
        kss=max(1.0, min(9.0, raw)),
        kss_90=max(1.0, min(9.0, alertness_to_kss(x, 90))),
        p_severe=prob_severe(x), p_severe_90=prob_severe(x, 90),
        hours_awake=hours_awake,
    )


def initial_s_at_sleep_onset(at_utc: datetime, home_tz: str, phase_shift: float = 0.0) -> float:
    """Initial condition used by Ingre et al.: S + C + U = 8.38 at first sleep onset."""
    c, u = circadian_terms(at_utc, home_tz, phase_shift)
    return max(LA, min(HA, P['initial_alertness'] - c - u))


# ---------------------------------------------------------------------------
# Sleep history integration
# ---------------------------------------------------------------------------

@dataclass
class SleepInterval:
    start_utc: datetime
    end_utc: datetime
    efficiency: float = 1.0   # fraction of the interval actually asleep

    @property
    def hours(self) -> float:
        return max(0.0, (self.end_utc - self.start_utc).total_seconds() / 3600.0)


def merge_intervals(intervals: Iterable[SleepInterval]) -> List[SleepInterval]:
    """Sort and clip overlaps so no sleep is credited twice."""
    out: List[SleepInterval] = []
    for iv in sorted(intervals, key=lambda i: i.start_utc):
        if iv.end_utc <= iv.start_utc:
            continue
        if out and iv.start_utc < out[-1].end_utc:
            if iv.end_utc <= out[-1].end_utc:
                continue
            iv = SleepInterval(out[-1].end_utc, iv.end_utc, iv.efficiency)
        out.append(iv)
    return out


class AlertnessState:
    """Carries S through time given a sleep history.

    Sleep efficiency (<1) is applied as time actually asleep: a 7 h hotel
    sleep at 0.88 efficiency recovers like 6.2 h of sleep.
    """

    def __init__(self, s: float, time_utc: datetime, last_wake_utc: Optional[datetime] = None):
        self.s = max(LA, min(HA, s))
        self.time_utc = time_utc
        self.last_wake_utc = last_wake_utc or time_utc

    @classmethod
    def from_history(cls, sleeps: Sequence[SleepInterval], home_tz: str,
                     phase_shift_at=lambda t: 0.0) -> Optional['AlertnessState']:
        merged = merge_intervals(sleeps)
        if not merged:
            return None
        first = merged[0]
        state = cls(initial_s_at_sleep_onset(first.start_utc, home_tz, phase_shift_at(first.start_utc)),
                    first.start_utc)
        state.apply_sleeps(merged)
        return state

    def advance_awake(self, until_utc: datetime) -> None:
        if until_utc <= self.time_utc:
            return
        self.s = wake(self.s, (until_utc - self.time_utc).total_seconds() / 3600.0)
        self.time_utc = until_utc

    def apply_sleep(self, iv: SleepInterval) -> None:
        start = max(iv.start_utc, self.time_utc)
        if iv.end_utc <= start:
            return
        self.advance_awake(start)
        hours = (iv.end_utc - start).total_seconds() / 3600.0
        self.s = sleep(self.s, hours * max(0.0, min(1.0, iv.efficiency)))
        self.time_utc = iv.end_utc
        self.last_wake_utc = iv.end_utc

    def apply_sleeps(self, sleeps: Iterable[SleepInterval]) -> None:
        for iv in merge_intervals(sleeps):
            self.apply_sleep(iv)

    def hours_awake(self, at_utc: datetime) -> float:
        return max(0.0, (at_utc - self.last_wake_utc).total_seconds() / 3600.0)


def sleep_in_window(sleeps: Sequence[SleepInterval], start: datetime, end: datetime) -> float:
    """Hours of sleep (interval time, no efficiency) inside [start, end)."""
    total = 0.0
    for iv in merge_intervals(sleeps):
        a, b = max(iv.start_utc, start), min(iv.end_utc, end)
        if b > a:
            total += (b - a).total_seconds() / 3600.0
    return total


def prior_sleep_wake_check(sleeps: Sequence[SleepInterval], at_utc: datetime,
                           end_utc: Optional[datetime] = None) -> Dict:
    """Prior sleep/wake model — Dawson & McCulloch (2005) Sleep Med Rev 9:365-380.

    Rules: sleep in prior 24 h ≥ 5 h (X), sleep in prior 48 h ≥ 12 h (Y), and
    hours awake at the end of the duty ≤ sleep in the prior 48 h (Z ≤ Y).
    The ICAO FRMS Implementation Guide cites this as an example of a simple,
    evidence-based fatigue-likelihood check.
    """
    end_utc = end_utc or at_utc
    past = [iv for iv in merge_intervals(sleeps) if iv.start_utc < at_utc]
    s24 = sleep_in_window(past, at_utc - timedelta(hours=24), at_utc)
    s48 = sleep_in_window(past, at_utc - timedelta(hours=48), at_utc)
    last_wake = max((min(iv.end_utc, at_utc) for iv in past), default=None)
    awake_start = (at_utc - last_wake).total_seconds() / 3600 if last_wake else None
    awake_end = (end_utc - last_wake).total_seconds() / 3600 if last_wake else None
    checks = [
        dict(rule='sleep_24h', label='Sleep in prior 24 h ≥ 5 h', value=round(s24, 2),
             limit=5.0, passed=s24 >= 5.0),
        dict(rule='sleep_48h', label='Sleep in prior 48 h ≥ 12 h', value=round(s48, 2),
             limit=12.0, passed=s48 >= 12.0),
    ]
    if awake_end is not None:
        checks.append(dict(rule='wake_vs_sleep', label='Hours awake at end of duty ≤ sleep in prior 48 h',
                           value=round(awake_end, 2), limit=round(s48, 2), passed=awake_end <= s48))
    return dict(sleep_24h=round(s24, 2), sleep_48h=round(s48, 2),
                hours_awake_at_start=None if awake_start is None else round(awake_start, 2),
                hours_awake_at_end=None if awake_end is None else round(awake_end, 2),
                checks=checks, passed=all(c['passed'] for c in checks),
                source='Dawson & McCulloch (2005) Sleep Med Rev 9:365-380')


def cumulative_deficit(sleeps: Sequence[SleepInterval], at_utc: datetime, days: int = 7,
                       need_hours: float = 8.0) -> Dict:
    """Rolling sleep deficit against an 8 h/day need over the last ``days``.

    Subjective sleepiness (and therefore KSS) plateaus under chronic
    restriction while objective performance keeps worsening (Van Dongen et
    al. 2003 Sleep 26:117-126; Belenky et al. 2003 J Sleep Res 12:1-12).
    This ledger is reported separately so the KSS score is not silently
    inflated by an unvalidated interaction term.

    Bands (≈ nightly shortfall sustained over a week):
        none < 5 h · mild 5–10 h (~1 h/night, cf. Belenky 7 h TIB)
        moderate 10–15 h (~1.5–2 h/night, cf. Van Dongen 6 h TIB)
        severe ≥ 15 h (≥ 2 h/night, cf. Belenky 5 h TIB)
    """
    window_start = at_utc - timedelta(days=days)
    earliest = min((iv.start_utc for iv in sleeps), default=at_utc)
    covered_days = max(0.0, min(days, (at_utc - max(window_start, earliest)).total_seconds() / 86400))
    slept = sleep_in_window(sleeps, window_start, at_utc)
    deficit = max(0.0, need_hours * covered_days - slept)
    band = 'none' if deficit < 5 else 'mild' if deficit < 10 else 'moderate' if deficit < 15 else 'severe'
    return dict(days=round(covered_days, 2), sleep_hours=round(slept, 2), need_hours=need_hours,
                deficit_hours=round(deficit, 2), band=band)
