"""EASA roster checks, disruptive definitions and standby parsing."""
from datetime import datetime, timedelta

import pytest
import pytz

from core.compliance import EASAComplianceValidator
from core.easa_checks import run_checks, _local_nights
from core.parameters import EASAFatigueFramework
from models.data_models import Airport, Duty, DutyType, FlightSegment, Roster
from parsers.qatar_crewlink_parser import CrewLinkRosterParser

DOH = Airport('DOH', 'Asia/Qatar')
RUH = Airport('RUH', 'Asia/Riyadh')
Q = pytz.timezone('Asia/Qatar')


def at(day, hour, minute=0):
    return Q.localize(datetime(2026, 9, day, 0, 0) + timedelta(hours=hour, minutes=minute)).astimezone(pytz.utc)


def flight_duty(day, rep_h, hours, did=None):
    rep = at(day, rep_h)
    dep = rep + timedelta(hours=1)
    mid = dep + timedelta(hours=(hours - 1.5) / 2)
    segs = [FlightSegment('Q1', DOH, RUH, dep, mid - timedelta(minutes=20)),
            FlightSegment('Q2', RUH, DOH, mid + timedelta(minutes=20), rep + timedelta(hours=hours - 0.5))]
    return Duty(did or f'D{day:02d}{rep_h:02d}', datetime(2026, 9, day), rep, rep + timedelta(hours=hours),
                segs, 'Asia/Qatar')


def roster(duties, standbys=()):
    return Roster('r', 'p', '2026-09', list(duties), 'Asia/Qatar', standbys=list(standbys))


def rules(result, severity='warning'):
    return {f['rule'] for f in result['findings'] if f['severity'] == severity}


def test_duty_60h_in_7_days_breach():
    # 6 x 11h duties on consecutive days = 66h with long nightly rests
    r = run_checks(roster([flight_duty(d, 8, 11) for d in range(1, 7)]))
    assert 'duty_7d' in rules(r)
    assert r['summary']['duty_7d_max'] == pytest.approx(66)


def test_within_limits_and_home_standby_counts_25_percent():
    standby = Duty('SB', datetime(2026, 9, 3), at(3, 6), at(3, 14), [], 'Asia/Qatar',
                   duty_type=DutyType.HOME_STANDBY)
    r = run_checks(roster([flight_duty(1, 8, 8), flight_duty(5, 8, 8)], [standby]))
    assert rules(r) == set()
    assert r['summary']['duty_7d_max'] == pytest.approx(18)  # 8 + 8 + 25% of 8


def test_min_rest_breach_home_base():
    r = run_checks(roster([flight_duty(1, 14, 10), flight_duty(2, 8, 8)]))  # release 00:00 → report 08:00
    assert 'min_rest' in rules(r)


def test_recovery_rest_gap_over_168h():
    # Daily duties for 9 days: no 36h rest with 2 local nights between two recovery rests
    duties = [flight_duty(1, 8, 6)] + [flight_duty(d, 8, 6) for d in range(4, 13)] + [flight_duty(15, 8, 6)]
    r = run_checks(roster(duties))
    assert 'recovery_rest' in rules(r)
    assert r['summary']['recovery_rests'] == 2


def test_local_nights_counting():
    assert _local_nights(at(1, 20), at(3, 9), 'Asia/Qatar') == 2
    assert _local_nights(at(1, 20), at(2, 7), 'Asia/Qatar') == 1
    assert _local_nights(at(1, 23), at(2, 6), 'Asia/Qatar') == 0


@pytest.mark.parametrize('rep,rel,early,late,night', [
    ((5, 0), (13, 0), True, False, False),
    ((5, 59), (13, 0), True, False, False),
    ((6, 0), (14, 0), False, False, False),
    ((4, 30), (12, 0), False, False, True),     # 02:00-04:59 encroached → night duty, not early
    ((14, 0), (23, 0), False, True, False),
    ((14, 0), (22, 59), False, False, False),
    ((17, 0), (1, 59), False, True, False),
    ((20, 0), (2, 30), False, False, True),
])
def test_disruptive_definitions(rep, rel, early, late, night):
    start = at(10, *rep)
    end = at(10, *rel)
    if end <= start:
        end += timedelta(days=1)
    d = Duty('x', datetime(2026, 9, 10), start, end, [], 'Asia/Qatar')
    r = EASAComplianceValidator(EASAFatigueFramework()).is_disruptive_duty(d)
    assert (r['early_start'], r['late_finish'], r['night_duty']) == (early, late, night)


def test_home_standby_column_is_parsed():
    p = CrewLinkRosterParser(timezone_format='local')
    duty = p._parse_column_to_duty(datetime(2026, 9, 22), ['RPT:22:00', 'PSBY', 'DOH', '22:00', '04:00'])
    assert duty.duty_type == DutyType.HOME_STANDBY
    assert duty.report_time_utc.astimezone(Q).strftime('%d %H:%M') == '22 22:00'
    assert duty.release_time_utc.astimezone(Q).strftime('%d %H:%M') == '23 04:00'
