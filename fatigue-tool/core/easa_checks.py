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
# A sector this long can be flown with an augmented crew (matches the frontend's
# LONG_SECTOR_BLOCK_HOURS in src/lib/crew.ts).
LONG_SECTOR_BLOCK_HOURS = 7.0


def augmentation_likely(duty: Duty) -> bool:
    """A 2-pilot duty above the basic FDP maximum with a long sector, whose crew the
    pilot has not stated. CrewLink prints no crew size (only IR sectors mark 4 pilots),
    so such a duty is most likely flown with 3 or 4 pilots: the pilot is asked to set it."""
    from models.data_models import CrewComposition
    return (duty.duty_type == DutyType.FLIGHT and bool(duty.segments)
            and duty.crew_composition == CrewComposition.STANDARD
            and not getattr(duty, 'crew_stated', False)
            and bool(duty.max_fdp_hours) and duty.fdp_hours > duty.max_fdp_hours + 1e-6
            and any(s.block_time_hours >= LONG_SECTOR_BLOCK_HOURS for s in duty.segments))


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
            if not seg.is_deadhead]


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
        if not roster.pilot_base:
            continue
        rest = (nxt.report_time_utc - prev.release_time_utc).total_seconds() / 3600
        at_home = bool(roster.pilot_base) and (not prev.segments or prev.segments[-1].arrival_airport.code == roster.pilot_base)
        # OM-A 7.13.1/7.13.2: at least the preceding duty, or 12 h at base / 10 h away. Under
        # reduced rest (7.13.6) the floor is 12 h / 10 h; between the floor and the preceding
        # duty, qatar_rest notes a possible reduced rest instead.
        minimum = 12.0 if at_home else 10.0
        if rest < minimum:
            findings.append(_finding(
                'min_rest', 'OM-A 7.13.1 / 7.13.2', 'warning', 'Rest shorter than the minimum',
                f'{_h(rest)} between release {_fmt(prev.release_time_utc, tz)} and report '
                f'{_fmt(nxt.report_time_utc, tz)}; the minimum {"at home base" if at_home else "away from base"} '
                f'is {_h(max(prev.duty_hours, minimum))}, and never below {_h(minimum)} even with reduced rest.',
                prev.release_time_utc, nxt.report_time_utc, rest, round(minimum, 2)))

    # ---- ORO.FTL.235(d) recurrent extended recovery rest -------------------
    recovery: List[Tuple[datetime, datetime]] = []
    for prev, nxt in zip(activities, activities[1:]):
        start, end = prev.release_time_utc, nxt.report_time_utc
        hours = (end - start).total_seconds() / 3600
        rest_tz = prev.segments[-1].arrival_airport.timezone if prev.segments else tz
        if hours >= RECOVERY_REST_HOURS and _local_nights(start, end, rest_tz) >= 2:
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
    # Known leading/trailing spans are lower bounds; unknown history cannot make them shorter.
    if activities and recovery:
        boundaries = [(activities[0].report_time_utc, recovery[0][0]),
                      (recovery[-1][1], activities[-1].release_time_utc)]
        for start, end in boundaries:
            gap = (end - start).total_seconds() / 3600
            if gap > RECOVERY_MAX_GAP_HOURS:
                findings.append(_finding('recovery_rest', 'ORO.FTL.235(d)', 'warning',
                    'Extended recovery rest missing at a roster boundary',
                    f'At least {_h(gap)} without qualifying recovery rest in the supplied activities.',
                    start, end, gap, RECOVERY_MAX_GAP_HOURS))
    summary['recovery_rests'] = len(recovery)

    # ---- Qatar OM-A 7.6.6 / 7.11 / 7.13 rest rules -------------------------------
    from core import qatar_rest
    findings.extend(qatar_rest.run(roster, duties, activities, tz, recovery, _finding, _fmt, _h))

    # ---- FDP above the maximum: Qatar OM-A 7.6.3 / 7.6.5 / 7.6.6 / 7.7.1 ----------
    extensions = []
    for d in duties:
        if d.duty_type != DutyType.FLIGHT or not d.segments or not d.max_fdp_hours:
            continue
        fdp = d.fdp_hours
        ref = getattr(d, 'fdp_limit_reference', None) or 'OM-A 7.6.3'
        ext = getattr(d, 'planned_extension_fdp_hours', None)
        crew_note = (' The roster does not show the crew: if this flight has 3 or 4 pilots, '
                     'set the crew in the duty details.' if augmentation_likely(d) else '')
        when = _fmt(d.report_time_utc, tz)
        if d.extended_fdp_hours and fdp > d.extended_fdp_hours + 1e-6:
            findings.append(_finding('fdp_max', 'OM-A 7.7.1.2', 'warning', 'FDP exceeds the maximum with discretion',
                                     f'{when}: FDP {_h(fdp)}, maximum {_h(d.extended_fdp_hours)} '
                                     'including commander’s discretion.' + crew_note,
                                     d.report_time_utc, d.release_time_utc, fdp, d.extended_fdp_hours))
        elif fdp > d.max_fdp_hours + 1e-6 and ext and fdp <= ext + 1e-6:
            extensions.append(d)
            findings.append(_finding('fdp_max', 'OM-A 7.6.5 Table 7-8', 'info', 'FDP uses a planned extension',
                                     f'{when}: FDP {_h(fdp)} vs basic maximum {_h(d.max_fdp_hours)} ({ref}); within '
                                     f'the planned extension of {_h(ext)}. Allowed at most twice in 7 days, with '
                                     'pre- and post-flight rest each 2 h longer, or post-flight rest 4 h longer.' + crew_note,
                                     d.report_time_utc, d.release_time_utc, fdp, ext))
        elif fdp > d.max_fdp_hours + 1e-6:
            limit = f'planned extension {_h(ext)}' if ext else 'no planned extension is allowed at this report time'
            findings.append(_finding('fdp_max', ref, 'warning', 'FDP above the planned maximum',
                                     f'{when}: FDP {_h(fdp)} vs basic maximum {_h(d.max_fdp_hours)} ({limit}). '
                                     'Beyond this only commander’s discretion for unforeseen circumstances '
                                     '(OM-A 7.7.1) applies.' + crew_note,
                                     d.report_time_utc, d.release_time_utc, fdp, ext or d.max_fdp_hours))
    # 7.6.5(1): an extension at most twice in any 7 consecutive days.
    from core.qatar_ftl import EXTENSIONS_PER_7_DAYS
    extensions.sort(key=lambda d: d.report_time_utc)
    for i in range(EXTENSIONS_PER_7_DAYS, len(extensions)):
        first, last = extensions[i - EXTENSIONS_PER_7_DAYS], extensions[i]
        if last.report_time_utc - first.report_time_utc < timedelta(days=7):
            findings.append(_finding('fdp_extension', 'OM-A 7.6.5', 'warning',
                                     'More than two planned extensions in 7 days',
                                     f'{_fmt(first.report_time_utc, tz)} to {_fmt(last.report_time_utc, tz)}: '
                                     f'{EXTENSIONS_PER_7_DAYS + 1} FDPs use a planned extension.',
                                     first.report_time_utc, last.release_time_utc,
                                     EXTENSIONS_PER_7_DAYS + 1, EXTENSIONS_PER_7_DAYS))
    summary['planned_extensions'] = len(extensions)

    # This is a scoped checker, never a compliance certificate. Prior roster history is unknown.
    coverage = {}
    for rule in ('duty_7d', 'duty_14d', 'duty_28d', 'block_28d', 'min_rest', 'recovery_rest',
                 'time_zone_rest', 'disruptive', 'standby'):
        failed = any(f['rule'] == rule and f['severity'] == 'warning' for f in findings)
        coverage[rule] = {'status': 'failed' if failed else 'incomplete_history',
                          'reason': 'Only supplied activities were assessed; boundary history is unknown.'}
    flights = [d for d in duties if d.duty_type == DutyType.FLIGHT and d.segments]
    assessed = sum(d.max_fdp_hours is not None for d in flights)
    coverage['fdp_max'] = {'status': 'not_assessed' if assessed < len(flights) or not flights else
                         ('failed' if any(f['rule'] in ('fdp_max', 'fdp_extension') and f['severity'] == 'warning'
                                          for f in findings) else 'passed'),
                         'assessed': assessed, 'eligible': len(flights),
                         'reason': ('Qatar OM-A 7.6.3 Tables 7-6/7-7, 7.6.5 Table 7-8, 7.6.6 Tables 7-9/7-10 '
                                    'and 7.18. Acclimatisation is derived from the supplied duties (OM-A 7.6.1, '
                                    'assuming acclimatised to the home base before the first duty); duties '
                                    'where it cannot be determined are not assessed. Split duty and standby '
                                    'before the FDP are outside this check.')}
    if not roster.pilot_base:
        coverage['min_rest'] = {'status': 'not_assessed', 'reason': 'Home base identity is missing.'}
    summary['coverage'] = coverage
    summary['status'] = 'findings' if any(f['severity'] == 'warning' for f in findings) else 'partial'
    findings.sort(key=lambda f: (f['severity'] != 'warning', f['window_start_utc'] or ''))
    return dict(findings=findings, summary=summary)
