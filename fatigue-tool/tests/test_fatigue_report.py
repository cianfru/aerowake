"""Automatic fatigue report: scenario behaviour, honesty rules and validation."""
from datetime import datetime, timedelta

import pytest
import pytz
from fastapi import FastAPI
from fastapi.testclient import TestClient

from reports.routes import router

LON = pytz.timezone('Europe/London')
app = FastAPI()
app.include_router(router)
client = TestClient(app)


def t(day, hour, minute=0):
    return LON.localize(datetime(2026, 9, day, hour, minute)).astimezone(pytz.utc).isoformat()


def sector(dep, arr, d, h, m, d2, h2, m2, fn='EZY1'):
    return dict(flight_number=fn, departure=dep, arrival=arr, departure_utc=t(d, h, m), arrival_utc=t(d2, h2, m2))


def sleep(d, h, m, d2, h2, m2, **kw):
    return dict(start_utc=t(d, h, m), end_utc=t(d2, h2, m2), **kw)


def base_request(**changes):
    """Pilot calls fatigue before an early on 8 Sep after a late finish on the 7th."""
    body = dict(
        home_base='LGW', event_type='fatigue_call_before_duty', event_time_utc=t(8, 4, 30),
        period_start_utc=t(5, 0), period_end_utc=t(8, 12), affected_duty_id='D8',
        duties=[
            dict(id='D6', report_utc=t(6, 6, 0), release_utc=t(6, 14, 30), source='roster',
                 sectors=[sector('LGW', 'BCN', 6, 7, 0, 6, 9, 0), sector('BCN', 'LGW', 6, 9, 45, 6, 13, 45)]),
            dict(id='D7', report_utc=t(7, 14, 0), release_utc=t(8, 0, 45), source='roster',
                 sectors=[sector('LGW', 'FCO', 7, 15, 0, 7, 18, 30), sector('FCO', 'LGW', 7, 19, 30, 8, 0, 15)]),
            dict(id='D8', report_utc=t(8, 5, 30), release_utc=t(8, 14, 0), status='cancelled_fatigue',
                 sectors=[sector('LGW', 'EDI', 8, 6, 30, 8, 8, 0), sector('EDI', 'LGW', 8, 8, 45, 8, 10, 15),
                          sector('LGW', 'EDI', 8, 11, 0, 8, 12, 30)]),
        ],
        sleeps=[
            sleep(5, 23, 0, 6, 4, 45),
            sleep(6, 22, 30, 7, 7, 0),
            sleep(8, 1, 45, 8, 4, 15, quality=2),
        ],
        self_assessment=dict(kss=8, samn_perelli=6, rated_at_utc=t(8, 4, 30)),
        contributing_factors=['short_rest', 'late_finish', 'early_start'],
        narrative='Could not fall asleep after the late Rome.',
        pilot=dict(name='Test Pilot', rank='FO'),
    )
    body.update(changes)
    return body


def post(body):
    r = client.post('/api/fatigue-report', json=body)
    assert r.status_code == 200, r.text
    return r.json()


def titles(report, severity=None):
    return {f['title'] for f in report['findings'] if severity is None or f['severity'] == severity}


def test_example_identifies_the_problems():
    r = post(base_request())
    found = titles(r)
    assert 'Rest shorter than the regulatory minimum' in found     # 4h45 between D7 and D8
    assert 'Less than 5 h sleep in the 24 h before the duty' in found
    assert 'Prior sleep/wake check failed on multiple criteria' in found
    assert 'Late finish followed by early start' in found
    assert 'Pilot reports significant fatigue' in found
    assert r['summary']['objective_support'] is True
    assert r['summary']['headline'].startswith('Fatigue declaration is supported')
    # Published model: KSS ≈ 6.5 (group mean), ≥ 7 for the 90th-percentile pilot.
    assert r['assessment']['kss_max'] >= 6.0
    assert r['assessment']['kss_max_90'] >= 7.0
    assert 'Predicted sleepiness approaching the severe range' in found
    assert r['data_quality']['confidence'] == 'high'
    assert [p['title'] for p in r['narrative']][0] == 'Event'
    assert r['prior_sleep_wake']['sleep_24h'] == pytest.approx(4.0)  # 05:30–07:00 on the 7th + 2h30


def test_rested_pilot_self_report_is_never_contradicted():
    body = base_request(
        duties=[dict(id='D8', report_utc=t(8, 9, 0), release_utc=t(8, 15, 0),
                     sectors=[sector('LGW', 'BCN', 8, 10, 0, 8, 12, 0), sector('BCN', 'LGW', 8, 12, 45, 8, 14, 45)])],
        sleeps=[sleep(5, 23, 0, 6, 7, 0), sleep(6, 23, 0, 7, 7, 0), sleep(7, 23, 0, 8, 7, 0)],
        event_time_utc=t(8, 7, 30), self_assessment=dict(kss=8, rated_at_utc=t(8, 7, 30)))
    r = post(body)
    assert not r['summary']['objective_support']
    assert "The pilot’s assessment stands" in r['summary']['headline']
    assert 'Pilot rates sleepiness higher than the model predicts' in titles(r)
    assert r['assessment']['kss_max'] < 5.5


def test_estimated_sleep_lowers_confidence_and_is_disclosed():
    body = base_request()
    body['sleeps'][1]['source'] = 'estimated'
    r = post(body)
    assert r['data_quality']['confidence'] == 'medium'
    assert any('estimates' in n for n in r['data_quality']['notes'])


def test_no_model_without_two_sleeps_but_rules_still_run():
    r = post(base_request(sleeps=[sleep(8, 1, 45, 8, 4, 15)]))
    assert r['assessment'] is None and r['timeline'] == []
    assert r['data_quality']['confidence'] == 'low'
    assert 'Rest shorter than the regulatory minimum' in titles(r)


@pytest.mark.parametrize('change', [
    dict(affected_duty_id='nope'),
    dict(sleeps=[sleep(6, 22, 0, 7, 6, 0), sleep(7, 5, 0, 7, 8, 0)]),
    dict(period_end_utc=t(4, 0)),
    dict(contributing_factors=['aliens']),
    dict(home_base=None),
])
def test_invalid_inputs_are_rejected(change):
    assert client.post('/api/fatigue-report', json=base_request(**change)).status_code == 422


def test_unknown_airport_is_disclosed():
    body = base_request()
    body['duties'][0]['sectors'][0]['arrival'] = 'QQZ'
    r = post(body)
    assert any('QQZ' in n for n in r['data_quality']['notes'])
