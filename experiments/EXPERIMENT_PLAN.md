# Experiment Plan: Metadata Storage & dbt-core Decoupling

## Goals

### Goal 1: Store Metadata in Warehouses
Store essential dbt metadata (manifest/catalog) in users' warehouses alongside dbt runs, making metadata management easier and version-controlled with the data.

### Goal 2: Generic Recce (dbt-core Decoupling)
Decouple Recce from dbt-core and dbt-adapters to support any data tool, using a unified warehouse access layer.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CURRENT STATE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  manifest.json ──→ dbt-core classes ──→ Recce ──→ dbt-adapter ──→ SQL  │
│  catalog.json      (version-coupled)            (warehouse-specific)     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           TARGET STATE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Metadata   │    │    Recce     │    │   Unified    │              │
│  │   Storage    │    │    Core      │    │   SQL Layer  │              │
│  │              │    │              │    │              │              │
│  │ • Warehouse  │───→│ • Lineage    │───→│ • sqlglot    │───→ Warehouse│
│  │ • Version-   │    │ • Diff       │    │ • SQLAlchemy │              │
│  │   agnostic   │    │ • Checks     │    │ • Unified    │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Experiment 1: Metadata Schema Design

**Objective:** Design a warehouse-native schema to store essential metadata.

### 1.1 Define Essential Fields

From our exploration, Recce uses these fields:

```sql
-- recce_metadata.nodes
CREATE TABLE recce_metadata.nodes (
    run_id          VARCHAR,        -- Links to dbt run
    run_at          TIMESTAMP,      -- When metadata was captured
    environment     VARCHAR,        -- 'base' or 'current'

    -- From manifest.json
    unique_id       VARCHAR,        -- model.jaffle_shop.customers
    name            VARCHAR,        -- customers
    resource_type   VARCHAR,        -- model, seed, snapshot, source
    package_name    VARCHAR,        -- jaffle_shop
    schema_name     VARCHAR,        -- prod
    checksum        VARCHAR,        -- SHA256 hash for change detection
    raw_code        TEXT,           -- SQL code
    config          JSON,           -- materialization, etc.

    -- From catalog.json
    columns         JSON,           -- [{name, type}, ...]

    PRIMARY KEY (run_id, environment, unique_id)
);

-- recce_metadata.lineage
CREATE TABLE recce_metadata.lineage (
    run_id          VARCHAR,
    environment     VARCHAR,
    node_id         VARCHAR,        -- Child node
    parent_id       VARCHAR,        -- Parent node

    PRIMARY KEY (run_id, environment, node_id, parent_id)
);

-- recce_metadata.runs
CREATE TABLE recce_metadata.runs (
    run_id          VARCHAR PRIMARY KEY,
    run_at          TIMESTAMP,
    dbt_version     VARCHAR,
    adapter_type    VARCHAR,
    project_name    VARCHAR,
    git_sha         VARCHAR,        -- Optional: link to git commit
    branch          VARCHAR,        -- Optional: branch name
);
```

### 1.2 Experiment Tasks

- [ ] Create schema in DuckDB (local testing)
- [ ] Create schema in Snowflake (production testing)
- [ ] Write extractor: `manifest.json` → INSERT statements
- [ ] Write extractor: `catalog.json` → UPDATE statements (add columns)
- [ ] Test round-trip: extract → store → retrieve → reconstruct

### 1.3 Success Criteria

- Can reconstruct lineage from warehouse tables
- Can detect changes using checksum comparison
- Query performance < 1s for typical project (100-500 nodes)

---

## Experiment 2: Version-Agnostic Metadata Extraction

**Objective:** Extract metadata from any manifest version (v9-v12+) without dbt-core.

### 2.1 Extractor Implementation

```python
# experiments/metadata_extractor.py

import json
from typing import Dict, List, Any
from dataclasses import dataclass

@dataclass
class NodeMetadata:
    unique_id: str
    name: str
    resource_type: str
    package_name: str
    schema_name: str
    checksum: str
    raw_code: str
    config: dict
    columns: List[dict]  # From catalog

@dataclass
class LineageEdge:
    child_id: str
    parent_id: str

def extract_from_manifest(manifest_path: str) -> tuple[List[NodeMetadata], List[LineageEdge]]:
    """
    Extract metadata from any manifest version.
    Works with v9, v10, v11, v12 - all have same essential fields.
    """
    with open(manifest_path) as f:
        data = json.load(f)

    nodes = []
    lineage = []

    # Extract nodes (same structure across versions)
    for node_id, node in data.get("nodes", {}).items():
        if node.get("resource_type") not in ["model", "seed", "snapshot"]:
            continue

        nodes.append(NodeMetadata(
            unique_id=node["unique_id"],
            name=node["name"],
            resource_type=node["resource_type"],
            package_name=node["package_name"],
            schema_name=node["schema"],
            checksum=node.get("checksum", {}).get("checksum", ""),
            raw_code=node.get("raw_code", ""),
            config=node.get("config", {}),
            columns=[],  # Populated from catalog
        ))

    # Extract sources
    for source_id, source in data.get("sources", {}).items():
        nodes.append(NodeMetadata(
            unique_id=source["unique_id"],
            name=source["name"],
            resource_type="source",
            package_name=source["package_name"],
            schema_name=source["schema"],
            checksum="",
            raw_code="",
            config=source.get("config", {}),
            columns=[],
        ))

    # Extract lineage from parent_map
    for child_id, parents in data.get("parent_map", {}).items():
        for parent_id in parents:
            lineage.append(LineageEdge(child_id=child_id, parent_id=parent_id))

    return nodes, lineage

def extract_columns_from_catalog(catalog_path: str, nodes: List[NodeMetadata]) -> None:
    """Add column information from catalog to nodes (mutates in place)."""
    with open(catalog_path) as f:
        catalog = json.load(f)

    node_map = {n.unique_id: n for n in nodes}

    for node_id, node_catalog in catalog.get("nodes", {}).items():
        if node_id in node_map:
            columns = [
                {"name": col["name"], "type": col["type"]}
                for col in node_catalog.get("columns", {}).values()
            ]
            node_map[node_id].columns = columns

    for source_id, source_catalog in catalog.get("sources", {}).items():
        if source_id in node_map:
            columns = [
                {"name": col["name"], "type": col["type"]}
                for col in source_catalog.get("columns", {}).values()
            ]
            node_map[source_id].columns = columns
```

### 2.2 Experiment Tasks

- [ ] Test extraction from v9 manifest
- [ ] Test extraction from v12 manifest
- [ ] Verify all Recce-required fields are captured
- [ ] Benchmark extraction time for large manifests

### 2.3 Success Criteria

- Same output from v9 and v12 manifests (for same project)
- Zero dbt-core imports in extractor
- < 100ms extraction time for typical manifest

---

## Experiment 3: Unified SQL Layer (sqlglot + SQLAlchemy)

**Objective:** Replace dbt adapters with sqlglot + SQLAlchemy.

### 3.1 SQL Adapter Implementation

```python
# experiments/sql_adapter.py

from typing import List, Tuple, Any, Optional
import sqlglot
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

class UnifiedSqlAdapter:
    """
    Unified SQL adapter using sqlglot for dialect handling
    and SQLAlchemy for connection management.
    """

    DIALECT_MAP = {
        "snowflake": "snowflake",
        "bigquery": "bigquery",
        "postgres": "postgres",
        "redshift": "redshift",
        "duckdb": "duckdb",
        "databricks": "databricks",
    }

    def __init__(self, connection_string: str, dialect: str):
        self.engine: Engine = create_engine(connection_string)
        self.dialect = self.DIALECT_MAP.get(dialect, dialect)

    def quote_identifier(self, name: str) -> str:
        """Quote an identifier for the current dialect."""
        return sqlglot.exp.to_identifier(name).sql(dialect=self.dialect)

    def quote_table(self, schema: str, table: str) -> str:
        """Quote a table reference for the current dialect."""
        return sqlglot.exp.to_table(f"{schema}.{table}").sql(dialect=self.dialect)

    def execute(self, sql: str) -> Tuple[List[str], List[Tuple]]:
        """
        Execute SQL and return (column_names, rows).
        This is all Recce needs from SQL execution.
        """
        with self.engine.connect() as conn:
            result = conn.execute(text(sql))
            columns = list(result.keys())
            rows = [tuple(row) for row in result.fetchall()]
            return columns, rows

    def execute_with_cancel(self, sql: str, timeout: Optional[float] = None):
        """Execute with cancellation support."""
        # Implementation depends on dialect
        pass

    @classmethod
    def from_dbt_profile(cls, profiles_path: str, profile: str, target: str):
        """Create adapter from dbt profiles.yml."""
        import yaml

        with open(profiles_path) as f:
            profiles = yaml.safe_load(f)

        config = profiles[profile]["outputs"][target]
        dialect = config["type"]

        connection_string = cls._build_connection_string(config)
        return cls(connection_string, dialect)

    @staticmethod
    def _build_connection_string(config: dict) -> str:
        """Convert dbt profile config to SQLAlchemy connection string."""
        dialect = config["type"]

        if dialect == "snowflake":
            return (
                f"snowflake://{config['user']}:{config['password']}"
                f"@{config['account']}/{config['database']}/{config['schema']}"
                f"?warehouse={config['warehouse']}"
            )
        elif dialect == "postgres":
            return (
                f"postgresql://{config['user']}:{config['password']}"
                f"@{config['host']}:{config['port']}/{config['dbname']}"
            )
        elif dialect == "bigquery":
            return f"bigquery://{config['project']}/{config.get('dataset', '')}"
        elif dialect == "duckdb":
            return f"duckdb:///{config.get('path', ':memory:')}"
        elif dialect == "redshift":
            return (
                f"redshift+psycopg2://{config['user']}:{config['password']}"
                f"@{config['host']}:{config['port']}/{config['dbname']}"
            )
        elif dialect == "databricks":
            return (
                f"databricks://token:{config['token']}"
                f"@{config['host']}:443/{config.get('catalog', 'hive_metastore')}"
            )
        else:
            raise ValueError(f"Unsupported dialect: {dialect}")
```

### 3.2 Experiment Tasks

- [ ] Test connection to DuckDB
- [ ] Test connection to PostgreSQL
- [ ] Test connection to Snowflake
- [ ] Test dialect-specific quoting with sqlglot
- [ ] Compare query results with dbt adapter results
- [ ] Implement query cancellation

### 3.3 Success Criteria

- Same query results as dbt adapter
- Proper quoting for all supported dialects
- Connection from profiles.yml works

---

## Experiment 4: Simple Jinja Replacement

**Objective:** Replace dbt's Jinja rendering for `ref()` and `source()`.

### 4.1 Template Renderer Implementation

```python
# experiments/template_renderer.py

import re
from typing import Dict

class SimpleTemplateRenderer:
    """
    Simple template renderer for ref() and source().
    Does NOT support full Jinja - only what Recce needs.
    """

    def __init__(self, adapter: "UnifiedSqlAdapter", nodes: Dict[str, "NodeMetadata"]):
        self.adapter = adapter
        self.nodes = nodes
        self._build_lookup()

    def _build_lookup(self):
        """Build lookup tables for ref() and source()."""
        self.ref_lookup = {}  # model_name -> schema.table
        self.source_lookup = {}  # (source_name, table_name) -> schema.table

        for node in self.nodes.values():
            if node.resource_type in ["model", "seed", "snapshot"]:
                self.ref_lookup[node.name] = (node.schema_name, node.name)
            elif node.resource_type == "source":
                key = (node.package_name, node.name)  # source_name is package_name
                self.source_lookup[key] = (node.schema_name, node.name)

    def render(self, sql_template: str) -> str:
        """
        Render SQL template, replacing:
        - {{ ref('model_name') }}
        - {{ source('source_name', 'table_name') }}
        """
        sql = sql_template

        # Replace ref()
        ref_pattern = r"\{\{\s*ref\(['\"](\w+)['\"]\)\s*\}\}"
        def ref_replacer(match):
            model_name = match.group(1)
            if model_name in self.ref_lookup:
                schema, table = self.ref_lookup[model_name]
                return self.adapter.quote_table(schema, table)
            return match.group(0)  # Leave unchanged if not found

        sql = re.sub(ref_pattern, ref_replacer, sql)

        # Replace source()
        source_pattern = r"\{\{\s*source\(['\"](\w+)['\"],\s*['\"](\w+)['\"]\)\s*\}\}"
        def source_replacer(match):
            source_name, table_name = match.group(1), match.group(2)
            key = (source_name, table_name)
            if key in self.source_lookup:
                schema, table = self.source_lookup[key]
                return self.adapter.quote_table(schema, table)
            return match.group(0)

        sql = re.sub(source_pattern, source_replacer, sql)

        return sql
```

### 4.2 Experiment Tasks

- [ ] Test ref() replacement
- [ ] Test source() replacement
- [ ] Handle edge cases (quoted names, whitespace variations)
- [ ] Compare rendered SQL with dbt's output
- [ ] Test with real model SQL

### 4.3 Success Criteria

- Rendered SQL matches dbt output for common cases
- Clear error messages for unsupported Jinja features
- Performance: < 10ms per template

---

## Experiment 5: End-to-End Integration

**Objective:** Run a complete Recce workflow without dbt-core.

### 5.1 Integration Test

```python
# experiments/e2e_test.py

def test_lineage_diff_without_dbt():
    """
    Test complete lineage diff workflow:
    1. Load metadata from warehouse (not files)
    2. Build lineage graph
    3. Detect changes
    4. Execute diff queries
    """
    # 1. Connect to warehouse
    adapter = UnifiedSqlAdapter.from_dbt_profile(
        "~/.dbt/profiles.yml", "jaffle_shop", "dev"
    )

    # 2. Load metadata from warehouse
    base_nodes = load_nodes_from_warehouse(adapter, run_id="base_run_123")
    curr_nodes = load_nodes_from_warehouse(adapter, run_id="curr_run_456")

    # 3. Build lineage
    base_lineage = build_lineage_graph(base_nodes)
    curr_lineage = build_lineage_graph(curr_nodes)

    # 4. Detect changes (using checksum)
    changes = detect_changes(base_nodes, curr_nodes)

    # 5. Run diff queries for changed models
    for node_id in changes:
        renderer = SimpleTemplateRenderer(adapter, curr_nodes)
        diff_sql = generate_diff_sql(node_id, renderer)
        columns, rows = adapter.execute(diff_sql)

        print(f"Diff for {node_id}: {len(rows)} differences")
```

### 5.2 Experiment Tasks

- [ ] Create test fixtures (DuckDB with sample data)
- [ ] Implement `load_nodes_from_warehouse()`
- [ ] Implement `build_lineage_graph()`
- [ ] Implement `detect_changes()`
- [ ] Run full diff workflow
- [ ] Compare results with current Recce

### 5.3 Success Criteria

- Same diff results as current Recce implementation
- No dbt-core imports in critical path
- Clear separation of concerns

---

## Experiment Phases

### Phase 1: Proof of Concept (1-2 weeks)
- [ ] Experiment 1.2: Create schema in DuckDB
- [ ] Experiment 2: Metadata extraction (v9 + v12)
- [ ] Experiment 3: Basic SQL adapter with DuckDB

### Phase 2: Core Functionality (2-3 weeks)
- [ ] Experiment 3: SQL adapter for Snowflake/Postgres
- [ ] Experiment 4: Template renderer
- [ ] Experiment 1: Full metadata storage workflow

### Phase 3: Integration (2-3 weeks)
- [ ] Experiment 5: End-to-end integration
- [ ] Performance benchmarking
- [ ] Error handling and edge cases

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| sqlglot dialect coverage | Test all target dialects early |
| SQLAlchemy connection complexity | Keep dbt profiles.yml as fallback |
| Jinja edge cases | Document supported subset, fail gracefully |
| Performance regression | Benchmark against current implementation |
| Breaking existing users | Maintain backward compatibility layer |

---

## Decision Points

After experiments, decide:

1. **Metadata storage location:**
   - Option A: Dedicated schema (recce_metadata)
   - Option B: Information schema extension
   - Option C: External metadata store (S3/GCS)

2. **Adapter strategy:**
   - Option A: Full replacement (sqlglot + SQLAlchemy only)
   - Option B: Hybrid (use dbt adapter if available, fallback to unified)
   - Option C: Wrapper (unified interface, multiple backends)

3. **Jinja support level:**
   - Option A: ref() and source() only
   - Option B: Add common macros (dbt_utils)
   - Option C: Full Jinja with custom context
