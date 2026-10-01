"""Fatigue report 1.3: future-duty guards, canonical bands, event-anchored sleep
summary, flight numbers, operational fields and the provisional curve.

All fixtures are synthetic.
"""
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_fatigue_report import base_request, client, planning_request, post, sleep, t, titles


def iso(dt):
    return dt.isoformat()


def future_request(**changes):
    """A duty that starts tomorrow, with the event before it."""
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    report = now + timedelta(days=1)
    body = dict(
        home_base='LGW', event_type='roster_concern', event_time_utc=iso(report),
        period_start_utc=iso(report - timedelta(days=3)), period_end_utc=iso(report + timedelta(hours=18)),
        affected_duty_id='F1', diary_complete=False,
        duties=[dict(id='F1', report_utc=iso(report), release_utc=iso(report + timedelta(hours=9)), status='planned',
                     sectors=[dict(flight_number='EZY801', departure='LGW', arrival='BCN',
                                   departure_utc=iso(report + timedelta(hours=1)),
                                   arrival_utc=iso(report + timedelta(hours=3)))])],
        sleeps=[],
    )
    body.update(changes)
    return body


def test_roster_concern_about_a_future_duty_is_accepted():
    assert client.post('/api/fatigue-report', json=future_request()).status_code == 200


@pytest.mark.parametrize('event_type', ['fatigue_call_before_duty', 'fatigue_during_duty', 'fatigue_after_duty'])
def test_retrospective_event_cannot_be_in_the_future(event_type):
    response = client.post('/api/fatigue-report', json=future_request(event_type=event_type))
    assert response.status_code == 422
    assert 'must be in the past' in response.text


def test_future_duty_cannot_be_marked_operated():
    body = future_request()
    body['duties'][0]['status'] = 'operated'
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422 and 'cannot be marked operated' in response.text


def test_fatigue_call_can_cancel_an_upcoming_duty_but_a_concern_cannot():
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    body = future_request(event_type='fatigue_call_before_duty', event_time_utc=iso(now - timedelta(minutes=10)))
    body['duties'][0]['status'] = 'cancelled_fatigue'
    assert client.post('/api/fatigue-report', json=body).status_code == 200
    body = future_request()
    body['duties'][0]['status'] = 'cancelled_fatigue'
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422 and 'has not started yet' in response.text


def test_fatigue_during_duty_needs_the_duty_and_a_time_inside_it():
    body = base_request(event_type='fatigue_during_duty', affected_duty_id=None)
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422 and 'Select the duty' in response.text
    body = base_request(event_type='fatigue_during_duty', affected_duty_id='D7', event_time_utc=t(7, 12),
                        self_assessment={})
    response = client.post('/api/fatigue-report', json=body)
    assert response.status_code == 422 and 'between that duty' in response.text
    body = base_request(event_type='fatigue_during_duty', affected_duty_id='D7', event_time_utc=t(7, 22),
                        self_assessment={})
    body['duties'][1]['status'] = 'operated'
    assert client.post('/api/fatigue-report', json=body).status_code == 200


def test_phase_of_flight_only_for_fatigue_during_duty():
    response = client.post('/api/fatigue-report', json=base_request(phase_of_flight='cruise'))
    assert response.status_code == 422 and 'Phase of flight' in response.text


def test_operational_fields_are_echoed_with_labels_and_in_the_narrative():
    r = post(base_request(crew_position='first_officer', pilot_role='pilot_monitoring',
                          mitigations=['caffeine', 'informed_operator', 'caffeine'],
                          effect_on_operation='duty_not_operated',
                          suggested_action='Review late-to-early transitions on this pattern.'))
    op = r['operational']
    assert op['crew_position_label'] == 'First officer'
    assert [m['code'] for m in op['mitigations']] == ['caffeine', 'informed_operator']
    assert op['effect_on_operation_label'] == 'Duty not operated'
    text = next(p['text'] for p in r['narrative'] if p['title'] == 'Operational context (pilot)')
    assert 'Mitigations taken: Caffeine, Informed crew control / duty manager.' in text
    assert 'Suggested action: Review late-to-early' in text


def test_unknown_operational_codes_are_rejected():
    assert client.post('/api/fatigue-report', json=base_request(mitigations=['coffee_machine'])).status_code == 422
    assert client.post('/api/fatigue-report', json=base_request(effect_on_operation='maybe')).status_code == 422


def test_flight_numbers_label_the_duty_and_the_year_is_available():
    body = base_request()
    for i, s in enumerate(body['duties'][2]['sectors']):
        s['flight_number'] = f'EZY{801 + i}'
    r = post(body)
    row = next(d for d in r['duties'] if d['id'] == 'D8')
    assert row['flights'] == ['EZY801', 'EZY802', 'EZY803']
    assert row['flights_label'] == 'EZY801/802/803'
    assert r['event']['affected_duty_label'] == 'Tue 08 Sep 05:30 EZY801/802/803 LGW → EDI → LGW → EDI'
    assert r['event']['time_local_long'] == 'Tue 08 Sep 2026 04:30'
    assert r['event']['utc_offset'] == 'UTC+1'


def test_manual_duty_without_sectors_is_named_by_its_type():
    body = base_request()
    body['duties'][0]['sectors'] = []
    r = post(body)
    assert r['duties'][0]['route'] == 'Flight duty'


def test_sleep_summary_is_anchored_to_the_event_and_split_by_source():
    body = base_request()
    body['sleeps'][1]['source'] = 'estimated'
    ss = post(body)['sleep_summary']
    assert ss['sleep_24h'] == pytest.approx(5.0)          # 04:30 on the 7th → 04:30 on the 8th
    assert ss['sleep_72h'] == pytest.approx(16.75)
    assert ss['estimated_72h'] == pytest.approx(8.5)
    assert ss['reported_72h'] == pytest.approx(8.25)
    assert ss['basis'] == 'mixed'
    assert ss['last_wake_local'] == 'Tue 08 Sep 04:15'
    assert ss['hours_awake_at_event'] == pytest.approx(0.25)


def test_prediction_finding_follows_canonical_bands_and_headline_uses_peak_band():
    r = post(base_request())
    band = r['assessment']['risk_level']
    assert r['summary']['overall_level'] == band
    assert f'Predicted sleepiness in the {band} band' in titles(r)
    assert r['summary']['highest_severity'] == 'critical'  # the pilot's own rating


def test_estimated_sleep_alone_never_produces_a_critical_sleep_finding():
    r = post(planning_request())
    sleep_or_prediction = [f for f in r['findings'] if f['category'] in ('sleep', 'prediction')]
    assert sleep_or_prediction
    assert all(f['severity'] != 'critical' for f in sleep_or_prediction)
    multi = next(f for f in r['findings'] if f['title'] == 'Prior sleep/wake check failed on multiple criteria')
    assert multi['severity'] == 'warning'
    assert multi['detail'].startswith('Based on estimated sleep')


def test_provisional_curve_without_diary_confirmation_keeps_assessment_withheld():
    r = post(planning_request(diary_complete=False))
    assert r['timeline'] == [] and r['assessment'] is None
    assert r['provisional_timeline'], 'illustrative curve should be available'
    assert all(d['predicted_kss_max'] is None for d in r['duties'])


def test_confirmed_empty_days_are_described_as_confirmed():
    body = base_request(period_start_utc=t(4, 0))
    notes = ' '.join(post(body)['data_quality']['notes'])
    assert 'No sleep recorded on 04 Sep 2026 (the pilot confirmed the diary is complete).' in notes


def test_headline_is_neutral_and_free_of_jargon():
    r = post(base_request())
    text = ' '.join(p['text'] for p in r['narrative'])
    assert 'initialization' not in text
    assert 'declaration is supported' not in r['summary']['headline']
    assert 'last wake Tue 08 Sep 04:15' in text


def test_reported_sleep_before_event_keeps_critical_prediction_possible():
    """A pilot-confirmed history can still reach critical; only estimates are capped."""
    body = base_request(sleeps=[sleep(5, 23, 0, 6, 1, 0), sleep(7, 3, 0, 7, 4, 0)],
                        event_time_utc=t(8, 4, 30))
    r = post(body)
    assert r['data_quality']['prediction_basis'] == 'reported_sleep'
    assert all('not all confirmed' not in f['detail'] for f in r['findings'])
