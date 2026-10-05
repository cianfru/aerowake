"""Pilot sleep edits and the per-block basis shown to the pilot.

Synthetic Doha roster (late turns and one night turn). Each test checks what the
pilot sees after removing, moving or adding a sleep block.
"""
import io
import itertools
from datetime import datetime, timedelta

import pytest

from api.replay import restore, snapshot
from core import BorbelyFatigueModel, ModelConfig
from core.sleep_edits import normalise

H = {'X-Guest-Session': 's' * 40}
LATES = [f'2026-10-{d:02d},QR46{i},{a},{b},{std},{sta},17:15,00:45,'
         for d in (5, 6, 12) for i, (a, b, std, sta) in enumerate([('DOH', 'NJF', '18:30', '20:40'),
                                                                   ('NJF', 'DOH', '21:40', '23:55')])]
NIGHT = ['2026-10-14,QR1238,DOH,RUH,22:45,00:45,21:30,04:15,',
         '2026-10-14,QR1239,RUH,DOH,01:45,03:45,21:30,04:15,2026-10-15']


def _csv(rows):
    head = 'Date,Flight,Departure,Arrival,STD,STA,Report,Release,DepartureDate\n'
    return (head + '\n'.join(rows) + '\n').encode()


_ADDRESSES = itertools.count(10)


def _client():
    """A test client with its own address, so each test has its own rate-limit window."""
    from fastapi.testclient import TestClient
    from api.api_server import app
    return TestClient(app, client=(f'192.0.2.{next(_ADDRESSES)}', 50000))


@pytest.fixture
def client():
    with _client() as c:
        yield c


def _upload(client, **data):
    files = {'file': ('roster.csv', io.BytesIO(_csv(LATES + NIGHT)), 'text/csv')}
    r = client.post('/api/analyze', headers=H, files=files,
                    data={'home_base': 'DOH', 'month': '2026-10', **data})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope='module')
def uploaded():
    with _client() as c:
        return _upload(c)


@pytest.fixture
def _analyze(client, uploaded):
    """The shared analysis with the model's estimates restored (one upload per module)."""
    def fresh(_client=None):
        r = _put(client, uploaded['analysis_id'], [])
        assert r.status_code == 200, r.text
        return r.json()
    return fresh


def _duty(body, date):
    return next(d for d in body['duties'] if d['date'] == date)


def _blocks(duty, kind):
    return [b for b in duty['sleep_quality']['sleep_blocks'] if b['sleep_type'] == kind]


def _put(client, analysis_id, edits):
    return client.put(f'/api/analysis/{analysis_id}/sleep-edits', headers=H, json={'edits': edits})


def test_assumed_nap_states_its_evidence(client, _analyze):
    body = _analyze(client)
    night = _duty(body, '2026-10-14')
    nap = _blocks(night, 'nap')[0]
    assert nap['source'] == 'estimated'
    assert '54 %' in nap['basis'] and 'Signal et al. 2014' in nap['basis']
    assert "'sometimes'" in nap['basis']
    # The main sleep is explained by the duty's strategy, not a per-block note.
    assert _blocks(night, 'main')[0]['basis'] is None


def test_removing_the_assumed_nap(client, _analyze):
    body = _analyze(client)
    night = _duty(body, '2026-10-14')
    nap = _blocks(night, 'nap')[0]
    r = _put(client, body['analysis_id'], [{'id': 'n1', 'action': 'remove', 'kind': 'nap',
                                            'target_start_utc': nap['sleep_start_utc'],
                                            'target_end_utc': nap['sleep_end_utc']}])
    assert r.status_code == 200, r.text
    after = r.json()
    assert after['analysis_id'] == body['analysis_id']
    edited = _duty(after, '2026-10-14')
    assert _blocks(edited, 'nap') == []
    assert 'You removed the assumed nap' in edited['sleep_quality']['explanation']
    assert edited['sleep_quality']['is_user_override'] is True
    assert edited['assumed_nap_hours'] is None
    # Without the nap the pilot is awake longer at report and no less sleepy.
    assert edited['pre_duty_awake_hours'] > night['pre_duty_awake_hours']
    assert edited['max_kss'] >= night['max_kss']
    assert after['sleep_edits'] == [{**after['sleep_edits'][0], 'id': 'n1', 'applied': True}]
    # Other duties keep their estimates.
    assert _duty(after, '2026-10-05')['sleep_quality']['sleep_blocks'] == \
        _duty(body, '2026-10-05')['sleep_quality']['sleep_blocks']
    # The stored analysis serves the edited result.
    got = client.get(f"/api/analysis/{body['analysis_id']}", headers=H)
    assert got.status_code == 200
    assert _blocks(_duty(got.json(), '2026-10-14'), 'nap') == []


def test_moving_a_night_keeps_the_nap_and_uses_the_pilot_times(client, _analyze):
    body = _analyze(client)
    night = _duty(body, '2026-10-14')
    main = _blocks(night, 'main')[0]
    start = datetime.fromisoformat(main['sleep_start_utc']) + timedelta(hours=1)
    end = datetime.fromisoformat(main['sleep_end_utc']) - timedelta(hours=1)
    r = _put(client, body['analysis_id'], [{'action': 'replace', 'target_start_utc': main['sleep_start_utc'],
                                            'target_end_utc': main['sleep_end_utc'],
                                            'start_utc': start.isoformat(), 'end_utc': end.isoformat()}])
    assert r.status_code == 200, r.text
    edited = _duty(r.json(), '2026-10-14')
    mains = _blocks(edited, 'main')
    assert len(mains) == 1 and mains[0]['source'] == 'pilot'
    assert datetime.fromisoformat(mains[0]['sleep_start_utc']) == start
    assert datetime.fromisoformat(mains[0]['sleep_end_utc']) == end
    assert 'You set this sleep' in mains[0]['basis']
    assert len(_blocks(edited, 'nap')) == 1, 'a nap outside the new times stays'
    assert 'Sleep you set' in edited['sleep_quality']['explanation']


def test_adding_a_nap_and_restoring_the_estimates(client, _analyze):
    body = _analyze(client)
    late = _duty(body, '2026-10-12')
    report = datetime.fromisoformat(late['report_time_utc'])
    nap = {'action': 'add', 'kind': 'nap', 'start_utc': (report - timedelta(hours=4)).isoformat(),
           'end_utc': (report - timedelta(hours=3)).isoformat()}
    r = _put(client, body['analysis_id'], [nap])
    assert r.status_code == 200, r.text
    added = [b for b in _blocks(_duty(r.json(), '2026-10-12'), 'nap') if b['source'] == 'pilot']
    assert len(added) == 1 and added[0]['duration_hours'] == pytest.approx(1.0, abs=0.01)
    # An empty list puts the model's estimates back.
    r = _put(client, body['analysis_id'], [])
    assert r.status_code == 200
    assert _duty(r.json(), '2026-10-12')['sleep_quality']['sleep_blocks'] == late['sleep_quality']['sleep_blocks']
    assert r.json()['sleep_edits'] == []


@pytest.mark.parametrize('edit, message', [
    ({'action': 'add', 'kind': 'nap', 'start_utc': '2026-10-14T19:00:00+00:00',
      'end_utc': '2026-10-14T20:00:00+00:00'}, 'overlaps a duty'),
    ({'action': 'add', 'kind': 'nap', 'start_utc': '2026-10-13T10:00:00+00:00',
      'end_utc': '2026-10-13T16:00:00+00:00'}, 'nap must last'),
    ({'action': 'remove'}, 'which sleep'),
    ({'action': 'add', 'kind': 'main', 'start_utc': '2026-10-13T22:00:00',
      'end_utc': '2026-10-14T06:00:00'}, 'UTC offset'),
])
def test_invalid_edits_are_refused(client, _analyze, edit, message):
    body = _analyze(client)
    r = _put(client, body['analysis_id'], [edit])
    assert r.status_code == 422
    assert message in r.json()['detail']


def test_another_session_cannot_edit(client, _analyze):
    body = _analyze(client)
    r = client.put(f"/api/analysis/{body['analysis_id']}/sleep-edits",
                   headers={'X-Guest-Session': 'x' * 40}, json={'edits': []})
    assert r.status_code == 404


def test_edits_carry_over_to_a_new_upload(client, _analyze):
    body = _analyze(client)
    nap = _blocks(_duty(body, '2026-10-14'), 'nap')[0]
    edit = {'action': 'remove', 'kind': 'nap', 'target_start_utc': nap['sleep_start_utc'],
            'target_end_utc': nap['sleep_end_utc']}
    # Re-upload with the edits carried over (what the app does after a crew change).
    import json
    again = _upload(client, sleep_edits=json.dumps([edit]))
    assert _blocks(_duty(again, '2026-10-14'), 'nap') == []
    # An edit that no longer fits (overlaps a duty) is dropped, not an error.
    bad = {'action': 'add', 'kind': 'nap', 'start_utc': '2026-10-14T19:00:00+00:00',
           'end_utc': '2026-10-14T20:00:00+00:00'}
    third = _upload(client, sleep_edits=json.dumps([bad, edit]))
    assert [e['action'] for e in third['sleep_edits']] == ['remove']


def test_snapshot_round_trip_keeps_edits():
    from test_logic_v41 import njf_turn, roster
    r = roster([njf_turn('A', 5), njf_turn('B', 9)])
    model = BorbelyFatigueModel(ModelConfig.aerowake(nap_habit='usually'))
    model.simulate_roster(r)
    nap = next(b for b in model.sleep_strategies['B']['sleep_blocks'] if b['sleep_type'] == 'nap')
    fresh = roster([njf_turn('A', 5), njf_turn('B', 9)])
    fresh.sleep_edits = normalise([{'action': 'remove', 'kind': 'nap', 'target_start_utc': nap['sleep_start_utc'],
                                    'target_end_utc': nap['sleep_end_utc']}], fresh)
    replayed = restore(snapshot(fresh))
    assert replayed.sleep_edits == fresh.sleep_edits
    model = BorbelyFatigueModel(ModelConfig.aerowake(nap_habit='usually'))
    model.simulate_roster(replayed)
    assert not [b for b in model.sleep_strategies['B']['sleep_blocks'] if b['sleep_type'] == 'nap']
    assert replayed.sleep_edit_results[0]['applied'] is True
