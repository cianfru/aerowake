"""Qatar OM-A 7.6.6 / 7.11 / 7.13 rest rules (core/qatar_rest.py) on synthetic rosters."""
from datetime import datetime, timedelta

import pytest
import pytz

from core.easa_checks import run_checks
from core.qatar_rest import table_7_12
from models.data_models import Airport, CrewComposition, Duty, DutyType, FlightSegment, Roster

Q = pytz.timezone('Asia/Qatar')
DOH, LHR = Airport('DOH', 'Asia/Qatar'), Airport('LHR', 'Europe/London')
BKK, JFK = Airport('BKK', 'Asia/Bangkok'), Airport('JFK', 'America/New_York')
SYD = Airport('SYD', 'Australia/Sydney')


def at(day, hour, minute=0, month=10):
    return Q.localize(datetime(2026, month, day) + timedelta(hours=hour, minutes=minute)).astimezone(pytz.utc)


def leg(dep, arr, report, block, did, month=10):
    off = report + timedelta(hours=1)
    seg = FlightSegment('1', dep, arr, off, off + timedelta(hours=block))
    return Duty(did, report.astimezone(Q).replace(tzinfo=None), report, seg.scheduled_arrival_utc + timedelta(minutes=30),
                [seg], 'Asia/Qatar')


def roster(duties, standbys=(), month='2026-10'):
    return Roster('r', 'p', month, list(duties), 'Asia/Qatar', pilot_base='DOH', standbys=list(standbys))


def found(res, rule, severity='warning'):
    return [f for f in res['findings'] if f['rule'] == rule and f['severity'] == severity]


@pytest.mark.parametrize('diff,elapsed,nights', [
    (4, 30, 2), (6, 50, 2), (6, 80, 3), (6, 100, 3), (7, 50, 3), (9, 75, 3), (9, 96, 4),
    (10, 47, 2), (11, 60, 3), (12, 80, 4), (12, 120, 5)])
def test_table_7_12(diff, elapsed, nights):
    assert table_7_12(diff, elapsed) == nights


def test_rest_after_in_flight_rest_fdp_is_14_hours():
    out = leg(DOH, JFK, at(1, 8), 14.0, 'OUT')
    out.crew_composition = CrewComposition.AUGMENTED_3
    back = leg(JFK, DOH, out.release_time_utc + timedelta(hours=13), 12.5, 'BACK')  # 13 h rest
    res = run_checks(roster([out, back]))
    assert any('7.6.6' in f['detail'] for f in found(res, 'min_rest'))


def test_away_rest_after_four_time_zones_is_14_hours():
    out = leg(DOH, BKK, at(1, 2), 6.5, 'OUT')  # +4 h
    back = leg(BKK, DOH, out.release_time_utc + timedelta(hours=12), 6.5, 'BACK')
    res = run_checks(roster([out, back]))
    assert any('7.13.5' in f['detail'] for f in found(res, 'min_rest'))


def test_rest_between_floor_and_duty_length_is_possible_reduced_rest():
    a = leg(DOH, LHR, at(1, 8), 7.0, 'A')  # duty 8.5 h; LHR is 2 h from DOH
    b = leg(LHR, DOH, a.release_time_utc + timedelta(hours=10), 6.5, 'B')
    c = leg(DOH, LHR, b.release_time_utc + timedelta(hours=12), 7.0, 'C')
    a2 = leg(DOH, LHR, at(5, 8), 13.0, 'LONG')  # duty 14.5 h
    d = leg(LHR, DOH, a2.release_time_utc + timedelta(hours=11), 6.5, 'D')
    res = run_checks(roster([a, b, c, a2, d]))
    assert not found(res, 'min_rest')
    assert found(res, 'reduced_rest', 'info')


def test_table_7_12_local_nights_after_a_far_rotation():
    out = leg(DOH, SYD, at(1, 20), 14.0, 'OUT')  # +7 h in October
    back = leg(SYD, DOH, out.release_time_utc + timedelta(hours=30), 14.5, 'BACK')
    nxt = leg(DOH, LHR, back.release_time_utc + timedelta(hours=40), 7.0, 'NEXT')
    res = run_checks(roster([out, back, nxt]))
    assert found(res, 'time_zone_rest')
    later = leg(DOH, LHR, back.release_time_utc + timedelta(days=4), 7.0, 'LATER')
    assert not found(run_checks(roster([out, back, later])), 'time_zone_rest')


def test_east_west_transition_needs_three_local_nights():
    east_out = leg(DOH, SYD, at(1, 20), 14.0, 'E1')
    east_back = leg(SYD, DOH, east_out.release_time_utc + timedelta(hours=30), 14.5, 'E2')
    west_out = leg(DOH, JFK, east_back.release_time_utc + timedelta(hours=40), 14.0, 'W1')
    res = run_checks(roster([east_out, east_back, west_out]))
    assert any(f['reference'] == 'OM-A 7.13.5(1)(C)' for f in found(res, 'time_zone_rest'))
    west_out = leg(DOH, JFK, east_back.release_time_utc + timedelta(days=5), 14.0, 'W2')
    res = run_checks(roster([east_out, east_back, west_out]))
    assert not any(f['reference'] == 'OM-A 7.13.5(1)(C)' for f in found(res, 'time_zone_rest'))


def turn(report, did):
    """DOH-BAH-DOH turn, 8 h 30 duty."""
    bah = Airport('BAH', 'Asia/Bahrain')
    a = FlightSegment('1', DOH, bah, report + timedelta(hours=1), report + timedelta(hours=4))
    b = FlightSegment('2', bah, DOH, report + timedelta(hours=5), report + timedelta(hours=8))
    return Duty(did, report.astimezone(Q).replace(tzinfo=None), report, report + timedelta(hours=8, minutes=30),
                [a, b], 'Asia/Qatar')


def test_late_finish_then_early_start_needs_a_local_night():
    late = turn(at(1, 15), 'LATE')  # release 23:30 Doha
    early = turn(at(3, 5, 15), 'EARLY')  # local night 2-3 Oct in between
    assert not found(run_checks(roster([late, early])), 'disruptive')
    late2 = turn(at(1, 15), 'LATE2')
    early2 = turn(at(2, 13), 'NEXT')
    early2.report_time_utc, early2.release_time_utc = at(2, 5, 30), at(2, 13, 30)
    for seg, (dep, arr) in zip(early2.segments, ((6.5, 9.5), (10.5, 13))):
        seg.scheduled_departure_utc, seg.scheduled_arrival_utc = at(2, 0) + timedelta(hours=dep), at(2, 0) + timedelta(hours=arr)
    assert found(run_checks(roster([late2, early2])), 'disruptive')


def test_standby_longer_than_16_hours():
    s = Duty('S', datetime(2026, 10, 2), at(2, 6), at(2, 23), [], 'Asia/Qatar', duty_type=DutyType.HOME_STANDBY)
    a = leg(DOH, LHR, at(5, 8), 7.0, 'A')
    assert found(run_checks(roster([a], standbys=[s])), 'standby')


def test_two_local_days_twice_a_month():
    # Duties every 2nd day: each break is a recovery rest (36 h, 2 local nights) with 1 whole local day.
    duties = [leg(DOH, LHR, at(day, 8), 3.0, f'D{day}') for day in range(1, 32, 2)]
    res = run_checks(roster(duties))
    assert any(f['reference'] == 'OM-A 7.13.7' for f in found(res, 'recovery_rest'))
    # Two breaks of 3 days give 2 whole local days twice.
    days = [1, 2, 6, 7, 8, 9, 13, 14, 15, 16, 17, 22, 23, 24, 25, 30]
    duties = [leg(DOH, LHR, at(day, 8), 3.0, f'E{day}') for day in days]
    res = run_checks(roster(duties))
    assert not any(f['reference'] == 'OM-A 7.13.7' for f in found(res, 'recovery_rest'))
