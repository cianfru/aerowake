from datetime import datetime, timezone, timedelta
from math import exp, log, cos, pi
import pytest
from core.published_tpm import predict, sleep, wake, PARAMETERS


def dt(day, hour):
    return datetime(2026, 9, day, hour, tzinfo=timezone.utc)


def test_independent_reference_vector():
    # Direct scalar evaluation of the paper, independently of model helpers.
    g = log(.3/6.34)/8
    c = lambda h: 2.5*cos(2*pi/24*(h-16.8))
    u = lambda h: -.5+.5*cos(2*pi/12*(h-16.8-3))
    s0 = 8.38-c(22)-u(22)
    bt = (12.2-s0)/(g*(-2.1))
    s1 = 14.3-2.1*exp(g*(8-bt))
    s2 = 2.4+(s1-2.4)*exp(-.0353*16)
    bt2 = (12.2-s2)/(g*(-2.1))
    s3 = 14.3-2.1*exp(g*(8-bt2))
    final = 2.4+(s3-2.4)*exp(-.0353*10)
    expected = 9.68-.46*(final+c(16)+u(16))
    result = predict(dt(3,16), [(dt(1,22),dt(2,6)),(dt(2,22),dt(3,6))],0)
    assert result['kss_raw'] == pytest.approx(expected, abs=1e-10)
    assert 1 < result['kss'] < 7


def test_brake_continuity_and_recovery():
    s = 8
    bt = (12.2-s)/(PARAMETERS['g']*(-2.1))
    assert sleep(s,bt) == pytest.approx(12.2)
    assert sleep(s,bt-1e-7) == pytest.approx(sleep(s,bt+1e-7), abs=1e-6)
    assert sleep(13,0) == pytest.approx(13)
    assert 13 < sleep(13,4) < 14.3
    assert wake(12,8) < wake(12,4) < 12


def test_sleep_loss_increases_sleepiness_at_same_clock_time():
    rested = predict(dt(3,16), [(dt(1,22),dt(2,6)),(dt(2,22),dt(3,6))],0)
    restricted = predict(dt(3,16), [(dt(2,2),dt(2,6)),(dt(3,2),dt(3,6))],0)
    assert restricted['kss'] > rested['kss']


def test_offset_representation_does_not_change_prediction():
    periods = [(dt(1,22),dt(2,6)),(dt(2,22),dt(3,6))]
    shifted = [(s.astimezone(timezone(timedelta(hours=3))),e.astimezone(timezone(timedelta(hours=3)))) for s,e in periods]
    assert predict(dt(3,16),periods,3) == predict(dt(3,16),shifted,3)


@pytest.mark.parametrize('periods', [[], [(dt(1,22),dt(2,6))], [(dt(1,22),dt(2,6)),(dt(2,5),dt(2,8))], [(dt(1,22),dt(2,6)),(dt(3,20),dt(4,6))]])
def test_invalid_sleep_rejected(periods):
    with pytest.raises(ValueError):
        predict(dt(3,16),periods,0)


def test_extended_wake_flagged_and_output_bounded():
    result = predict(dt(4,23),[(dt(1,22),dt(2,6)),(dt(2,22),dt(3,6))],0)
    assert 'more_than_16_hours_since_sleep' in result['flags']
    assert 1 <= result['kss'] <= 9
