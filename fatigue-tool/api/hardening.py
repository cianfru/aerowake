"""Operational safeguards: bounded in-memory store, upload checks, rate limit.

All limits are configurable via environment variables so production can be
tuned without code changes:

    ANALYSIS_STORE_MAX      analyses kept in memory (default 200, LRU)
    MAX_UPLOAD_MB           maximum roster upload size (default 10)
    RATE_LIMIT_PER_MINUTE   POST requests per client IP per minute on
                            compute-heavy endpoints (default 20; 0 disables)
"""
import os
import asyncio
from starlette.concurrency import run_in_threadpool

_compute_slots = asyncio.Semaphore(int(os.environ.get('COMPUTE_CONCURRENCY', '2')))

async def run_compute(fn, *args, **kwargs):
    try:
        await asyncio.wait_for(_compute_slots.acquire(), timeout=0.2)
    except asyncio.TimeoutError:
        raise HTTPException(503, 'Analysis capacity is busy. Please retry shortly.', headers={'Retry-After': '5'})
    try:
        return await run_in_threadpool(fn, *args, **kwargs)
    finally:
        _compute_slots.release()

async def read_upload(file):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, 'Roster exceeds the upload limit.')
    return content

import threading
import time
from collections import OrderedDict, deque
from typing import Deque, Dict

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

MAX_UPLOAD_BYTES = int(float(os.environ.get('MAX_UPLOAD_MB', '10')) * 1024 * 1024)
RATE_LIMIT_PER_MINUTE = int(os.environ.get('RATE_LIMIT_PER_MINUTE', '20'))
# PUT /api/analysis/{id}/sleep-edits re-runs the model.
RATE_LIMITED_PUT_SUFFIXES = ('/sleep-edits',)
RATE_LIMITED_PREFIXES = ('/api/analyze', '/api/what-if', '/api/fatigue-report', '/api/rosters/', '/api/roster/', '/api/auth/', '/api/duty/', '/api/statistics/')


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
    # Proxy headers are accepted only by uvicorn's configured trusted proxies.
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
        path = request.url.path
        if self.per_minute > 0 and (
                (request.method in ('POST', 'GET') and path.startswith(RATE_LIMITED_PREFIXES))
                or (request.method == 'PUT' and path.endswith(RATE_LIMITED_PUT_SUFFIXES))):
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

class RequestBodyLimit:
    """Bound incoming bytes before multipart parsing can spool an unbounded file."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] not in ('POST', 'PUT', 'PATCH'):
            return await self.app(scope, receive, send)
        limit = MAX_UPLOAD_BYTES + 64 * 1024 if scope['path'] in ('/api/analyze', '/api/roster/preview') else 256 * 1024
        headers = dict(scope.get('headers', []))
        try:
            declared = int(headers.get(b'content-length', b'0'))
        except ValueError:
            declared = limit + 1
        if declared > limit:
            return await JSONResponse({'detail': 'Request body is too large.'}, status_code=413)(scope, receive, send)
        count = 0
        async def bounded_receive():
            nonlocal count
            message = await receive()
            count += len(message.get('body', b''))
            if count > limit:
                # FastAPI/Starlette handles this before route execution.
                raise HTTPException(413, 'Request body is too large.')
            return message
        await self.app(scope, bounded_receive, send)


class RequestTelemetry(BaseHTTPMiddleware):
    """Log only operation, status and latency; never request bodies or token headers."""
    async def dispatch(self, request, call_next):
        import logging
        import uuid
        request_id=uuid.uuid4().hex
        started=time.monotonic()
        response=await call_next(request)
        response.headers['X-Request-ID']=request_id
        route=request.scope.get('route')
        logging.getLogger('aerowake.requests').info(
            'request_id=%s method=%s operation=%s status=%s duration_ms=%.1f',
            request_id,request.method,getattr(route,'path','unmatched'),response.status_code,
            (time.monotonic()-started)*1000)
        return response
