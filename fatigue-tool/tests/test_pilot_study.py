from datetime import datetime, timezone, timedelta
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from study.routes import Observation, build_payload, router
from study.evaluation import evaluate, partition
from auth.dependencies import get_current_user
from db.session import get_db

NOW = datetime(2026,9,3,16,tzinfo=timezone.utc)


def body(**changes):
    value = dict(client_id=str(uuid4()), observed_at=NOW.isoformat(), observed_kss=4,
        home_utc_offset=0, sleeps=[dict(start='2026-09-01T22:00:00Z',end='2026-09-02T06:00:00Z'),
                                  dict(start='2026-09-02T22:00:00Z',end='2026-09-03T06:00:00Z')],
        phase='post_duty', prediction_seen=False, actual_sleep=True, complete_diary=True,
        home_acclimatized=True, consent=True)
    return Observation(**{**value, **changes})


def test_primary_and_exploratory_rules():
    assert build_payload(body(),NOW)['primary_analysis_eligible']
    result = build_payload(body(prediction_seen=True, actual_sleep=False, home_acclimatized=False),NOW+timedelta(hours=1))
    assert not result['primary_analysis_eligible']
    assert len(result['exclusions']) == 4
    assert result['prediction']['parameters']['kss_slope'] == -.46


@pytest.mark.parametrize('change',[dict(consent=False),dict(observed_kss=10),dict(observed_kss=4.5),dict(observed_at='2026-09-03T16:00:00'),dict(home_utc_offset=float('nan'))])
def test_validation(change):
    with pytest.raises(ValidationError): body(**change)


def test_future_rejected():
    with pytest.raises(ValueError): build_payload(body(),NOW-timedelta(hours=1))


def test_auth_required_on_all_endpoints():
    app=FastAPI(); app.include_router(router)
    with TestClient(app) as client:
        for method in ['get','post','delete']:
            kwargs = {'json':body().model_dump(mode='json')} if method == 'post' else {}
            assert getattr(client,method)('/api/pilot-study/observations',**kwargs).status_code == 401


def test_owner_filter_and_idempotent_snapshot():
    user=SimpleNamespace(id=uuid4()); saved={'prediction': {'kss': 4}, 'original': True}
    row=SimpleNamespace(id=uuid4(),payload=saved)
    queries=[]
    async def execute(query):
        queries.append(query)
        return SimpleNamespace(scalar_one_or_none=lambda:row, scalars=lambda:SimpleNamespace(all=lambda:[row]))
    db=SimpleNamespace(execute=execute,commit=AsyncMock())
    app=FastAPI();app.include_router(router)
    app.dependency_overrides[get_current_user]=lambda:user
    app.dependency_overrides[get_db]=lambda:db
    with TestClient(app) as client:
        response=client.post('/api/pilot-study/observations',json=body().model_dump(mode='json'))
        assert response.json()['original'] is True
        assert not db.commit.called
        export=client.get('/api/pilot-study/observations').json()
        assert 'email' not in export and export['participant_id'] != str(user.id)
        assert client.delete('/api/pilot-study/observations').status_code == 200
    assert all(user.id in q.compile().params.values() for q in queries)


def test_evaluation_deduplicates_and_splits_people():
    participants={}
    for i in range(100):
        p=str(i);participants.setdefault(partition(p),p)
    payload=build_payload(body(),NOW)
    exports=[dict(participant_id=p,observations=[dict(id='one',**payload)]) for p in participants.values()]
    result=evaluate(exports+exports)
    assert result['development']['metrics']['n']==1
    assert result['holdout']['metrics']['n']==1
    assert result['holdout']['constant_training_mean']['mae']==0
    assert result['status']=='descriptive_results_not_certification'


def test_save_commits_before_revealing_prediction(monkeypatch):
    import study.routes as routes
    monkeypatch.setattr(routes, 'datetime', SimpleNamespace(now=lambda tz:NOW))
    committed=[]
    rows=[]
    async def execute(query):
        return SimpleNamespace(scalar_one_or_none=lambda:None)
    def add(row):
        row.id=uuid4(); rows.append(row)
    async def commit():
        committed.append(True)
    db=SimpleNamespace(execute=execute,add=add,commit=commit)
    app=FastAPI();app.include_router(router)
    app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=uuid4())
    app.dependency_overrides[get_db]=lambda:db
    with TestClient(app) as client:
        response=client.post('/api/pilot-study/observations',json=body().model_dump(mode='json'))
    assert response.status_code==200
    assert committed == [True]
    assert response.json()['prediction']==rows[0].payload['prediction']
    assert rows[0].payload['inputs']['observed_kss']==4
