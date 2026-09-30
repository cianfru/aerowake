"""Pilot-study observations: home zone resolution, enrolment gate, per-record deletion."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from auth.dependencies import get_current_user
from db.session import get_db
from study import config, limits
from study.routes import Observation, build_payload, router

NOW = datetime(2026, 9, 3, 16, tzinfo=timezone.utc)


def body(**changes):
    value = dict(client_id=str(uuid4()), observed_at=NOW.isoformat(), observed_kss=4, home_timezone='Asia/Qatar',
                 sleeps=[dict(start='2026-09-01T22:00:00Z', end='2026-09-02T06:00:00Z'),
                         dict(start='2026-09-02T22:00:00Z', end='2026-09-03T06:00:00Z')],
                 phase='post_duty', prediction_seen=False, actual_sleep=True, complete_diary=True,
                 home_acclimatized=True, consent=True)
    value.update(changes)
    return Observation(**value)


def test_offset_is_derived_from_home_zone_at_rating_time():
    doha = build_payload(body(), NOW)
    assert doha['inputs']['home_utc_offset'] == 3
    london_summer = build_payload(body(home_timezone='Europe/London'), NOW)
    assert london_summer['inputs']['home_utc_offset'] == 1
    assert doha['prediction']['kss'] != london_summer['prediction']['kss']


def test_legacy_typed_offset_still_accepted():
    assert build_payload(body(home_timezone=None, home_utc_offset=3), NOW)['inputs']['home_utc_offset'] == 3


@pytest.mark.parametrize('change', [dict(home_timezone='Mars/Base'), dict(home_timezone=None)])
def test_home_clock_required_and_valid(change):
    with pytest.raises(ValidationError):
        body(**change)


def client_for(user, db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_enrolment_is_required_to_record():
    limits.reset()
    user = SimpleNamespace(id=uuid4(), study_consent_version=None, study_enrolled_at=None, study_withdrawn_at=None)
    with client_for(user, SimpleNamespace()) as client:
        assert client.post('/api/pilot-study/observations', json=body().model_dump(mode='json')).status_code == 403


def test_single_observation_delete_is_owner_scoped():
    limits.reset()
    user = SimpleNamespace(id=uuid4(), study_consent_version=config.CONSENT_VERSION, study_enrolled_at=NOW,
                           study_withdrawn_at=None)
    queries, counts = [], [1, 0]

    async def execute(query):
        queries.append(query)
        return SimpleNamespace(rowcount=counts.pop(0))
    db = SimpleNamespace(execute=execute, commit=AsyncMock(), rollback=AsyncMock())
    with client_for(user, db) as client:
        assert client.delete(f'/api/pilot-study/observations/{uuid4()}').status_code == 204
        assert client.delete(f'/api/pilot-study/observations/{uuid4()}').status_code == 404
    assert all(user.id in q.compile().params.values() for q in queries)
