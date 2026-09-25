"""Operational safeguards: LRU store, upload validation, rate limiting."""
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from api.hardening import BoundedStore, RateLimitMiddleware, validate_upload


def test_bounded_store_evicts_least_recently_used():
    store = BoundedStore(maxsize=2)
    store['a'], store['b'] = 1, 2
    _ = store['a']            # touch a
    store['c'] = 3            # evicts b
    assert list(store) == ['a', 'c']
    assert 'b' not in store


@pytest.mark.parametrize('content,suffix,status', [
    (b'', '.pdf', 400),
    (b'hello', '.pdf', 400),
    (b'Date,Flight\x00', '.csv', 400),
    (b'%PDF' + b'0' * (11 * 1024 * 1024), '.pdf', 413),
])
def test_upload_validation_rejects(content, suffix, status):
    with pytest.raises(HTTPException) as exc:
        validate_upload(content, suffix)
    assert exc.value.status_code == status


def test_upload_validation_accepts_real_types():
    validate_upload(b'%PDF-1.7 ...', '.pdf')
    validate_upload(b'Date,Flight,Departure\n', '.csv')


def test_rate_limit_only_on_heavy_posts():
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, per_minute=2)

    @app.post('/api/fatigue-report')
    def report():
        return {}

    @app.get('/health')
    def health():
        return {}

    c = TestClient(app)
    assert [c.post('/api/fatigue-report').status_code for _ in range(3)] == [200, 200, 429]
    assert all(c.get('/health').status_code == 200 for _ in range(5))
