"""Private in-flight logging never grants or retroactively expands study consent."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth.dependencies import get_current_user
from db.session import get_db
from study import config, limits
from study.inflight import router

NOW = datetime(2026, 10, 7, 12, tzinfo=timezone.utc)


@pytest.mark.parametrize('version,withdrawn,age,expected', [
    (None, False, 0, False),
    ('calibration-v2', False, 0, False),
    (config.CONSENT_VERSION, True, 0, False),
    (config.CONSENT_VERSION, False, 0, True),
    (config.CONSENT_VERSION, False, 2, False),
])
def test_personal_ratings_are_saved_without_enrolment(monkeypatch, version, withdrawn, age, expected):
    limits.reset()
    monkeypatch.setattr('study.inflight.utc_now', lambda: NOW)
    user = SimpleNamespace(id=uuid4(), study_consent_version=version,
                           study_enrolled_at=NOW - timedelta(hours=1) if version else None,
                           study_withdrawn_at=NOW if withdrawn else None)
    before = (user.study_consent_version, user.study_enrolled_at, user.study_withdrawn_at)
    added = []

    def add(row):
        row.id = uuid4()
        added.append(row)

    empty = SimpleNamespace(scalars=lambda: [])
    db = SimpleNamespace(execute=AsyncMock(return_value=empty), scalar=AsyncMock(return_value=0),
                         add=add, commit=AsyncMock(), rollback=AsyncMock())
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        response = client.post('/api/inflight-log', json={'entries': [{
            'client_id': str(uuid4()), 'recorded_at_utc': (NOW - timedelta(hours=age)).isoformat(),
            'kss': 6, 'recorded_offline': True,
        }]})
    assert response.status_code == 200, response.text
    assert response.json()['results'][0]['entry']['study_enrolled'] is expected
    assert len(added) == 1 and added[0].study_enrolled is expected
    assert (user.study_consent_version, user.study_enrolled_at, user.study_withdrawn_at) == before
    db.commit.assert_awaited_once()
