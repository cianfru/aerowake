"""Per-pilot request limits for study endpoints.

The global IP middleware (api/hardening.py) covers compute-heavy routes; study
routes are cheap but store health-related data, so they are bounded per account:
a sliding one-minute window in process, and a rolling 24-hour row cap in the database.
"""
import hashlib
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select

from study import config

_lock = threading.Lock()
_hits: dict = {}


def hash_hex(text):
    return hashlib.sha256(text.encode()).hexdigest()


def participant_id(user_id):
    """Stable pseudonym for exports; not anonymous (dates and sleep histories remain)."""
    return hash_hex(config.PARTICIPANT_SALT + str(user_id))[:24]


def throttle(user_id, bucket, per_minute):
    now = time.monotonic()
    key = (bucket, str(user_id))
    with _lock:
        window = _hits.setdefault(key, deque())
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= per_minute:
            retry = max(1, int(60 - (now - window[0])))
            raise HTTPException(429, 'Too many study requests. Please wait a minute and try again.',
                                headers={'Retry-After': str(retry)})
        window.append(now)
        if len(_hits) > 10000:
            for stale in [k for k, w in _hits.items() if not w or now - w[-1] > 60]:
                del _hits[stale]


def reset():
    with _lock:
        _hits.clear()


async def enforce_daily_cap(db, model, user_id, now=None):
    now = now or datetime.now(timezone.utc)
    count = await db.scalar(select(func.count()).select_from(model).where(
        model.user_id == user_id, model.created_at > now - timedelta(hours=24)))
    if (count or 0) >= config.DAILY_ROW_CAP:
        raise HTTPException(429, f'Daily limit reached ({config.DAILY_ROW_CAP} study entries in 24 hours). '
                                 'Please continue tomorrow.', headers={'Retry-After': '3600'})
