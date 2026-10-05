# Launch hardening

This branch implements the engineering fixes from the September 2026 audit. It does not constitute a production deployment or independent operational/scientific approval.

## Audit traceability

| Findings | Implementation | Remaining release evidence |
|---|---|---|
| AW-01 | Shared owner authorization for cached/cold analysis, detail, statistics and scenarios; durable deletion check and guest capability | PostgreSQL isolation/refresh/deletion tests run in CI |
| AW-02 | Resolved base zone, strict airports, UTC chronology, DST rejection and explicit CSV sector dates | More independently reviewed operator formats |
| AW-03, AW-08 | Peak-duty risk separate from landing; one boundary convention; UI derives watch list from peak KSS | Current-model snapshots should be reanalysed for corrected risk summaries |
| AW-04 | Bounded report periods, contained sectors, non-overlapping duties/sleep, explicit standby and augmented rest context | Operator-approved rest schemes remain outside scope |
| AW-05–07 | FDP ends at last operating arrival; corrected basic table; explicit crew/acclimatization coverage; home airport identity and recovery boundaries; no blanket all-clear | Independent FTL review and complete surrounding roster history |
| AW-09 | Old model snapshots flagged; incompatible results excluded from current KSS/yearly/cohort views | Re-upload old rosters once to establish reproducible inputs |
| AW-10 | Exact event/rating instants in simulation; explicit diary coverage; incomplete history withholds model assessment | Scientific evaluation of report predictions |
| AW-11 | Production secret requirement; unique atomic refresh rotation; persisted admin role; Unicode-safe password hashing; versioned session revocation | Secure production configuration and secret rotation |
| AW-12 | Private query keys, immediate cache/draft clearing, account-bound analysis state, cross-tab session change handling, shared refresh with stale-response guard | Browser/device smoke tests in staging |
| AW-13 | Versioned normalized JSON replay, parser/engine identity and source hash; no reparsing under guessed PDF/Qatar assumptions | Old results without snapshots need re-upload |
| AW-14 | Kept-mounted report edits, explicit replacement confirmation, optional tab draft and reload restoration, stable hub URLs | User accepts draft persistence; exports remain user controlled |
| AW-15 | Actual reported sleep integrated at full duration; estimates stay distinct | Independent scientific review; no claimed model validation from parser tests |
| AW-16–17 | Static airport search routing, strict unknowns, shared coordinate promises, visible loading/errors/retry and directional route list | Staging API/CORS check on the actual public domain |
| AW-18 | Pre-parser byte limit, bounded reads/rows/pages/month span, limited compute concurrency, protected heavy reads, trusted transport IP | Gateway limits, representative load test, multi-replica strategy |
| AW-19 | Explicit save outcome, separate readiness, versioned schema migration, atomic continuity upsert, operation/status/duration telemetry | Production backup restoration and rollout rehearsal |
| AW-20–21 | Deterministic latest records; incompatible models excluded; verified-email opt-in to self-declared cohorts; stale aggregates invalidated on withdrawal/deletion/company changes | Membership is self-declared; minimum-five suppression does not prove anonymity |
| AW-22–23 | Required typecheck/lint/tests/build; hook ordering fixed; assertion-based regressions; Python lock/3.12, Node22 and patched frontend tooling; dependency scans | Continue advisory scanning; lint warnings are not suppressed |
| AW-24 | Verification/reset, account export/delete, consent controls and privacy/data page | Publish legal operator identity/contact, hosting and backup retention; verify SMTP delivery |

Visual changes retain the dark aviation identity: concise hero, readable synthetic roster example, clearer workflow, independent landing bundle, compact mobile charts, globe/flat/list routes, keyboard/reset controls, reduced-motion behavior and a white high-contrast print style. No Mapbox account or replacement token is needed.

## Environment and deployment

API: Python 3.12, PostgreSQL, `requirements.lock`. Frontend: Node22, `npm ci`. The backend Dockerfile and Railway configuration use the lock, `alembic upgrade head` as a release command, and `/ready` for deployment readiness. Review the service root (`fatigue-tool`) and dashboard overrides before deployment.

Railway runs Docker start commands in exec form. Keep the explicit `sh -c` wrapper so the assigned `PORT` is expanded at runtime; `exec` forwards shutdown signals to Uvicorn. Both Railway and the Docker image use port 8000 when `PORT` is absent. See [Railway start commands](https://docs.railway.com/deployments/start-command).

Required production values:

- `ENVIRONMENT=production`, `DATABASE_URL`, a cryptographically random `JWT_SECRET` of at least 32 characters.
- `CORS_ORIGINS` restricted to intended frontend origins; trusted proxy addresses configured for the actual ingress.
- `SMTP_HOST`, `SMTP_FROM`, `SMTP_PORT`, optional credentials, and HTTPS `PUBLIC_APP_URL` for recovery/verification.
- Frontend `VITE_API_URL` pointing to the intended API. Frontend build SHA and API root version/build response support deployment diagnosis.

The in-memory guest cache and limits are per process. Start with one replica or provide sticky routing/shared storage. Heavy computation runs off the event loop behind a two-slot gate; cancellation does not terminate already running Python work. Measure representative roster loads before increasing concurrency.

Railway's current documentation announces a Config-as-Code cutoff on 2026-12-01. The existing service configuration is retained for this branch; plan the account-specific Infrastructure-as-Code migration before that cutoff. See [Railway configuration](https://docs.railway.com/config-as-code/reference) and [release commands](https://docs.railway.com/deployments/pre-deploy-command).

## Schema upgrade and rollback

1. Take a production backup and restore it into an isolated staging database. Verify restored row counts and owner-scoped reads. Do not run destructive test fixtures against that restore.
2. For a database managed by Alembic, run `alembic current`, then `alembic upgrade head`. CI rehearses both a fresh database and revision `002` with preserved synthetic user data.
3. For a legacy database created by application startup without Alembic, run `python -m db.legacy_baseline --check` with the intended `DATABASE_URL`. This read-only check verifies the complete `001`/`002` baseline (users, rosters, analyses, refresh_tokens, column types/nullability including `users.is_admin`, primary/foreign keys and indexes). After a successful backup restore and upgrade rehearsal, run `python -m db.legacy_baseline --apply --backup-reference <verified-backup-id>`, then `alembic upgrade head`. The adoption command checks again under a transaction lock and records only revision `002`; it does not create or verify the backup, recreate application tables, or modify their records. It refuses an incomplete, incompatible, or already-versioned database. Normal deployments never adopt a legacy database automatically. Migration `003` supplies later tables/columns and privacy controls; it is not a general repair tool for arbitrary drift.
4. Verify revision `003`, `/ready`, login/refresh, upload → preview → analyse → saved history, cold detail/reanalysis, deletion and email recovery using staging accounts. Existing passwords remain usable. Duplicate legacy refresh hashes are invalidated; affected sessions sign in again.
5. Roll out the matching frontend/backend together. Keep the old application release and tested backup available. Migration `003` is forward-only: rollback requires a coordinated restore, not automatic destructive downgrade. Plan a maintenance window if needed for schema locking and session behavior changes.

Never merge on the strength of unit tests alone when the above production evidence is unavailable.

## Data and reporting contracts

Source PDFs remain private. The [roster reference](ROSTER_REFERENCE.md) records the reviewed format and reconciliation limits. Source `52:52` block time reconciles; `90:00` duty accounting is explicitly unverified because releases are inferred.

Saved replay stores normalized inputs, engine/parser versions and source provenance; serialized data uses a closed dataclass/enum schema and no executable pickle. Report JSON includes the complete validated request and a canonical SHA-256 hash; re-post `provenance.inputs` to reproduce it with the recorded engine/report version. Generated time/report ID will differ. Report generation remains stateless.

Signed-in roster originals and analysis snapshots remain until roster/account deletion. Guest analyses expire within one hour or earlier eviction. Account deletion removes live database rows and invalidates access, but deployment-specific backup/log retention must be disclosed separately.

### Pilot study and duty debriefs

Migration `004` adds `duty_debriefs` and the `users.study_*` enrolment columns; it is additive and forward-only. Migration `005` adds the nullable `users.sleep_preferences` (usual bedtime, wake-up, nap habit). The API requires `db.session.EXPECTED_SCHEMA_REVISION` (`005`), so run `alembic upgrade head` in the release phase before starting the new API, then verify `/ready`, enrolment, one debrief save, roster deletion (the debrief keeps its snapshot with NULL roster/analysis links) and account deletion (debriefs removed) on staging. Study data (diary observations and debriefs) needs a one-time versioned enrolment, is owner-scoped, excluded from company dashboards and admin views, rate limited per account (writes, reads and a rolling 24-hour row cap), and has its own export, per-record delete and withdraw flow. Before recruiting, the owner confirms the controller, contact, purpose and retention in `fatigue-tool/study/config.py` and `fatigue-insight-hub/src/lib/study-config.ts` and obtains legal review of health-data consent. See [pilot study](PILOT_STUDY.md).

Research reference: [Ingre et al., 2014](https://doi.org/10.1371/journal.pone.0108679). FDP reference: [EASA last-operating-sector definition](https://www.easa.europa.eu/en/faq/47601) and [Easy Access Rules, ORO.FTL.205](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations). These sources do not certify AeroWake's implementation.
