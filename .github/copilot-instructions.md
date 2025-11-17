# Recce Copilot Instructions

## Project Overview

Recce is a data validation and review tool for dbt and SQLMesh projects. It's a Python/TypeScript monorepo providing CLI
tools and a web UI for comparing data environments, performing diffs, and collaborative review.

**Key Info:**

- **Type:** Python package (main) + TypeScript/React frontend + lightweight recce-cloud CLI
- **Languages:** Python 3.9-3.13, TypeScript/React 19, Next.js 16
- **Size:** ~50K lines (Python: 30K, TypeScript: 20K)
- **Main Commands:** `recce server`, `recce run`, `recce-cloud upload`
- **Frameworks:** FastAPI, Next.js, React 19, Chakra UI, pnpm

## Build & Validation

### Python Backend - ALWAYS use these commands in order

**Installation (Development):**

```bash
# Always run these together - pre-commit hooks are required
make install-dev
# OR
pip install -e .[dev]
pre-commit install
```

**Code Quality - Run before committing:**

```bash
# Format code (Black + isort) - always run first
make format

# Check without modifying
make check  # Runs black --check, isort --check, flake8

# Lint only
make flake8
```

**Testing:**

```bash
# Basic tests - fast, run for every change
make test
# OR
pytest tests

# With coverage report (htmlcov/index.html)
make test-coverage

# Multi-version testing (dbt 1.6-1.9, Python 3.9-3.13)
make test-tox                    # ~5-10 minutes
make test-tox-python-versions    # ~10-15 minutes
```

**Common Errors & Fixes:**

- `ImportError` after adding dependencies: Run `pip install -e .[dev]` again
- `flake8` failures: Run `make format` first, then check `.flake8` config
- Test failures: Check if dbt artifacts exist in `integration_tests/dbt/target` and `integration_tests/dbt/target-base`

# Updated Section for .github/copilot-instructions.md

Replace the **TypeScript Frontend** section and the **CI/CD Validation Pipelines** sections with the updated content
below:

---

### TypeScript Frontend - CRITICAL build workflow

**Installation:**

```bash
cd js
pnpm install  # Uses pnpm 10, NOT npm or yarn
```

**Development Server:**

```bash
cd js
pnpm dev      # Runs Next.js with Turbopack on port 3000
# OR from root
make dev
```

**Build Process - MUST follow this sequence:**

```bash
cd js
pnpm run build
# This does:
# 1. Cleans ../recce/data/
# 2. Builds Next.js to js/out/
# 3. Moves js/out/ to ../recce/data/
# You MUST run this after ANY frontend changes before testing with 'recce server'
```

**Linting & Type Checking:**

```bash
cd js
pnpm lint          # Biome lint & format check
pnpm lint:fix      # Auto-fix with Biome
pnpm type:check    # TypeScript compiler
```

**Common Errors & Fixes:**

- Changes not appearing in `recce server`: Run `cd js && pnpm run build` then restart server
- `pnpm: command not found`: Install with `npm install -g corepack@latest && corepack enable`
- Build fails: Check Node version is >=20 (`node --version`)
- Type errors: Run `pnpm type:check` to see full error messages
- Biome lint failures: Run `pnpm lint:fix` for auto-fixable issues

---

## CI/CD Validation Pipelines

**GitHub Actions workflows that MUST pass:**

1. **tests-python.yaml** - Runs on `recce/**` or `tests/**` changes

- Flake8 linting (Python 3.10)
- Tests across dbt 1.6-1.9 (Python 3.10)
- Tests across Python 3.11-3.13 (latest dbt)
- Codecov upload

2. **tests-js.yaml** - Runs on `js/**` changes

- Biome linting with frozen lockfile
- Frontend build verification

3. **integration-tests.yaml** - Full dbt smoke tests

- Matrix: Python 3.9-3.13 × dbt 1.6-latest
- Runs `integration_tests/dbt/smoke_test.sh`
- Tests: `recce run`, `recce summary`, `recce server`

4. **integration-tests-sqlmesh.yaml** - SQLMesh compatibility

- Python 3.11 + SQLMesh latest
- Runs `integration_tests/sqlmesh/test_server.sh`

**To replicate CI locally:**

```bash
# Python style check
pip install flake8 && make flake8

# Python tests (single version)
make test

# Python tests (multi-version) - matches CI
make test-tox

# Frontend lint + build - matches CI
cd js && pnpm install --frozen-lockfile && pnpm lint && pnpm run build

# Integration test (dbt)
cd integration_tests/dbt && ./smoke_test.sh

# Integration test (SQLMesh)
cd integration_tests/sqlmesh && ./prep_env.sh && ./test_server.sh
```

## Project Layout

### Root Files

- `setup.py` - Main package (recce), installs `recce` command
- `setup_cloud.py` - Cloud CLI (recce-cloud), installs `recce-cloud` command
- `Makefile` - All build/test commands
- `tox.ini` - Multi-version testing (dbt 1.6-1.9)
- `pyproject.toml` - Black/isort config (line-length: 120)
- `.flake8` - Linting rules (ignores W605, E501, E203, W503, F811)
- `.pre-commit-config.yaml` - Git hooks (Black, isort, flake8, trailing whitespace)

### Python Backend (`recce/`)

```
recce/
├── cli.py              # Main CLI entry point (click commands)
├── __init__.py         # Version loading
├── VERSION             # Single source of truth for version
├── adapter/            # dbt/SQLMesh adapters (BaseAdapter interface)
│   ├── dbt_adapter.py
│   └── sqlmesh_adapter.py
├── apis/               # FastAPI routes
│   ├── server.py       # Main FastAPI app
│   ├── check_func.py   # Check CRUD
│   └── run_func.py     # Run execution
├── core.py             # RecceContext singleton
├── models/             # Pydantic models (Check, Run, etc.)
├── tasks/              # Async task execution (QueryTask, DiffTask, etc.)
├── state/              # State persistence (FileStateLoader, CloudStateLoader)
├── config.py           # recce.yml config loading
└── data/               # GENERATED - DO NOT EDIT (from js/out/)
```

### TypeScript Frontend (`js/`)

```
js/
├── package.json        # pnpm 10, Node >=20, React 19, Next.js 16
├── tsconfig.json       # TypeScript config
├── next.config.mjs     # Next.js config (output: 'export')
├── src/
│   ├── app/            # Next.js app router
│   ├── lib/
│   │   ├── api/        # API client (axios)
│   │   └── hooks/      # React hooks
│   ├── components/     # React components (Chakra UI)
│   ├── constants/
│   └── utils/
├── .husky/             # Git hooks for JS files
└── out/                # Build output (moved to ../recce/data/)
```

### Cloud CLI (`recce_cloud/`)

```
recce_cloud/
├── cli.py              # recce-cloud CLI (click)
├── upload.py           # Artifact upload logic
├── ci_providers.py     # GitHub/GitLab detection
└── artifact.py         # Artifact validation
```

### Tests (`tests/`)

- Unit tests with pytest
- Integration tests in `integration_tests/dbt/` and `integration_tests/sqlmesh/`
- Test coverage report: `htmlcov/index.html`

### Configuration Files

- **Python linting:** `.flake8` (line-length 120, ignores E203/W503/E501)
- **Python formatting:** `pyproject.toml` (Black line-length 120, isort profile black)
- **Frontend:** `js/eslint.config.mjs`, `js/tsconfig.json`
- **Pre-commit:** `.pre-commit-config.yaml` (excludes `recce/data/`)

## Architecture Notes

**Dual Package Structure:**

- Main package (`recce`) has 20+ dependencies (FastAPI, dbt parsing, etc.)
- Cloud CLI (`recce-cloud`) has only 3 dependencies (click, requests, rich) for fast CI installs
- Both share `recce/VERSION` file

**State Management:**

- `RecceContext` singleton holds all runtime state
- Supports local (`FileStateLoader`) and cloud (`CloudStateLoader`) persistence
- State auto-saves to `recce_state.json` on server shutdown
- NEVER commit state files (user-specific runtime data)

**Frontend Build:**

- Next.js builds static export to `js/out/`
- Build script moves to `recce/data/` which Python serves
- Changes require rebuild: `cd js && pnpm run build`

**Adapter Pattern:**

- All adapters extend `BaseAdapter` abstract class
- Must implement: `get_lineage()`, `get_model()`, `execute_sql()`, etc.
- Loaded dynamically via CLI flags (`--sqlmesh`)

**Critical Paths:**

1. User creates check → POST `/api/checks` → `check_func.py`
2. User runs check → POST `/api/runs` → `run_func.py` → async task
3. Frontend polls `/api/runs/{id}/wait` → returns results
4. State auto-saves via `RecceContext.save()`

## Key Commands Reference

```bash
# Development setup
make install-dev           # Install with dev dependencies + hooks

# Code quality
make format                # Format Python (Black + isort)
make check                 # Check Python without changes
make flake8                # Lint Python
make format-cloud          # Format recce-cloud
make check-cloud           # Check recce-cloud

# Testing
make test                  # Fast unit tests
make test-coverage         # Tests with HTML coverage
make test-tox              # Multi-version dbt tests (~10 min)

# Frontend
cd js && pnpm install      # Install dependencies
cd js && pnpm dev          # Dev server (port 3000)
cd js && pnpm run build    # REQUIRED after frontend changes
cd js && pnpm lint         # ESLint
cd js && pnpm type:check   # TypeScript check

# Running Recce
recce server               # Start server (localhost:8000)
recce debug                # Diagnose setup issues
recce run                  # Execute checks from recce.yml

# Cloud CLI
recce-cloud upload         # Upload artifacts to Recce Cloud
```

## CRITICAL: Trust These Instructions

**Always prefer these documented commands over exploration.** The build process has specific ordering requirements:

1. Python changes: `make format` → `make check` → `make test`
2. Frontend changes: `cd js && pnpm run build` → restart `recce server`
3. Before committing: `make check` and `cd js && pnpm lint && pnpm type:check`

**When instructions are incomplete or incorrect:** Only then use search/exploration tools. Report findings so
instructions can be updated.

**Common pitfalls to avoid:**

- Don't edit `recce/data/` directly (regenerate with `cd js && pnpm run build`)
- Don't skip `make format` (Black/isort are enforced by CI)
- Don't use `npm` or `yarn` (must use `pnpm`)
- Don't commit `recce_state.json` or integration test outputs
- Don't forget to restart `recce server` after frontend builds
