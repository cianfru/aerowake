"""Duty debrief API: validation, blinding order, owner scoping, snapshot and export privacy.

All data here is synthetic. PostgreSQL-backed checks run only with a disposable TEST_DATABASE_URL.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

import api.analysis_access as access
from auth.dependencies import get_current_user
from db.session import get_db
from study import config, limits
from study.debriefs import (DebriefIn, build_debrief, export_row, is_flagged, kss_band, router, serialize,
                            stream_for)

NOW = datetime(2026, 9, 30, 12, tzinfo=timezone.utc)
REPORT = datetime(2026, 9, 29, 14, 15, tzinfo=timezone.utc)
RELEASE = REPORT + timedelta(hours=7, minutes=30)


def synthetic_analysis(max_kss=6.62):
    timeline = [dict(t=(REPORT + timedelta(minutes=30 * i)).isoformat(), kss=5.0 + 0.1 * i) for i in range(20)]
    return dict(
        analysis_id='a-synthetic', home_base_timezone='Asia/Qatar', alertness_timeline=timeline,
        duties=[dict(
            duty_id='D20260929', date='2026-09-29', report_time_utc=REPORT.isoformat(),
            release_time_utc=RELEASE.isoformat(), sectors=2, duty_type='flight', model_version='aerowake-4.0-kss',
            max_kss=max_kss, landing_kss=6.32, max_kss_90=7.69, max_hours_awake=15.0, prior_sleep=7.5,
            wocl_hours=0.0,
            segments=[
                dict(flight_number='SYN1', departure='AAA', arrival='BBB', departure_time=(REPORT + timedelta(hours=1)).isoformat(),
                     arrival_time=(REPORT + timedelta(hours=3)).isoformat()),
                dict(flight_number='SYN2', departure='BBB', arrival='AAA', departure_time=(REPORT + timedelta(hours=4)).isoformat(),
                     arrival_time=(REPORT + timedelta(hours=7)).isoformat(), kss_peak=6.62, kss_at_arrival=6.32,
                     risk_level='high'),
            ],
            sleep_quality=dict(sleep_blocks=[
                dict(sleep_start_utc='2026-09-28T23:15:00+00:00', sleep_end_utc='2026-09-29T06:45:00+00:00', sleep_type='main'),
                dict(sleep_start_utc='2026-09-29T11:00:00+00:00', sleep_end_utc='2026-09-29T12:30:00+00:00', sleep_type='nap'),
            ]),
        )])


def body(**changes):
    value = dict(client_id=str(uuid.uuid4()), analysis_id='a-synthetic', duty_id='D20260929',
                 duty_report_utc=REPORT.isoformat(), operation='as_rostered', moment='worst_moment', kss=7,
                 rated_at_utc=(NOW - timedelta(minutes=2)).isoformat(), prediction_seen=False)
    value.update(changes)
    return DebriefIn(**value)


# ── Pure rules ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize('kss,band', [(5.44, 'low'), (5.45, 'moderate'), (6.49, 'high'), (6.44, 'moderate'),
                                      (7.5, 'critical'), (8.46, 'extreme'), (None, None)])
def test_band_uses_value_rounded_to_one_decimal(kss, band):
    assert kss_band(kss) == band


def test_flag_threshold_matches_high_band():
    assert is_flagged(6.45) and not is_flagged(6.44) and is_flagged(None) is None


@pytest.mark.parametrize('hours,stream', [(0.5, 'momentary'), (1, 'momentary'), (6, 'same_day'), (30, 'recalled'), (49, 'late')])
def test_stream_by_recall_delay(hours, stream):
    assert stream_for(hours) == stream


@pytest.mark.parametrize('change', [
    dict(kss=10), dict(kss=6.5), dict(samn_perelli=8), dict(kss=None), dict(moment='cruise'),
    dict(countermeasures=['caffeine', 'caffeine']), dict(countermeasures=['none', 'nap']),
    dict(rated_at_utc='2026-09-30T11:00:00'), dict(note='x' * 501), dict(unexpected=True),
])
def test_request_validation(change):
    with pytest.raises(ValidationError):
        body(**change)


def test_not_operated_needs_no_rating():
    assert body(operation='not_operated', kss=None).kss is None


def test_snapshot_is_taken_from_saved_analysis():
    values = build_debrief(body(moment='top_of_descent', kss=7, sleeps=[
        dict(start_utc='2026-09-27T23:00:00Z', end_utc='2026-09-28T07:00:00Z'),
        dict(start_utc='2026-09-28T23:15:00Z', end_utc='2026-09-29T06:45:00Z'),
        dict(start_utc='2026-09-29T11:00:00Z', end_utc='2026-09-29T12:00:00Z', kind='nap')], sleep_complete=True),
        synthetic_analysis(), NOW)
    forecast = values['payload']['forecast']
    assert forecast['max_kss'] == 6.62 and forecast['risk_level'] == 'high' and forecast['flagged'] is True
    # Top of descent = last flown arrival − 30 min; nearest model sample, not interpolation.
    assert forecast['event_time_utc'] == (REPORT + timedelta(hours=6, minutes=30)).isoformat()
    assert forecast['kss_at_event'] == 6.3
    assert [b['kind'] for b in forecast['estimated_sleep']] == ['main', 'nap']
    assert forecast['report_local_hour'] == 17
    assert values['payload']['published_tpm']['model_version'] == 'ingre2014-5c-v1'
    assert all(s['source'] == 'reported' for s in values['payload']['sleeps'])
    assert values['payload']['duty']['route'] == ['AAA', 'BBB', 'AAA']
    assert values['payload']['quality']['stream'] == 'recalled'  # about 15 h after top of descent


def test_quality_exclusions_and_stream():
    values = build_debrief(body(prediction_seen=True, operation='times_changed', rated_at_utc=(RELEASE + timedelta(minutes=30)).isoformat()),
                           synthetic_analysis(), RELEASE + timedelta(minutes=40))
    assert values['payload']['quality']['stream'] == 'momentary'
    assert values['payload']['quality']['exclusions'] == ['times_changed_from_roster', 'prediction_seen_before_rating']


@pytest.mark.parametrize('change,now,message', [
    (dict(duty_id='D1'), NOW, 'not in the selected analysis'),
    (dict(duty_report_utc=(REPORT + timedelta(hours=1)).isoformat()), NOW, 'not in the selected analysis'),
    (dict(rated_at_utc=(NOW + timedelta(minutes=10)).isoformat()), NOW, 'future'),
    (dict(rated_at_utc=(NOW - timedelta(hours=25)).isoformat()), NOW, 'within 24 hours'),
    (dict(rated_at_utc=(REPORT + timedelta(hours=1)).isoformat()), REPORT + timedelta(hours=2), 'after its planned release'),
    (dict(moment='end_of_duty', rated_at_utc=(RELEASE - timedelta(hours=1)).isoformat()), RELEASE, 'earlier than the moment'),
    (dict(rated_at_utc=(RELEASE + timedelta(days=31)).isoformat()), RELEASE + timedelta(days=31), 'within 30 days'),
    (dict(sleeps=[dict(start_utc='2026-09-29T13:00:00Z', end_utc='2026-09-29T16:00:00Z')]), NOW, 'before the duty report'),
    (dict(sleeps=[dict(start_utc='2026-09-26T00:00:00Z', end_utc='2026-09-26T08:00:00Z')]), NOW, '72 hours'),
    (dict(sleeps=[dict(start_utc='2026-09-28T22:00:00Z', end_utc='2026-09-29T06:00:00Z'),
                  dict(start_utc='2026-09-29T05:00:00Z', end_utc='2026-09-29T07:00:00Z')]), NOW, 'overlap'),
])
def test_rejections(change, now, message):
    with pytest.raises(ValueError, match=message):
        build_debrief(body(**change), synthetic_analysis(), now)


# ── Endpoints (scripted session; owner filter asserted on every query) ──────

class FakeDB:
    def __init__(self, results=()):
        self.results = list(results)
        self.queries = []
        self.added = []
        self.commit = AsyncMock()
        self.rollback = AsyncMock()
        self.scalar = AsyncMock(return_value=0)

    async def execute(self, query):
        self.queries.append(query)
        value = self.results.pop(0) if self.results else None
        rows = value if isinstance(value, list) else ([value] if value else [])
        return SimpleNamespace(scalar_one_or_none=lambda: value if not isinstance(value, list) else None,
                               scalars=lambda: SimpleNamespace(all=lambda: rows), rowcount=len(rows))

    def add(self, row):
        row.id = uuid.uuid4()
        self.added.append(row)


def enrolled(**changes):
    return SimpleNamespace(**{**dict(id=uuid.uuid4(), study_consent_version=config.CONSENT_VERSION,
                                     study_enrolled_at=NOW, study_withdrawn_at=None), **changes})


def client_for(user, db):
    app = FastAPI()
    app.include_router(router)
    if user is not None:
        app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch):
    import study.debriefs as module
    monkeypatch.setattr(module, 'utc_now', lambda: NOW)
    limits.reset()
    yield
    limits.reset()


ROUTES = [('get', '/api/study/enrolment'), ('put', '/api/study/enrolment'), ('delete', '/api/study/enrolment'),
          ('post', '/api/debriefs'), ('get', '/api/debriefs'), ('get', '/api/debriefs/export'),
          ('patch', f'/api/debriefs/{uuid.uuid4()}'), ('delete', f'/api/debriefs/{uuid.uuid4()}'),
          ('delete', '/api/debriefs')]


@pytest.mark.parametrize('method,path', ROUTES)
def test_every_route_requires_sign_in(method, path):
    with client_for(None, FakeDB()) as client:
        kwargs = {'json': {}} if method in ('post', 'put', 'patch') else {}
        assert getattr(client, method)(path, **kwargs).status_code == 401


def test_not_enrolled_or_withdrawn_cannot_save():
    for user in (enrolled(study_consent_version=None), enrolled(study_withdrawn_at=NOW),
                 enrolled(study_consent_version='older-version')):
        with client_for(user, FakeDB()) as client:
            assert client.post('/api/debriefs', json=body().model_dump(mode='json')).status_code == 403


def test_other_owner_analysis_is_404_before_any_json_read(monkeypatch):
    user = enrolled()
    calls = []

    async def authorize(analysis_id, principal, db):
        calls.append(principal.owner)
        raise HTTPException(404, 'Analysis not found')
    monkeypatch.setattr(access, 'authorize', authorize)
    import study.debriefs as module
    monkeypatch.setattr(module, 'build_debrief', lambda *a: pytest.fail('read analysis before authorising'))
    with client_for(user, FakeDB()) as client:
        assert client.post('/api/debriefs', json=body().model_dump(mode='json')).status_code == 404
    assert calls == ['user:' + str(user.id)]


def test_cache_only_analysis_is_refused(monkeypatch):
    monkeypatch.setattr(access, 'authorize', AsyncMock(return_value=None))
    with client_for(enrolled(), FakeDB()) as client:
        assert client.post('/api/debriefs', json=body().model_dump(mode='json')).status_code == 409


def saved_record():
    return SimpleNamespace(analysis_json=synthetic_analysis(), roster_id=uuid.uuid4())


def test_create_saves_rating_then_reveals_server_snapshot(monkeypatch):
    monkeypatch.setattr(access, 'authorize', AsyncMock(return_value=saved_record()))
    user, db = enrolled(), FakeDB([None, None])
    request = body().model_dump(mode='json')
    request['forecast'] = {'max_kss': 1}  # clients cannot supply the snapshot
    with client_for(user, db) as client:
        assert client.post('/api/debriefs', json=request).status_code == 422
        response = client.post('/api/debriefs', json=body().model_dump(mode='json'))
    assert response.status_code == 200, response.text
    saved = db.added[0]
    assert db.commit.await_count == 1
    assert saved.user_id == user.id and saved.consent_version == config.CONSENT_VERSION
    assert response.json()['forecast']['max_kss'] == 6.62 == saved.payload['forecast']['max_kss']
    assert response.json()['kss'] == 7


def test_idempotent_replay_returns_original(monkeypatch):
    user = enrolled()
    original = SimpleNamespace(**build_debrief(body(), synthetic_analysis(), NOW), id=uuid.uuid4(),
                               client_id=uuid.uuid4(), analysis_id='a-synthetic', roster_id=None,
                               felt_vs_prediction=None, consent_version=config.CONSENT_VERSION, created_at=NOW)
    monkeypatch.setattr(access, 'authorize', AsyncMock(side_effect=AssertionError('not needed')))
    db = FakeDB([original])
    with client_for(user, db) as client:
        response = client.post('/api/debriefs', json=body(client_id=str(original.client_id)).model_dump(mode='json'))
    assert response.status_code == 200 and response.json()['id'] == str(original.id)
    assert not db.added and not db.commit.called


def test_duplicate_moment_conflicts(monkeypatch):
    monkeypatch.setattr(access, 'authorize', AsyncMock(return_value=saved_record()))
    with client_for(enrolled(), FakeDB([None, uuid.uuid4()])) as client:
        assert client.post('/api/debriefs', json=body().model_dump(mode='json')).status_code == 409


def test_daily_cap_and_rate_limit(monkeypatch):
    monkeypatch.setattr(access, 'authorize', AsyncMock(return_value=saved_record()))
    db = FakeDB([None])
    db.scalar = AsyncMock(return_value=config.DAILY_ROW_CAP)
    with client_for(enrolled(), db) as client:
        assert client.post('/api/debriefs', json=body().model_dump(mode='json')).status_code == 429
    user = enrolled()
    with client_for(user, FakeDB()) as client:
        codes = [client.get('/api/debriefs').status_code for _ in range(config.READS_PER_MINUTE + 1)]
    assert codes[-1] == 429 and set(codes[:-1]) == {200}


def test_owner_filter_on_list_patch_delete():
    user = enrolled()
    row = SimpleNamespace(**build_debrief(body(), synthetic_analysis(), NOW), id=uuid.uuid4(), client_id=uuid.uuid4(),
                          analysis_id=None, roster_id=None, felt_vs_prediction=None,
                          consent_version=config.CONSENT_VERSION, created_at=NOW)
    db = FakeDB([[row], row, [row], [row]])
    with client_for(user, db) as client:
        assert client.get('/api/debriefs').json()['debriefs'][0]['id'] == str(row.id)
        assert client.patch(f'/api/debriefs/{row.id}', json={'felt_vs_prediction': 'worse'}).json()['felt_vs_prediction'] == 'worse'
        assert client.patch(f'/api/debriefs/{row.id}', json={'kss': 3}).status_code == 422
        assert client.delete(f'/api/debriefs/{row.id}').status_code == 204
        assert client.delete('/api/debriefs').json() == {'deleted': 1}
        assert client.delete(f'/api/debriefs/{uuid.uuid4()}').status_code == 404
    assert all(user.id in q.compile().params.values() for q in db.queries)


def test_export_is_pseudonymised():
    user = enrolled()
    values = build_debrief(body(note='Synthetic free text', countermeasures=['caffeine']), synthetic_analysis(), NOW)
    row = SimpleNamespace(**values, id=uuid.uuid4(), client_id=uuid.uuid4(), analysis_id='a-synthetic',
                          roster_id=uuid.uuid4(), felt_vs_prediction='about_right',
                          consent_version=config.CONSENT_VERSION, created_at=NOW)
    with client_for(user, FakeDB([[row]])) as client:
        export = client.get('/api/debriefs/export').json()
    text = str(export)
    assert export['kind'] == 'duty_debriefs' and export['participant_id'] == limits.participant_id(user.id)
    assert str(user.id) not in text
    for private in ('D20260929', 'SYN1', 'AAA', 'Synthetic free text', '2026-09-29', 'a-synthetic', 'Asia/Qatar'):
        assert private not in text, private
    item = export['debriefs'][0]
    assert item['day_index'] == 0 and item['forecast']['max_kss'] == 6.62 and item['countermeasures'] == ['caffeine']


def test_enrolment_lifecycle():
    user = SimpleNamespace(id=uuid.uuid4(), study_consent_version=None, study_enrolled_at=None, study_withdrawn_at=None)
    db = FakeDB([[1, 2], []])
    with client_for(user, db) as client:
        state = client.get('/api/study/enrolment').json()
        assert state['enrolled'] is False and state['current']['retention'] == config.RETENTION
        assert client.put('/api/study/enrolment', json={'consent_version': 'old', 'accepted': True}).status_code == 409
        assert client.put('/api/study/enrolment', json={'consent_version': config.CONSENT_VERSION, 'accepted': False}).status_code == 422
        joined = client.put('/api/study/enrolment', json={'consent_version': config.CONSENT_VERSION, 'accepted': True}).json()
        assert joined['enrolled'] is True and user.study_enrolled_at == NOW
        left = client.delete('/api/study/enrolment?delete_data=true').json()
    assert left['enrolled'] is False and user.study_withdrawn_at == NOW
    assert left['deleted']['debriefs'] == 2


def test_serialize_round_trip_keeps_snapshot():
    values = build_debrief(body(), synthetic_analysis(), NOW)
    row = SimpleNamespace(**values, id=uuid.uuid4(), client_id=uuid.uuid4(), analysis_id=None, roster_id=None,
                          felt_vs_prediction=None, consent_version=config.CONSENT_VERSION, created_at=NOW)
    out = serialize(row)
    assert out['forecast']['risk_level'] == 'high' and out['analysis_id'] is None
    assert export_row(row, REPORT.date())['day_index'] == 0


# ── Disposable PostgreSQL integration ────────────────────────────────────────

def test_postgres_roster_deletion_keeps_debrief_and_account_deletion_removes_it():
    url = os.environ.get('TEST_DATABASE_URL')
    if not url:
        pytest.skip('Requires disposable PostgreSQL TEST_DATABASE_URL')
    assert 'test' in url.rsplit('/', 1)[-1]
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from api.api_server import app
    from auth.jwt import create_access_token
    from auth.password import hash_password
    from db.models import Analysis, Base, DutyDebrief, Roster, User

    with TestClient(app) as client:
        async def setup():
            engine = create_async_engine(url)
            sessions = async_sessionmaker(engine, expire_on_commit=False)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
            async with sessions() as db:
                owner = User(email='debrief-owner@example.test', password_hash=hash_password('a safe test password'))
                other = User(email='debrief-other@example.test', password_hash=hash_password('a safe test password'))
                db.add_all([owner, other])
                await db.flush()
                roster = Roster(user_id=owner.id, filename='synthetic.csv', month='2026-09')
                db.add(roster)
                await db.flush()
                db.add(Analysis(id='a-synthetic', roster_id=roster.id, analysis_json=synthetic_analysis()))
                await db.commit()
                return engine, sessions, owner.id, other.id, roster.id
        engine, sessions, owner, other, roster = client.portal.call(setup)

        async def override_db():
            async with sessions() as session:
                yield session
        app.dependency_overrides[get_db] = override_db
        access.analysis_store.clear()
        try:
            auth = lambda user: {'Authorization': 'Bearer ' + create_access_token(str(user))}  # noqa: E731
            join = {'consent_version': config.CONSENT_VERSION, 'accepted': True}
            # The autouse fixture freezes the server clock at NOW; rate relative to it, not to the real clock.
            request = body().model_dump(mode='json')
            assert client.post('/api/debriefs', headers=auth(owner), json=request).status_code == 403
            assert client.put('/api/study/enrolment', headers=auth(owner), json=join).status_code == 200
            assert client.put('/api/study/enrolment', headers=auth(other), json=join).status_code == 200
            assert client.post('/api/debriefs', headers=auth(other), json=request).status_code == 404
            saved = client.post('/api/debriefs', headers=auth(owner), json=request)
            assert saved.status_code == 200, saved.text
            assert client.get('/api/debriefs', headers=auth(other)).json()['debriefs'] == []
            assert client.delete(f"/api/debriefs/{saved.json()['id']}", headers=auth(other)).status_code == 404
            assert client.delete(f'/api/rosters/{roster}', headers=auth(owner)).status_code == 204
            kept = client.get('/api/debriefs', headers=auth(owner)).json()['debriefs']
            assert kept[0]['roster_id'] is None and kept[0]['analysis_id'] is None
            assert kept[0]['forecast']['max_kss'] == 6.62
            assert client.request('DELETE', '/api/auth/account', headers=auth(owner),
                                  json={'password': 'a safe test password'}).status_code == 204

            async def remaining():
                async with sessions() as db:
                    return (await db.execute(select(DutyDebrief))).scalars().all()
            assert client.portal.call(remaining) == []
        finally:
            app.dependency_overrides.clear()

            async def teardown():
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.drop_all)
                await engine.dispose()
            client.portal.call(teardown)
