# AeroWake API

Python 3.12 / FastAPI. Install `requirements.lock` for reproducible development, tests and deployment. `requirements.txt` records direct dependencies for intentional upgrades; it is not the deployment lock.

```sh
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements.lock
uvicorn api.api_server:app --reload --host 127.0.0.1 --port 8000
python -m pytest tests -q
```

Configure `DATABASE_URL`, `JWT_SECRET` and `CORS_ORIGINS` for persisted operation. Run `alembic upgrade head` before API startup; application startup validates revision `003` and does not create or modify schema. Unversioned legacy installations need the baseline procedure in [the deployment guide](../docs/LAUNCH_HARDENING.md).

Core API:

- `POST /api/roster/preview`: parse, validate and reconcile before simulation.
- `POST /api/analyze`: PDF/CSV analysis; explicit `saved`, `failed`, or `session_only` persistence status.
- `GET /api/analysis/{id}`, `/api/duty/{id}/{duty}`, `/api/statistics/{id}` and `POST /api/what-if`: shared ownership enforcement.
- `POST /api/fatigue-report`: stateless report, chronology checks, explicit coverage, normalized inputs and SHA-256 provenance in JSON.
- `/api/auth/*`: login, rotating refresh, email verification, password reset, export, consent and account deletion.
- `/health`: liveness. `/ready`: database readiness. `/`: model/parser/build identity.

Anonymous analysis requires a cryptographically random `X-Guest-Session` header of 32–128 characters. Keep it private, like a bearer credential; it is never a URL parameter. The browser creates it automatically. In-memory guest analyses expire within one hour and may be evicted earlier. Saved analyses authorize against database ownership before cache access.

Canonical times are aware UTC datetimes. Home zone comes from the confirmed airport; unknown codes or conflicting zones are rejected. CSV report/release are in home-base local time; sector times use airport local time. Optional `DepartureDate` and `ArrivalDate` columns resolve date-line cases. Ambiguous/nonexistent local DST times are rejected. See [roster reference](../docs/ROSTER_REFERENCE.md).

Risk thresholds use predicted KSS: low <5.5, moderate <6.5, high <7.5, critical <8.5, extreme ≥8.5. Duty headlines use peak KSS; landing risk is separate. The index is `110 − 10 × KSS`, not cognitive performance percent. Old model indices cannot be converted to current KSS without reanalysis.

Account email requires `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_FROM`, optionally `SMTP_USER` / `SMTP_PASSWORD`, and `PUBLIC_APP_URL`. STARTTLS is required. Links carry single-use tokens in URL fragments; token hashes expire after one hour. Never log email bodies or tokens.

Resource controls: `MAX_UPLOAD_MB` (10), `ANALYSIS_STORE_MAX` (200), `COMPUTE_CONCURRENCY` (2), `RATE_LIMIT_PER_MINUTE` (20). Enforce additional body/rate limits at the ingress and configure Uvicorn's trusted proxy addresses explicitly for your host. Limits/cache are per process. Multiple replicas need shared guest state or sticky routing; use one replica initially and load-test expected traffic.
