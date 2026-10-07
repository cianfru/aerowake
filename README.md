# AeroWake

Roster review and fatigue reporting for pilots. Predictions use `aerowake-4.2-kss`; they are estimates, not fitness-for-duty decisions or compliance certification.

- `fatigue-tool`: Python 3.12 / FastAPI, parsers, model, reports and PostgreSQL persistence.
- `fatigue-insight-hub`: Node 22 / React / TypeScript / Vite.
- [Launch hardening and deployment](docs/LAUNCH_HARDENING.md): changes, schema migration and remaining release gates.
- [Product and mobile audit](docs/PRODUCT_AUDIT.md): implemented improvements, cited BAM/SAFTE comparison and remaining validation work.
- [Scientific source audit](docs/SCIENCE_SOURCE_AUDIT.md): identified publications, corrected citations and unresolved records.
- [Roster reference format](docs/ROSTER_REFERENCE.md): UTC CrewLink interpretation, reviewed totals and validation boundaries.

## Local development

```sh
cd fatigue-tool
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements.lock
uvicorn api.api_server:app --reload --host 127.0.0.1 --port 8000
```

Without `DATABASE_URL` the API runs in guest mode. `/health` checks liveness; `/ready` returns 503 until persistence is configured. With a database, set a random `JWT_SECRET` of at least 32 characters and migrate before starting:

```sh
alembic upgrade head
```

In another terminal:

```sh
cd fatigue-insight-hub
npm ci
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

Set `CORS_ORIGINS` on the API if the frontend uses a different origin from the built-in local development origins. The map uses bundled Natural Earth geometry and d3-geo; no Mapbox token is required.

## Verification

```sh
# fatigue-tool
python -m pytest tests -q
pip-audit -r requirements.lock
# fatigue-insight-hub
npm run typecheck
npm run lint
npm test
npm run build
npm run audit:dependencies
```

The PostgreSQL tests require `TEST_DATABASE_URL` pointing to a **disposable database whose name contains `test`**. They delete its public schema. CI provisions that database and exercises migrations, ownership, deletion, refresh races and account recovery. Never point these tests at live data.

Keep real roster files, identifiers, study records and secrets out of Git. Use synthetic fixtures for regression tests.
