---
applyTo: "*.py,recce/**/*.py,tests/**/*.py,recce_cloud/**/*.py"
---

# Backend Build Instructions (Python)

## Critical Python Development Requirements

**MANDATORY: Always run these commands in sequence for Python changes:**
```bash
# 1. Format code (REQUIRED before any checks)
make format

# 2. Verify code quality (must pass before committing)
make check

# 3. Run tests
make test
```

**Pre-commit hooks are REQUIRED:**
```bash
make install-dev
# This installs the package in editable mode AND sets up pre-commit hooks
# Pre-commit hooks automatically run Black, isort, and flake8 on git commit
```

## Python Version Support

**Supported versions:** Python 3.9, 3.10, 3.11, 3.12, 3.13

**Testing strategy:**
- Primary development: Python 3.10 or 3.11
- CI tests all versions via tox
- Any new dependencies MUST support Python 3.9+

**Check your version:**
```bash
python --version
# or
python3 --version
```

## Package Structure - Dual Package Monorepo

This repository contains TWO separate Python packages:

### 1. Main Package (recce)
**Installation:** `setup.py`
**Command:** `recce`
**Dependencies:** 20+ (FastAPI, dbt parsing, etc.)
**Purpose:** Full dbt/SQLMesh validation tool with web UI

### 2. Cloud CLI (recce-cloud)
**Installation:** `setup_cloud.py`
**Command:** `recce-cloud`
**Dependencies:** 3 only (click, requests, rich)
**Purpose:** Lightweight CI/CD artifact upload tool

**CRITICAL: These are separate packages with separate installations:**
```bash
# Main package
pip install -e .[dev]        # Development
pip install .                # Production

# Cloud CLI
python setup_cloud.py develop    # Development
python setup_cloud.py install    # Production
```

## Development Setup

**Initial setup (ALWAYS run this first):**
```bash
make install-dev
# This does:
# 1. pip install -e .[dev] - Installs package in editable mode with dev dependencies
# 2. pre-commit install - Sets up git hooks for Black, isort, flake8
```

**What gets installed:**
- Main package dependencies (boto3, fastapi, uvicorn, dbt parsing libs, etc.)
- Dev dependencies (pytest, black, isort, flake8, tox, etc.)
- Git pre-commit hooks (.pre-commit-config.yaml)

**Verify installation:**
```bash
recce version           # Should print version number
which pre-commit        # Should show path to pre-commit
```

## Code Quality - MANDATORY Workflow

**1. Format code (ALWAYS run first):**
```bash
make format
# Runs:
# - Black (formatter, line-length 120)
# - isort (import sorter, profile=black)
# Modifies files in place
```

**2. Check code quality (run before committing):**
```bash
make check
# Runs (without modifying files):
# - black --check
# - isort --check
# - flake8
# ALL must pass before committing
```

**3. Individual checks (if needed):**
```bash
make flake8    # Lint only
black --check recce tests    # Check formatting only
isort --check recce tests    # Check import order only
```

**For recce-cloud package:**
```bash
make format-cloud    # Format recce_cloud/
make check-cloud     # Check recce_cloud/
make flake8-cloud    # Lint recce_cloud/
```

## Code Style Configuration

**Black (formatter):**
- Line length: 120 characters
- Config: `pyproject.toml`
- Targets: `./recce ./tests` or `./recce_cloud`

**isort (import sorter):**
- Profile: black (compatible with Black)
- Config: `pyproject.toml`
- Targets: `./recce ./tests` or `./recce_cloud`

**flake8 (linter):**
- Line length: 120 characters
- Config: `.flake8`
- Key ignores:
  - E501 (line too long - handled by Black)
  - E203 (whitespace before ':' - Black conflict)
  - W503 (line break before binary operator - Black conflict)
  - W605 (invalid escape sequence in regex)
  - F811 (redefinition of unused name)
- Targets: `recce,tests` or `recce_cloud`

**Pre-commit hooks (.pre-commit-config.yaml):**
- Runs on `git commit` automatically
- Excludes: `recce/data/` (generated frontend files)
- Checks: trailing whitespace, end-of-file fixer, YAML check, Black, isort, flake8

## Testing

**Quick tests (run frequently):**
```bash
make test
# or
pytest tests
# Fast unit tests, takes ~30 seconds
```

**Tests with coverage:**
```bash
make test-coverage
# Generates HTML report: htmlcov/index.html
# Shows coverage stats in terminal
```

**Run specific test:**
```bash
pytest tests/test_specific.py::test_function_name
pytest tests/test_file.py -v
pytest tests/ -k "test_pattern"
```

**Multi-version testing (matches CI):**
```bash
make test-tox
# Tests across dbt 1.6, 1.7, 1.8, 1.9, latest
# Uses Python 3.10
# Takes ~5-10 minutes
# Runs in parallel

make test-tox-python-versions
# Tests across Python 3.9, 3.10, 3.11, 3.12, 3.13
# Uses latest dbt
# Takes ~10-15 minutes
```

**Tox configuration (tox.ini):**
- Environments: `dbt1.6`, `dbt1.7`, `dbt1.8`, `dbt1.9`, `dbtlatest`
- Python versions: `3.9`, `3.10`, `3.11`, `3.12`, `3.13`
- Base Python for dbt tests: 3.10
- Dependencies: pytest, pytest-asyncio, pytest-cov, pandas, duckdb, httpx, dbt-duckdb
- Only latest dbt tests include mcp>=1.0.0

## Common Errors & Solutions

**Error: "ModuleNotFoundError" after adding dependency**
- **Cause:** Forgot to reinstall package
- **Fix:** `pip install -e .[dev]` or `make install-dev`

**Error: "flake8 errors" on commit**
- **Cause:** Forgot to format code first
- **Fix:** `make format` then try commit again

**Error: "ImportError: cannot import name X"**
- **Cause:** Circular imports or missing __init__.py
- **Fix:** Check import order, ensure __init__.py exists in package dirs

**Error: "pytest: command not found"**
- **Cause:** Dev dependencies not installed
- **Fix:** `make install-dev`

**Error: "black/isort version mismatch"**
- **Cause:** Old pre-commit hooks
- **Fix:** `pre-commit autoupdate` then `pre-commit install`

**Error: Tests pass locally but fail in CI**
- **Cause:** Different dbt version or Python version
- **Fix:** Run `make test-tox` to test multiple versions locally

**Error: "No module named 'recce'" when running tests**
- **Cause:** Package not installed in editable mode
- **Fix:** `pip install -e .[dev]`

## Architecture - Key Modules

### recce/ (Main Package)

**Entry Point:**
- `cli.py` - Click CLI commands (server, run, diff, debug, version, etc.)
- `__init__.py` - Version loading from VERSION file

**Core:**
- `core.py` - RecceContext singleton (holds state, adapter, DAOs)
- `config.py` - recce.yml configuration loading and validation
- `VERSION` - Single source of truth for version number

**Adapters:**
- `adapter/base_adapter.py` - BaseAdapter abstract class
- `adapter/dbt_adapter.py` - DbtAdapter (parses manifest.json, catalog.json)
- `adapter/sqlmesh_adapter.py` - SQLMeshAdapter
- **CRITICAL:** All adapters MUST implement ALL BaseAdapter methods

**API Layer:**
- `apis/server.py` - FastAPI application and routes
- `apis/check_func.py` - Check CRUD endpoints
- `apis/run_func.py` - Run execution and polling endpoints
- Uses: FastAPI, uvicorn, websockets

**State Management:**
- `state/state.py` - RecceState, RecceStateMetadata, ArtifactsRoot models
- `state/loader.py` - FileStateLoader, CloudStateLoader classes
- **CRITICAL:** State persistence must work with BOTH loaders

**Models:**
- `models/types.py` - Pydantic models (Check, Run, CheckType, RunType)
- Uses: pydantic for validation and serialization

**Tasks (Async Execution):**
- `tasks/` - Task classes extending base Task
- Examples: QueryTask, DiffTask, ProfileDiffTask, RowCountDiffTask
- Executed asynchronously, results stored in Run objects

**Utilities:**
- `git.py` - Git operations (current_branch, etc.)
- `pull_request.py` - PR/MR detection
- `exceptions.py` - RecceException and subclasses

**Data (Generated):**
- `data/` - Frontend build output (DO NOT EDIT)
- Auto-generated by: `cd js && pnpm run build`

### tests/

**Structure:**
- Unit tests with pytest
- Test files follow pattern: `test_*.py`
- Uses fixtures for common setup
- Integration test scripts in `integration_tests/`

**Test dependencies:**
- pytest >= 4.6
- pytest-asyncio (async test support)
- pytest-cov (coverage reporting)
- pandas, duckdb, httpx (test utilities)

### recce_cloud/ (Cloud CLI)

**Minimal structure:**
- `cli.py` - Click CLI for recce-cloud command
- `upload.py` - Artifact upload logic
- `ci_providers.py` - GitHub Actions/GitLab CI detection
- `artifact.py` - Artifact validation
- `__init__.py` - Version loading (shares recce/VERSION)

**Dependencies (only 3):**
- click >= 7.1
- requests >= 2.28.1
- rich >= 12.0.0

**Use case:** Fast CI/CD artifact uploads without full recce dependencies

## State Files - NEVER COMMIT

**DO NOT commit these files:**
- `recce_state.json` - User-specific runtime state
- `state.json` - Alternative state file name
- `integration_tests/dbt/recce_state.json`
- `integration_tests/dbt/recce_summary.md`
- Any `.duckdb` files in integration tests

**These are gitignored but check before committing**

## Integration Tests

**dbt integration tests:**
```bash
cd integration_tests/dbt
./smoke_test.sh
# Tests: recce run, recce summary, recce server
# Requires: dbt, duckdb
```

**SQLMesh integration tests:**
```bash
cd integration_tests/sqlmesh
./prep_env.sh
./test_server.sh
# Requires: sqlmesh
```

## CI/CD Validation

**GitHub Actions workflows (must pass):**

1. **tests-python.yaml** - Triggered by: `recce/**`, `tests/**`, `setup.py`
   - Flake8 linting (Python 3.10)
   - Tests across dbt 1.6-1.9 (Python 3.10)
   - Tests across Python 3.11-3.13 (latest dbt)
   - Codecov upload

2. **integration-tests.yaml** - Full smoke tests
   - Matrix: Python 3.9-3.13 × dbt 1.6-latest
   - Runs: `integration_tests/dbt/smoke_test.sh`

3. **integration-tests-sqlmesh.yaml**
   - Python 3.11 + SQLMesh latest
   - Runs: `integration_tests/sqlmesh/test_server.sh`

4. **integration-tests-cloud.yaml** - Cloud sync tests
   - Requires: GITHUB_TOKEN, RECCE_API_TOKEN
   - Tests cloud mode with real API

**Replicate CI locally:**
```bash
# Style check
pip install flake8 && make flake8

# Basic tests
make test

# Multi-version tests (matches CI)
make test-tox

# Integration test
cd integration_tests/dbt && ./smoke_test.sh
```

## Key Patterns & Conventions

**Singleton Pattern:**
- `RecceContext` - Central state holder
- `RecceConfig` - Configuration loader
- Only one instance should exist per process

**Adapter Pattern:**
- All adapters extend `BaseAdapter`
- Must implement: `get_lineage()`, `get_model()`, `execute_sql()`, etc.
- Loaded dynamically based on CLI flags

**State Loader Pattern:**
- `FileStateLoader` - Local file persistence
- `CloudStateLoader` - S3/cloud persistence
- Both implement same interface for interchangeability

**DAO Pattern:**
- `CheckDAO` - Check storage and retrieval
- `RunDAO` - Run storage and retrieval
- In-memory storage with state persistence

**Task Execution:**
1. User triggers check via API
2. POST to `/api/runs` creates Run object
3. Task submitted to executor (async)
4. Frontend polls `/api/runs/{id}/wait`
5. Results stored in Run, persisted to state

## Version Management

**Single source of truth:** `recce/VERSION`

**Read by:**
- `setup.py` - Package version
- `setup_cloud.py` - Cloud CLI version
- `recce/__init__.py` - Runtime version
- Frontend reads at runtime for display

**Update version:**
1. Edit `recce/VERSION` only
2. Both packages automatically use same version
3. GitHub releases trigger PyPI publish

## Dependencies - Key Libraries

**Main package (setup.py):**
- **Web framework:** fastapi, uvicorn, websockets
- **dbt parsing:** No direct dbt dependency (parses JSON artifacts)
- **Data processing:** boto3 (S3), deepdiff, sqlglot, pandas (tests)
- **CLI:** click >= 7.1
- **Utilities:** GitPython, PyGithub, requests, rich, ruamel.yaml
- **Validation:** pydantic, portalocker
- **Monitoring:** sentry-sdk
- **Date/time:** python-dateutil, pytz
- **Other:** jinja2, py-markdown-table, python-multipart, packaging

**Dev dependencies (extras_require['dev']):**
- **Testing:** pytest >= 4.6, pytest-asyncio, pytest-cov, pytest-flake8
- **Formatting:** black >= 25.1.0, isort >= 6.0.1
- **Linting:** flake8 >= 7.2.0
- **Pre-commit:** pre-commit >= 4.2.0
- **Type checking:** pytest-mypy
- **Multi-version:** tox
- **Utilities:** twine (packaging), pandas, httpx

**MCP support (optional extras_require['mcp']):**
- mcp >= 1.0.0

## Quick Command Reference

```bash
# Setup
make install-dev              # Install with dev deps + hooks

# Code quality
make format                   # Format with Black + isort
make check                    # Check without modifying
make flake8                   # Lint only

# Cloud CLI
make format-cloud             # Format recce_cloud/
make check-cloud              # Check recce_cloud/

# Testing
make test                     # Quick unit tests (~30s)
make test-coverage            # With coverage report
make test-tox                 # Multi dbt version (~10min)
make test-tox-python-versions # Multi Python version (~15min)
pytest tests/test_x.py        # Specific test

# Run application
recce server                  # Start server (port 8000)
recce debug                   # Diagnose setup
recce run                     # Execute checks
recce version                 # Show version
recce-cloud upload            # Upload artifacts
```

## Working with Adapters

**Adding a new adapter:**
1. Create file in `recce/adapter/` extending `BaseAdapter`
2. Implement ALL abstract methods (no partial implementations)
3. Add CLI flag in `recce/cli.py` to trigger loading
4. Update `RecceContext.load()` to instantiate new adapter
5. Test with both base and current environments

**Critical adapter methods:**
- `get_lineage()` - Return DAG structure
- `get_model(node_id)` - Retrieve model details
- `execute_sql(sql, fetch=True)` - Run queries
- `generate_sql(sql, base_only)` - Generate SQL for environment
- `get_catalog()` - Return catalog data

## Working with State

**State persistence flow:**
1. Changes made via API calls (check/run CRUD)
2. `RecceContext` holds in-memory state
3. Auto-save on server shutdown
4. State loader (File or Cloud) handles persistence

**State file structure:**
- `metadata` - Schema version, recce version, timestamp
- `runs` - List of Run objects
- `checks` - List of Check objects
- `artifacts` - Base and current environment artifacts
- `git` - Git branch info
- `pull_request` - PR/MR metadata

**NEVER edit state files manually** - Use API or commands

## Critical Reminders for Backend Development

1. **Always run `make format` before `make check`** - Black/isort must run first
2. **Pre-commit hooks are required** - Auto-installed with `make install-dev`
3. **Never skip `make test` before committing** - Catches regressions early
4. **All adapters must implement ALL BaseAdapter methods** - Partial implementations fail
5. **Support Python 3.9+** - Check dependencies are compatible
6. **State files are user-specific** - Never commit `recce_state.json`
7. **Two separate packages** - Main (`setup.py`) and Cloud (`setup_cloud.py`)
8. **Line length is 120** - Not 80, not 100, exactly 120
9. **Version is in recce/VERSION** - Don't hardcode versions elsewhere
10. **Frontend is in recce/data/** - Never edit, it's auto-generated

## Debugging Tips

**Server won't start:**
- Check `recce debug` for artifact/connection issues
- Verify dbt artifacts in `target/` and `target-base/`
- Check Python version is 3.9+

**Tests failing:**
- Run with `-v` flag: `pytest tests/test_x.py -v`
- Check test dependencies installed: `pip install -e .[dev]`
- Try fresh install: `pip uninstall recce && make install-dev`

**Import errors:**
- Verify package installed: `pip list | grep recce`
- Check for circular imports in new code
- Ensure `__init__.py` exists in package directories

**Type checking (optional):**
- Mypy not in standard workflow but available
- Run: `mypy recce/` if needed

**Trust these instructions.** The Python backend has specific requirements for code quality, testing, and packaging. Only search for additional information if these instructions are incomplete or incorrect.
