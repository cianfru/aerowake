"""Configured operator rest rules beyond the ORO.FTL.235 minimums, OM-A Chapter 7.

Scoped to the supplied activities, like the rest of easa_checks:

* 7.6.6(3)   rest after an FDP extended by in-flight rest: ≥ preceding duty, or 14 h
* 7.13.5(2)  away from base after an FDP with a time difference of 4 h or more: same
* 7.13.5(1)  Table 7-12 local nights of rest at home base after a rotation with ≥ 4 h time
             difference; 3 local nights between east-west / west-east rotations
* 7.13.4     disruptive schedules: late finish / night duty → early start at base needs a
             local night between; 4 or more disruptive duties between two recovery rests
             extend the second to 60 h
* 7.13.6     reduced rest: never below 12 h at base / 10 h away (the ORO minimum check
             reports anything shorter); a rest between that floor and the preceding duty
             is noted as possible reduced rest
* 7.13.7     recurrent extended recovery rest increased to 2 local days twice a month
* 7.11.3(2)  standby other than airport standby: at most 16 h
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

import pytz

from models.data_models import CrewComposition, DutyType

TIME_ZONE_REST_HOURS = 14.0          # 7.6.6(3), 7.13.5(2)
TIME_ZONE_THRESHOLD_HOURS = 4.0      # 7.13.5
EAST_WEST_LOCAL_NIGHTS = 3           # 7.13.5(1)(C)
EAST_WEST_OUT_HOURS = 6.0
EAST_WEST_BACK_HOURS = 4.0
DISRUPTIVE_RECOVERY_HOURS = 60.0     # 7.13.4(2)
DISRUPTIVE_COUNT = 4
HOME_STANDBY_MAX_HOURS = 16.0        # 7.11.3(2)
LOCAL_DAYS_PER_MONTH = 2             # 7.13.7

# Table 7-12: rows by maximum time difference (≤6, >6 ≤9, >9 ≤12 h), columns by time
# elapsed since reporting for the first FDP of the rotation (<48, 48–71:59, 72–95:59, ≥96 h).
TABLE_7_12 = {6: (2, 2, 3, 3), 9: (2, 3, 3, 4), 12: (2, 3, 4, 5)}


def table_7_12(max_difference_hours: float, elapsed_hours: float) -> int:
    row = next((v for limit, v in TABLE_7_12.items() if max_difference_hours <= limit + 1e-9), TABLE_7_12[12])
    col = 0 if elapsed_hours < 48 else 1 if elapsed_hours < 72 else 2 if elapsed_hours < 96 else 3
    return row[col]


def _offset_hours(tz: str, at: datetime) -> float:
    return at.astimezone(pytz.timezone(tz)).utcoffset().total_seconds() / 3600


def _signed_difference(duty, home_tz: str) -> float:
    """Largest time difference (h, + east of base) between home base and the airports of a duty."""
    best = 0.0
    for seg in duty.segments:
        for airport, at in ((seg.departure_airport, seg.scheduled_departure_utc),
                            (seg.arrival_airport, seg.scheduled_arrival_utc)):
            diff = _offset_hours(airport.timezone, at) - _offset_hours(home_tz, at)
            if abs(diff) > abs(best):
                best = diff
    return best


def _fdp_time_difference(duty) -> float:
    """Time difference crossed within one FDP: departure vs every later airport."""
    if not duty.segments:
        return 0.0
    first = duty.segments[0]
    ref = _offset_hours(first.departure_airport.timezone, first.scheduled_departure_utc)
    return max((abs(_offset_hours(s.arrival_airport.timezone, s.scheduled_arrival_utc) - ref)
                for s in duty.segments), default=0.0)


def _full_local_days(start: datetime, end: datetime, tz: str) -> int:
    """Whole local calendar days (00:00–24:00) inside [start, end)."""
    zone = pytz.timezone(tz)
    day = start.astimezone(zone).date()
    count = 0
    while True:
        day_start = zone.localize(datetime(day.year, day.month, day.day))
        if day_start >= end:
            break
        if day_start >= start and zone.localize(datetime(day.year, day.month, day.day) + timedelta(days=1)) <= end:
            count += 1
        day += timedelta(days=1)
    return count


def _rotations(duties: Sequence, base: str) -> List[List]:
    """Flight duties grouped from leaving base to returning to it."""
    rotations, current = [], []
    for d in duties:
        if d.duty_type != DutyType.FLIGHT or not d.segments:
            continue
        current.append(d)
        if d.segments[-1].arrival_airport.code == base:
            rotations.append(current)
            current = []
    if current:
        rotations.append(current)  # still away at the end of the supplied activities
    return rotations


def run(roster, duties: Sequence, activities: Sequence, tz: str,
        recovery: Sequence[Tuple[datetime, datetime]], finding, fmt, h) -> List[Dict]:
    """Qatar rest findings. ``finding``/``fmt``/``h`` are easa_checks' helpers."""
    out: List[Dict] = []
    base = roster.pilot_base

    # ---- 7.6.6(3) / 7.13.5(2) 14 h rest; 7.13.6 possible reduced rest --------------
    for prev, nxt in zip(activities, activities[1:]):
        if not base:
            break
        if prev.duty_type == DutyType.HOME_STANDBY:
            continue
        rest = (nxt.report_time_utc - prev.release_time_utc).total_seconds() / 3600
        at_home = not prev.segments or prev.segments[-1].arrival_airport.code == base
        floor = 12.0 if at_home else 10.0
        augmented = getattr(prev, 'crew_composition', CrewComposition.STANDARD) in (
            CrewComposition.AUGMENTED_3, CrewComposition.AUGMENTED_4) and not getattr(prev, 'is_ulr', False)
        zones = not at_home and _fdp_time_difference(prev) >= TIME_ZONE_THRESHOLD_HOURS - 1e-9
        need = max(prev.duty_hours, TIME_ZONE_REST_HOURS)
        if (augmented or zones) and rest < need - 1e-9:
            why = ('after an FDP extended by in-flight rest (augmented crew)' if augmented
                   else 'away from base after an FDP crossing 4 or more time zones (CS FTL.1.235(b))')
            out.append(finding('min_rest', 'Configured scheme §7.6.6 / §7.13.5 · compare CS FTL.1.235(b)', 'warning', 'Rest shorter than 14 h',
                               f'{h(rest)} between release {fmt(prev.release_time_utc, tz)} and report '
                               f'{fmt(nxt.report_time_utc, tz)}; {why} the minimum is {h(need)}.',
                               prev.release_time_utc, nxt.report_time_utc, rest, round(need, 2)))
        elif nxt.duty_type == DutyType.FLIGHT and floor - 1e-9 <= rest < prev.duty_hours - 1e-9:
            out.append(finding('reduced_rest', 'Configured scheme §7.13.6 · compare ORO.FTL.235(c)', 'warning', 'Reduced rest needs approval and compensation',
                               f'{h(rest)} after a {h(prev.duty_hours)} duty ({fmt(prev.release_time_utc, tz)}). '
                               'This is shorter than the preceding duty. Reduced-rest approval is not verified; '
                               'the configured scheme also requires compensatory rest and a reduced next FDP. '
                               'Those consequences are not assessed here.',
                               prev.release_time_utc, nxt.report_time_utc, rest, round(prev.duty_hours, 2)))

    # ---- 7.13.5(1) Table 7-12 and east-west transitions -----------------------------
    if base:
        home_tz = roster.home_base_timezone
        rotations = _rotations(duties, base)
        previous_crossing: Optional[Tuple[float, datetime]] = None
        for rotation in rotations:
            last = rotation[-1]
            signed = max((_signed_difference(d, home_tz) for d in rotation), key=abs, default=0.0)
            returned = last.segments[-1].arrival_airport.code == base
            next_act = next((a for a in activities if a.report_time_utc >= last.release_time_utc
                             and a is not last), None)
            if returned and next_act is not None:
                rest_nights = _local_nights_between(last.release_time_utc, next_act.report_time_utc, home_tz)
                if abs(signed) >= TIME_ZONE_THRESHOLD_HOURS - 1e-9:
                    elapsed = (last.release_time_utc - rotation[0].report_time_utc).total_seconds() / 3600
                    need = table_7_12(abs(signed), elapsed)
                    if rest_nights < need:
                        out.append(finding('time_zone_rest', 'Configured scheme §7.13.5 · compare CS FTL.1.235(b)', 'warning',
                                           'Too few local nights at base after a time-zone rotation',
                                           f'{rest_nights} local night{"s" if rest_nights != 1 else ""} at base after '
                                           f'returning {fmt(last.release_time_utc, tz)}; a rotation of '
                                           f'{h(elapsed)} with a {abs(signed):.0f} h time difference needs {need}.',
                                           last.release_time_utc, next_act.report_time_utc, rest_nights, need))
            # East-west: a rotation crossing ≥ 6 h one way, then ≥ 4 h the other way.
            if previous_crossing is not None and abs(previous_crossing[0]) >= EAST_WEST_OUT_HOURS - 1e-9 \
                    and abs(signed) >= EAST_WEST_BACK_HOURS - 1e-9 and signed * previous_crossing[0] < 0:
                nights = _local_nights_between(previous_crossing[1], rotation[0].report_time_utc, home_tz)
                if nights < EAST_WEST_LOCAL_NIGHTS:
                    out.append(finding('time_zone_rest', 'Configured scheme §7.13.5 · compare CS FTL.1.235(b)', 'warning',
                                       'East-west transition without 3 local nights',
                                       f'{nights} local night{"s" if nights != 1 else ""} at base before the '
                                       f'{fmt(rotation[0].report_time_utc, tz)} rotation, which crosses time zones '
                                       'in the opposite direction to the previous one; 3 are required.',
                                       previous_crossing[1], rotation[0].report_time_utc, nights, EAST_WEST_LOCAL_NIGHTS))
            if returned:
                previous_crossing = (signed, last.release_time_utc) if abs(signed) >= EAST_WEST_BACK_HOURS - 1e-9 \
                    else None

    # ---- 7.13.4 disruptive schedules -----------------------------------------------
    from core.compliance import EASAComplianceValidator
    validator = EASAComplianceValidator()
    disruptive = {id(d): validator.is_disruptive_duty(d) for d in duties}
    if base:
        for prev, nxt in zip(duties, duties[1:]):
            p, n = disruptive[id(prev)], disruptive[id(nxt)]
            prev_home = not prev.segments or prev.segments[-1].arrival_airport.code == base
            if prev_home and (p['late_finish'] or p['night_duty']) and n['early_start'] \
                    and _local_nights_between(prev.release_time_utc, nxt.report_time_utc, roster.home_base_timezone) < 1:
                out.append(finding('disruptive', 'Configured scheme §7.13.4 · compare CS FTL.1.235(a)', 'warning',
                                   'Late finish or night duty followed by an early start',
                                   f'No local night between release {fmt(prev.release_time_utc, tz)} and the '
                                   f'early start {fmt(nxt.report_time_utc, tz)} at base.',
                                   prev.release_time_utc, nxt.report_time_utc, 0, 1))
    for (a_start, a_end), (b_start, b_end) in zip(recovery, recovery[1:]):
        count = sum(1 for d in duties if a_end <= d.report_time_utc < b_start and disruptive[id(d)]['is_disruptive'])
        length = (b_end - b_start).total_seconds() / 3600
        if count >= DISRUPTIVE_COUNT and length < DISRUPTIVE_RECOVERY_HOURS - 1e-9:
            out.append(finding('disruptive', 'Configured scheme §7.13.4 · compare CS FTL.1.235(a)', 'warning',
                               'Recovery rest after 4 or more disruptive duties shorter than 60 h',
                               f'{count} early starts, late finishes or night duties before the recovery rest '
                               f'from {fmt(b_start, tz)}, which lasts {h(length)}; 60 h are required.',
                               b_start, b_end, length, DISRUPTIVE_RECOVERY_HOURS))

    # ---- 7.13.7 two local days twice a month ----------------------------------------
    if recovery and getattr(roster, 'month', None):
        year, month = map(int, roster.month.split('-'))
        home_tz = roster.home_base_timezone
        zone = pytz.timezone(home_tz)
        month_start = zone.localize(datetime(year, month, 1))
        month_end = zone.localize(datetime(year + (month == 12), month % 12 + 1, 1))
        long_ones = [r for r in recovery if r[0] < month_end and r[1] > month_start
                     and _full_local_days(r[0], r[1], home_tz) >= 2]
        covers_month = activities and activities[0].report_time_utc <= month_start + timedelta(days=3) \
            and activities[-1].release_time_utc >= month_end - timedelta(days=3)
        if covers_month and len(long_ones) < LOCAL_DAYS_PER_MONTH:
            out.append(finding('recovery_rest', 'Configured scheme §7.13.7 · compare ORO.FTL.235(d)', 'warning',
                               'Fewer than two recovery rests of 2 local days this month',
                               f'{len(long_ones)} recovery rest{"s" if len(long_ones) != 1 else ""} in '
                               f'{roster.month} include 2 whole local days; the scheme requires this twice a month.',
                               month_start, month_end, len(long_ones), LOCAL_DAYS_PER_MONTH))

    # ---- 7.11.3(2) home standby at most 16 h ----------------------------------------
    for s in getattr(roster, 'standbys', []):
        hours = (s.release_time_utc - s.report_time_utc).total_seconds() / 3600
        if hours > HOME_STANDBY_MAX_HOURS + 1e-9:
            out.append(finding('standby', 'Configured scheme §7.11.3 · compare CS FTL.1.225(b)', 'warning', 'Standby longer than 16 h',
                               f'Standby from {fmt(s.report_time_utc, tz)} lasts {h(hours)}.',
                               s.report_time_utc, s.release_time_utc, hours, HOME_STANDBY_MAX_HOURS))
    return out


def _local_nights_between(start: datetime, end: datetime, tz: str) -> int:
    from core.easa_checks import _local_nights
    return _local_nights(start, end, tz)
