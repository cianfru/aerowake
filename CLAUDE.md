# CLAUDE.md - AI Assistant Guide for Aerowake Project

## Project Overview

Aerowake is a comprehensive fatigue risk management system for airline pilots, organized as a monorepo with two complementary applications:

1. **fatigue-tool/** - Python/FastAPI backend implementing EASA-compliant biomathematical fatigue modeling
2. **fatigue-insight-hub/** - React/TypeScript frontend providing interactive fatigue analysis and visualization

**Repository**: `github.com/cianfru/aerowake` (unified monorepo)

**Purpose**: Enable pilots and flight operations teams to predict fatigue levels across multi-day rosters, identify Window of Circadian Low (WOCL) risks, calculate sleep debt, and generate safety recommendations aligned with EU Regulation 965/2012 (EASA ORO.FTL).

## Repository Structure

```
Aerowake/
├── fatigue-tool/              # Backend API (Python/FastAPI)
│   ├── core/                  # Fatigue model engine (Borbely Two-Process Model)
│   ├── models/                # Data structures (Duty, Roster, SleepBlock, Airport)
│   ├── api/                   # FastAPI REST endpoints
│   ├── parsers/               # Roster file parsing (PDF/CSV)
│   ├── visualization/         # Plotly/Matplotlib charts
│   ├── tests/                 # Print-based test suite
│   ├── requirements.txt       # Python dependencies
│   └── CLAUDE.md              # Backend-specific documentation
│
├── fatigue-insight-hub/       # Frontend UI (React/TypeScript/Vite)
│   ├── src/                   # Source code
│   │   ├── components/        # React components
│   │   ├── pages/             # Route pages
│   │   ├── hooks/             # Custom React hooks
│   │   └── lib/               # Utilities and helpers
│   ├── public/                # Static assets
│   ├── package.json           # Node dependencies
│   └── README.md              # Frontend setup instructions
│
└── .claude/                   # Claude Code configuration
    └── projects/.../memory/   # Persistent memory across sessions
```

## Tech Stack

### Backend (fatigue-tool)
- **Language**: Python 3.8+
- **Framework**: FastAPI + Uvicorn
- **Data validation**: Pydantic v2
- **Time handling**: pytz (UTC storage)
- **Airport data**: airportsdata (~7,800 IATA airports)
- **Numerics**: NumPy, Pandas
- **PDF parsing**: pdfplumber
- **Visualization**: Plotly, Matplotlib, Pillow
- **Deployment**: Railway.app (Root Directory: `fatigue-tool`)

### Frontend (fatigue-insight-hub)
- **Framework**: React 18 + TypeScript
- **Build tool**: Vite
- **UI library**: shadcn-ui + Radix UI
- **Styling**: Tailwind CSS
- **State management**: TanStack Query (React Query)
- **Routing**: React Router DOM
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Maps**: Mapbox GL
- **Date handling**: date-fns
- **Deployment**: Vercel (Root Directory: `fatigue-insight-hub`)

## Development Commands

### Backend (fatigue-tool)

```bash
# Navigate to backend
cd fatigue-tool

# Install dependencies
pip install -r requirements.txt

# Run API server (development)
uvicorn api.api_server:app --reload --host 0.0.0.0 --port 8000

# OpenAPI documentation
# Available at http://localhost:8000/docs

# Run tests
python tests/test_sleep_strategies.py
python tests/test_sleep_efficiency.py
python tests/test_comprehensive_improvements.py
python tests/test_performance_improvements.py
```

### Frontend (fatigue-insight-hub)

```bash
# Navigate to frontend
cd fatigue-insight-hub

# Install dependencies (uses bun.lockb, so bun is recommended)
npm install
# or
bun install

# Run development server
npm run dev

# Build for production
npm run build

# Build for development (with source maps)
npm run build:dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Key Architecture Concepts

### Backend Architecture (Three-Layer Design)

1. **Data Models** (`models/data_models.py`)
   - Dataclasses for rosters, duties, flights, sleep blocks
   - Airport database with timezone information
   - Sleep quality calculation logic

2. **Core Engine** (`core/`)
   - `BorbelyFatigueModel` - Main fatigue simulation engine
   - `UnifiedSleepCalculator` - 5 sleep strategy dispatch system
   - `EASAComplianceValidator` - Regulatory compliance checking
   - `WorkloadModel` - Aviation workload integration

3. **API Layer** (`api/api_server.py`)
   - FastAPI server with Pydantic response models
   - POST /api/analyze endpoint
   - CORS configuration for frontend integration

### Frontend Architecture

1. **Component-based UI**
   - Reusable components in `src/components/`
   - shadcn-ui for consistent design system
   - Radix UI primitives for accessibility

2. **Page Routing**
   - React Router for navigation
   - Page components in `src/pages/`

3. **Data Fetching**
   - TanStack Query for server state management
   - Optimistic updates and caching

4. **Visualization**
   - Recharts for fatigue timeline graphs
   - Mapbox for flight route visualization
   - Three.js for 3D aircraft visualizations

## Code Conventions

### Backend Conventions

#### Time Handling
- **Storage**: All datetimes in UTC (`report_time_utc`, `release_time_utc`)
- **Display**: Convert to home base timezone using `pytz.timezone(tz).normalize()`
- **Multi-day duties**: Parser adjusts report times crossing midnight
- **Never hardcode UTC offsets** - always use `Airport.timezone` attribute

#### Parameters and Configuration
- All model parameters live in `core/parameters.py`
- Every parameter must cite its peer-reviewed source in the docstring
- Four presets available: default_easa, conservative, liberal, research

#### Testing
- Tests use print-based validation (not pytest)
- Each test file runs standalone
- Expected output: `✅ TEST PASSED` or `❌ TEST FAILED`

### Frontend Conventions

#### Component Structure
- Use functional components with TypeScript
- Prefer composition over inheritance
- Keep components focused and single-purpose
- Use custom hooks for shared logic

#### Styling
- Tailwind CSS utility classes
- shadcn-ui design tokens
- Responsive design (mobile-first)
- Dark mode support via next-themes

#### State Management
- Local state with useState for UI state
- TanStack Query for server data
- Context API for global app state (if needed)

#### File Organization
- Components: PascalCase (e.g., `FatigueChart.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Pages: kebab-case directories or PascalCase files

## Common Pitfalls

### Backend
1. **Sleep overlap**: Every sleep generation path must call `_validate_sleep_no_overlap()`
2. **Confidence scores**: Constrained sleep duration should reduce `confidence_score` to 0.60-0.70
3. **Overnight duties**: Multi-day duties require `timedelta(days=1)` shifts
4. **Post-duty sleep environment**: Layover = 'hotel', home base = 'home'
5. **Breaking API contract**: Do not rename fields without updating frontend

### Frontend
1. **Async state**: Always handle loading and error states in components
2. **Type safety**: Avoid `any` types, use proper TypeScript interfaces
3. **Key props**: Always provide unique keys for list items
4. **Accessibility**: Use semantic HTML and ARIA attributes
5. **Performance**: Memoize expensive calculations with useMemo/useCallback

## Integration Points

### API Communication
- Frontend expects backend at configured API endpoint
- All requests/responses use JSON
- Datetime format: ISO 8601 strings
- CORS enabled for cross-origin requests

### Data Flow
1. User uploads roster file in frontend
2. Frontend sends roster data to `/api/analyze` endpoint
3. Backend parses roster, runs fatigue simulation
4. Backend returns analysis with duties, sleep blocks, performance points
5. Frontend visualizes results in charts and tables

## Regulatory Context (EASA FTL)

When implementing features, reference these regulations:
- **ORO.FTL.120** - Rest requirements (12h minimum, 8h sleep opportunity)
- **ORO.FTL.235** - Cumulative duty hours, standby periods
- **AMC1 ORO.FTL.105(10)** - WOCL definition (02:00-05:59 home base time)
- **AMC1 ORO.FTL.105(1)** - Acclimatization (±2h timezone band, 3 local nights)

## Project-Specific Instructions

### Backend Development (fatigue-tool)
- Refer to `fatigue-tool/CLAUDE.md` for detailed backend architecture
- All sleep strategies documented in `UnifiedSleepCalculator`
- Performance calculation formula and risk levels in main CLAUDE.md
- API response contract must be maintained for frontend compatibility

### Frontend Development (fatigue-insight-hub)
- Standard React/Vite/TypeScript project (no external editor dependencies)
- Local development with `npm run dev` (port 8080)
- Deployment via Vercel (configured in vercel.json, Root Directory = `fatigue-insight-hub`)

## Key Files for Context

### Backend
| File | Purpose |
|------|---------|
| `fatigue-tool/core/fatigue_model.py` | Main fatigue model, Borbely equations |
| `fatigue-tool/core/sleep_calculator.py` | 5 sleep strategies dispatch |
| `fatigue-tool/core/parameters.py` | All configurable parameters with citations |
| `fatigue-tool/models/data_models.py` | Data structures, sleep quality logic |
| `fatigue-tool/api/api_server.py` | REST API, endpoints, Pydantic models |
| `fatigue-tool/parsers/roster_parser.py` | PDF/CSV parsing, time validation |

### Frontend
| File | Purpose |
|------|---------|
| `fatigue-insight-hub/src/` | Main source directory |
| `fatigue-insight-hub/package.json` | Dependencies and scripts |
| `fatigue-insight-hub/vite.config.ts` | Vite build configuration |
| `fatigue-insight-hub/tailwind.config.ts` | Tailwind CSS configuration |
| `fatigue-insight-hub/tsconfig.json` | TypeScript configuration |

## Development Workflow

### Making Changes

1. **Backend changes**:
   - Modify code in `fatigue-tool/`
   - Run relevant tests to validate
   - Test API endpoint with `/docs` interface
   - Update `fatigue-tool/CLAUDE.md` if architecture changes

2. **Frontend changes**:
   - Modify code in `fatigue-insight-hub/`
   - Test in development mode with `npm run dev`
   - Verify responsive design and accessibility
   - Run linter and fix issues

3. **Cross-project changes**:
   - Ensure API contract compatibility
   - Update data models on both sides
   - Test integration between frontend and backend
   - Document breaking changes in both CLAUDE.md files

### Testing Integration

1. Start backend server on port 8000
2. Start frontend dev server (usually port 5173)
3. Configure frontend to point to `http://localhost:8000`
4. Test full user workflow with real roster data

## Notes for AI Assistants

- When working on backend, focus on scientific accuracy and EASA compliance
- When working on frontend, prioritize user experience and data visualization clarity
- Always consider timezone handling carefully - pilots work across multiple time zones
- Sleep quality and fatigue predictions have safety implications - be conservative with changes
- Maintain API contract stability to prevent breaking frontend integration
- Reference relevant sections of EASA regulations when discussing compliance features
