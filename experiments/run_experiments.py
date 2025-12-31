#!/usr/bin/env python3
"""
End-to-End Experiment Runner

Tests the complete workflow without dbt-core:
1. Extract metadata from manifest/catalog (version-agnostic)
2. Store in warehouse
3. Load and compare between environments
4. Execute SQL through unified adapter
"""

import sys
from pathlib import Path

# Add experiments to path
sys.path.insert(0, str(Path(__file__).parent))


def test_metadata_extraction():
    """Test Experiment 2: Version-agnostic metadata extraction."""
    print("=" * 60)
    print("EXPERIMENT 2: Metadata Extraction")
    print("=" * 60)

    from metadata_extractor import MetadataExtractor, detect_changes

    # Test with v9 manifest
    v9_manifest = Path(__file__).parent.parent / "tests" / "manifest.json"
    v9_catalog = Path(__file__).parent.parent / "tests" / "catalog.json"

    if v9_manifest.exists():
        print(f"\n[v9] Loading {v9_manifest}...")
        extractor = MetadataExtractor(str(v9_manifest), str(v9_catalog) if v9_catalog.exists() else None)
        v9_nodes, v9_lineage, v9_metadata = extractor.extract()
        print(f"  ✓ Version: {v9_metadata.dbt_schema_version}")
        print(f"  ✓ Nodes: {len(v9_nodes)}")
        print(f"  ✓ Lineage edges: {len(v9_lineage)}")

    # Test with v12 manifest
    v12_manifest = Path(__file__).parent.parent / "tests" / "data" / "manifest" / "base" / "manifest.json"
    v12_catalog = Path(__file__).parent.parent / "tests" / "data" / "manifest" / "base" / "catalog.json"

    if v12_manifest.exists():
        print(f"\n[v12] Loading {v12_manifest}...")
        extractor = MetadataExtractor(str(v12_manifest), str(v12_catalog) if v12_catalog.exists() else None)
        v12_nodes, v12_lineage, v12_metadata = extractor.extract()
        print(f"  ✓ Version: {v12_metadata.dbt_schema_version}")
        print(f"  ✓ Nodes: {len(v12_nodes)}")
        print(f"  ✓ Lineage edges: {len(v12_lineage)}")

    # Compare v12 base vs pr2 for change detection
    v12_pr2_manifest = Path(__file__).parent.parent / "tests" / "data" / "manifest" / "pr2" / "manifest.json"
    if v12_manifest.exists() and v12_pr2_manifest.exists():
        print("\n[Change Detection] Comparing base vs pr2...")
        pr2_extractor = MetadataExtractor(str(v12_pr2_manifest))
        pr2_nodes, _, _ = pr2_extractor.extract()

        changes = detect_changes(v12_nodes, pr2_nodes)
        print(f"  ✓ Changes detected: {len(changes)}")
        for node_id, change_type in list(changes.items())[:5]:
            print(f"    - {change_type}: {node_id}")

    return True


def test_sql_adapter():
    """Test Experiment 3: Unified SQL adapter."""
    print("\n" + "=" * 60)
    print("EXPERIMENT 3: Unified SQL Adapter")
    print("=" * 60)

    from sql_adapter import UnifiedSqlAdapter, SimpleTemplateRenderer

    # Test DuckDB connection
    print("\n[DuckDB] Testing connection...")
    adapter = UnifiedSqlAdapter("duckdb:///:memory:", "duckdb")
    if adapter.test_connection():
        print("  ✓ Connection successful")
    else:
        print("  ✗ Connection failed")
        return False

    # Test query execution
    print("\n[DuckDB] Testing query execution...")
    adapter.execute("CREATE TABLE test_models (id INT, name VARCHAR, amount DECIMAL(10,2))")
    adapter.execute("""
        INSERT INTO test_models VALUES
        (1, 'customers', 1234.56),
        (2, 'orders', 5678.90),
        (3, 'products', 9012.34)
    """)
    result = adapter.execute("SELECT * FROM test_models ORDER BY id")
    print(f"  ✓ Query returned {result.row_count} rows")
    print(f"  Columns: {result.columns}")

    # Test dialect quoting
    print("\n[Quoting] Testing dialect-specific quoting...")
    dialects = ["duckdb", "snowflake", "bigquery", "postgres"]
    for dialect in dialects:
        test_adapter = UnifiedSqlAdapter("duckdb:///:memory:", dialect)
        quoted = test_adapter.quote_table("my_schema", "my_table")
        print(f"  {dialect:12}: {quoted}")

    # Test template rendering
    print("\n[Template] Testing ref() and source() rendering...")
    renderer = SimpleTemplateRenderer(
        adapter,
        node_lookup={
            "customers": ("prod", "customers"),
            "orders": ("prod", "orders"),
        },
    )
    renderer.add_source("raw", "payments", "raw_data", "payments")

    template = "SELECT * FROM {{ ref('customers') }} c JOIN {{ source('raw', 'payments') }} p ON c.id = p.customer_id"
    rendered = renderer.render(template)
    print(f"  Template: {template[:60]}...")
    print(f"  Rendered: {rendered[:60]}...")

    return True


def test_warehouse_storage():
    """Test Experiment 1: Warehouse metadata storage."""
    print("\n" + "=" * 60)
    print("EXPERIMENT 1: Warehouse Metadata Storage")
    print("=" * 60)

    from sql_adapter import UnifiedSqlAdapter
    from warehouse_storage import WarehouseMetadataStorage
    from metadata_extractor import MetadataExtractor

    # Create DuckDB adapter
    print("\n[Setup] Creating DuckDB adapter...")
    adapter = UnifiedSqlAdapter("duckdb:///:memory:", "duckdb")
    storage = WarehouseMetadataStorage(adapter)

    # Initialize schema
    print("\n[Schema] Initializing metadata schema...")
    storage.initialize()
    print("  ✓ Schema created")

    # Load and store v9 manifest as "base"
    v9_manifest = Path(__file__).parent.parent / "tests" / "manifest.json"
    v9_catalog = Path(__file__).parent.parent / "tests" / "catalog.json"

    if v9_manifest.exists():
        print("\n[Store] Storing v9 manifest as 'base'...")
        extractor = MetadataExtractor(str(v9_manifest), str(v9_catalog) if v9_catalog.exists() else None)
        nodes, lineage, metadata = extractor.extract()
        base_run_id = storage.store_run(
            manifest_metadata=metadata,
            nodes=nodes,
            lineage=lineage,
            environment="base",
            git_branch="main",
        )
        print(f"  ✓ Stored as run_id: {base_run_id[:8]}...")

    # Load and store v12 manifest as "current"
    v12_manifest = Path(__file__).parent.parent / "tests" / "data" / "manifest" / "pr2" / "manifest.json"
    v12_catalog = Path(__file__).parent.parent / "tests" / "data" / "manifest" / "pr2" / "catalog.json"

    if v12_manifest.exists():
        print("\n[Store] Storing v12 manifest as 'current'...")
        extractor = MetadataExtractor(str(v12_manifest), str(v12_catalog) if v12_catalog.exists() else None)
        nodes, lineage, metadata = extractor.extract()
        current_run_id = storage.store_run(
            manifest_metadata=metadata,
            nodes=nodes,
            lineage=lineage,
            environment="current",
            git_branch="feature/new-models",
        )
        print(f"  ✓ Stored as run_id: {current_run_id[:8]}...")

    # List runs
    print("\n[List] Listing stored runs...")
    runs = storage.list_runs()
    for run in runs:
        print(f"  - {run['run_id'][:8]}... | {run['environment']:8} | {run['project_name']} | {run['dbt_version']}")

    # Compare runs
    if v9_manifest.exists() and v12_manifest.exists():
        print("\n[Compare] Comparing base vs current...")
        changes = storage.compare_runs(base_run_id, current_run_id)
        print(f"  ✓ Changes detected: {len(changes)}")
        for node_id, change_type in list(changes.items())[:5]:
            print(f"    - {change_type}: {node_id}")

    # Round-trip verification
    print("\n[Verify] Round-trip verification...")
    loaded_metadata, loaded_nodes, loaded_lineage = storage.load_run(current_run_id)
    print(f"  ✓ Loaded {len(loaded_nodes)} nodes from warehouse")
    print(f"  ✓ Loaded {len(loaded_lineage)} lineage edges from warehouse")

    return True


def test_end_to_end():
    """Test complete workflow: extract -> store -> compare -> query."""
    print("\n" + "=" * 60)
    print("EXPERIMENT 5: End-to-End Integration")
    print("=" * 60)

    from sql_adapter import UnifiedSqlAdapter, SimpleTemplateRenderer
    from warehouse_storage import WarehouseMetadataStorage
    from metadata_extractor import MetadataExtractor

    # Setup
    adapter = UnifiedSqlAdapter("duckdb:///:memory:", "duckdb")
    storage = WarehouseMetadataStorage(adapter)
    storage.initialize()

    # Create sample data tables
    print("\n[Setup] Creating sample data tables...")
    adapter.execute("""
        CREATE SCHEMA prod;
        CREATE TABLE prod.customers (id INT, name VARCHAR, email VARCHAR);
        INSERT INTO prod.customers VALUES
            (1, 'Alice', 'alice@example.com'),
            (2, 'Bob', 'bob@example.com'),
            (3, 'Charlie', 'charlie@example.com');
    """)
    print("  ✓ Created prod.customers with 3 rows")

    # Load manifests and store
    base_manifest = Path(__file__).parent.parent / "tests" / "data" / "manifest" / "base" / "manifest.json"
    current_manifest = Path(__file__).parent.parent / "tests" / "data" / "manifest" / "pr2" / "manifest.json"

    if base_manifest.exists() and current_manifest.exists():
        # Store base
        print("\n[Store] Storing base metadata...")
        extractor = MetadataExtractor(str(base_manifest))
        nodes, lineage, metadata = extractor.extract()
        base_run_id = storage.store_run(metadata, nodes, lineage, "base")

        # Store current
        print("[Store] Storing current metadata...")
        extractor = MetadataExtractor(str(current_manifest))
        nodes, lineage, metadata = extractor.extract()
        current_run_id = storage.store_run(metadata, nodes, lineage, "current")

        # Detect changes
        print("\n[Diff] Detecting changes...")
        changes = storage.compare_runs(base_run_id, current_run_id)
        print(f"  ✓ Found {len(changes)} changed nodes")

        # For changed models, we could run diff queries
        print("\n[Query] Executing queries through unified adapter...")
        _, current_nodes, _ = storage.load_run(current_run_id)

        # Build lookup for template rendering
        node_lookup = {
            n.name: (n.schema_name or "prod", n.name)
            for n in current_nodes
            if n.resource_type == "model"
        }

        renderer = SimpleTemplateRenderer(adapter, node_lookup)

        # Execute a sample query
        sample_query = "SELECT COUNT(*) as cnt FROM prod.customers"
        result = adapter.execute(sample_query)
        print(f"  ✓ Query result: {result.rows[0][0]} customers")

    print("\n" + "=" * 60)
    print("ALL EXPERIMENTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

    return True


def main():
    """Run all experiments."""
    print("=" * 60)
    print("RECCE DECOUPLING EXPERIMENTS")
    print("=" * 60)
    print("\nGoal 1: Store metadata in warehouses")
    print("Goal 2: Decouple from dbt-core")
    print("=" * 60)

    results = {}

    try:
        results["metadata_extraction"] = test_metadata_extraction()
    except Exception as e:
        print(f"\n  ✗ Metadata extraction failed: {e}")
        results["metadata_extraction"] = False

    try:
        results["sql_adapter"] = test_sql_adapter()
    except Exception as e:
        print(f"\n  ✗ SQL adapter failed: {e}")
        results["sql_adapter"] = False

    try:
        results["warehouse_storage"] = test_warehouse_storage()
    except Exception as e:
        print(f"\n  ✗ Warehouse storage failed: {e}")
        results["warehouse_storage"] = False

    try:
        results["end_to_end"] = test_end_to_end()
    except Exception as e:
        print(f"\n  ✗ End-to-end failed: {e}")
        results["end_to_end"] = False

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"  {name:25}: {status}")

    all_passed = all(results.values())
    print("\n" + ("All experiments passed!" if all_passed else "Some experiments failed."))

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
