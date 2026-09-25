"""
EASA roster-level checks (Regulation (EU) 965/2012, Subpart FTL)
================================================================

Facts pilots cite in fatigue reports, computed from the roster alone:

* ORO.FTL.210(a) cumulative duty: 60 h / 7 days, 110 h / 14 days,
  190 h / 28 days (any consecutive days).
* ORO.FTL.210(b) flight time: 100 h / 28 days (block time, operating sectors).
* ORO.FTL.225 / CS FTL.1.225: home standby counts 25 % toward cumulative
  duty; airport standby counts in full.
* ORO.FTL.235(a)/(b) minimum rest before an FDP: at least the preceding
  duty and 12 h at home base (10 h away from base).
* ORO.FTL.235(d) recurrent extended recovery rest: at least 36 h including
  two local nights, with no more than 168 h between the end of one and the
  start of the next.
* ORO.FTL.205 FDP above the table maximum (discretion/extension used).

Limits are checked within the uploaded roster only: activity in the previous
month is unknown unless carried over, so windows at the start of a roster can
under-count. Operator schemes approved under ORO.FTL.125 may differ.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

import pytz

from models.data_models import Duty, DutyType, Roster

DUTY_LIMITS = {7: 60.0, 14: 110.0, 28: 190.0}
BLOCK_LIMIT_28D = 100.0
HOME_STANDBY_FACTOR = 0.25
RECOVERY_REST_HOURS = 36.0
RECOVERY_MAX_GAP_HOURS = 168.0
APPROACHING = 0.9  # report "approaching" at 90 % of a limit


@dataclass
class Interval:
    start: datetime
    end: datetime
    weight: float = 1.0

    def overlap_hours(self, a: datetime, b: datetime) -> float:
        lo, hi = max(self.start, a), min(self.end, b)
        return max(0.0, (hi - lo).total_seconds() / 3600) * self.weight


def _finding(rule, reference, severity, title, detail, start=None, end=None, value=None, limit=None):
    return dict(rule=rule, reference=reference, severity=severity, title=title, detail=detail,
                window_start_utc=start.isoformat() if start else None,
                window_end_utc=end.isoformat() if end else None,
                value=None if value is None else round(value, 2),
                limit=limit)


def _max_window(intervals: Sequence[Interval], days: int) -> Tuple[float, Optional[datetime], Optional[datetime]]:
    """Largest weighted total in any window of ``days`` consecutive 24 h periods."""
    span = timedelta(days=days)
    candidates = set()
    for iv in intervals:
        candidates.add(iv.end)
        candidates.add(iv.start + span)
    best = (0.0, None, None)
    for end in candidates:
        start = end - span
        total = sum(iv.overlap_hours(start, end) for iv in intervals)
        if total > best[0] + 1e-9:
            best = (total, start, end)
    return best


def duty_intervals(roster: Roster) -> List[Interval]:
    out = [Interval(d.report_time_utc, d.release_time_utc) for d in roster.duties]
    out += [Interval(s.report_time_utc, s.release_time_utc, HOME_STANDBY_FACTOR)
            for s in getattr(roster, 'standbys', [])]
    return out


def block_intervals(roster: Roster) -> List[Interval]:
    return [Interval(seg.scheduled_departure_utc, seg.scheduled_arrival_utc)
            for d in roster.duties for seg in d.segments
            if not seg.is_deadhead and not seg.is_inflight_rest]


def _local_nights(start: datetime, end: datetime, tz: str) -> int:
    """Local nights (8 h within 22:00–08:00) fully contained in [start, end)."""
    zone = pytz.timezone(tz)
    day = start.astimezone(zone).date() - timedelta(days=1)
    last = end.astimezone(zone).date()
    count = 0
    while day <= last:
        window_start = zone.localize(datetime(day.year, day.month, day.day, 22))
        window_end = zone.localize(datetime(day.year, day.month, day.day) + timedelta(days=1, hours=8))
        overlap = (min(end, window_end) - max(start, window_start)).total_seconds() / 3600
        if overlap >= 8.0 - 1e-9:
            count += 1
        day += timedelta(days=1)
    return count


def _fmt(dt: datetime, tz: str) -> str:
    return dt.astimezone(pytz.timezone(tz)).strftime('%d %b %H:%M')


def _h(hours: float) -> str:
    whole = int(hours)
    minutes = int(round((hours - whole) * 60))
    if minutes == 60:
        whole, minutes = whole + 1, 0
    return f'{whole}h{minutes:02d}'


def run_checks(roster: Roster, home_base_timezone: Optional[str] = None) -> Dict:
    tz = home_base_timezone or roster.home_base_timezone
    findings: List[Dict] = []
    duties = sorted(roster.duties, key=lambda d: d.report_time_utc)
    activities = sorted(duties + list(getattr(roster, 'standbys', [])), key=lambda d: d.report_time_utc)

    # ---- ORO.FTL.210 cumulative limits ---------------------------------
    di = duty_intervals(roster)
    summary = {}
    for days, limit in DUTY_LIMITS.items():
        total, start, end = _max_window(di, days)
        summary[f'duty_{days}d_max'] = round(total, 2)
        if total > limit:
            findings.append(_finding(f'duty_{days}d', 'ORO.FTL.210(a)', 'warning',
                                     f'Duty hours exceed {limit:.0f} h in {days} days',
                                     f'{_h(total)} of duty between {_fmt(start, tz)} and {_fmt(end, tz)}.',
                                     start, end, total, limit))
        elif total >= APPROACHING * limit:
            findings.append(_finding(f'duty_{days}d', 'ORO.FTL.210(a)', 'info',
                                     f'Duty hours close to the {days}-day limit',
                                     f'{_h(total)} of {limit:.0f} h between {_fmt(start, tz)} and {_fmt(end, tz)}.',
                                     start, end, total, limit))
    total, start, end = _max_window(block_intervals(roster), 28)
    summary['block_28d_max'] = round(total, 2)
    if total > BLOCK_LIMIT_28D:
        findings.append(_finding('block_28d', 'ORO.FTL.210(b)', 'warning',
                                 'Flight time exceeds 100 h in 28 days',
                                 f'{_h(total)} block time between {_fmt(start, tz)} and {_fmt(end, tz)}.',
                                 start, end, total, BLOCK_LIMIT_28D))
    elif total >= APPROACHING * BLOCK_LIMIT_28D:
        findings.append(_finding('block_28d', 'ORO.FTL.210(b)', 'info',
                                 'Flight time close to the 28-day limit',
                                 f'{_h(total)} of 100 h between {_fmt(start, tz)} and {_fmt(end, tz)}.',
                                 start, end, total, BLOCK_LIMIT_28D))
    summary['limits'] = {'duty_7d': 60, 'duty_14d': 110, 'duty_28d': 190, 'block_28d': 100}

    # ---- ORO.FTL.235 minimum rest before each duty -------------------------
    for prev, nxt in zip(duties, duties[1:]):
        rest = (nxt.report_time_utc - prev.release_time_utc).total_seconds() / 3600
        at_home = not prev.segments or prev.segments[-1].arrival_airport.timezone == tz
        minimum = max(prev.duty_hours, 12.0 if at_home else 10.0)
        if rest < minimum:
            findings.append(_finding(
                'min_rest', 'ORO.FTL.235(a)/(b)', 'warning', 'Rest shorter than the minimum',
                f'{_h(rest)} between release {_fmt(prev.release_time_utc, tz)} and report '
                f'{_fmt(nxt.report_time_utc, tz)}; minimum {"at home base" if at_home else "away from base"} '
                f'is {_h(minimum)}. Check whether a reduced-rest scheme applied.',
                prev.release_time_utc, nxt.report_time_utc, rest, round(minimum, 2)))

    # ---- ORO.FTL.235(d) recurrent extended recovery rest -------------------
    recovery: List[Tuple[datetime, datetime]] = []
    for prev, nxt in zip(activities, activities[1:]):
        start, end = prev.release_time_utc, nxt.report_time_utc
        hours = (end - start).total_seconds() / 3600
        if hours >= RECOVERY_REST_HOURS and _local_nights(start, end, tz) >= 2:
            recovery.append((start, end))
    for (a_start, a_end), (b_start, _) in zip(recovery, recovery[1:]):
        gap = (b_start - a_end).total_seconds() / 3600
        if gap > RECOVERY_MAX_GAP_HOURS:
            findings.append(_finding(
                'recovery_rest', 'ORO.FTL.235(d)', 'warning', 'Too long between extended recovery rests',
                f'{_h(gap)} between recovery rests ending {_fmt(a_end, tz)} and starting '
                f'{_fmt(b_start, tz)} (maximum 168 h; each recovery rest ≥ 36 h including 2 local nights).',
                a_end, b_start, gap, RECOVERY_MAX_GAP_HOURS))
    if activities and not recovery and \
            (activities[-1].release_time_utc - activities[0].report_time_utc).total_seconds() / 3600 > RECOVERY_MAX_GAP_HOURS:
        findings.append(_finding('recovery_rest', 'ORO.FTL.235(d)', 'warning',
                                 'No extended recovery rest in the roster',
                                 'No rest of at least 36 h including 2 local nights was found.'))
    summary['recovery_rests'] = len(recovery)

    # ---- ORO.FTL.205 FDP above the table maximum ---------------------------
    for d in duties:
        if d.duty_type != DutyType.FLIGHT or not d.segments or not d.max_fdp_hours:
            continue
        fdp = d.fdp_hours
        if d.extended_fdp_hours and fdp > d.extended_fdp_hours + 1e-6:
            findings.append(_finding('fdp_max', 'ORO.FTL.205', 'warning', 'FDP exceeds the maximum with discretion',
                                     f'{_fmt(d.report_time_utc, tz)}: FDP {_h(fdp)}, maximum {_h(d.extended_fdp_hours)} '
                                     'including commander’s discretion.',
                                     d.report_time_utc, d.release_time_utc, fdp, d.extended_fdp_hours))
        elif fdp > d.max_fdp_hours + 1e-6:
            findings.append(_finding('fdp_max', 'ORO.FTL.205', 'info', 'FDP above the basic maximum',
                                     f'{_fmt(d.report_time_utc, tz)}: FDP {_h(fdp)} vs basic maximum '
                                     f'{_h(d.max_fdp_hours)} — an extension or commander’s discretion is needed.',
                                     d.report_time_utc, d.release_time_utc, fdp, d.max_fdp_hours))

    findings.sort(key=lambda f: (f['severity'] != 'warning', f['window_start_utc'] or ''))
    return dict(findings=findings, summary=summary)
