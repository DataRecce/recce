# AGENTS.md

This file provides guidance to AI Agents when working with code in this repository.
For Claude-specific guidance, also see `CLAUDE.md`.

## Overview

Recce is a data validation and review tool for dbt projects. It helps data teams preview, validate, and ship data
changes with confidence by providing lineage visualization, data diffing, and collaborative review features.

## Critical Constraints & Guidelines

### Do NOT:

- ❌ **Commit state files**: Never commit `recce_state.json` or any `state.json` files (contains user-specific runtime
  state)
- ❌ **Edit generated files**: Never edit files in `recce/data/` directly (auto-generated from `js/out/` during frontend
  build)
- ❌ **Break adapter interface**: All adapters must implement ALL `BaseAdapter` abstract methods (partial implementations
  will fail at runtime)
- ❌ **Skip Python version compatibility**: Any new dependencies must support Python 3.9+ (we test 3.9-3.13)
- ❌ **Bypass frontend build**: If you modify frontend code, you MUST run `cd js && pnpm run build` to update
  `recce/data/` before testing with `recce server`
- ❌ **Use interactive git commands**: Never use `git rebase -i`, `git add -i`, or similar (interactive prompts don't
  work in CLI context)
- ❌ **Create worktrees in subdirectories**: Git worktrees must only be created at the repository root (`/Users/jaredmscott/repos/recce/recce`), never inside subdirectories like `js/`
- ❌ **Mix concerns across layers**: Keep strict separation between models, tasks, APIs, and adapters (see Code
  Organization Philosophy below)
- ❌ **Import UI internals from OSS**: OSS app code must not import from `js/packages/ui/src/*` directly; use
  `@datarecce/ui` export paths instead

### Always:

- ✅ **Build frontend before testing**: When frontend changes are made, run `cd js && pnpm run build` then restart
  `recce server`
- ✅ **Test across dbt versions**: For adapter changes, run `make test-tox` to verify against dbt 1.6-1.9
- ✅ **Use pre-commit hooks**: Automatically installed with `make install-dev` (handles Black, isort, flake8)
- ✅ **Maintain state loader abstraction**: All state persistence must work with both `FileStateLoader` (local) and
  `CloudStateLoader` (Recce Cloud)
- ✅ **Update both base and current**: When modifying check logic, ensure changes work for both environments being
  compared
- ✅ **Follow monorepo structure**: Backend (Python) and frontend (TypeScript) are tightly coupled but maintain clear
  boundaries
- ✅ **Keep OSS shell thin**: Route composition and OSS-only glue stay in `js/app`; shared UI and logic live in
  `@datarecce/ui`
- ✅ **Use standard American English**: All repository communication and documentation must be written in standard American English.
- ✅ **Use designated directories for temporary AI documentation**: Place working documents in appropriate gitignored directories (see AI Agent Documentation Guidelines below)

## AI Agent Documentation Guidelines

AI agents (Claude, GitHub Copilot, etc.) should use the following directory structure for temporary working documents:

- **`docs/plans/`** - Implementation plans, design documents, and architectural proposals
- **`docs/tasks/`** - Task lists, tracking documents, and work breakdown structures
- **`docs/summaries/`** - Summary documents, status reports, and progress updates

**Important Rules:**

- ❌ **Do NOT commit these files**: All files in `docs/plans/`, `docs/tasks/`, and `docs/summaries/` are gitignored
- ✅ **Use for working documents**: These directories are intended for temporary AI-generated documentation during development
- ✅ **Keep them local**: These files help maintain context across sessions but should never be committed to the repository
- ✅ **Clean up when done**: Remove obsolete planning documents after implementation is complete

**Example Usage:**
```bash
# Implementation plans
docs/plans/feature-new-check-type.md
docs/plans/refactor-adapter-pattern.json

# Task tracking
docs/tasks/sprint-01-tasks.md
docs/tasks/bug-fixes-queue.json

# Summary reports
docs/summaries/week-01-progress.md
docs/summaries/performance-analysis.json
```

## Git Development Practices

### Branch Naming

All new code MUST be developed in a branch with one of these prefixes, branched directly from `main`:

- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `hotfix/` - Critical production fixes

```bash
# Create a new feature branch
git checkout main
git pull origin main
git checkout -b feature/my-new-feature
```

### Commit Requirements

> **REQUIRED: All commits MUST use `--signoff` (or `-s`).** This is non-negotiable and absolutely required for all commits in this repository. Commits without sign-off will be rejected.

**1. Sign-off (DCO):** Every commit MUST include a "Signed-off-by:" line per
the [Developer Certificate of Origin](https://developercertificate.org/):

```bash
git commit -s -m "Your commit message"
# OR
git commit --signoff -m "Your commit message"
```

**2. Semantic/Conventional Commits:** Use structured commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
Signed-off-by: Your Name <your.email@example.com>
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting, no code change
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `chore` - Maintenance tasks (deps, build, CI)

**Examples:**

```bash
git commit -s -m "feat(check): add timeline component for check events"
git commit -s -m "fix(adapter): normalize column casing for Snowflake"
git commit -s -m "docs: update AGENTS.md with git practices"
git commit -s -m "refactor(dataGrid): extract shared utilities"
```

## Development Workflow

Before submitting any code changes, you MUST complete the appropriate workflow below. Pre-commit hooks are mandatory and must never be skipped.

### Backend Changes (Python)

When modifying Python code in `recce/` or `tests/`:

```bash
# 1. Format code (Black + isort)
make format

# 2. Run linting (flake8)
make flake8

# 3. Run tests
make test
# OR for more verbose output:
pytest tests -v

# 4. Commit (hooks will run automatically - NEVER skip them)
git commit -s -m "type(scope): description"
```

### Frontend Changes (TypeScript/React)

When modifying code in `js/`:

```bash
cd js

# 1. Run linting and auto-fix (Biome)
pnpm lint:fix

# 2. Run type checking
pnpm type:check

# 3. Run tests
pnpm test

# 4. Commit (hooks will run automatically - NEVER skip them)
git commit -s -m "type(scope): description"
```

### Pre-Commit Hook Requirements

**CRITICAL: Never skip pre-commit hooks.** The following flags are FORBIDDEN:

- ❌ `git commit --no-verify`
- ❌ `git commit -n`
- ❌ Any method that bypasses hooks

Pre-commit hooks ensure code quality by running:
- **Python**: Black formatting, isort import sorting, flake8 linting
- **Frontend**: `pnpm lint:staged` (Biome) and `pnpm type:check`

If a hook fails:
1. Fix the reported issues
2. Stage the fixes: `git add <fixed-files>`
3. Commit again (do NOT use `--amend` if the original commit failed)

### Full Stack Changes

When changes span both backend and frontend:

```bash
# 1. Complete backend workflow
make format && make flake8 && make test

# 2. Complete frontend workflow
cd js && pnpm lint:fix && pnpm type:check && pnpm test

# 3. Build frontend to test integration
pnpm run build

# 4. Test with backend
cd .. && recce server

# 5. Commit all changes together
git add -A && git commit -s -m "type(scope): description"
```

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
- ✅ `js/app/` imports from `@datarecce/ui` (components, contexts, hooks, lib)
- ✅ `js/packages/ui/` can import within its own package only
- ❌ `js/packages/ui/` NEVER imports from `js/app/` or `js/src/`

### Why This Matters

- **Keeps task execution testable** without spinning up FastAPI server
- **Allows adapter swapping** without breaking existing tasks
- **Enables frontend builds** without Python environment
- **Makes state persistence flexible** (local file vs cloud S3)
- **Prevents circular dependencies** that cause import errors

### Where to Add New Code

| What You're Adding | Where It Goes                                      | What to Import                  |
|--------------------|----------------------------------------------------|---------------------------------|
| New check type     | `tasks/` (new Task class)                          | Can use adapter, models         |
| New API endpoint   | `apis/*_api.py` (route) + `apis/*_func.py` (logic) | Can use tasks, models, adapter  |
| New data model     | `models/` (Pydantic class)                         | Only standard library           |
| Platform support   | `adapter/` (extend BaseAdapter)                    | Can use models only             |
| State storage      | `state/` (extend RecceStateLoader)                 | Can use models only             |
| UI component (shared) | `js/packages/ui/src/components/`               | Use `@datarecce/ui/api`, hooks  |
| UI component (OSS-only shell) | `js/app/`                             | Use `@datarecce/ui` exports     |
| API client (shared) | `js/packages/ui/src/api/`                        | Axios, React Query              |
| OSS tests/utilities | `js/src/`                                        | Prefer `@datarecce/ui` imports  |

## Architecture & Tech Stack

### Monolithic Client-Server Application

### Backend (Python)

- **Python 3.9-3.13** (primary development: 3.10-3.12)
- **FastAPI** - REST API server
- **Click** - CLI framework
- **Pydantic** - Data models and validation
- **dbt adapters** - Platform-specific database connections

- FastAPI REST server that serves static frontend and provides APIs for runs/checks
- CLI built with Click (`recce server`, `recce run`)
- Adapter pattern abstracts different data platforms (dbt-core, SQLMesh)
- Task execution engine runs validation checks asynchronously
- State management supports local file storage or Recce Cloud

### Frontend (TypeScript/React)

- **Node.js >=20** - JavaScript runtime
- **pnpm 10.25.0** - Package manager (NOT npm or yarn)
- **Next.js 16.0.10** - React framework with App Router
- **React 19.2.3** - UI library with new JSX transform
- **TypeScript 5.9** - Type safety
- **MUI 7** - Component library
- **Biome 2.3** - Fast linter and formatter (replaces ESLint + Prettier)
- **Tailwind CSS 4** - Utility-first CSS
- **CodeMirror 6** - Code editor (SQL, YAML support)
- **React Query 5** - API state management
- **Reactflow 12** - Lineage graph visualization

- Next.js 16 app built with React 19, compiled to static files
- UI built in a shared workspace package `@datarecce/ui`
- React Query handles API communication and state management
- Reactflow for lineage graph visualization
- Built frontend is embedded in Python package at `recce/data/`

**Key Design Patterns:**

- **Pluggable Adapter Pattern**: `BaseAdapter` interface allows support for different data platforms (dbt, SQLMesh).
  Each adapter implements platform-specific lineage parsing, model retrieval, and SQL generation.
- **In-Memory State with Persistence**: `RecceContext` holds runtime state (runs, checks, adapter). `CheckDAO` and
  `RunDAO` provide in-memory storage. `RecceStateLoader` abstraction supports `FileStateLoader` (local JSON) or
  `CloudStateLoader` (S3 sync).
- **Task-Based Check Execution**: Each check type (profile_diff, value_diff, row_count_diff, etc.) maps to a `Task`
  class. Tasks are submitted asynchronously via FastAPI, and frontend polls for completion.
- **Static Frontend Bundling**: Next.js builds to static HTML/JS in `js/out/`, which is moved to `recce/data/` and
  served by FastAPI at runtime. No Node.js needed in production.

## Project Structure

```
recce/                     # Backend (Python)
├── apis/                  # FastAPI route handlers
├── adapter/               # dbt/SQLMesh adapter implementations
├── models/                # Pydantic data models
├── tasks/                 # Async check execution (QueryTask, DiffTask, etc.)
├── state/                 # State persistence (FileStateLoader, CloudStateLoader)
├── util/cloud/            # Recce Cloud API clients
├── config.py              # recce.yml config loading
└── data/                  # GENERATED - DO NOT EDIT (from js/out/)

js/                        # Frontend (Next.js)
├── app/                   # OSS Next.js App Router shell (routes/layout only)
├── src/                   # OSS tests + test utilities (Vitest)
│   ├── components/        # Test suites for UI behavior
│   ├── lib/               # Test helpers for data grid + adapters
│   └── testing-utils/     # Shared test harnesses and fixtures
├── packages/
│   ├── ui/                # @datarecce/ui package source
│   │   ├── src/
│   │   │   ├── api/        # Shared API clients
│   │   │   ├── components/ # Shared UI + OSS variants (*Oss)
│   │   │   ├── contexts/   # Shared React contexts
│   │   │   ├── hooks/      # Shared hooks
│   │   │   ├── lib/        # Shared lib utilities
│   │   │   └── styles/     # Shared styles
│   │   └── dist/          # Built package outputs
│   └── storybook/         # @datarecce/storybook - Storybook stories and visual tests
│       ├── stories/        # Component stories
│       ├── .storybook/     # Storybook configuration
│       └── tests/          # Visual regression tests (Playwright)
├── biome.json             # Biome linter & formatter config
├── vitest.config.mts      # Vitest test configuration
├── vitest.setup.mts       # Test setup (mocks, polyfills)
└── package.json
```

## Frontend Separation & Usage Patterns

- `@datarecce/ui` is the source of truth for UI components, contexts, hooks, and API clients.
- OSS Next.js routes/layouts live in `js/app/` and should stay thin (compose `@datarecce/ui` exports only).
- OSS-specific variants are suffixed `*Oss` and live in `js/packages/ui/src/components/` (pages import these via
  `@datarecce/ui/components/...`).
- `js/src/` is test-only (Vitest suites + utilities) and should not contain runtime app code.
- Prefer public export paths (`@datarecce/ui`, `@datarecce/ui/components/...`, `@datarecce/ui/contexts`, etc.); avoid
  deep imports into `js/packages/ui/src`.

## Development Commands

### Backend (Python)

Note that `dbt-core` is
currently [compatible with Python 3.13 for v1.11 and above](https://docs.getdbt.com/faqs/Core/install-python-compatibility).
Use Python 3.12 for better compatibility.

```bash
# Install in development mode with dev dependencies
make install-dev
# OR
pip install -e .[dev]
pre-commit install

# Run the server locally
recce server

# Code formatting (Black + isort) - ALWAYS run first
make format

# Code quality checks (no modifications)
make check

# Linting only
make flake8

# Run tests
make test
pytest tests

# Run tests with coverage
make test-coverage

# Test across multiple dbt versions (1.6-1.9)
make test-tox

# Test across multiple Python versions (3.9-3.13)
make test-tox-python-versions
```

### Frontend (TypeScript/React)

```bash
# Node.js version management - use nave first, fall back to nvm
# The required Node.js version is specified in js/.nvmrc
cd js

# Option 1: nave (preferred)
nave auto pnpm install

# Option 2: nvm (if nave not available)
nvm use
pnpm install

# Install frontend dependencies (pnpm ONLY, NOT npm or yarn)
pnpm install

# Run Next.js dev server with Turbopack from js/ directory
pnpm dev
# OR from root
make dev

# Build frontend (outputs to js/out/, then moves to recce/data/) from js/ directory
pnpm run build

# Linting and formatting (Biome) from js/ directory
pnpm lint          # Check for issues
pnpm lint:fix      # Auto-fix issues

# Type checking from js/ directory
pnpm type:check

# Tests from js/ directory
pnpm test
pnpm test:cov      # With coverage

# Clean build artifacts from js/ directory
pnpm run clean
```

### Full Build Workflow

When you modify frontend code and want to test it with the Python backend:

1. Build frontend: `cd js && pnpm run build`
2. This automatically moves built files to `recce/data/`
3. Run backend: `recce server`

## Architecture

### Monolithic Client-Server Application

**Backend (Python/FastAPI):**

- FastAPI REST server that serves static frontend and provides APIs for runs/checks
- CLI built with Click (`recce server`, `recce run`)
- Adapter pattern abstracts different data platforms (dbt-core, SQLMesh)
- Task execution engine runs validation checks asynchronously
- State management supports local file storage or Recce Cloud

**Frontend (TypeScript/React):**

- Next.js 16 app built with React 19, compiled to static files
- UI built in `@datarecce/ui` (MUI + Tailwind)
- React Query handles API communication and state management
- Reactflow for lineage graph visualization
- CodeMirror 6 for SQL/YAML editing
- Built frontend is embedded in Python package at `recce/data/`

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

### Warehouse-Resilient Naming

Different SQL warehouses return column names in different cases:

- **Snowflake**: UPPERCASE
- **PostgreSQL/Redshift**: lowercase
- **BigQuery**: preserves original case

Backend normalizes column names to ensure consistency:

- `primary_keys` are normalized to match actual column casing
- Boolean flag columns (`in_a`, `in_b`) are always lowercase
- Quote stripping for SQL identifiers (`"col"`, `` `col` ``, `[col]`)

See `recce/tasks/utils.py` for normalization functions.

## Cloud-Only Features

### Check Events Timeline

GitHub PR-style discussion feature for checks, only available when connected to Recce Cloud.

**Event Types:**

- `check_created` - Initial check creation
- `comment` - User comments (supports edit/delete)
- `approval_change` - Check approval status changes
- `description_change` - Check description updates
- `name_change` - Check name updates
- `preset_applied` - Preset configuration applied

**Key Files:**

- Backend: `recce/apis/check_events_api.py`, `recce/util/cloud/check_events.py`
- Frontend: `js/packages/ui/src/api/checkEvents.ts`, `js/packages/ui/src/hooks/useCheckEvents.ts`
- Components: `js/packages/ui/src/components/check/timeline/`

## Code Style

### Python

- **Black** (line length 120) + **isort** (profile: black) + **flake8**
- Pre-commit hooks configured in `.pre-commit-config.yaml`
- Always run `make format` before `make check`

### TypeScript/React

- **Biome 2.3** - Fast linter and formatter (replaces ESLint + Prettier)
- Double quotes for strings
- Space indentation
- React 19 JSX transform (no React import needed)
- Key rules: `noExplicitAny`, `useExhaustiveDependencies`, `noUnusedVariables`
- Git hooks: `.husky/pre-commit` runs `pnpm lint:staged` and `pnpm type:check`

## Testing Strategy

- **Python Unit Tests**: `pytest` in `tests/` directory
- **Frontend Tests**: Vitest 4 + React Testing Library + happy-dom in `js/`
- **Storybook Tests**: Component stories with interaction tests via `@storybook/addon-vitest`
- **Visual Regression**: Playwright-based visual tests in `js/packages/storybook/`
- **Integration Tests**: Separate CI jobs in `integration_tests/` for dbt and SQLMesh
- **Multi-Version Testing**: Tox for testing against dbt 1.6-1.9 and Python 3.9-3.13
- **Property-Based Testing**: fast-check for data grid utilities

## CI/CD

- **tests-python.yaml**: Python unit tests on multiple versions
- **tests-js.yaml**: Frontend linting (Biome) and tests
- **build-statics.yaml**: Auto-builds and commits frontend when merged to main
- **integration-tests.yaml**: Full dbt project tests
- **release.yaml**: Builds and publishes to PyPI on version tags
- **nightly.yaml**: Runs full test matrix nightly

## Working with the Codebase

### Adding a New Check Type

1. Create a new task class in `recce/tasks/` extending `Task`
2. Implement `execute()` method with check logic
3. Add run type enum to `recce/models/types.py`
4. Add API handler in `recce/apis/run_func.py`
5. Create frontend UI component in `js/packages/ui/src/components/`
6. Add API client method in `js/packages/ui/src/api/`
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
- Run `recce debug` to check artifact/connection issues

## Distribution

- **PyPI Package**: `pip install recce`
- **Entry Point**: `recce` CLI command → `recce.cli:cli`
- **Embedded Frontend**: Static files bundled in Python package at install time
- **Self-Contained**: Single pip install provides full stack (no separate Node deployment)

## Version Management

- Single source of truth: `recce/VERSION` file
- Read by `setup.py` for package versioning
- Frontend reads at runtime for display
- Server checks PyPI on startup to notify about updates

## Common Errors & Fixes

**Frontend changes not appearing:**

- Run `cd js && pnpm run build` then restart `recce server`

**Python import errors:**

- Run `pip install -e .[dev]` to reinstall in editable mode

**Biome lint failures:**

- Run `pnpm lint:fix` to auto-fix, then manually fix remaining issues

**Type errors during build:**

- Run `pnpm type:check` for detailed error messages

**Test failures:**

- Check if dbt artifacts exist in `integration_tests/dbt/target`
- Try fresh install: `pip uninstall recce && make install-dev`

---

## Individual Preferences

- @~/.claude/recce.md
- signoff commits with `git commit -h`
