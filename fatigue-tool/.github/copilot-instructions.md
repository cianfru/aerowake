# Fatigue Analysis Tool - AI Coding Agent Guide

## Project Overview
EASA-compliant biomathematical fatigue model for airline pilots. Implements the Borbély Two-Process Model (homeostatic Process S + circadian Process C) with aviation-specific workload integration and realistic sleep behavior modeling.

**Core Purpose**: Predict pilot fatigue across multi-day rosters, identify WOCL (Window of Circadian Low) risks, calculate sleep debt, and generate actionable safety recommendations aligned with EU Regulation 965/2012.

## Architecture

### Three-Layer Design
1. **Data Models** ([data_models.py](data_models.py)) - Immutable structures for rosters, duties, flights, sleep blocks
2. **Core Engine** ([core_model.py](core_model.py)) - `BorbelyFatigueModel` with sleep strategy system
3. **API/UI Layer** - FastAPI server ([api_server.py](api_server.py)), Streamlit app, TypeScript client

### Key Components
- **Sleep Strategy System** (5 strategies): Normal, Night Departure, Early Morning, Anchor/WOCL, Recovery
  - Each strategy has specific trigger conditions and sleep pattern generation logic
  - See [SLEEP_CALCULATION_AUDIT.md](SLEEP_CALCULATION_AUDIT.md) for scientific validation
- **Parser System**: Qatar CrewLink parser ([qatar_crewlink_parser.py](qatar_crewlink_parser.py)), generic PDF/CSV parsers ([roster_parser.py](roster_parser.py))
- **Visualization**: Chronogram (raster plot), aviation calendar, performance graphs

## Critical Developer Knowledge

### Sleep Strategy Dispatch Pattern
When modifying sleep generation in [core_model.py](core_model.py), the strategy dispatcher (`estimate_sleep_blocks()` ~L485) routes to:
- `_night_departure_strategy()` - Report ≥20:00 or <04:00 → morning sleep + 2h pre-duty nap
- `_early_morning_strategy()` - Report <07:00 → Roach (2012) regression (4-6.6h)
- `_wocl_duty_strategy()` - WOCL crossing + >6h duty → 4.5h anchor sleep
- `_normal_sleep_strategy()` - Default 23:00-07:00

**All strategies** must call `_validate_sleep_no_overlap()` to prevent duty-sleep collisions. See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for overlap fix details.

### Time Handling: UTC + Timezone Awareness
- **Storage**: All datetime objects stored in UTC (`report_time_utc`, `release_time_utc`)
- **Display**: Convert to home base timezone for UI using `pytz.timezone(home_timezone).normalize()`
- **Multi-day duties**: Report times may occur on previous day if duty crosses midnight. Parser validates `report < first_departure` and adjusts accordingly ([roster_parser.py](roster_parser.py) `_validate_duty_times()`)

### Testing Patterns
Tests use **print-based validation** (not pytest). Run directly:
```bash
python test_normal_sleep_fix.py
python test_post_duty_sleep.py
```
Expected output: `✅ TEST PASSED` or `❌ TEST FAILED`. Tests construct duties manually with `datetime` objects and verify sleep block generation.

### Configuration Presets
Four presets in [core_model.py](core_model.py) `ModelConfig`:
- `default_easa_config()` - Balanced (recommended)
- `conservative_config()` - Stricter thresholds, lower sleep efficiency
- `liberal_config()` - Airline-friendly assumptions
- `research_config()` - Pure Borbély parameters (50/50 S/C weighting)

**Never hardcode parameters** - always use config objects.

## Development Workflows

### Running the API Server
```bash
uvicorn api_server:app --reload --host 0.0.0.0 --port 8000
```
OpenAPI docs: `http://localhost:8000/docs`

### Testing API Integration
```bash
python test_api_exposure.py  # Verifies POST /api/analyze endpoint
```

### Generating Visualizations
```python
from chronogram import FatigueChronogram
chrono = FatigueChronogram(theme='pro_dark')
chrono.plot_monthly_chronogram(monthly_analysis, save_path='output.png', mode='risk')
```

### Deployment
- **Railway**: Uses [Procfile](Procfile) → `uvicorn api_server:app`
- **Frontend**: Lovable.dev app consumes API via [frontend_api_client.ts](frontend_api_client.ts)
- See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for TypeScript integration steps

## Project-Specific Conventions

### Scientific Citation Standard
All sleep parameters cite peer-reviewed sources in docstrings:
```python
# Correct (from core_model.py):
tau_i: float = 18.2  # Buildup during wake (hours) - Jewett & Kronauer (1999)
```
If modifying sleep calculations, verify against [SLEEP_CALCULATION_AUDIT.md](SLEEP_CALCULATION_AUDIT.md).

### Post-Duty Sleep Generation
Critical pattern from recent fix ([PR_POST_DUTY_SLEEP_FIX.md](PR_POST_DUTY_SLEEP_FIX.md)):
```python
# Environment determination (core_model.py _generate_post_duty_sleep())
environment = 'home' if is_home_base else 'hotel'
# Never add conditional checks - layover = any non-home-base arrival
```

### Sleep Quality Multiplicative Factors
Seven factors applied to raw duration ([data_models.py](data_models.py) `SleepBlock.effective_hours`):
1. Time of day alignment (circadian)
2. Sleep pressure (homeostatic debt)
3. Fragmentation penalty
4. Environment (home=1.0, hotel=0.88, inflight=0.70)
5. WOCL boost (1.10 when sleep includes 02:00-06:00)
6. Jet lag penalty
7. Sleep inertia (within 30 min of wake)

**Never modify `effective_hours` calculation** without consulting audit documentation.

### API Response Structure
All `/api/analyze` responses include:
- `duties[]` with nested `sleep_blocks[]` and `performance_points[]`
- `rest_days[]` with recovery sleep
- `summary.risk_assessment` with EASA regulatory references
- `time_validation_warnings[]` for data quality issues

See Pydantic models in [api_server.py](api_server.py) lines 67-223.

## Common Pitfalls

1. **Modifying sleep hours without reducing confidence**: If you constrain sleep duration, reduce `confidence_score` to 0.60-0.70
2. **Forgetting overnight adjustment**: Multi-day duties require `timedelta(days=1)` shifts for report times
3. **Hardcoding timezones**: Always use `Airport.timezone` attribute, never assume UTC offsets
4. **Skipping validation calls**: Every new sleep generation path MUST call `_validate_sleep_no_overlap()`
5. **Breaking API contract**: Frontend expects ISO format datetimes and specific field names (see [frontend_api_client.ts](frontend_api_client.ts))

## Key Files for AI Context

- [core_model.py](core_model.py) (2535 lines) - Main model, sleep strategies, Borbély equations
- [data_models.py](data_models.py) (616 lines) - All data structures, sleep quality logic
- [roster_parser.py](roster_parser.py) - Time validation, duty construction
- [SLEEP_CALCULATION_AUDIT.md](SLEEP_CALCULATION_AUDIT.md) - Scientific validation, parameter sources
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Recent overlap fixes, validation patterns

## Regulatory Context (EASA FTL)
When implementing features, reference:
- **ORO.FTL.120** - Rest requirements (12h minimum, 8h sleep opportunity)
- **ORO.FTL.235** - Cumulative duty hours, standby periods
- **AMC1 ORO.FTL.105(10)** - WOCL definition (02:00-05:59 home time)
- **AMC1 ORO.FTL.105(1)** - Acclimatization (±2h timezone band, 3 local nights)

Risk thresholds map to these regulations (see [core_model.py](core_model.py) `RiskThresholds` class).
