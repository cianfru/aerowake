# CLAUDE.md - AI Assistant Guide

## Current launch contracts (September 2026)

Use [launch hardening](../docs/LAUNCH_HARDENING.md) and [roster reference](../docs/ROSTER_REFERENCE.md) for current deployment and input contracts. Older explanatory notes below must not override these contracts.

- Store aware UTC instants; resolve home zones from verified airport codes. Distinguish reported sleep from inferred opportunities.
- Current KSS is 1–9; index = 110 − 10 × KSS. Higher bands begin at KSS 5.5/6.5/7.5/8.5. Duty headline risk uses peak KSS, not landing alone. Never convert an unidentified legacy model index into KSS.
- Scope checks to available records and disclose missing history/context. Independent FTL/scientific evaluation remains a release gate.
- Owner authorization precedes both cache and database reads. Report JSON carries normalized inputs and provenance; source rosters and personal data must stay out of Git/logs.
- Python 3.12 with requirements.lock; Node22 with npm ci. Backend: python -m pytest tests -q. Frontend: npm run typecheck, npm run lint, npm test, npm run build.
- Schema migrations run before API startup; never restore ad-hoc startup DDL. PostgreSQL test fixtures require a disposable test database and delete its schema.


## Project Overview

Roster analysis and fatigue reporting for airline pilots. The current engine is aerowake-4.1-kss (Three Process Model, Ingre et al. 2014; 4.1 changed sleep estimation and the headline window, not the KSS core). Predictions and scoped checks are not operational fitness or compliance certification.

**Purpose**: Predict pilot fatigue across multi-day rosters, identify WOCL (Window of Circadian Low, 02:00-05:59) risks, calculate sleep debt, and generate safety recommendations aligned with EU Regulation 965/2012 (EASA ORO.FTL).

## Repository Structure

```
fatigue-tool/
├── core/                          # Fatigue model engine
│   ├── __init__.py                # Public API exports
│   ├── fatigue_model.py           # BorbelyFatigueModel (main engine)
│   ├── sleep_calculator.py        # UnifiedSleepCalculator (5 strategies)
│   ├── compliance.py              # EASAComplianceValidator
│   ├── workload.py                # WorkloadModel (flight phase multipliers)
│   └── parameters.py              # All configuration dataclasses
├── models/                        # Data structures
│   ├── __init__.py
│   └── data_models.py             # Duty, Roster, SleepBlock, Airport, etc.
├── api/                           # FastAPI REST backend
│   └── api_server.py              # POST /api/analyze endpoint
├── parsers/                       # Roster file parsing
│   ├── __init__.py
│   ├── roster_parser.py           # PDF/CSV parser + AirportDatabase
│   └── qatar_crewlink_parser.py   # Qatar Airways CrewLink format
├── visualization/                 # Charts and plots
│   ├── __init__.py
│   ├── chronogram.py              # 30-min resolution timeline
│   └── aviation_calendar.py       # Monthly heatmap
├── scripts/                       # Utility scripts
│   └── analyze_sleep_debt.py
├── tests/                         # pytest assertion suite
│   ├── test_sleep_strategies.py
│   ├── test_sleep_efficiency.py
│   ├── test_comprehensive_improvements.py
│   └── test_performance_improvements.py
├── requirements.txt               # Python dependencies
├── Procfile                       # Railway deployment (uvicorn)
├── railway.json                   # Railway CI/CD config
└── Aptfile                        # System-level dependencies (cairo, pango)
```

## Tech Stack

- **Language**: Python 3.12
- **Web framework**: FastAPI + Uvicorn
- **Data validation**: Pydantic v2
- **Timezone handling**: pytz (all storage in UTC)
- **Airport data**: airportsdata (~7,800 IATA airports)
- **Numerics**: NumPy, Pandas
- **PDF parsing**: pdfplumber (no Java dependency)
- **Visualization**: Plotly, Matplotlib, Pillow
- **Deployment**: Railway.app (Dockerfile with locked dependencies)

## Development Commands

### Run the API server
```bash
uvicorn api.api_server:app --reload --host 0.0.0.0 --port 8000
```
OpenAPI docs available at `http://localhost:8000/docs`

### Run tests
```bash
pip install -r requirements.lock
python -m pytest tests -q      # CI runs this on every PR (.github/workflows/ci.yml)
```

### Install dependencies
```bash
pip install -r requirements.lock
```

## Key Architecture Concepts

### Three-Layer Design
1. **Data Models** (`models/data_models.py`) - Dataclasses for rosters, duties, flights, sleep blocks
2. **Core Engine** (`core/`) - `BorbelyFatigueModel` with sleep strategies, compliance, workload
3. **API Layer** (`api/api_server.py`) - FastAPI server with Pydantic response models

### Sleep Strategy Dispatch
The `UnifiedSleepCalculator.estimate_sleep_blocks()` routes to one of 5 strategies:

| Strategy | Trigger | Behavior |
|----------|---------|----------|
| Night Departure | Report >= 18:00 or < 04:00 | Night sleep + pre-duty nap ramped by report time and nap habit |
| Early Morning | Report < 07:00 | Roach (2012) regression, 4-6.6h |
| WOCL Anchor | WOCL crossing + >6h duty | 4.5h consolidated anchor sleep |
| Recovery | Post-duty hotel/home | Environment-adjusted sleep block |
| Normal | Default | 23:00-07:00 home bed |

### Alertness Calculation (engine `aerowake-4.1-kss`, `core/alertness.py`)
Open Three Process Model as validated on airline crew (Ingre et al. 2014, model 5c):
```
X   = S_B + C + U            # homeostat with brake + circadian + ultradian
KSS = 9.68 − 0.46·X          # Karolinska Sleepiness Scale 1–9
P(KSS ≥ 7) = logistic(−0.599·X + 4.30)
performance index = 110 − 10·KSS   # legacy 20–100 field, linear in KSS
```
Bands (index): low ≥55 (KSS<5.5), moderate 45–55, high 35–45, critical 25–35, extreme <25.
Bands are decided on KSS rounded to one decimal (half up, lower bound inclusive) everywhere
(`alertness.classify_kss`); `RiskThresholds.classify(index)` converts to KSS first.
Headline duty risk = peak KSS over `HEADLINE_RISK_WINDOW` (`core/parameters.py`, default
'fdp' = report → last operating on-blocks; 'duty' = report → release). Both peaks, the peak
time and per-sector peak/on-blocks KSS come from the duty timeline (`DutyTimeline.segment_kss`).
Acclimatization: body clock closes 30 %/day of the gap to local time (process A).
Workload, time-on-task, hypoxia, inertia and "resilience" are NOT in the score.
Cumulative restriction (7-day deficit) and the Dawson & McCulloch prior sleep/wake
check are reported separately. Audit and rationale: `docs/MODEL_VALIDATION.md`.

### Fatigue report (`reports/`, `POST /api/fatigue-report`)
Stateless report from pilot-supplied duties, sleep and self-rating. Report 1.2 also supports `roster_concern` scenarios with planned travel, clearly identified sleep estimates and a personal watch reference. Input provenance schema 2 retains the full request; watch references never alter model scores. See
`docs/FATIGUE_REPORT.md`. The pilot's own assessment is never contradicted.

### EASA roster checks (`core/easa_checks.py`)
Run on every analysis (`easa_findings`, `easa_summary`) and in fatigue reports:
ORO.FTL.210 rolling duty 60h/7d, 110h/14d, 190h/28d and block 100h/28d;
ORO.FTL.235 minimum rest; ORO.FTL.235(d) recovery rest (36h incl. 2 local nights,
≤168h apart); FDP above the ORO.FTL.205 table. Disruptive elements follow
ORO.FTL.105(8) (`EASAComplianceValidator.is_disruptive_duty`).

### Augmented crew and Qatar FTL
See `docs/QATAR_FTL.md`: IR = the pilot is relief on that sector → 4-pilot; one crew per pairing
(IR leaving base → Crew B both legs; IR returning to base → Crew A both legs); 3-pilot only by
pilot override (`duty_crew_overrides` `{composition, crew_set}`, `_apply_crew_overrides`). All
scored in-flight rest blocks are returned with `source` 'roster_ir' | 'planned' and
`approved_plan` (Qatar figure). ULR = Qatar FTL 7.18 (`QatarFTL718Validator`), with the approved
rest patterns `QATAR_ULR_REST_PATTERNS` (Figures 7-3..7-8); augmented non-ULR FDP limits are
still EASA CS FTL.1.205(c) pending OM-A Chapter 7 tables.

### Standby
CrewLink PSBY/HSBY/SBY → `DutyType.HOME_STANDBY` on `Roster.standbys`: not scored
(pilot at home, free to sleep), counts 25% toward cumulative duty. ASBY/APSBY →
`DutyType.AIRPORT_STANDBY`, kept in `roster.duties` and counted in full.

### Operational settings (env)
`ANALYSIS_STORE_MAX` (LRU, default 200), `MAX_UPLOAD_MB` (10),
`RATE_LIMIT_PER_MINUTE` (20, POST analyze/what-if/fatigue-report/reanalyze),
`CORS_ORIGINS`. See `api/hardening.py`.

### Model configuration (single model)
One model only: `ModelConfig.aerowake()` in `core/parameters.py`. The old preset
names (`operational`, `default_easa`, `conservative`, `liberal`, `research`) and
`from_preset()` are kept as aliases so old clients don't break; they all return
the same configuration.

### Sleep-estimation rules worth knowing
- Pre-duty nap (`PreDutyNapAssumptions`): stated per analysis as `nap_habit`
  ('usually' | 'sometimes' | 'rarely', default 'sometimes'; form field on analyze /
  reanalyze / what-if, echoed as `assumptions`). Length ramps from 0 h at 18:00 to the
  night-departure nap (≤2.5 h, window-limited) at 22:00 body time; 'sometimes' scales it by
  the 54 % nap prevalence of Signal et al. (2014); 'rarely' none. Modelling assumption to calibrate with pilot debrief data. The duty's
  sleep explanation, `assumed_nap_hours` and risk reasons state it.
- Afternoon release before a night report (`DaytimeSleepBounds`): ≤2.5 h afternoon nap
  ending by 18:00 body time + evening sleep from 21:00 — never one long afternoon block.
- The pre-simulation debt estimate uses the simulation ledger (`_advance_sleep_debt`) over
  every generated block — do not reintroduce a per-strategy estimate.
- After-midnight reports anchor the previous night's sleep (night-departure strategy).
- `core/sleep_attribution.py` makes the API sleep entries match `all_sleep` exactly: a duty's
  `sleep_quality` is its last main sleep before report (+ later naps); earlier recovery
  sleep moves to `post_duty_<prev id>`. Top-level sleep start/end = that main block (what-if
  baseline). What-if overrides replace the main block, or any block via `block_start_utc`.
- Acclimatisation: `compliance.determine_acclimatisation` (ORO.FTL.105(1) Table 1). Unknown
  state → Table 3; undeterminable (e.g. roster starts abroad) → no FDP verdict.
- `Roster.alertness_timeline` (API `alertness_timeline`): 30-min KSS samples across the
  month from the same engine, plus each duty's peak instants (`duty_peak`); `kss=None`
  while asleep; ends at the last estimated sleep / last release + 2h — no points without a
  sleep estimate behind them.
- `avg_sleep_per_night` covers only `sleep_coverage_days` (month start → last estimate).
- Qatar CrewLink simulator codes: OPTR, FFS, FS1, AFTD, 77LP, AW8, PSIM (bare `SIM`
  is an annotation, not a duty).

## Code Conventions

### Time Handling
- **Storage**: All datetimes in UTC (`report_time_utc`, `release_time_utc`)
- **Display**: Convert to home base timezone using `pytz.timezone(tz).normalize()`
- **Multi-day duties**: Parser adjusts report times crossing midnight via `_validate_duty_times()`
- **Never hardcode UTC offsets** - always use `Airport.timezone` attribute

### Parameters and Configuration
- All model parameters live in `core/parameters.py` - never hardcode values elsewhere
- Every parameter must cite its peer-reviewed source in the docstring:
  ```python
  tau_i: float = 18.2  # Buildup during wake (hours) - Jewett & Kronauer (1999)
  ```

### Sleep Quality Factors
Seven multiplicative factors applied to raw sleep duration in `SleepBlock.effective_hours`:
1. Time of day alignment (circadian)
2. Sleep pressure (homeostatic debt)
3. Fragmentation penalty
4. Environment (home=1.0, hotel=0.88, airport_hotel=0.82, crew_rest=0.70)
5. WOCL boost (1.10 when sleep includes 02:00-06:00)
6. Jet lag penalty
7. Sleep inertia (within 30 min of wake)

### Testing Conventions
- Tests manually construct `Duty` objects with UTC datetimes
- Pytest discovers tests and fixtures; use assertions for every expected outcome.
- Assert model invariants and independently reviewed fixtures; never treat printed status as a test result.
- Test pattern:
  ```python
  from models.data_models import Duty, FlightSegment, Airport
  duty = Duty(duty_id='D001', segments=[segment], ...)
  model = BorbelyFatigueModel()
  timeline = model.simulate_duty(duty)
  assert 20 <= timeline.landing_performance <= 100
  ```

### API Response Contract
All `/api/analyze` responses include:
- `duties[]` with sleep and performance fields defined by DutyResponse
- `rest_days_sleep[]` with inferred recovery sleep
- `easa_findings[]` and `easa_summary` with explicit assessment coverage
- `persistence_status` indicating saved, failed or session_only
- Import warnings and source reconciliation are returned by `/api/roster/preview`.

Frontend expects ISO format datetimes and specific field names defined in Pydantic models (`api/api_server.py`).

## Common Pitfalls

1. **Sleep overlap**: Every sleep generation path MUST call `_validate_sleep_no_overlap()` to prevent duty-sleep collisions
2. **Confidence scores**: If you constrain sleep duration, reduce `confidence_score` to 0.60-0.70
3. **Overnight duties**: Multi-day duties require `timedelta(days=1)` shifts for report times
4. **Post-duty sleep environment**: Layover = any non-home-base arrival (`'hotel'`), home base = `'home'` - generate sleep in the actual arrival timezone, not home timezone
5. **Breaking API contract**: Do not rename fields or change datetime format without updating frontend expectations
6. **Import paths**: After recent refactoring, imports use module paths (e.g., `from core.fatigue_model import BorbelyFatigueModel`, `from models.data_models import Duty`)

## Regulatory Context (EASA FTL)

When implementing features, reference these regulations:
- **ORO.FTL.235** - Rest periods (requirements depend on home/away context)
- **ORO.FTL.210 / .225** - Cumulative limits / standby
- **AMC1 ORO.FTL.105(10)** - WOCL definition (02:00-05:59 home base time)
- **AMC1 ORO.FTL.105(1)** - Acclimatization (±2h timezone band, 3 local nights)

## Key Files for Context

| File | Purpose |
|------|---------|
| `core/fatigue_model.py` | Main model, sleep strategies, Borbely equations |
| `core/sleep_calculator.py` | Unified sleep calculator with 5 strategies |
| `core/parameters.py` | All configurable parameters with scientific citations |
| `models/data_models.py` | All data structures, sleep quality logic |
| `api/api_server.py` | REST API, Pydantic models, endpoint definitions |
| `parsers/roster_parser.py` | PDF/CSV parsing, time validation, duty construction |
| `parsers/qatar_crewlink_parser.py` | Qatar Airways CrewLink format parser |
