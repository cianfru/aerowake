"""Operational safeguards: bounded in-memory store, upload checks, rate limit.

All limits are configurable via environment variables so production can be
tuned without code changes:

    ANALYSIS_STORE_MAX      analyses kept in memory (default 200, LRU)
    MAX_UPLOAD_MB           maximum roster upload size (default 10)
    RATE_LIMIT_PER_MINUTE   POST requests per client IP per minute on
                            compute-heavy endpoints (default 20; 0 disables)
"""
import os
import threading
import time
from collections import OrderedDict, deque
from typing import Deque, Dict

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

MAX_UPLOAD_BYTES = int(float(os.environ.get('MAX_UPLOAD_MB', '10')) * 1024 * 1024)
RATE_LIMIT_PER_MINUTE = int(os.environ.get('RATE_LIMIT_PER_MINUTE', '20'))
RATE_LIMITED_PREFIXES = ('/api/analyze', '/api/what-if', '/api/fatigue-report', '/api/rosters/')


class BoundedStore(OrderedDict):
    """LRU dict: evicts the least recently used analysis beyond ``maxsize``.

    Evicted analyses are reloaded from the database for signed-in users;
    anonymous users re-upload. Keeps memory bounded on long-running servers.
    """

    def __init__(self, maxsize: int = int(os.environ.get('ANALYSIS_STORE_MAX', '200'))):
        super().__init__()
        self.maxsize = maxsize
        self._lock = threading.Lock()

    def __getitem__(self, key):
        with self._lock:
            value = super().__getitem__(key)
            self.move_to_end(key)
            return value

    def __setitem__(self, key, value):
        with self._lock:
            super().__setitem__(key, value)
            self.move_to_end(key)
            while len(self) > self.maxsize:
                self.popitem(last=False)


def validate_upload(content: bytes, suffix: str) -> None:
    """Reject oversized or mislabelled roster files before parsing."""
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413,
                            detail=f'File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).')
    if not content:
        raise HTTPException(status_code=400, detail='The uploaded file is empty.')
    if suffix == '.pdf' and not content[:1024].lstrip().startswith(b'%PDF'):
        raise HTTPException(status_code=400, detail='This file is not a valid PDF.')
    if suffix == '.csv' and b'\x00' in content[:4096]:
        raise HTTPException(status_code=400, detail='This file is not a valid CSV.')


def client_ip(request) -> str:
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window limit per client IP on compute-heavy POST endpoints.

    In-process only: with several server replicas each enforces its own
    window. Sufficient to stop accidental loops and casual abuse; use a
    gateway limit for stronger guarantees.
    """

    def __init__(self, app, per_minute: int = RATE_LIMIT_PER_MINUTE):
        super().__init__(app)
        self.per_minute = per_minute
        self.hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    async def dispatch(self, request, call_next):
        if (self.per_minute > 0 and request.method == 'POST'
                and request.url.path.startswith(RATE_LIMITED_PREFIXES)):
            now = time.monotonic()
            key = client_ip(request)
            with self._lock:
                window = self.hits.setdefault(key, deque())
                while window and now - window[0] > 60:
                    window.popleft()
                if len(window) >= self.per_minute:
                    retry = max(1, int(60 - (now - window[0])))
                    return JSONResponse(status_code=429, headers={'Retry-After': str(retry)},
                                        content={'detail': 'Too many requests. Please wait a minute and try again.'})
                window.append(now)
                if len(self.hits) > 10000:  # drop idle clients
                    for ip in [ip for ip, w in self.hits.items() if not w or now - w[-1] > 60]:
                        del self.hits[ip]
        return await call_next(request)
