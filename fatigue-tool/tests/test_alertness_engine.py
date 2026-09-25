"""KSS-anchored engine (aerowake-4.0-kss): published equations and face validity.

Face-validity anchors are ordinal expectations from the field literature,
not tuned target numbers: rested daytime duties are low risk; night duties
through the WOCL are worse than day duties; repeated short sleep degrades
progressively; acclimatization moves the body clock toward local time.
"""
import math
from datetime import datetime, timedelta

import pytest
import pytz

from core import BorbelyFatigueModel, ModelConfig
from core import alertness as aw
from models.data_models import Airport, FlightSegment, Duty, Roster

UTC = pytz.utc
LGW = Airport('LGW', 'Europe/London')
BCN = Airport('BCN', 'Europe/Madrid')
EDI = Airport('EDI', 'Europe/London')
LON = pytz.timezone('Europe/London')


def local(day, hour):
    return LON.localize(datetime(2026, 9, day) + timedelta(hours=hour)).astimezone(UTC)


def duty(did, day, rep_h, sectors, block=2.0, turn=0.75):
    rep = local(day, rep_h)
    t, segs = rep + timedelta(hours=1), []
    for i, (a, b) in enumerate(sectors):
        segs.append(FlightSegment(f'X{i}', a, b, t, t + timedelta(hours=block)))
        t = segs[-1].scheduled_arrival_utc + timedelta(hours=turn)
    return Duty(did, datetime(2026, 9, day, tzinfo=UTC), rep,
                segs[-1].scheduled_arrival_utc + timedelta(minutes=30), segs, 'Europe/London')


def run(duties):
    m = BorbelyFatigueModel(ModelConfig.operational_config())
    return m, m.simulate_roster(Roster('r', 'p', '2026-09', duties, 'Europe/London', pilot_base='LGW'))


RT = [(LGW, BCN), (BCN, LGW)]
FOUR = [(LGW, EDI), (EDI, LGW), (LGW, EDI), (EDI, LGW)]


def test_published_transfer_and_probability():
    # Ingre et al. (2014): KSS = 9.68 − 0.46·X; P(KSS>k) ordinal logit.
    assert aw.alertness_to_kss(10) == pytest.approx(5.08)
    assert aw.alertness_to_kss(10, 90) == pytest.approx(6.15)
    # Probabilities decrease with k and with alertness.
    probs = [aw.prob_kss_above(8, k) for k in range(1, 9)]
    assert all(a > b for a, b in zip(probs, probs[1:]))
    assert aw.prob_severe(12) < aw.prob_severe(8) < aw.prob_severe(5)
    assert aw.prob_severe(8, 90) > aw.prob_severe(8)


def test_index_is_linear_kss_and_bands_match_thresholds():
    policy = ModelConfig.operational_config().risk_thresholds
    for kss, band in [(3, 'low'), (5.4, 'low'), (6, 'moderate'), (7, 'high'), (8, 'critical'), (9, 'extreme')]:
        assert aw.classify_kss(kss) == band
        assert policy.classify(aw.kss_to_index(kss)) == band
    assert aw.index_to_kss(aw.kss_to_index(6.3)) == pytest.approx(6.3)


def test_homeostat_matches_published_asymptotes():
    s = aw.wake(14.0, 16)
    assert aw.LA < s < 14.0
    assert aw.sleep(s, 8) > aw.sleep(s, 5) > s
    assert aw.sleep(aw.LA, 50) == pytest.approx(aw.HA, abs=0.05)


def test_body_clock_moves_toward_local_time():
    # Home London, fully adapted to +3 h: body clock reads home time + 3.
    t = local(10, 14)
    assert aw.body_clock_hour(t, 'Europe/London', 3.0) == pytest.approx(17.0)
    shift = aw.acclimatize(0.0, 3.0, elapsed_days=1)
    assert shift == pytest.approx(0.9)          # 30 % of the gap per day
    assert aw.acclimatize(0.0, 3.0, 10) == pytest.approx(3.0, abs=0.1)
    # Shortest path across the date line.
    assert aw.acclimatize(11.0, -11.0, 1) > 11.0 or aw.acclimatize(11.0, -11.0, 1) < -11.0


def test_rested_daytime_duty_is_low_risk():
    _, res = run([duty('mid', 10, 9, RT)])
    t = res.duty_timelines[0]
    assert t.max_kss < 5.5
    assert t.risk_thresholds['low'][0] == 55


def test_night_duty_is_worse_than_day_duty_but_not_off_scale():
    _, day = run([duty('mid', 10, 9, RT)])
    _, night = run([duty('night', 10, 23, RT, block=2.5)])
    d, n = day.duty_timelines[0], night.duty_timelines[0]
    assert n.max_kss > d.max_kss + 1.5
    assert 6.0 <= n.max_kss <= 8.5


def test_consecutive_earlies_degrade_progressively():
    _, res = run([duty(f'E{i}', 10 + i, 5.5, FOUR, block=1.25) for i in range(5)])
    kss = [t.max_kss for t in res.duty_timelines]
    assert all(b >= a - 0.05 for a, b in zip(kss, kss[1:]))
    assert kss[-1] - kss[0] > 0.5
    deficits = [t.sleep_deficit_7d['deficit_hours'] for t in res.duty_timelines]
    assert deficits[-1] > deficits[0]


def test_points_carry_kss_and_consistent_index():
    _, res = run([duty('mid', 10, 9, RT)])
    pts = [p for p in res.duty_timelines[0].timeline if not p.is_in_rest]
    for p in pts:
        assert 1 <= p.kss <= 9
        assert p.raw_performance == pytest.approx(aw.kss_to_index(p.kss), abs=0.05)
        assert 0 <= p.p_severe_sleepiness <= 1
        assert p.kss_90 >= p.kss


def test_prior_sleep_wake_check():
    at = local(10, 6)
    good = [aw.SleepInterval(at - timedelta(hours=32), at - timedelta(hours=24)),
            aw.SleepInterval(at - timedelta(hours=9), at - timedelta(hours=1))]
    bad = [aw.SleepInterval(at - timedelta(hours=30), at - timedelta(hours=26)),
           aw.SleepInterval(at - timedelta(hours=6), at - timedelta(hours=2))]
    assert aw.prior_sleep_wake_check(good, at, at + timedelta(hours=10))['passed']
    r = aw.prior_sleep_wake_check(bad, at, at + timedelta(hours=10))
    assert not r['passed']
    assert r['sleep_24h'] == pytest.approx(4)
    assert {c['rule'] for c in r['checks'] if not c['passed']} >= {'sleep_24h', 'sleep_48h'}


def test_overlapping_sleep_is_not_double_counted():
    at = local(10, 12)
    a = aw.SleepInterval(at - timedelta(hours=10), at - timedelta(hours=2))
    b = aw.SleepInterval(at - timedelta(hours=6), at - timedelta(hours=1))
    assert aw.sleep_in_window([a, b], at - timedelta(hours=24), at) == pytest.approx(9)
