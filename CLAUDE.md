# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Recce is a data validation and review tool for dbt projects. It helps data teams preview, validate, and ship data changes with confidence by providing lineage visualization, data diffing, and collaborative review features.

## Critical Constraints & Guidelines

### Do NOT:
- ❌ **Commit state files**: Never commit `recce_state.json` or any `state.json` files (contains user-specific runtime state)
- ❌ **Edit generated files**: Never edit files in `recce/data/` directly (auto-generated from `js/out/` during frontend build)
- ❌ **Break adapter interface**: All adapters must implement ALL `BaseAdapter` abstract methods (partial implementations will fail at runtime)
- ❌ **Skip Python version compatibility**: Any new dependencies must support Python 3.9+ (we test 3.9-3.13)
- ❌ **Bypass frontend build**: If you modify frontend code, you MUST run `cd js && pnpm run build` to update `recce/data/` before testing with `recce server`
- ❌ **Use interactive git commands**: Never use `git rebase -i`, `git add -i`, or similar (interactive prompts don't work in CLI context)
- ❌ **Mix concerns across layers**: Keep strict separation between models, tasks, APIs, and adapters (see Code Organization Philosophy below)

### Always:
- ✅ **Build frontend before testing**: When frontend changes are made, run `cd js && pnpm run build` then restart `recce server`
- ✅ **Test across dbt versions**: For adapter changes, run `make test-tox` to verify against dbt 1.5-1.8
- ✅ **Use pre-commit hooks**: Automatically installed with `make install-dev` (handles Black, isort, flake8)
- ✅ **Maintain state loader abstraction**: All state persistence must work with both `FileStateLoader` (local) and `CloudStateLoader` (Recce Cloud)
- ✅ **Update both base and current**: When modifying check logic, ensure changes work for both environments being compared
- ✅ **Follow monorepo structure**: Backend (Python) and frontend (TypeScript) are tightly coupled but maintain clear boundaries

## Code Organization Philosophy

### Separation of Concerns

```
recce/
├── models/          # Pure data structures (Pydantic), NO business logic
├── apis/            # FastAPI routes, minimal logic (delegate to *_func.py)
│   ├── *_api.py     # Route definitions only
│   └── *_func.py    # Business logic for routes
├── tasks/           # Pure execution logic, NO API awareness
├── adapter/         # Platform abstraction, implements BaseAdapter
├── state/           # Persistence layer, abstracts local vs cloud
└── core.py          # RecceContext - central state coordinator
```

### Dependency Rules

**What can import what:**
- ✅ `apis/` can import from `models/`, `tasks/`, `adapter/`, `state/`
- ✅ `tasks/` can import from `models/`, `adapter/` (but NOT from `apis/`)
- ✅ `adapter/` can import from `models/` (but NOT from `tasks/` or `apis/`)
- ✅ `state/` can import from `models/` only
- ❌ Backend (`recce/`) NEVER imports from frontend (`js/`)
- ❌ Frontend uses API clients (`lib/api/`) NEVER direct backend imports

### Why This Matters

- **Keeps task execution testable** without spinning up FastAPI server
- **Allows adapter swapping** without breaking existing tasks
- **Enables frontend builds** without Python environment
- **Makes state persistence flexible** (local file vs cloud S3)
- **Prevents circular dependencies** that cause import errors

### Where to Add New Code

| What You're Adding | Where It Goes | What to Import |
|-------------------|---------------|----------------|
| New check type | `tasks/` (new Task class) | Can use adapter, models |
| New API endpoint | `apis/*_api.py` (route) + `apis/*_func.py` (logic) | Can use tasks, models, adapter |
| New data model | `models/` (Pydantic class) | Only standard library |
| Platform support | `adapter/` (extend BaseAdapter) | Can use models only |
| State storage | `state/` (extend RecceStateLoader) | Can use models only |
| UI component | `js/src/components/` | Use API clients from `lib/api/` |
| API client | `js/src/lib/api/` | Axios, React Query |

## Architecture

### Monolithic Client-Server Application

**Backend (Python/FastAPI):**
- FastAPI REST server that serves static frontend and provides APIs for runs/checks
- CLI built with Click (`recce server`, `recce run`)
- Adapter pattern abstracts different data platforms (dbt-core, SQLMesh)
- Task execution engine runs validation checks asynchronously
- State management supports local file storage or Recce Cloud

**Frontend (TypeScript/React):**
- Next.js 15 app built with React 19, compiled to static files
- UI built with Chakra UI + Tailwind CSS
- React Query handles API communication and state management
- Reactflow for lineage graph visualization
- Built frontend is embedded in Python package at `recce/data/`

**Key Design Patterns:**
- **Pluggable Adapter Pattern**: `BaseAdapter` interface allows support for different data platforms (dbt, SQLMesh). Each adapter implements platform-specific lineage parsing, model retrieval, and SQL generation.
- **In-Memory State with Persistence**: `RecceContext` holds runtime state (runs, checks, adapter). `CheckDAO` and `RunDAO` provide in-memory storage. `RecceStateLoader` abstraction supports `FileStateLoader` (local JSON) or `CloudStateLoader` (S3 sync).
- **Task-Based Check Execution**: Each check type (profile_diff, value_diff, row_count_diff, etc.) maps to a `Task` class. Tasks are submitted asynchronously via FastAPI, and frontend polls for completion.
- **Static Frontend Bundling**: Next.js builds to static HTML/JS in `js/out/`, which is moved to `recce/data/` and served by FastAPI at runtime. No Node.js needed in production.

### Key Directories

```
recce/                      # Python backend package
├── cli.py                  # Click CLI entry point
├── server.py              # FastAPI application setup
├── core.py                # RecceContext - central state manager
├── run.py                 # Run execution logic
├── config.py              # recce.yml configuration
├── artifact.py            # dbt artifact management
├── apis/                  # FastAPI route handlers
│   ├── check_api.py       # /api/checks endpoints
│   ├── run_api.py         # /api/runs endpoints
│   ├── check_func.py      # Check creation/mutation logic
│   └── run_func.py        # Run submission logic
├── adapter/               # Platform abstraction layer
│   ├── base.py            # BaseAdapter abstract class
│   ├── dbt_adapter/       # dbt implementation (primary)
│   └── sqlmesh_adapter.py # SQLMesh implementation (experimental)
├── models/                # Pydantic data models
│   ├── types.py           # Run, Check, RunType, RunStatus enums
│   ├── check.py           # CheckDAO (in-memory storage)
│   └── run.py             # RunDAO (in-memory storage)
├── state/                 # State persistence layer
│   ├── state_loader.py    # Abstract RecceStateLoader
│   ├── local.py           # FileStateLoader (local JSON)
│   └── cloud.py           # CloudStateLoader (Recce Cloud + S3)
├── tasks/                 # Check execution tasks
│   ├── core.py            # Task base class
│   ├── query.py           # Query execution
│   ├── profile.py         # Statistical profiling
│   ├── valuediff.py       # Column value comparison
│   └── ...
├── event/                 # Telemetry (Sentry, Amplitude)
├── util/                  # Utilities (Recce Cloud client, etc.)
└── data/                  # Compiled frontend static assets (do not edit directly)

js/                        # Frontend (Next.js)
├── src/
│   ├── lib/
│   │   ├── api/           # API client files (checks.ts, runs.ts, etc.)
│   │   └── hooks/         # React contexts & custom hooks
│   ├── components/        # React components
│   │   ├── lineage/       # Lineage visualization
│   │   ├── check/         # Check management UI
│   │   ├── run/           # Run execution UI
│   │   └── ...
│   ├── constants/
│   └── utils/
└── package.json
```

## Development Commands

### Backend (Python)

```bash
# Install in development mode with dev dependencies
make install-dev
# OR
pip install -e .[dev]
pre-commit install

# Run the server locally
recce server

# Code formatting (Black + isort)
make format

# Linting
make flake8

# Code quality checks (no modifications)
make check

# Run tests
make test
pytest tests

# Run tests with coverage
make test-coverage
pytest --cov=recce --cov-report=html --cov-report=term tests

# Test across multiple dbt versions
make test-tox
tox run-parallel

# Test across multiple Python versions (3.9-3.13)
make test-tox-python-versions
tox run-parallel -e 3.9,3.10,3.11,3.12,3.13

# Run a single test
pytest tests/test_specific.py::test_function_name
```

### Frontend (TypeScript/React)

```bash
# Install frontend dependencies
cd js
pnpm install

# Run Next.js dev server with Turbopack
pnpm dev
# OR
make dev

# Build frontend (outputs to js/out/, then moves to recce/data/)
cd js
pnpm run build

# Linting
pnpm run lint
pnpm run lint:fix

# Type checking
pnpm run type:check

# Tests
pnpm test

# Clean build artifacts
pnpm run clean
```

### Full Build Workflow

When you modify frontend code and want to test it with the Python backend:

1. Build frontend: `cd js && pnpm run build`
2. This automatically moves built files to `recce/data/`
3. Run backend: `recce server`

## Important Technical Details

### State Management

- **RecceContext** is the central singleton that holds:
  - Current dbt project artifacts (manifest, catalog)
  - Adapter instance (DbtAdapter or SQLMeshAdapter)
  - CheckDAO and RunDAO for in-memory storage
  - State loader for persistence

- **State Persistence**:
  - Local mode: Saves to `recce_state.json` in project directory
  - Cloud mode: Syncs with Recce Cloud via S3 with server-side encryption
  - State auto-saves on server termination

### Check Execution Flow

1. User creates a check via UI
2. Frontend POSTs to `/api/checks` → `check_func.py` creates check
3. User runs check → Frontend POSTs to `/api/runs` → `run_func.py` submits task
4. Backend executes task asynchronously using appropriate `Task` class
5. Frontend polls `/api/runs/{run_id}/wait` for completion
6. Results stored in `Run` object with status tracking

### Adapter Pattern

- Adapters are loaded dynamically based on CLI flags (`--sqlmesh`)
- Each adapter must implement `BaseAdapter` interface:
  - `get_lineage()` - Return DAG structure
  - `get_model()` - Retrieve model details
  - `execute_sql()` - Run SQL queries
  - Platform-specific artifact parsing (manifest, catalog, etc.)

### Version Management

- Single source of truth: `recce/VERSION` file
- Read by `setup.py` for package versioning
- Frontend reads at runtime for display
- Server checks PyPI on startup to notify about updates

### Configuration

- `recce.yml` defines preset checks
- Validated at startup with check-type-specific validators
- Singleton pattern (`RecceConfig`) prevents multiple loads
- Supports environment-specific settings

### Telemetry

- Sentry integration for error tracking (opt-out via env var)
- Amplitude analytics for usage tracking (opt-in)
- Event tracking decorators on critical paths
- Different tracking for Recce Cloud instances (via `RECCE_CLOUD_INSTANCE` env var)

## Testing Strategy

- **Python Unit Tests**: `pytest` in `tests/` directory
- **Frontend Tests**: Jest + React Testing Library in `js/`
- **Integration Tests**: Separate CI jobs in `integration_tests/` for dbt and SQLMesh
- **Multi-Version Testing**: Tox for testing against dbt 1.5-1.8 and Python 3.9-3.13

## CI/CD

- **tests-python.yaml**: Python unit tests on multiple versions
- **tests-js.yaml**: Frontend linting and tests
- **build-statics.yaml**: Auto-builds and commits frontend when merged to main
- **integration-tests.yaml**: Full dbt project tests
- **release.yaml**: Builds and publishes to PyPI on version tags
- **nightly.yaml**: Runs full test matrix nightly

## Code Style

- **Python**: Black (line length 120) + isort + flake8
- **TypeScript**: ESLint + Prettier
- **Pre-commit hooks**: Configured to run formatters and linters

## Working with the Codebase

### Adding a New Check Type

1. Create a new task class in `recce/tasks/` extending `Task`
2. Implement `execute()` method with check logic
3. Add run type enum to `recce/models/types.py`
4. Add API handler in `recce/apis/run_func.py`
5. Create frontend UI component in `js/src/components/`
6. Add API client method in `js/src/lib/api/`
7. Update validation in `recce/config.py` for `recce.yml` support

### Adding a New Adapter

1. Create new adapter file in `recce/adapter/` extending `BaseAdapter`
2. Implement all abstract methods (get_lineage, get_model, execute_sql, etc.)
3. Add CLI flag in `recce/cli.py` to load new adapter
4. Update `RecceContext` initialization to support new adapter type
5. Add integration tests in `integration_tests/`

### Debugging

- Backend logs to console and `recce_error.log`
- Frontend development: Use React DevTools and browser console
- Use `recce server --debug` for verbose logging

## Distribution

- **PyPI Package**: `pip install recce`
- **Entry Point**: `recce` CLI command → `recce.cli:cli`
- **Embedded Frontend**: Static files bundled in Python package at install time
- **Self-Contained**: Single pip install provides full stack (no separate Node deployment)

---

## Individual Preferences
- @~/.claude/recce.md
