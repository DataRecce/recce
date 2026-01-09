"""
Experiment 1: Metadata Storage in Warehouse

Store essential dbt metadata directly in users' warehouses,
making metadata management easier and version-controlled with data.
"""

import json
from dataclasses import asdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from metadata_extractor import (
    LineageEdge,
    ManifestMetadata,
    MetadataExtractor,
    NodeMetadata,
)


class WarehouseMetadataStorage:
    """
    Store and retrieve dbt metadata from warehouse tables.

    Schema:
        recce_metadata.runs      - Run metadata (git sha, branch, timestamp)
        recce_metadata.nodes     - Node definitions and checksums
        recce_metadata.lineage   - DAG edges (parent -> child)
    """

    SCHEMA = "recce_metadata"

    # DDL statements for each supported dialect
    DDL = {
        "duckdb": """
            CREATE SCHEMA IF NOT EXISTS {schema};

            CREATE TABLE IF NOT EXISTS {schema}.runs (
                run_id          VARCHAR PRIMARY KEY,
                run_at          TIMESTAMP,
                dbt_version     VARCHAR,
                adapter_type    VARCHAR,
                project_name    VARCHAR,
                git_sha         VARCHAR,
                git_branch      VARCHAR,
                environment     VARCHAR  -- 'base' or 'current'
            );

            CREATE TABLE IF NOT EXISTS {schema}.nodes (
                run_id          VARCHAR,
                unique_id       VARCHAR,
                name            VARCHAR,
                resource_type   VARCHAR,
                package_name    VARCHAR,
                schema_name     VARCHAR,
                checksum        VARCHAR,
                raw_code        TEXT,
                config          JSON,
                columns         JSON,
                description     TEXT,
                source_name     VARCHAR,
                PRIMARY KEY (run_id, unique_id)
            );

            CREATE TABLE IF NOT EXISTS {schema}.lineage (
                run_id          VARCHAR,
                child_id        VARCHAR,
                parent_id       VARCHAR,
                PRIMARY KEY (run_id, child_id, parent_id)
            );
        """,
        "snowflake": """
            CREATE SCHEMA IF NOT EXISTS {schema};

            CREATE TABLE IF NOT EXISTS {schema}.runs (
                run_id          VARCHAR PRIMARY KEY,
                run_at          TIMESTAMP_NTZ,
                dbt_version     VARCHAR,
                adapter_type    VARCHAR,
                project_name    VARCHAR,
                git_sha         VARCHAR,
                git_branch      VARCHAR,
                environment     VARCHAR
            );

            CREATE TABLE IF NOT EXISTS {schema}.nodes (
                run_id          VARCHAR,
                unique_id       VARCHAR,
                name            VARCHAR,
                resource_type   VARCHAR,
                package_name    VARCHAR,
                schema_name     VARCHAR,
                checksum        VARCHAR,
                raw_code        TEXT,
                config          VARIANT,
                columns         VARIANT,
                description     TEXT,
                source_name     VARCHAR,
                PRIMARY KEY (run_id, unique_id)
            );

            CREATE TABLE IF NOT EXISTS {schema}.lineage (
                run_id          VARCHAR,
                child_id        VARCHAR,
                parent_id       VARCHAR,
                PRIMARY KEY (run_id, child_id, parent_id)
            );
        """,
        "postgres": """
            CREATE SCHEMA IF NOT EXISTS {schema};

            CREATE TABLE IF NOT EXISTS {schema}.runs (
                run_id          VARCHAR PRIMARY KEY,
                run_at          TIMESTAMP,
                dbt_version     VARCHAR,
                adapter_type    VARCHAR,
                project_name    VARCHAR,
                git_sha         VARCHAR,
                git_branch      VARCHAR,
                environment     VARCHAR
            );

            CREATE TABLE IF NOT EXISTS {schema}.nodes (
                run_id          VARCHAR,
                unique_id       VARCHAR,
                name            VARCHAR,
                resource_type   VARCHAR,
                package_name    VARCHAR,
                schema_name     VARCHAR,
                checksum        VARCHAR,
                raw_code        TEXT,
                config          JSONB,
                columns         JSONB,
                description     TEXT,
                source_name     VARCHAR,
                PRIMARY KEY (run_id, unique_id)
            );

            CREATE TABLE IF NOT EXISTS {schema}.lineage (
                run_id          VARCHAR,
                child_id        VARCHAR,
                parent_id       VARCHAR,
                PRIMARY KEY (run_id, child_id, parent_id)
            );
        """,
    }

    def __init__(self, adapter: "UnifiedSqlAdapter", schema: str = SCHEMA):
        """
        Initialize storage with adapter.

        Args:
            adapter: SQL adapter for warehouse operations
            schema: Schema name for metadata tables
        """
        self.adapter = adapter
        self.schema = schema

    def initialize(self) -> None:
        """Create schema and tables if they don't exist."""
        dialect = self.adapter.dialect
        ddl_template = self.DDL.get(dialect, self.DDL["postgres"])
        ddl = ddl_template.format(schema=self.schema)

        # Execute each statement separately
        for statement in ddl.split(";"):
            statement = statement.strip()
            if statement:
                self.adapter.execute(statement)

    def store_run(
        self,
        manifest_metadata: ManifestMetadata,
        nodes: List[NodeMetadata],
        lineage: List[LineageEdge],
        environment: str = "current",
        git_sha: Optional[str] = None,
        git_branch: Optional[str] = None,
    ) -> str:
        """
        Store a complete run's metadata.

        Args:
            manifest_metadata: Metadata about the manifest
            nodes: List of node metadata
            lineage: List of lineage edges
            environment: 'base' or 'current'
            git_sha: Optional git commit SHA
            git_branch: Optional git branch name

        Returns:
            run_id of the stored run
        """
        run_id = str(uuid4())
        run_at = datetime.utcnow().isoformat()

        # Insert run record
        self.adapter.execute(
            f"""
            INSERT INTO {self.schema}.runs
            (run_id, run_at, dbt_version, adapter_type, project_name, git_sha, git_branch, environment)
            VALUES
            ('{run_id}', '{run_at}', '{manifest_metadata.dbt_version}',
             '{manifest_metadata.adapter_type}', '{manifest_metadata.project_name}',
             {f"'{git_sha}'" if git_sha else 'NULL'},
             {f"'{git_branch}'" if git_branch else 'NULL'},
             '{environment}')
            """
        )

        # Insert nodes
        for node in nodes:
            config_json = json.dumps(node.config).replace("'", "''")
            columns_json = json.dumps(node.columns).replace("'", "''")
            raw_code = node.raw_code.replace("'", "''")
            description = (node.description or "").replace("'", "''")

            self.adapter.execute(
                f"""
                INSERT INTO {self.schema}.nodes
                (run_id, unique_id, name, resource_type, package_name, schema_name,
                 checksum, raw_code, config, columns, description, source_name)
                VALUES
                ('{run_id}', '{node.unique_id}', '{node.name}', '{node.resource_type}',
                 '{node.package_name}', '{node.schema_name}', '{node.checksum}',
                 '{raw_code}', '{config_json}', '{columns_json}', '{description}',
                 {f"'{node.source_name}'" if node.source_name else 'NULL'})
                """
            )

        # Insert lineage
        for edge in lineage:
            self.adapter.execute(
                f"""
                INSERT INTO {self.schema}.lineage (run_id, child_id, parent_id)
                VALUES ('{run_id}', '{edge.child_id}', '{edge.parent_id}')
                """
            )

        return run_id

    def load_run(self, run_id: str) -> Tuple[ManifestMetadata, List[NodeMetadata], List[LineageEdge]]:
        """
        Load metadata for a specific run.

        Args:
            run_id: ID of the run to load

        Returns:
            Tuple of (manifest_metadata, nodes, lineage)
        """
        # Load run metadata
        result = self.adapter.execute(
            f"SELECT * FROM {self.schema}.runs WHERE run_id = '{run_id}'"
        )
        if not result.rows:
            raise ValueError(f"Run {run_id} not found")

        run_data = result.to_dicts()[0]
        manifest_metadata = ManifestMetadata(
            dbt_version=run_data["dbt_version"],
            dbt_schema_version="warehouse",  # Not stored
            adapter_type=run_data["adapter_type"],
            project_name=run_data["project_name"],
            generated_at=str(run_data["run_at"]),
        )

        # Load nodes
        result = self.adapter.execute(
            f"SELECT * FROM {self.schema}.nodes WHERE run_id = '{run_id}'"
        )
        nodes = []
        for row in result.to_dicts():
            nodes.append(
                NodeMetadata(
                    unique_id=row["unique_id"],
                    name=row["name"],
                    resource_type=row["resource_type"],
                    package_name=row["package_name"],
                    schema_name=row["schema_name"],
                    checksum=row["checksum"],
                    raw_code=row["raw_code"],
                    config=json.loads(row["config"]) if row["config"] else {},
                    columns=json.loads(row["columns"]) if row["columns"] else [],
                    description=row["description"],
                    source_name=row["source_name"],
                )
            )

        # Load lineage
        result = self.adapter.execute(
            f"SELECT * FROM {self.schema}.lineage WHERE run_id = '{run_id}'"
        )
        lineage = [
            LineageEdge(child_id=row["child_id"], parent_id=row["parent_id"])
            for row in result.to_dicts()
        ]

        return manifest_metadata, nodes, lineage

    def list_runs(
        self, environment: Optional[str] = None, limit: int = 10
    ) -> List[Dict]:
        """
        List recent runs.

        Args:
            environment: Filter by environment ('base' or 'current')
            limit: Maximum number of runs to return

        Returns:
            List of run metadata dictionaries
        """
        where = f"WHERE environment = '{environment}'" if environment else ""
        result = self.adapter.execute(
            f"""
            SELECT * FROM {self.schema}.runs
            {where}
            ORDER BY run_at DESC
            LIMIT {limit}
            """
        )
        return result.to_dicts()

    def get_latest_run_id(self, environment: str) -> Optional[str]:
        """Get the most recent run_id for an environment."""
        runs = self.list_runs(environment=environment, limit=1)
        return runs[0]["run_id"] if runs else None

    def compare_runs(
        self, base_run_id: str, current_run_id: str
    ) -> Dict[str, str]:
        """
        Compare two runs and return changes.

        Args:
            base_run_id: Run ID for base environment
            current_run_id: Run ID for current environment

        Returns:
            Dict mapping node_id to change_type ('added', 'removed', 'modified')
        """
        # Get checksums for both runs
        base_result = self.adapter.execute(
            f"""
            SELECT unique_id, checksum
            FROM {self.schema}.nodes
            WHERE run_id = '{base_run_id}'
            """
        )
        base_checksums = {row[0]: row[1] for row in base_result.rows}

        current_result = self.adapter.execute(
            f"""
            SELECT unique_id, checksum
            FROM {self.schema}.nodes
            WHERE run_id = '{current_run_id}'
            """
        )
        current_checksums = {row[0]: row[1] for row in current_result.rows}

        changes = {}

        # Find added and modified
        for node_id, checksum in current_checksums.items():
            if node_id not in base_checksums:
                changes[node_id] = "added"
            elif checksum != base_checksums[node_id]:
                changes[node_id] = "modified"

        # Find removed
        for node_id in base_checksums:
            if node_id not in current_checksums:
                changes[node_id] = "removed"

        return changes


# --- CLI for testing ---

if __name__ == "__main__":
    import sys
    from sql_adapter import UnifiedSqlAdapter

    print("=== Warehouse Metadata Storage Test ===\n")

    # Create DuckDB adapter for testing
    adapter = UnifiedSqlAdapter("duckdb:///:memory:", "duckdb")
    storage = WarehouseMetadataStorage(adapter)

    # Initialize schema
    print("1. Initializing schema...")
    storage.initialize()
    print("   ✓ Schema created")

    # Check if manifest files are provided
    if len(sys.argv) >= 2:
        manifest_path = sys.argv[1]
        catalog_path = sys.argv[2] if len(sys.argv) > 2 else None

        print(f"\n2. Extracting metadata from {manifest_path}...")
        extractor = MetadataExtractor(manifest_path, catalog_path)
        nodes, lineage, metadata = extractor.extract()
        print(f"   ✓ Extracted {len(nodes)} nodes, {len(lineage)} edges")

        print("\n3. Storing metadata in warehouse...")
        run_id = storage.store_run(
            manifest_metadata=metadata,
            nodes=nodes,
            lineage=lineage,
            environment="current",
            git_branch="main",
        )
        print(f"   ✓ Stored as run_id: {run_id}")

        print("\n4. Loading metadata back from warehouse...")
        loaded_metadata, loaded_nodes, loaded_lineage = storage.load_run(run_id)
        print(f"   ✓ Loaded {len(loaded_nodes)} nodes, {len(loaded_lineage)} edges")

        print("\n5. Verifying round-trip...")
        assert len(nodes) == len(loaded_nodes), "Node count mismatch!"
        assert len(lineage) == len(loaded_lineage), "Lineage count mismatch!"
        print("   ✓ Round-trip verified!")

        print("\n6. Listing runs...")
        runs = storage.list_runs()
        for run in runs:
            print(f"   - {run['run_id'][:8]}... ({run['environment']}) at {run['run_at']}")

    else:
        print("\nUsage: python warehouse_storage.py <manifest.json> [catalog.json]")
        print("\nRunning basic storage test without manifest...")

        # Create dummy data
        from metadata_extractor import NodeMetadata, LineageEdge, ManifestMetadata

        dummy_metadata = ManifestMetadata(
            dbt_version="1.8.0",
            dbt_schema_version="v12",
            adapter_type="duckdb",
            project_name="test_project",
            generated_at="2024-01-01T00:00:00Z",
        )

        dummy_nodes = [
            NodeMetadata(
                unique_id="model.test.customers",
                name="customers",
                resource_type="model",
                package_name="test",
                schema_name="prod",
                checksum="abc123",
                raw_code="SELECT * FROM raw.customers",
                config={"materialized": "table"},
                columns=[{"name": "id", "type": "INT"}, {"name": "name", "type": "VARCHAR"}],
            ),
            NodeMetadata(
                unique_id="model.test.orders",
                name="orders",
                resource_type="model",
                package_name="test",
                schema_name="prod",
                checksum="def456",
                raw_code="SELECT * FROM raw.orders",
                config={"materialized": "view"},
                columns=[{"name": "id", "type": "INT"}, {"name": "customer_id", "type": "INT"}],
            ),
        ]

        dummy_lineage = [
            LineageEdge(child_id="model.test.orders", parent_id="model.test.customers"),
        ]

        print("\n2. Storing dummy metadata...")
        run_id = storage.store_run(
            manifest_metadata=dummy_metadata,
            nodes=dummy_nodes,
            lineage=dummy_lineage,
            environment="current",
        )
        print(f"   ✓ Stored as run_id: {run_id}")

        print("\n3. Loading metadata back...")
        loaded_metadata, loaded_nodes, loaded_lineage = storage.load_run(run_id)
        print(f"   ✓ Loaded {len(loaded_nodes)} nodes, {len(loaded_lineage)} edges")
        print(f"   First node: {loaded_nodes[0].name} ({loaded_nodes[0].resource_type})")
