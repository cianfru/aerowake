"""The pilot's usual night (SleepHabits) replaces the 23:00–07:00 default."""
import io
import itertools
from datetime import datetime

import pytest
import pytz

from core.parameters import ModelConfig, SleepHabits

H = {'X-Guest-Session': 'h' * 40}
# Two daytime turns with days off before: the night before each is the usual night.
CSV = ('Date,Flight,Departure,Arrival,STD,STA,Report,Release\n'
       '2026-10-05,QR1,DOH,RUH,12:00,14:00,11:00,17:00\n'
       '2026-10-09,QR2,DOH,RUH,12:00,14:00,11:00,17:00\n').encode()
_ADDRESSES = itertools.count(10)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from api.api_server import app
    with TestClient(app, client=(f'198.51.100.{next(_ADDRESSES)}', 50000)) as c:
        yield c


def _analyze(client, **data):
    files = {'file': ('roster.csv', io.BytesIO(CSV), 'text/csv')}
    return client.post('/api/analyze', headers=H, files=files, data={'home_base': 'DOH', 'month': '2026-10', **data})


def _main_sleep_local(body, date):
    duty = next(d for d in body['duties'] if d['date'] == date)
    main = next(b for b in duty['sleep_quality']['sleep_blocks'] if b['sleep_type'] == 'main')
    tz = pytz.timezone('Asia/Qatar')
    return [datetime.fromisoformat(main[k]).astimezone(tz).strftime('%H:%M') for k in ('sleep_start_utc', 'sleep_end_utc')]


def test_habits_accept_after_midnight_bedtimes_and_refuse_odd_nights():
    late = SleepHabits.from_clock('00:30', '07:30')
    assert late.bedtime_hour == 24.5 and late.duration_hours == 7.0
    assert late.labels == {'usual_bedtime': '00:30', 'usual_wake_time': '07:30'}
    assert SleepHabits().is_default and SleepHabits().duration_hours == 8.0
    for bed, wake in [('18:00', '06:00'), ('23:00', '03:00'), ('20:00', '11:00'), ('02:00', '06:00'), ('7am', '07:00')]:
        with pytest.raises(ValueError):
            SleepHabits.from_clock(bed, wake)
    assert ModelConfig.aerowake().assumptions['usual_bedtime'] == '23:00'


def test_default_night_and_a_stated_night(client):
    default = _analyze(client)
    assert default.status_code == 200, default.text
    assert _main_sleep_local(default.json(), '2026-10-09') == ['23:00', '07:00']
    own = _analyze(client, usual_bedtime='00:00', usual_wake_time='06:00')
    assert own.status_code == 200, own.text
    body = own.json()
    assert body['assumptions']['usual_bedtime'] == '00:00'
    assert body['assumptions']['usual_wake_time'] == '06:00'
    assert _main_sleep_local(body, '2026-10-09') == ['00:00', '06:00']
    # A shorter usual night is less sleep, so the duty is no less sleepy.
    d_default = next(d for d in default.json()['duties'] if d['date'] == '2026-10-09')
    d_own = next(d for d in body['duties'] if d['date'] == '2026-10-09')
    assert d_own['max_kss'] >= d_default['max_kss']


def test_an_impossible_night_is_refused(client):
    r = _analyze(client, usual_bedtime='18:00', usual_wake_time='06:00')
    assert r.status_code == 422
    assert 'bedtime' in r.json()['detail']
