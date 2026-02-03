# Architecture

## Overview

Recce is a monolithic client-server application where the Python backend serves a static Next.js frontend and provides REST APIs for data validation checks.

## Tech Stack

| Layer | Stack | Key Packages |
|-------|-------|--------------|
| Backend | Python 3.9-3.13 | FastAPI, Click, Pydantic, dbt adapters |
| Frontend | Node.js 20+ | Next.js 16, React 19, TypeScript 5.9, MUI 7, Biome 2.3, Tailwind 4 |
| Visualization | React | Reactflow 12 (lineage), CodeMirror 6 (SQL/YAML) |
| State Management | React | React Query 5 (API), React Context |

## Key Design Patterns

### Pluggable Adapter Pattern

`BaseAdapter` interface allows support for different data platforms (dbt, SQLMesh). Core abstract methods:
- `get_lineage()` - Return DAG structure
- `get_model()` - Retrieve model details
- `get_node_by_name()` - Find node by unique ID
- Platform-specific artifact parsing (manifest, catalog)

DbtAdapter also provides:
- `execute()` - Run SQL queries against warehouse

Adapters are loaded dynamically based on CLI flags (`--sqlmesh`).

### In-Memory State with Persistence

- `RecceContext` holds runtime state (runs, checks, adapter)
- `CheckDAO` and `RunDAO` provide in-memory storage
- `RecceStateLoader` abstraction supports:
  - `FileStateLoader` - Local JSON persistence
  - `CloudStateLoader` - S3 sync for Recce Cloud

### Task-Based Check Execution

1. Each check type maps to a `Task` class (profile_diff, value_diff, row_count_diff, etc.)
2. Tasks are submitted asynchronously via FastAPI
3. Frontend polls `/api/runs/{run_id}/wait` for completion
4. Results stored in `Run` object with status tracking

### Static Frontend Bundling

- Next.js builds to static HTML/JS in `js/out/`
- Build artifacts moved to `recce/data/`
- FastAPI serves static files at runtime
- No Node.js needed in production

## Check Execution Flow

```
1. User creates check via UI
2. Frontend POSTs to /api/checks → check_func.py creates check
3. User runs check → Frontend POSTs to /api/runs → run_func.py submits task
4. Backend executes task asynchronously using appropriate Task class
5. Frontend polls /api/runs/{run_id}/wait for completion
6. Results stored in Run object with status tracking
```

## Warehouse-Resilient Naming

Different SQL warehouses return column names in different cases:
- **Snowflake**: UPPERCASE
- **PostgreSQL/Redshift**: lowercase
- **BigQuery**: preserves original case

Backend normalizes column names:
- `primary_keys` normalized to match actual column casing
- Boolean flag columns (`in_a`, `in_b`) always lowercase
- Quote stripping for SQL identifiers (`"col"`, `` `col` ``, `[col]`)

See `recce/tasks/utils.py` for normalization functions.

## Distribution

- **PyPI Package**: `pip install recce`
- **Entry Point**: `recce` CLI → `recce.cli:cli`
- **Embedded Frontend**: Static files bundled in Python package
- **Self-Contained**: Single pip install provides full stack

## Version Management

- Single source of truth: `recce/VERSION` file
- Read by `setup.py` for package versioning
- Frontend reads at runtime for display
- Server checks PyPI on startup for update notifications
