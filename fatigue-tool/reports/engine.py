"""
Automatic fatigue report generation
===================================

Builds a structured fatigue report from what the pilot actually provides:
duties in a selected period (from an uploaded roster or entered manually),
actual sleep episodes, the duty they were due to operate, and their own
sleepiness rating. The report identifies where the problems are and states
only what the supplied information supports.

Principles
----------
* Reported sleep is used as-is. Estimated sleep (pre-filled from roster
  analysis and not confirmed) is labelled as such and lowers confidence.
* Nothing is silently invented: missing data is listed, and when fewer than
  two sleep episodes exist no model prediction is made.
* The pilot's own assessment always stands. Model output can support a
  fatigue declaration; it is never used to contradict one.

Evidence used (see core/alertness.py for the model itself):
    Ingre et al. (2014) PLoS ONE e108679 — predicted KSS / P(KSS ≥ 7)
    Dawson & McCulloch (2005) Sleep Med Rev 9:365-380 — prior sleep/wake check
    Van Dongen et al. (2003) Sleep 26:117-126; Belenky et al. (2003)
        J Sleep Res 12:1-12 — cumulative restriction
    Powell et al. (2007) Aviat Space Environ Med 78:698-701 — sectors,
        duty length and time of day in short-haul fatigue
    Regulation (EU) 965/2012 ORO.FTL.105(8) disruptive schedules,
        ORO.FTL.235 rest periods
    Samn & Perelli (1982) USAF SAM-TR-82-21 — Samn-Perelli fatigue scale
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import pytz

from core import alertness as aw

REPORT_VERSION = 'aerowake-fatigue-report-1.0'

SEVERITY_ORDER = {'info': 0, 'caution': 1, 'warning': 2, 'critical': 3}

SAMN_PERELLI_LABELS = {
    1: 'Fully alert, wide awake', 2: 'Very lively, responsive, but not at peak',
    3: 'Okay, somewhat fresh', 4: 'A little tired, less than fresh',
    5: 'Moderately tired, let down', 6: 'Extremely tired, very difficult to concentrate',
    7: 'Completely exhausted, unable to function effectively',
}

FACTOR_LABELS = {
    'roster_pattern': 'Roster pattern / scheduling',
    'short_rest': 'Short rest period',
    'early_start': 'Early report',
    'late_finish': 'Late finish',
    'night_duty': 'Night duty / WOCL',
    'time_zones': 'Time-zone changes',
    'long_duty': 'Long duty day',
    'multiple_sectors': 'Multiple sectors',
    'delays': 'Delays / disruption',
    'commute': 'Commute or positioning',
    'hotel_disturbance': 'Hotel / accommodation disturbance',
    'home_disturbance': 'Disturbance at home (e.g. noise, family)',
    'unable_to_sleep': 'Unable to sleep despite opportunity',
    'illness': 'Illness or medication',
    'personal': 'Personal / domestic reasons',
    'workload': 'High workload (weather, technical, ATC)',
    'other': 'Other',
}


# ---------------------------------------------------------------------------
# Normalised inputs
# ---------------------------------------------------------------------------

@dataclass
class Sector:
    flight_number: str
    departure: str
    arrival: str
    departure_utc: datetime
    arrival_utc: datetime
    departure_tz: str
    arrival_tz: str
    is_deadhead: bool = False


@dataclass
class DutyIn:
    id: str
    report_utc: datetime
    release_utc: datetime
    sectors: List[Sector]
    status: str = 'operated'
    duty_type: str = 'flight'
    description: str = ''
    source: str = 'manual'

    @property
    def hours(self) -> float:
        return (self.release_utc - self.report_utc).total_seconds() / 3600


@dataclass
class SleepIn:
    start_utc: datetime
    end_utc: datetime
    kind: str = 'main'
    location: str = 'home'
    quality: Optional[int] = None
    source: str = 'reported'

    @property
    def hours(self) -> float:
        return (self.end_utc - self.start_utc).total_seconds() / 3600


@dataclass
class ReportInput:
    home_timezone: str
    home_base: Optional[str]
    event_type: str
    event_time_utc: datetime
    period_start_utc: datetime
    period_end_utc: datetime
    duties: List[DutyIn]
    sleeps: List[SleepIn]
    affected_duty_id: Optional[str] = None
    self_kss: Optional[int] = None
    self_samn_perelli: Optional[int] = None
    self_rated_at: Optional[datetime] = None
    factors: List[str] = field(default_factory=list)
    narrative: str = ''
    pilot: Dict[str, str] = field(default_factory=dict)
    unknown_airports: List[str] = field(default_factory=list)


# Sleep efficiency by location (Signal et al. 2013 PSG: hotel ≈ 0.88,
# bunk ≈ 0.70). Self-rated poor quality lowers it modestly.
LOCATION_EFFICIENCY = {'home': 1.0, 'hotel': 0.88, 'crew_rest': 0.70, 'other': 0.85}
QUALITY_ADJUST = {1: 0.85, 2: 0.92, 3: 1.0, 4: 1.0, 5: 1.0}


def _efficiency(s: SleepIn) -> float:
    base = LOCATION_EFFICIENCY.get(s.location, 0.85)
    return max(0.6, base * QUALITY_ADJUST.get(s.quality or 3, 1.0))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt(dt: Optional[datetime], tz: str) -> Optional[str]:
    if dt is None:
        return None
    return dt.astimezone(pytz.timezone(tz)).strftime('%a %d %b %H:%M')


def _fmt_z(dt: Optional[datetime]) -> Optional[str]:
    return None if dt is None else dt.astimezone(timezone.utc).strftime('%d %b %H:%MZ')


def _local_hour(dt: datetime, tz: str) -> float:
    loc = dt.astimezone(pytz.timezone(tz))
    return loc.hour + loc.minute / 60


def _hours(h: Optional[float]) -> str:
    if h is None:
        return 'not available'
    whole = int(h)
    minutes = int(round((h - whole) * 60))
    if minutes == 60:
        whole, minutes = whole + 1, 0
    return f'{whole}h{minutes:02d}'


def _overlaps_window(start: datetime, end: datetime, tz: str, h0: float, h1: float) -> bool:
    """True if [start, end) touches local clock window [h0, h1) on any day."""
    t = start
    step = timedelta(minutes=5)
    while t < end:
        h = _local_hour(t, tz)
        if h0 <= h < h1:
            return True
        t += step
    return False


class LocationTrack:
    """Where the pilot is (IANA tz) over time, derived from sectors flown."""

    def __init__(self, home_tz: str, duties: List[DutyIn]):
        self.home_tz = home_tz
        self.events: List[Tuple[datetime, str]] = []
        for d in duties:
            if d.status in ('cancelled_fatigue', 'not_operated', 'planned'):
                continue
            for s in d.sectors:
                self.events.append((s.arrival_utc, s.arrival_tz))
        self.events.sort()

    def tz_at(self, t: datetime) -> str:
        tz = self.home_tz
        for when, where in self.events:
            if when <= t:
                tz = where
            else:
                break
        return tz


def _phase_shift_series(inp: ReportInput, start: datetime, end: datetime, track: LocationTrack):
    """Acclimatization (process A) sampled hourly; returns a lookup function."""
    samples: List[Tuple[datetime, float]] = []
    shift = 0.0
    t = start
    while t <= end + timedelta(hours=1):
        local_tz = track.tz_at(t)
        target = aw.utc_offset_hours(local_tz, t) - aw.utc_offset_hours(inp.home_timezone, t)
        samples.append((t, shift))
        shift = aw.acclimatize(shift, target, 1 / 24)
        t += timedelta(hours=1)

    def at(when: datetime) -> float:
        if not samples or when <= samples[0][0]:
            return 0.0
        idx = min(len(samples) - 1, int((when - samples[0][0]).total_seconds() // 3600))
        return samples[idx][1]
    return at


# ---------------------------------------------------------------------------
# Simulation over reported sleep
# ---------------------------------------------------------------------------

def _simulate(inp: ReportInput, sleeps: List[SleepIn], start: datetime, end: datetime,
              shift_at, step_minutes: int = 15) -> List[Dict]:
    """Predicted KSS from ``start`` to ``end`` using the supplied sleep only."""
    intervals = [aw.SleepInterval(s.start_utc, s.end_utc, _efficiency(s)) for s in sleeps]
    merged = aw.merge_intervals(intervals)
    if len(merged) < 2:
        return []
    state = aw.AlertnessState(aw.initial_s_at_sleep_onset(merged[0].start_utc, inp.home_timezone,
                                                          shift_at(merged[0].start_utc)),
                              merged[0].start_utc)
    out = []
    t = start
    idx = 0
    step = timedelta(minutes=step_minutes)
    while t <= end:
        while idx < len(merged) and merged[idx].start_utc < t:
            iv = merged[idx]
            if iv.end_utc <= t:
                state.apply_sleep(iv)
                idx += 1
            else:
                state.apply_sleep(aw.SleepInterval(iv.start_utc, t, iv.efficiency))
                break
        asleep = any(iv.start_utc <= t < iv.end_utc for iv in merged)
        if t >= merged[0].end_utc and not asleep:
            state.advance_awake(t)
            p = aw.predict_point(t, state.s, inp.home_timezone, shift_at(t), state.hours_awake(t))
            out.append(dict(time_utc=t, kss=round(p.kss, 2), kss_90=round(p.kss_90, 2),
                            p_severe=round(p.p_severe, 3), hours_awake=round(p.hours_awake, 2),
                            asleep=False))
        elif asleep:
            out.append(dict(time_utc=t, kss=None, kss_90=None, p_severe=None, hours_awake=0.0, asleep=True))
        t += step
    return out


# ---------------------------------------------------------------------------
# Findings
# ---------------------------------------------------------------------------

def _finding(severity, category, title, detail, when=None, reference=None, tz=None):
    return dict(severity=severity, category=category, title=title, detail=detail,
                time_utc=when.isoformat() if when else None,
                time_local=_fmt(when, tz) if when and tz else None,
                reference=reference)


def _duty_route(d: DutyIn) -> str:
    if d.sectors:
        return ' → '.join([d.sectors[0].departure] + [s.arrival for s in d.sectors])
    return d.description or d.duty_type.replace('_', ' ').title()


def _duty_label(d: DutyIn, tz: str) -> str:
    return f'{_fmt(d.report_utc, tz)} {_duty_route(d)}'


def _duty_patterns(d: DutyIn, tz: str) -> Dict[str, bool]:
    """EASA ORO.FTL.105(8) disruptive-schedule elements, on home-base time."""
    rep = _local_hour(d.report_utc, tz)
    rel = _local_hour(d.release_utc, tz)
    return dict(
        early_start=5.0 <= rep < 6.0,
        very_early_start=2.0 <= rep < 5.0,
        late_finish=rel >= 23.0 or rel < 2.0,
        night_duty=_overlaps_window(d.report_utc, d.release_utc, tz, 2.0, 5.0),
    )


def analyse(inp: ReportInput) -> Dict:
    tz = inp.home_timezone
    duties = sorted(inp.duties, key=lambda d: d.report_utc)
    sleeps = sorted(inp.sleeps, key=lambda s: s.start_utc)
    affected = next((d for d in duties if d.id == inp.affected_duty_id), None)
    findings: List[Dict] = []

    # Evaluation point: the affected duty, else the moment fatigue was declared.
    eval_start = affected.report_utc if affected else inp.event_time_utc
    eval_end = affected.release_utc if affected else inp.event_time_utc
    if affected and inp.event_type == 'fatigue_during_duty':
        eval_end = max(eval_start, min(eval_end, inp.event_time_utc))
    horizon_end = max(inp.period_end_utc, eval_end, inp.event_time_utc)
    sim_start = min([inp.period_start_utc] + [s.start_utc for s in sleeps])

    track = LocationTrack(tz, duties)
    shift_at = _phase_shift_series(inp, sim_start, horizon_end, track)
    series = _simulate(inp, sleeps, inp.period_start_utc, horizon_end, shift_at)
    model_available = bool(series)
    sleep_before = [s for s in sleeps if s.start_utc < eval_start]
    intervals_before = [aw.SleepInterval(s.start_utc, min(s.end_utc, eval_start)) for s in sleep_before]

    # ---- data quality ------------------------------------------------------
    reported = [s for s in sleeps if s.source == 'reported']
    estimated = [s for s in sleeps if s.source != 'reported']
    last72 = [s for s in sleeps if s.end_utc > eval_start - timedelta(hours=72) and s.start_utc < eval_start]
    days = []
    d0 = inp.period_start_utc.astimezone(pytz.timezone(tz)).date()
    d1 = min(inp.period_end_utc, eval_start).astimezone(pytz.timezone(tz)).date()
    while d0 <= d1:
        days.append(d0)
        d0 += timedelta(days=1)
    home = pytz.timezone(tz)

    def _day_bounds(day):
        start = home.localize(datetime(day.year, day.month, day.day))
        return start, home.normalize(start + timedelta(days=1))
    nights_without_sleep = [str(day) for day in days
                            if not any(s.start_utc < _day_bounds(day)[1] and s.end_utc > _day_bounds(day)[0]
                                       for s in sleeps)]
    if not model_available:
        confidence = 'low'
    elif any(s.source != 'reported' for s in last72) or nights_without_sleep:
        confidence = 'medium'
    else:
        confidence = 'high'
    quality_notes = []
    if not model_available:
        quality_notes.append('Fewer than two sleep episodes were provided, so no model prediction was made. '
                             'Rule-based checks on the information supplied are still reported.')
    if estimated:
        quality_notes.append(f'{len(estimated)} sleep period(s) are roster-based estimates that were not '
                             'confirmed by the pilot; conclusions that depend on them are less certain.')
    if nights_without_sleep:
        quality_notes.append('No sleep was entered on: ' + ', '.join(nights_without_sleep) +
                             '. These days are treated as awake, which may overstate fatigue if sleep was omitted.')
    if inp.unknown_airports:
        quality_notes.append('Unrecognised airport codes (time zone assumed UTC): ' +
                             ', '.join(sorted(set(inp.unknown_airports))) + '.')
    if inp.self_kss is None and inp.self_samn_perelli is None:
        quality_notes.append('No self-rated sleepiness or fatigue score was provided.')

    # ---- sleep checks -----------------------------------------------------
    sw = aw.prior_sleep_wake_check(intervals_before, eval_start, eval_end) if sleep_before else None
    if sw:
        failed = [c for c in sw['checks'] if not c['passed']]
        for c in failed:
            findings.append(_finding(
                'warning', 'sleep', {'sleep_24h': 'Less than 5 h sleep in the 24 h before the duty',
                                     'sleep_48h': 'Less than 12 h sleep in the 48 h before the duty',
                                     'wake_vs_sleep': 'Time awake by end of duty exceeds sleep in prior 48 h'}[c['rule']],
                {'sleep_24h': f"Slept {_hours(c['value'])} in the 24 h before report (criterion: at least 5h00).",
                 'sleep_48h': f"Slept {_hours(c['value'])} in the 48 h before report (criterion: at least 12h00).",
                 'wake_vs_sleep': f"About {_hours(c['value'])} awake by the end of the duty, more than the "
                                  f"{_hours(c['limit'])} slept in the prior 48 h."}[c['rule']],
                eval_start, sw['source'], tz))
        if len(failed) >= 2:
            findings.append(_finding(
                'critical', 'sleep', 'Prior sleep/wake check failed on multiple criteria',
                'The sleep obtained before this duty fails more than one criterion of the prior sleep/wake '
                'model. Under this model fatigue-related error is likely and duty should not proceed without '
                'additional controls.', eval_start, sw['source'], tz))

    main_sleeps = [s for s in sleeps if s.kind == 'main' and s.start_utc < eval_start]
    for s in main_sleeps:
        if s.hours < 5.0:
            findings.append(_finding('caution', 'sleep', 'Short main sleep',
                                     f'Main sleep of {_hours(s.hours)} ({_fmt(s.start_utc, tz)} – '
                                     f'{_fmt(s.end_utc, tz)}), {s.source}.', s.start_utc, None, tz))
        if s.quality is not None and s.quality <= 2:
            findings.append(_finding('caution', 'sleep', 'Poor sleep quality reported',
                                     f'Pilot rated sleep starting {_fmt(s.start_utc, tz)} as '
                                     f'{s.quality}/5.', s.start_utc, None, tz))

    deficit = aw.cumulative_deficit(intervals_before, eval_start) if sleep_before else None
    if deficit and deficit['band'] in ('moderate', 'severe'):
        findings.append(_finding(
            'critical' if deficit['band'] == 'severe' else 'warning', 'sleep', 'Cumulative sleep restriction',
            f"About {_hours(deficit['deficit_hours'])} less sleep than an 8 h/day need over the previous "
            f"{deficit['days']:.1f} days. Performance continues to decline under repeated restriction even "
            'when sleepiness ratings level off.', eval_start,
            'Van Dongen et al. (2003) Sleep 26:117-126; Belenky et al. (2003) J Sleep Res 12:1-12', tz))

    # ---- predicted alertness on the affected duty / at the event ---------
    assessment = None
    if model_available:
        on = [p for p in series if eval_start <= p['time_utc'] <= eval_end and not p['asleep']]
        if on:
            worst = max(on, key=lambda p: p['kss'])
            at_start = on[0]
            last_arrival = None
            if affected and affected.sectors:
                last_arrival = min(affected.sectors[-1].arrival_utc, eval_end)
            at_landing = min(on, key=lambda p: abs((p['time_utc'] - last_arrival).total_seconds())) \
                if last_arrival else None
            assessment = dict(
                start_utc=eval_start.isoformat(), end_utc=eval_end.isoformat(),
                kss_at_start=at_start['kss'], kss_max=worst['kss'], kss_max_90=worst['kss_90'],
                kss_max_time_utc=worst['time_utc'].isoformat(), kss_max_time_local=_fmt(worst['time_utc'], tz),
                kss_at_landing=at_landing['kss'] if at_landing else None,
                p_severe_max=worst['p_severe'],
                hours_awake_at_start=at_start['hours_awake'],
                hours_awake_at_end=on[-1]['hours_awake'],
                risk_level=aw.classify_kss(worst['kss']),
                kss_label=aw.KSS_LABELS[int(round(worst['kss']))],
            )
            if worst['kss'] >= 7.0:
                findings.append(_finding(
                    'critical' if worst['kss'] >= 8.0 else 'warning', 'prediction',
                    'Predicted severe sleepiness during the duty',
                    f"With the sleep reported, predicted sleepiness reaches KSS {worst['kss']:.1f} "
                    f"(“{assessment['kss_label']}”) at {_fmt(worst['time_utc'], tz)}; about "
                    f"{round(worst['p_severe'] * 100)}% of pilots in this situation would rate KSS 7 or higher.",
                    worst['time_utc'], 'Ingre et al. (2014) PLoS ONE e108679', tz))
            elif worst['kss'] >= 6.5 or worst['kss_90'] >= 7.0:
                findings.append(_finding(
                    'caution', 'prediction', 'Predicted sleepiness approaching the severe range',
                    f"Predicted KSS peaks at {worst['kss']:.1f} at {_fmt(worst['time_utc'], tz)} "
                    f"(90th-percentile pilot: {worst['kss_90']:.1f}).",
                    worst['time_utc'], 'Ingre et al. (2014) PLoS ONE e108679', tz))
            awake_end = on[-1]['hours_awake']
            if awake_end >= 17:
                findings.append(_finding(
                    'critical' if awake_end >= 20 else 'warning', 'sleep', 'Extended wakefulness',
                    f'About {_hours(awake_end)} awake by the end of the period assessed. Performance '
                    'impairment after 17 or more hours awake is comparable to that seen with alcohol at '
                    'levels restricted for driving in many countries.',
                    eval_end, 'Dawson & Reid (1997) Nature 388:235; Williamson & Feyer (2000) '
                              'Occup Environ Med 57:649-655', tz))

    # ---- roster / FTL patterns across the period --------------------------
    duty_rows = []
    prev: Optional[DutyIn] = None
    disruptive_run = 0
    for d in duties:
        pat = _duty_patterns(d, tz)
        row = dict(id=d.id, label=_duty_label(d, tz), route=_duty_route(d), status=d.status, duty_type=d.duty_type,
                   report_utc=d.report_utc.isoformat(), release_utc=d.release_utc.isoformat(),
                   report_local=_fmt(d.report_utc, tz), release_local=_fmt(d.release_utc, tz),
                   report_z=_fmt_z(d.report_utc), release_z=_fmt_z(d.release_utc),
                   duty_hours=round(d.hours, 2), sectors=len([s for s in d.sectors if not s.is_deadhead]),
                   patterns=pat, is_affected=d is affected, source=d.source)
        pts = [p for p in series if d.report_utc <= p['time_utc'] <= d.release_utc and not p['asleep']]
        row['predicted_kss_max'] = max((p['kss'] for p in pts), default=None)
        row['risk_level'] = aw.classify_kss(row['predicted_kss_max']) if pts else 'unknown'
        rest_h = None
        if prev is not None:
            rest_h = (d.report_utc - prev.release_utc).total_seconds() / 3600
            rest_at_home = track.tz_at(prev.release_utc) == tz
            minimum = max(prev.hours, 12.0 if rest_at_home else 10.0)
            row['rest_before_hours'] = round(rest_h, 2)
            row['rest_sleep_hours'] = round(aw.sleep_in_window(
                [aw.SleepInterval(s.start_utc, s.end_utc) for s in sleeps], prev.release_utc, d.report_utc), 2)
            if rest_h < minimum:
                findings.append(_finding(
                    'warning', 'roster', 'Rest shorter than the regulatory minimum',
                    f"{_hours(rest_h)} between release at {_fmt(prev.release_utc, tz)} and report at "
                    f"{_fmt(d.report_utc, tz)}; the minimum {'at home base' if rest_at_home else 'away from base'} "
                    f"is {_hours(minimum)} (at least the preceding duty, and no less than "
                    f"{12 if rest_at_home else 10} h). Check whether a reduced-rest scheme applied.",
                    d.report_utc, 'Regulation (EU) 965/2012 ORO.FTL.235', tz))
            if rest_h < 14.0 and (_duty_patterns(prev, tz)['late_finish'] or _duty_patterns(prev, tz)['night_duty']) \
                    and (pat['early_start'] or pat['very_early_start']):
                findings.append(_finding(
                    'warning', 'roster', 'Late finish followed by early start',
                    f"Release at {_fmt(prev.release_utc, tz)} then report at {_fmt(d.report_utc, tz)}: the "
                    'rest spans the night but leaves little time for a full sleep.',
                    d.report_utc, 'Regulation (EU) 965/2012 ORO.FTL.105(8)', tz))
        is_disruptive = pat['early_start'] or pat['very_early_start'] or pat['late_finish'] or pat['night_duty']
        disruptive_run = disruptive_run + 1 if is_disruptive and d.status != 'cancelled_fatigue' else 0
        if disruptive_run == 3:
            findings.append(_finding('caution', 'roster', 'Consecutive disruptive duties',
                                     'Three or more consecutive duties include an early start, late finish or '
                                     'night element.', d.report_utc,
                                     'Regulation (EU) 965/2012 ORO.FTL.105(8)', tz))
        if d is affected or d.status == 'operated':
            if pat['night_duty']:
                findings.append(_finding('caution', 'circadian', 'Duty through the window of circadian low',
                                         f'{row["label"]} is on duty during 02:00–04:59 home-base time.',
                                         d.report_utc, 'AMC1 ORO.FTL.105(10); ORO.FTL.105(8)', tz))
            elif pat['very_early_start'] or pat['early_start']:
                findings.append(_finding('caution', 'circadian', 'Early report',
                                         f'Report at {_fmt(d.report_utc, tz)} requires waking in the early '
                                         'morning, which typically truncates the preceding sleep.',
                                         d.report_utc, 'Roach et al. (2012) Accid Anal Prev 45S:22-26', tz))
            if d.hours > 12.0:
                findings.append(_finding('info', 'roster', 'Long duty',
                                         f'{row["label"]}: {_hours(d.hours)} duty.', d.report_utc,
                                         'Powell et al. (2007) Aviat Space Environ Med 78:698-701', tz))
            if row['sectors'] >= 4:
                findings.append(_finding('info', 'roster', 'Multi-sector duty',
                                         f'{row["label"]}: {row["sectors"]} sectors. Fatigue increases with the '
                                         'number of sectors flown in a duty.', d.report_utc,
                                         'Powell et al. (2007) Aviat Space Environ Med 78:698-701', tz))
        duty_rows.append(row)
        if d.status != 'cancelled_fatigue':
            prev = d

    # Time-zone changes across the period.
    offsets = {round(aw.utc_offset_hours(z, inp.event_time_utc) - aw.utc_offset_hours(tz, inp.event_time_utc), 1)
               for _, z in track.events if _ <= eval_start}
    big = [o for o in offsets if abs(o) >= 3]
    if big:
        findings.append(_finding('caution', 'circadian', 'Time-zone transitions',
                                 f'Recent layovers up to {max(abs(o) for o in big):.0f} h from home-base time. '
                                 'The body clock adapts at roughly 30% of the remaining difference per day.',
                                 None, 'Ingre et al. (2014) PLoS ONE e108679 (process A)', tz))

    # ---- pilot's own assessment ------------------------------------------
    self_assessment = None
    if inp.self_kss is not None or inp.self_samn_perelli is not None:
        rated_at = inp.self_rated_at or inp.event_time_utc
        model_at = None
        if model_available:
            near = [p for p in series if not p['asleep']]
            if near:
                model_at = min(near, key=lambda p: abs((p['time_utc'] - rated_at).total_seconds()))
                if abs((model_at['time_utc'] - rated_at).total_seconds()) > 3600:
                    model_at = None
        self_assessment = dict(
            kss=inp.self_kss, kss_label=aw.KSS_LABELS.get(inp.self_kss) if inp.self_kss else None,
            samn_perelli=inp.self_samn_perelli,
            samn_perelli_label=SAMN_PERELLI_LABELS.get(inp.self_samn_perelli) if inp.self_samn_perelli else None,
            rated_at_utc=rated_at.isoformat(), rated_at_local=_fmt(rated_at, tz),
            model_kss_at_rating=model_at['kss'] if model_at else None,
        )
        high_kss = inp.self_kss is not None and inp.self_kss >= 7
        high_sp = inp.self_samn_perelli is not None and inp.self_samn_perelli >= 5
        if high_kss or high_sp:
            severe = (inp.self_kss or 0) >= 8 or (inp.self_samn_perelli or 0) >= 6
            parts = []
            if inp.self_kss is not None:
                parts.append(f'KSS {inp.self_kss} (“{aw.KSS_LABELS[inp.self_kss]}”)')
            if inp.self_samn_perelli is not None:
                parts.append(f'Samn-Perelli {inp.self_samn_perelli} (“{SAMN_PERELLI_LABELS[inp.self_samn_perelli]}”)')
            findings.append(_finding('critical' if severe else 'warning', 'self_report',
                                     'Pilot reports significant fatigue', 'Self-rating: ' + '; '.join(parts) + '.',
                                     rated_at, 'Åkerstedt & Gillberg (1990); Samn & Perelli (1982)', tz))
        if model_at and inp.self_kss is not None:
            gap = inp.self_kss - model_at['kss']
            if gap >= 2:
                findings.append(_finding(
                    'info', 'self_report', 'Pilot rates sleepiness higher than the model predicts',
                    f'Self-rated KSS {inp.self_kss} vs predicted {model_at["kss"]:.1f}. The model predicts an '
                    'average pilot from sleep timing alone (typical error ±1.4 KSS) and cannot see illness, stress, '
                    'sleep quality or individual vulnerability. The pilot’s assessment takes precedence.',
                    rated_at, 'Ingre et al. (2014) PLoS ONE e108679', tz))
            elif gap <= -2:
                findings.append(_finding(
                    'info', 'self_report', 'Model predicts more sleepiness than the pilot reports',
                    f'Predicted KSS {model_at["kss"]:.1f} vs self-rated {inp.self_kss}. Under sustained sleep '
                    'restriction people tend to underestimate their own impairment.',
                    rated_at, 'Van Dongen et al. (2003) Sleep 26:117-126', tz))

    findings.sort(key=lambda f: (-SEVERITY_ORDER[f['severity']], f['time_utc'] or ''))
    top = max((SEVERITY_ORDER[f['severity']] for f in findings), default=0)
    objective = [f for f in findings if f['category'] != 'self_report' and SEVERITY_ORDER[f['severity']] >= 2]

    sleep_rows = [dict(start_utc=s.start_utc.isoformat(), end_utc=s.end_utc.isoformat(),
                       start_local=_fmt(s.start_utc, tz), end_local=_fmt(s.end_utc, tz),
                       hours=round(s.hours, 2), kind=s.kind, location=s.location, quality=s.quality,
                       source=s.source) for s in sleeps]

    summary = dict(
        overall_level=['low', 'moderate', 'high', 'critical'][top],
        objective_support=bool(objective),
        headline=_headline(objective, self_assessment, findings),
        counts={k: sum(1 for f in findings if f['severity'] == k) for k in SEVERITY_ORDER},
    )

    report = dict(
        report_id=str(uuid.uuid4()),
        report_version=REPORT_VERSION,
        engine_version=aw.ENGINE_VERSION,
        generated_at=datetime.now(timezone.utc).isoformat(),
        home_timezone=tz, home_base=inp.home_base,
        pilot=inp.pilot,
        event=dict(type=inp.event_type, time_utc=inp.event_time_utc.isoformat(),
                   time_local=_fmt(inp.event_time_utc, tz), time_z=_fmt_z(inp.event_time_utc),
                   affected_duty_id=affected.id if affected else None,
                   affected_duty_label=_duty_label(affected, tz) if affected else None),
        period=dict(start_utc=inp.period_start_utc.isoformat(), end_utc=inp.period_end_utc.isoformat(),
                    start_local=_fmt(inp.period_start_utc, tz), end_local=_fmt(inp.period_end_utc, tz)),
        data_quality=dict(confidence=confidence, reported_sleeps=len(reported), estimated_sleeps=len(estimated),
                          duties=len(duties), nights_without_sleep=nights_without_sleep, notes=quality_notes,
                          model_available=model_available),
        summary=summary,
        assessment=assessment,
        prior_sleep_wake=sw,
        cumulative_deficit=deficit,
        self_assessment=self_assessment,
        contributing_factors=[dict(code=f, label=FACTOR_LABELS.get(f, f)) for f in inp.factors],
        pilot_narrative=inp.narrative,
        findings=findings,
        duties=duty_rows,
        sleeps=sleep_rows,
        timeline=[dict(time_utc=p['time_utc'].isoformat(), kss=p['kss'], kss_90=p['kss_90'],
                       p_severe=p['p_severe'], hours_awake=p['hours_awake'], asleep=p['asleep'])
                  for p in series],
        limitations=_limitations(model_available),
    )
    report['narrative'] = _narrative(report, inp)
    return report


def _headline(objective, self_assessment, findings) -> str:
    self_high = any(f['category'] == 'self_report' and f['severity'] in ('warning', 'critical') for f in findings)
    if objective and self_high:
        return 'Fatigue declaration is supported by the sleep and duty data provided.'
    if objective:
        return 'Sleep and duty data show significant fatigue risk factors.'
    if self_high:
        return ('The pilot reports significant fatigue. The data provided show no major scheduling or sleep '
                'risk factor, so contributing causes are likely outside what the model can see '
                '(e.g. sleep quality, illness, stress). The pilot’s assessment stands.')
    if self_assessment:
        return 'No major fatigue risk factors identified in the information provided.'
    return 'No major fatigue risk factors identified in the information provided (no self-rating given).'


def _limitations(model_available: bool) -> List[str]:
    out = [
        'Predictions describe an average pilot with the sleep and duty times entered; individuals differ '
        '(90th-percentile values are shown for reference). Typical prediction error is about ±1.4 KSS points.',
        'The model does not account for sleep disorders, illness, medication, caffeine, workload, stress or '
        'commuting beyond what is entered as sleep and duty times.',
        'This report supports, and does not replace, the pilot’s own judgement of fitness for duty. It is not '
        'a medical assessment.',
        'Regulatory references are to Regulation (EU) 965/2012 (EASA ORO.FTL); operator schemes may differ.',
    ]
    if not model_available:
        out.insert(0, 'Alertness was not modelled because fewer than two sleep periods were provided.')
    return out


def _narrative(r: Dict, inp: ReportInput) -> List[Dict]:
    tz = inp.home_timezone
    paras = []
    ev = r['event']
    kind = {'fatigue_call_before_duty': 'declared unfit for duty due to fatigue before',
            'fatigue_during_duty': 'reported fatigue during',
            'fatigue_after_duty': 'reported fatigue after'}.get(inp.event_type, 'reported fatigue in relation to')
    if ev['affected_duty_label']:
        paras.append(dict(title='Event', text=f"The pilot {kind} the duty {ev['affected_duty_label']} "
                                              f"(home-base time, {tz}). The report was triggered at {ev['time_local']} "
                                              f"({ev['time_z']})."))
    else:
        paras.append(dict(title='Event', text=f"The pilot reported fatigue at {ev['time_local']} ({ev['time_z']}), "
                                              'without a specific duty selected.'))

    s_rows = r['sleeps']
    if s_rows:
        total = sum(s['hours'] for s in s_rows)
        rep = sum(1 for s in s_rows if s['source'] == 'reported')
        sw = r['prior_sleep_wake']
        text = (f"{len(s_rows)} sleep period(s) totalling {_hours(total)} were provided for "
                f"{r['period']['start_local']} to {r['period']['end_local']} ({rep} reported by the pilot, "
                f"{len(s_rows) - rep} estimated from the roster).")
        if sw:
            text += (f" In the 24 h before the assessed point the pilot slept {_hours(sw['sleep_24h'])}, and "
                     f"{_hours(sw['sleep_48h'])} in the 48 h before")
            if sw['hours_awake_at_start'] is not None:
                text += f"; they had been awake {_hours(sw['hours_awake_at_start'])} at that point"
            text += '.'
        cd = r['cumulative_deficit']
        if cd and cd['band'] != 'none':
            text += (f" Over the preceding {cd['days']:.1f} days the sleep shortfall against an 8 h/day need is "
                     f"about {_hours(cd['deficit_hours'])} ({cd['band']}).")
        paras.append(dict(title='Sleep', text=text))
    else:
        paras.append(dict(title='Sleep', text='No sleep information was provided.'))

    ops = [d for d in r['duties'] if d['status'] == 'operated']
    if r['duties']:
        text = f"{len(r['duties'])} duty period(s) in the selected period, {len(ops)} operated."
        rests = [d['rest_before_hours'] for d in r['duties'] if d.get('rest_before_hours') is not None]
        if rests:
            text += f" Shortest rest between duties: {_hours(min(rests))}."
        flags = []
        for d in r['duties']:
            p = d['patterns']
            tags = [n for n, k in (('early start', 'early_start'), ('very early start', 'very_early_start'),
                                   ('late finish', 'late_finish'), ('night duty', 'night_duty')) if p[k]]
            if tags:
                flags.append(f"{d['label']} ({', '.join(tags)})")
        if flags:
            text += ' Disruptive elements: ' + '; '.join(flags) + '.'
        paras.append(dict(title='Duties', text=text))

    a = r['assessment']
    if a:
        aff = next((d for d in inp.duties if d.id == inp.affected_duty_id), None)
        hypothetical = aff is not None and aff.status in ('cancelled_fatigue', 'not_operated', 'planned')
        lead = 'Had the duty been operated, predicted' if hypothetical else 'Using the sleep provided, predicted'
        text = (f"{lead} sleepiness is KSS {a['kss_at_start']:.1f} at the start and "
                f"peaks at KSS {a['kss_max']:.1f} (“{a['kss_label']}”) at {a['kss_max_time_local']}")
        if a['kss_at_landing'] is not None:
            text += f"; KSS {a['kss_at_landing']:.1f} at the final landing"
        text += (f". For a more fatigue-susceptible pilot (90th percentile) the peak would be about "
                 f"KSS {a['kss_max_90']:.1f}. The pilot would have been awake about {_hours(a['hours_awake_at_end'])} "
                 'by the end.')
        paras.append(dict(title='Predicted alertness', text=text))

    sa = r['self_assessment']
    if sa:
        parts = []
        if sa['kss']:
            parts.append(f"KSS {sa['kss']} (“{sa['kss_label']}”)")
        if sa['samn_perelli']:
            parts.append(f"Samn-Perelli {sa['samn_perelli']} (“{sa['samn_perelli_label']}”)")
        text = f"At {sa['rated_at_local']} the pilot rated themselves " + ' and '.join(parts) + '.'
        if sa['model_kss_at_rating'] is not None and sa['kss']:
            text += f" The model predicted KSS {sa['model_kss_at_rating']:.1f} at that time."
        paras.append(dict(title='Pilot assessment', text=text))
    if r['contributing_factors']:
        paras.append(dict(title='Contributing factors (pilot)',
                          text=', '.join(f['label'] for f in r['contributing_factors']) + '.'))

    key = [f for f in r['findings'] if f['severity'] in ('critical', 'warning')]
    if key:
        text = 'Main issues identified: ' + '; '.join(f"{f['title'].lower()}" for f in key[:6]) + '.'
    else:
        text = 'No warning-level issues were identified from the information provided.'
    text += ' ' + r['summary']['headline']
    paras.append(dict(title='Conclusion', text=text))
    return paras
