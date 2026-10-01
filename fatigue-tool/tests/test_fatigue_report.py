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
        diary_complete=True, home_base='LGW', event_type='fatigue_call_before_duty', event_time_utc=t(8, 4, 30),
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
    assert r['summary']['headline'].startswith('The recorded sleep and duty history includes factors consistent')
    # Published model: KSS ≈ 6.5 (group mean), ≥ 7 for the 90th-percentile pilot.
    assert r['assessment']['kss_max'] >= 6.0
    assert r['assessment']['kss_max_90'] >= 7.0
    assert 'Predicted sleepiness in the moderate band' in found  # peak 6.4: canonical band
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


def test_unknown_airport_is_rejected():
    body = base_request()
    body['duties'][0]['sectors'][0]['arrival'] = 'QQZ'
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422
    assert 'Unknown airport QQZ' in response.text


def planning_request(**changes):
    body = base_request(event_type='roster_concern', self_assessment={}, narrative='Early duties have been difficult for me previously.')
    for duty in body['duties']:
        duty['status'] = 'planned'
    for item in body['sleeps']:
        item['source'] = 'estimated'
    body.update(changes)
    return body


def test_roster_concern_combines_planned_records_and_estimates_without_inventing_experience():
    r = post(planning_request())
    assert r['assessment'] and r['data_quality']['prediction_basis'] == 'estimated_sleep'
    assert r['self_assessment'] is None
    assert all(d['status'] == 'planned' for d in r['duties'])
    assert 'Rest shorter than the regulatory minimum' in titles(r)
    assert r['duties'][-1]['rest_before_hours'] == pytest.approx(4.75)
    narrative = ' '.join(p['text'] for p in r['narrative'])
    assert 'prospective fatigue concern' in narrative
    assert 'declared unfit' not in narrative
    assert 'If this duty and sleep scenario occur' in narrative
    assert r['scientific_basis'][0]['url'].endswith('journal.pone.0108679')


def test_personal_reference_changes_watch_dates_not_prediction_or_findings():
    low = post(planning_request(watch_reference_kss=1))
    high = post(planning_request(watch_reference_kss=9))
    assert low['watch_reference']['duty_ids']
    assert not high['watch_reference']['duty_ids']
    assert low['assessment'] == high['assessment']
    assert low['findings'] == high['findings']
    assert low['provenance']['input_sha256'] != high['provenance']['input_sha256']


def test_planning_requires_review_of_complete_sleep_scenario():
    r = post(planning_request(diary_complete=False))
    assert r['assessment'] is None and r['timeline'] == []
    assert r['watch_reference']['duty_ids'] == []
    assert r['pilot_narrative']


def test_actual_report_retains_roster_pattern_evidence_without_claiming_duties_were_flown():
    body = base_request()
    for duty in body['duties'][:-1]:
        duty['status'] = 'planned'
    r = post(body)
    assert 'Rest shorter than the regulatory minimum' in titles(r)
    assert 'Late finish followed by early start' in titles(r)
    assert r['duties'][0]['status'] == 'planned'


def test_planning_rejects_sleep_during_operating_duty():
    body = planning_request()
    body['sleeps'].append(sleep(6, 8, 0, 6, 9, 0, source='estimated'))
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422
    assert 'overlaps planned duty' in response.text


def test_planned_travel_affects_location_only_for_prospective_scenario():
    from reports.engine import LocationTrack
    from reports.routes import FatigueReportRequest, to_input
    body = planning_request()
    body['duties'][0]['sectors'] = [sector('LGW', 'DOH', 6, 7, 0, 6, 13, 0)]
    inp = to_input(FatigueReportRequest(**body))
    when = datetime.fromisoformat(t(6, 14))
    assert LocationTrack(inp.home_timezone, inp.duties).tz_at(when) == 'Europe/London'
    assert LocationTrack(inp.home_timezone, inp.duties, include_planned=True).tz_at(when) == 'Asia/Qatar'


@pytest.mark.parametrize('value', [0, 9.1])
def test_personal_reference_must_be_on_kss_scale(value):
    assert client.post('/api/fatigue-report', json=planning_request(watch_reference_kss=value)).status_code == 422


def test_future_observations_cannot_be_manufactured_by_a_planning_report():
    body = planning_request()
    for key in ('event_time_utc', 'period_start_utc', 'period_end_utc'):
        body[key] = body[key].replace('2026', '2099')
    body.update(duties=[], sleeps=[], affected_duty_id=None, self_assessment={'kss': 8, 'rated_at_utc': body['event_time_utc']})
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422 and 'not future fatigue' in response.text
    body['self_assessment'] = {}
    body['sleeps'] = [sleep(7, 23, 0, 8, 4, 0, source='reported')]
    for key in ('start_utc', 'end_utc'):
        body['sleeps'][0][key] = body['sleeps'][0][key].replace('2026', '2099')
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422 and 'Future sleep must be marked estimated' in response.text


def test_after_duty_report_names_the_sleep_screening_reference_time():
    body = base_request(event_type='fatigue_after_duty', event_time_utc=t(8, 16),
                        period_end_utc=t(8, 18), self_assessment={})
    body['duties'][-1]['status'] = 'operated'
    report = post(body)
    event = next(p['text'] for p in report['narrative'] if p['title'] == 'Event')
    sleep_text = next(p['text'] for p in report['narrative'] if p['title'] == 'Sleep')
    assert 'recorded event or concern time is Tue 08 Sep 16:00' in event
    assert '24 h before duty report at Tue 08 Sep 05:30' in sleep_text
    assert 'before the assessed point' not in sleep_text
    assert report['prior_sleep_wake']['sleep_24h'] == pytest.approx(4.0)


def test_unconfirmed_diary_never_reports_gaps_as_time_awake():
    """Missing sleep entries are unknown, not continuous wakefulness."""
    body = base_request(diary_complete=False)
    r = post(body)
    ss = r['sleep_summary']
    assert ss['hours_awake_at_event'] is None
    assert ss['hours_since_last_sleep'] is not None
    narrative = ' '.join(section['text'] for section in r['narrative'])
    assert 'awake at the event' not in narrative

    confirmed = post(base_request())['sleep_summary']
    assert confirmed['hours_awake_at_event'] == confirmed['hours_since_last_sleep']
