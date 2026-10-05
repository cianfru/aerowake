"""Run against a dedicated disposable PostgreSQL database in CI, never production."""
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from api.api_server import app
from auth.jwt import create_access_token
from auth.password import hash_password
from db.models import Base, User, Roster, Analysis
from db.session import get_db
from api.analysis_access import analysis_store

@pytest.fixture
def database_client():
    url=os.environ.get('TEST_DATABASE_URL')
    if not url:
        pytest.skip('TEST_DATABASE_URL is required for the disposable PostgreSQL integration suite')
    assert 'test' in url.rsplit('/',1)[-1], 'Use a dedicated database named for tests'
    # Deliberately create only synthetic users and rosters.
    with TestClient(app) as client:
        async def setup():
            engine=create_async_engine(url)
            sessions=async_sessionmaker(engine,expire_on_commit=False)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
            async with sessions() as db:
                a=User(email='owner@example.com',password_hash=hash_password('a safe test password'))
                b=User(email='other@example.com',password_hash=hash_password('a safe test password'))
                db.add_all([a,b]);await db.flush()
                r=Roster(user_id=a.id,filename='synthetic.csv',month='2026-09')
                db.add(r);await db.flush()
                db.add(Analysis(id='private-test',roster_id=r.id,analysis_json={'analysis_id':'private-test','marker':'owner only'}))
                await db.commit()
                return engine,sessions,a.id,b.id,r.id
        engine,sessions,owner,other,roster_id=client.portal.call(setup)
        async def override_db():
            async with sessions() as session:
                yield session
        app.dependency_overrides[get_db]=override_db
        analysis_store.clear()
        yield client,owner,other,roster_id
        app.dependency_overrides.clear()
        async def teardown():
            async with engine.begin() as conn: await conn.run_sync(Base.metadata.drop_all)
            await engine.dispose()
        client.portal.call(teardown)

def headers(user):return {'Authorization':'Bearer '+create_access_token(str(user))}

def test_cold_saved_result_requires_owner_and_deletion_revokes(database_client):
    c,a,b,roster=database_client
    assert c.get('/api/analysis/private-test',headers=headers(a)).json()['marker']=='owner only'
    for auth in [headers(b),{'X-Guest-Session':str(uuid.uuid4())}]:
        for path in ['/api/analysis/private-test','/api/duty/private-test/D','/api/statistics/private-test']:
            assert c.get(path,headers=auth).status_code==404
        assert c.post('/api/what-if',headers=auth,json={'analysis_id':'private-test'}).status_code==404
    assert c.delete(f'/api/rosters/{roster}',headers=headers(a)).status_code==204
    assert c.get('/api/analysis/private-test',headers=headers(a)).status_code==404

def test_refresh_rotation_is_single_use_and_account_deletion_revokes(database_client):
    c,a,b,roster=database_client
    login=c.post('/api/auth/login',json={'email':'owner@example.com','password':'a safe test password'})
    assert login.status_code==200,login.text
    tokens=login.json()
    body={'refresh_token':tokens['refresh_token']}
    first=c.post('/api/auth/refresh',json=body)
    assert first.status_code==200,first.text
    assert c.post('/api/auth/refresh',json=body).status_code==401
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:c.post('/api/auth/refresh',json={'refresh_token':first.json()['refresh_token']}).status_code,range(2)))
    assert sorted(results)==[200,401]
    assert c.request('DELETE','/api/auth/account',headers=headers(a),json={'password':'a safe test password'}).status_code==204
    assert c.get('/api/auth/me',headers=headers(a)).status_code==401
    assert c.get('/api/analysis/private-test',headers=headers(a)).status_code==401


def test_verification_and_password_reset_are_one_use_and_revoke_sessions(database_client,monkeypatch):
    c,a,b,roster=database_client
    delivered=[]
    monkeypatch.setenv('SMTP_HOST','test.invalid');monkeypatch.setenv('SMTP_FROM','test@example.test');monkeypatch.setenv('PUBLIC_APP_URL','https://example.test')
    monkeypatch.setattr('auth.account.send_email',lambda address,token,purpose:delivered.append((token,purpose)))
    assert c.post('/api/auth/verification/request',headers=headers(a)).status_code==200
    token,purpose=delivered.pop();assert purpose=='verify'
    assert c.post('/api/auth/verification/confirm',json={'token':token}).status_code==200
    assert c.post('/api/auth/verification/confirm',json={'token':token}).status_code==400
    assert c.get('/api/auth/me',headers=headers(a)).json()['email_verified'] is True
    known=c.post('/api/auth/password-reset/request',json={'email':'owner@example.com'})
    unknown=c.post('/api/auth/password-reset/request',json={'email':'absent@example.com'})
    assert known.json()==unknown.json() and known.status_code==unknown.status_code==200
    token,purpose=delivered.pop();assert purpose=='reset'
    assert c.post('/api/auth/password-reset/confirm',json={'token':token,'password':'a different safe password'}).status_code==200
    assert c.post('/api/auth/password-reset/confirm',json={'token':token,'password':'a different safe password'}).status_code==400
    assert c.get('/api/auth/me',headers=headers(a)).status_code==401
    assert c.post('/api/auth/login',json={'email':'owner@example.com','password':'a different safe password'}).status_code==200


def test_saved_csv_replays_after_cache_eviction_and_reanalysis(database_client):
    c, owner, other, _ = database_client
    csv = b'Date,Flight,Departure,Arrival,STD,STA,Report,Release\n2026-09-08,TEST1,LGW,FCO,08:00,11:00,07:00,12:00\n'
    response = c.post('/api/analyze', headers=headers(owner),
                      files={'file': ('synthetic.csv', csv, 'text/csv')},
                      data={'home_base': 'LGW', 'month': '2026-09'})
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved['persistence_status'] == 'saved'
    assert saved['home_base_timezone'] == 'Europe/London'
    uuid.UUID(saved['roster_id'])
    analysis_id = saved['analysis_id']
    warm_result = c.get(f'/api/analysis/{analysis_id}', headers=headers(owner)).json()
    assert warm_result == saved
    duty_id = saved['duties'][0]['duty_id']
    path = f'/api/duty/{analysis_id}/{duty_id}'
    warm = c.get(path, headers=headers(owner))
    assert warm.status_code == 200, warm.text
    analysis_store.clear()
    assert c.get(f'/api/analysis/{analysis_id}', headers=headers(owner)).json() == saved
    cold = c.get(path, headers=headers(owner))
    assert cold.status_code == 200, cold.text
    assert cold.json() == warm.json()
    assert c.get(path, headers=headers(other)).status_code == 404
    rerun = c.post(f"/api/rosters/{saved['roster_id']}/reanalyze", headers=headers(owner))
    assert rerun.status_code == 200, rerun.text
    assert rerun.json()['persistence_status'] == 'saved'
    assert rerun.json()['duties'] == saved['duties']
    assert c.get(f'/api/analysis/{analysis_id}', headers=headers(owner)).status_code == 200


def test_sleep_changes_are_saved_with_the_analysis(database_client):
    c, owner, other, _ = database_client
    csv = (b'Date,Flight,Departure,Arrival,STD,STA,Report,Release\n'
           b'2026-09-08,TEST1,LGW,FCO,08:00,11:00,07:00,12:00\n'
           b'2026-09-10,TEST2,LGW,FCO,08:00,11:00,07:00,12:00\n')
    saved = c.post('/api/analyze', headers=headers(owner), files={'file': ('synthetic.csv', csv, 'text/csv')},
                   data={'home_base': 'LGW', 'month': '2026-09'}).json()
    analysis_id, duty = saved['analysis_id'], saved['duties'][1]
    main = next(b for b in duty['sleep_quality']['sleep_blocks'] if b['sleep_type'] == 'main')
    from datetime import datetime, timedelta
    start = datetime.fromisoformat(main['sleep_start_utc']) + timedelta(hours=1)
    edit = {'id': 'm1', 'action': 'replace', 'target_start_utc': main['sleep_start_utc'],
            'target_end_utc': main['sleep_end_utc'], 'start_utc': start.isoformat(),
            'end_utc': main['sleep_end_utc']}
    path = f'/api/analysis/{analysis_id}/sleep-edits'
    assert c.put(path, headers=headers(other), json={'edits': [edit]}).status_code == 404
    r = c.put(path, headers=headers(owner), json={'edits': [edit]})
    assert r.status_code == 200, r.text
    assert r.json()['persistence_status'] == 'saved'

    def pilot_start(body):
        blocks = next(d for d in body['duties'] if d['duty_id'] == duty['duty_id'])['sleep_quality']['sleep_blocks']
        return [b['sleep_start_utc'] for b in blocks if b['source'] == 'pilot']

    assert pilot_start(r.json()) == [start.isoformat()]
    analysis_store.clear()
    assert pilot_start(c.get(f'/api/analysis/{analysis_id}', headers=headers(owner)).json()) == [start.isoformat()]
    cold = c.get(f"/api/duty/{analysis_id}/{duty['duty_id']}", headers=headers(owner))
    assert cold.status_code == 200, cold.text
    # The stored inputs carry the change into a reanalysis.
    rerun = c.post(f"/api/rosters/{saved['roster_id']}/reanalyze", headers=headers(owner))
    assert rerun.status_code == 200, rerun.text
    assert pilot_start(rerun.json()) == [start.isoformat()]
    assert rerun.json()['sleep_edits'][0]['id'] == 'm1'
