"""
Warehouse metadata loader for Recce.

Loads manifest and catalog data from warehouse tables created by the recce dbt package,
instead of reading from local artifact files.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("uvicorn")


class WarehousePreviousState:
    """
    A minimal implementation of dbt's PreviousState interface for warehouse-loaded metadata.

    This provides the same interface as dbt.graph.selector.PreviousState but with
    pre-loaded manifest data from the warehouse instead of loading from filesystem.
    """

    def __init__(self, manifest):
        """
        Initialize with a pre-loaded manifest.

        Args:
            manifest: A dbt Manifest object (from WritableManifest)
        """
        # Required path attributes (use dummy values since we're not reading from disk)
        self.state_path: Path = Path("/warehouse")
        self.target_path: Path = Path("/warehouse")
        self.project_root: Path = Path("/")

        # The manifest is already loaded from warehouse
        self.manifest = manifest

        # These are optional and we don't have them from warehouse
        self.results = None
        self.sources = None
        self.sources_current = None


@dataclass
class WarehouseMetadataConfig:
    """Configuration for warehouse metadata loading."""

    schema_suffix: str = "recce_metadata"
    curr_invocation_id: Optional[str] = None  # If None, use latest
    base_invocation_id: Optional[str] = None  # If None, use second-latest


class WarehouseMetadataLoader:
    """
    Loads Recce metadata from warehouse tables.

    Queries recce_invocations and recce_nodes_dbt tables
    to reconstruct WritableManifest and CatalogArtifact objects.

    Note: Column metadata (catalog) is not yet stored in warehouse tables.
    A future recce_columns_dbt table could be added to support this.
    """

    def __init__(self, adapter, runtime_config, config: Optional[WarehouseMetadataConfig] = None):
        """
        Initialize the warehouse metadata loader.

        Args:
            adapter: The dbt SQLAdapter instance for executing queries
            runtime_config: The dbt RuntimeConfig for schema information
            config: Optional configuration for metadata loading
        """
        self.adapter = adapter
        self.runtime_config = runtime_config
        self.config = config or WarehouseMetadataConfig()

        # Use schema_suffix directly as the schema name
        # This matches the dbt package behavior when recce_schema var is set
        self.recce_schema = self.config.schema_suffix

    def _execute_query(self, sql: str) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results as list of dicts."""
        with self.adapter.connection_named("recce_warehouse_loader"):
            response, result = self.adapter.execute(sql, fetch=True, auto_begin=True)
            if result is None:
                return []

            # Convert agate table to list of dicts
            rows = []
            for row in result.rows:
                row_dict = {}
                for i, col_name in enumerate(result.column_names):
                    row_dict[col_name.lower()] = row[i]
                rows.append(row_dict)
            return rows

    def get_invocations(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent invocations from the warehouse."""
        sql = f"""
            SELECT
                invocation_id,
                generated_at,
                adapter_type,
                project_name,
                framework_version,
                git_sha,
                git_branch
            FROM {self.recce_schema}.recce_invocations
            ORDER BY generated_at DESC
            LIMIT {limit}
        """
        return self._execute_query(sql)

    def get_invocation_pair(self) -> Tuple[str, str]:
        """
        Get the invocation IDs to use for current and base.

        Returns:
            Tuple of (curr_invocation_id, base_invocation_id)
        """
        if self.config.curr_invocation_id and self.config.base_invocation_id:
            return (self.config.curr_invocation_id, self.config.base_invocation_id)

        invocations = self.get_invocations(limit=2)
        if len(invocations) < 2:
            raise ValueError(
                f"Need at least 2 invocations in warehouse to compare. "
                f"Found {len(invocations)}. Run 'dbt run' at least twice with the recce package installed."
            )

        curr_id = self.config.curr_invocation_id or invocations[0]["invocation_id"]
        base_id = self.config.base_invocation_id or invocations[1]["invocation_id"]

        return (curr_id, base_id)

    def get_nodes_for_invocation(self, invocation_id: str) -> List[Dict[str, Any]]:
        """Get all nodes for a specific invocation."""
        sql = f"""
            SELECT
                unique_id,
                name,
                resource_type,
                package_name,
                database_name,
                schema_name,
                depends_on,
                checksum,
                raw_code,
                language,
                source_name,
                config
            FROM {self.recce_schema}.recce_nodes_dbt
            WHERE invocation_id = '{invocation_id}'
        """
        return self._execute_query(sql)

    # NOTE: get_columns_for_invocation is not available yet.
    # The recce-dbt-package doesn't have a recce_columns_dbt table.
    # Column metadata will need to be fetched live from information_schema
    # or a future recce_columns_dbt table could be added to the package.

    def get_invocation_metadata(self, invocation_id: str) -> Dict[str, Any]:
        """Get metadata for a specific invocation."""
        sql = f"""
            SELECT
                invocation_id,
                generated_at,
                adapter_type,
                project_name,
                framework_version,
                git_sha,
                git_branch
            FROM {self.recce_schema}.recce_invocations
            WHERE invocation_id = '{invocation_id}'
        """
        rows = self._execute_query(sql)
        if not rows:
            raise ValueError(f"Invocation {invocation_id} not found in warehouse")
        return rows[0]

    def _parse_json_field(self, value: Any) -> Any:
        """Parse a JSON field that might be string or native JSON type."""
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return value

    def _build_manifest_dict(self, invocation_id: str) -> Dict[str, Any]:
        """
        Build a manifest.json-compatible dictionary from warehouse data.

        This reconstructs the minimal manifest structure needed by Recce.
        """
        metadata = self.get_invocation_metadata(invocation_id)
        nodes = self.get_nodes_for_invocation(invocation_id)

        # Build the manifest structure
        dbt_version = metadata.get("framework_version") or "1.8.0"
        manifest = {
            "metadata": {
                "dbt_schema_version": "https://schemas.getdbt.com/dbt/manifest/v12.json",
                "dbt_version": dbt_version,
                "generated_at": (
                    metadata["generated_at"].isoformat()
                    if isinstance(metadata["generated_at"], datetime)
                    else str(metadata["generated_at"])
                ),
                "invocation_id": invocation_id,
                "project_name": metadata["project_name"],
                "adapter_type": metadata["adapter_type"],
            },
            "nodes": {},
            "sources": {},
            "exposures": {},
            "metrics": {},
            "semantic_models": {},
            "macros": {},
            "docs": {},
            "disabled": {},
            "selectors": {},
            "parent_map": {},
            "child_map": {},
            "group_map": {},  # Required in manifest v12
            "groups": {},  # Required in manifest v12
            "unit_tests": {},  # Required in manifest v12
            "saved_queries": {},  # Required in manifest v12
        }

        # Process nodes
        for node in nodes:
            unique_id = node["unique_id"]
            resource_type = node["resource_type"]
            depends_on = self._parse_json_field(node.get("depends_on")) or []
            config = self._parse_json_field(node.get("config")) or {}

            # Build full node_dict for models, seeds, snapshots, tests
            node_dict = {
                "unique_id": unique_id,
                "name": node["name"],
                "resource_type": resource_type,
                "package_name": node["package_name"],
                "database": node.get("database_name"),
                "schema": node.get("schema_name"),
                "depends_on": {"macros": [], "nodes": depends_on if isinstance(depends_on, list) else []},
                "checksum": {"name": "sha256", "checksum": node.get("checksum") or ""},
                "raw_code": node.get("raw_code") or "",
                "language": node.get("language") or "sql",
                "config": config,
                "path": f"models/{node['name']}.sql",
                "original_file_path": f"models/{node['name']}.sql",
                "alias": node["name"],
                "fqn": [node["package_name"], node["name"]],
                # Additional required fields
                "description": "",
                "columns": {},
                "meta": {},
                "docs": {"show": True, "node_color": None},
                "patch_path": None,
                "build_path": None,
                "deferred": False,
                "unrendered_config": {},
                "created_at": 0.0,
                "relation_name": f'"{node.get("database_name", "")}"."{node.get("schema_name", "")}"."{node["name"]}"',
                "refs": [],
                "sources": [],
                "metrics": [],
                "tags": [],
                "compiled_path": None,
                "compiled": True,
                "compiled_code": node.get("raw_code") or "",
                "extra_ctes_injected": True,
                "extra_ctes": [],
                "contract": {"enforced": False, "alias_types": True, "checksum": None},
                "access": "protected",
                "constraints": [],
                "version": None,
                "latest_version": None,
                "deprecation_date": None,
                "defer_relation": None,
                "primary_key": [],
                "time_spine": None,
            }

            # Route to correct collection based on resource type
            if resource_type == "source":
                # Sources have different structure
                source_name = node.get("source_name") or node["name"]
                source_dict = {
                    "unique_id": unique_id,
                    "name": node["name"],
                    "resource_type": resource_type,
                    "package_name": node["package_name"],
                    "database": node.get("database_name"),
                    "schema": node.get("schema_name"),
                    "source_name": source_name,
                    "source_description": "",
                    "loader": "",
                    "identifier": node["name"],
                    "path": f"models/{source_name}/{node['name']}.yml",
                    "original_file_path": f"models/{source_name}/{node['name']}.yml",
                    "fqn": [node["package_name"], source_name, node["name"]],
                    "description": "",
                    "columns": {},
                    "meta": {},
                    "source_meta": {},
                    "tags": [],
                    "config": config,
                    "unrendered_config": {},
                    "relation_name": f'"{node.get("database_name", "")}"."{node.get("schema_name", "")}"."{node["name"]}"',
                    "created_at": 0.0,
                }
                manifest["sources"][unique_id] = source_dict
            elif resource_type == "exposure":
                exposure_dict = {
                    "unique_id": unique_id,
                    "name": node["name"],
                    "resource_type": resource_type,
                    "package_name": node["package_name"],
                    "type": "dashboard",
                    "owner": {"email": "", "name": ""},
                    "depends_on": {"nodes": depends_on} if isinstance(depends_on, list) else depends_on,
                    "path": f"models/{node['name']}.yml",
                    "original_file_path": f"models/{node['name']}.yml",
                    "fqn": [node["package_name"], node["name"]],
                    "description": "",
                    "label": node["name"],
                    "meta": {},
                    "tags": [],
                    "config": config,
                    "unrendered_config": {},
                    "url": "",
                    "refs": [],
                    "sources": [],
                    "metrics": [],
                    "created_at": 0.0,
                }
                manifest["exposures"][unique_id] = exposure_dict
            elif resource_type == "metric":
                # Skip metrics for now as they depend on semantic_models which
                # aren't currently stored in the warehouse metadata tables.
                # TODO: Update recce-dbt-package to store semantic_models, then enable metrics.
                logger.debug(f"Skipping metric {unique_id} (semantic_model dependencies not available)")
                continue
                metric_dict = {
                    "unique_id": unique_id,
                    "name": node["name"],
                    "resource_type": resource_type,
                    "package_name": node["package_name"],
                    "type": "simple",
                    "type_params": {
                        "measure": None,
                        "input_measures": [],
                        "numerator": None,
                        "denominator": None,
                        "expr": None,
                        "window": None,
                        "grain_to_date": None,
                        "metrics": [],
                        "conversion_type_params": None,
                        "cumulative_type_params": None,
                    },
                    "depends_on": {"macros": [], "nodes": depends_on if isinstance(depends_on, list) else []},
                    "path": f"models/{node['name']}.yml",
                    "original_file_path": f"models/{node['name']}.yml",
                    "fqn": [node["package_name"], node["name"]],
                    "description": "",
                    "label": node["name"],
                    "filter": None,
                    "metadata": None,
                    "time_granularity": None,
                    "meta": {},
                    "tags": [],
                    "config": config,
                    "unrendered_config": {},
                    "sources": [],
                    "refs": [],
                    "metrics": [],
                    "created_at": 0.0,
                    "group": None,
                }
                manifest["metrics"][unique_id] = metric_dict
            elif resource_type == "semantic_model":
                sm_dict = {
                    "unique_id": unique_id,
                    "name": node["name"],
                    "resource_type": resource_type,
                    "package_name": node["package_name"],
                    "depends_on": {"macros": [], "nodes": depends_on if isinstance(depends_on, list) else []},
                    "path": f"models/{node['name']}.yml",
                    "original_file_path": f"models/{node['name']}.yml",
                    "fqn": [node["package_name"], node["name"]],
                    "description": "",
                    "node_relation": None,
                    "defaults": None,
                    "entities": [],
                    "measures": [],
                    "dimensions": [],
                    "metadata": None,
                    "primary_entity": None,
                    "label": node["name"],
                    "config": config,
                    "unrendered_config": {},
                    "refs": [],
                    "created_at": 0.0,
                    "group": None,
                }
                manifest["semantic_models"][unique_id] = sm_dict
            else:
                # model, seed, snapshot, test, etc.
                manifest["nodes"][unique_id] = node_dict

        # Build parent/child maps for all resource types
        all_nodes = {}
        all_nodes.update(manifest["nodes"])
        all_nodes.update(manifest["sources"])
        all_nodes.update(manifest["exposures"])
        all_nodes.update(manifest["metrics"])
        all_nodes.update(manifest["semantic_models"])

        # Initialize empty lists for all nodes in child_map first
        for unique_id in all_nodes.keys():
            manifest["child_map"][unique_id] = []

        # Build parent_map and populate child_map
        for unique_id, node in all_nodes.items():
            depends_on = node.get("depends_on", {})
            parent_nodes = depends_on.get("nodes", []) if isinstance(depends_on, dict) else []
            manifest["parent_map"][unique_id] = parent_nodes

            # Build child map entries
            for parent_id in parent_nodes:
                if parent_id not in manifest["child_map"]:
                    manifest["child_map"][parent_id] = []
                manifest["child_map"][parent_id].append(unique_id)

        return manifest

    def _get_columns_from_information_schema(self, relations: List[Dict[str, str]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch column metadata from information_schema for given relations.

        Args:
            relations: List of dicts with 'database', 'schema', 'name', 'unique_id' keys

        Returns:
            Dict mapping unique_id to list of column dicts
        """
        if not relations:
            return {}

        # Build WHERE clause for batch query
        conditions = []
        for rel in relations:
            schema = rel.get("schema") or ""
            name = rel.get("name") or ""
            if schema and name:
                # Use UPPER for case-insensitive matching (Snowflake returns uppercase)
                conditions.append(f"(UPPER(table_schema) = UPPER('{schema}') AND UPPER(table_name) = UPPER('{name}'))")

        if not conditions:
            return {}

        # Query information_schema.columns
        where_clause = " OR ".join(conditions)
        sql = f"""
            SELECT
                table_schema,
                table_name,
                column_name,
                data_type,
                ordinal_position
            FROM information_schema.columns
            WHERE {where_clause}
            ORDER BY table_schema, table_name, ordinal_position
        """

        try:
            rows = self._execute_query(sql)
        except Exception as e:
            logger.warning(f"Failed to fetch columns from information_schema: {e}")
            return {}

        # Build lookup from (schema, table) -> unique_id
        schema_table_to_id: Dict[Tuple[str, str], str] = {}
        for rel in relations:
            schema = (rel.get("schema") or "").upper()
            name = (rel.get("name") or "").upper()
            if schema and name:
                schema_table_to_id[(schema, name)] = rel["unique_id"]

        # Group columns by unique_id
        columns_by_node: Dict[str, List[Dict[str, Any]]] = {}
        for row in rows:
            schema = (row.get("table_schema") or "").upper()
            table = (row.get("table_name") or "").upper()
            unique_id = schema_table_to_id.get((schema, table))
            if unique_id:
                if unique_id not in columns_by_node:
                    columns_by_node[unique_id] = []
                columns_by_node[unique_id].append(
                    {
                        "column_name": row["column_name"],
                        "data_type": row.get("data_type") or "unknown",
                        "ordinal_position": row.get("ordinal_position") or 0,
                    }
                )

        return columns_by_node

    def _build_catalog_dict(self, invocation_id: str) -> Dict[str, Any]:
        """
        Build a catalog.json-compatible dictionary from warehouse data.

        Fetches column metadata directly from information_schema based on
        node locations stored in recce_nodes_dbt.
        """
        metadata = self.get_invocation_metadata(invocation_id)
        nodes = self.get_nodes_for_invocation(invocation_id)

        # Build catalog structure
        dbt_version = metadata.get("framework_version") or "1.8.0"
        catalog = {
            "metadata": {
                "dbt_schema_version": "https://schemas.getdbt.com/dbt/catalog/v1.json",
                "dbt_version": dbt_version,
                "generated_at": (
                    metadata["generated_at"].isoformat()
                    if isinstance(metadata["generated_at"], datetime)
                    else str(metadata["generated_at"])
                ),
                "invocation_id": invocation_id,
            },
            "nodes": {},
            "sources": {},
        }

        # Collect relations to query (models, seeds, snapshots - not sources)
        relations_to_query = []
        node_info_map: Dict[str, Dict] = {}

        for node in nodes:
            unique_id = node["unique_id"]
            resource_type = node.get("resource_type")
            database = node.get("database_name")
            schema = node.get("schema_name")
            name = node.get("name")

            node_info_map[unique_id] = node

            # Only query columns for materialized objects (not sources - they're external)
            if resource_type in ("model", "seed", "snapshot") and schema and name:
                relations_to_query.append(
                    {
                        "unique_id": unique_id,
                        "database": database,
                        "schema": schema,
                        "name": name,
                    }
                )

        # Batch fetch columns from information_schema
        columns_by_node = self._get_columns_from_information_schema(relations_to_query)

        # Build catalog entries for all nodes
        for unique_id, node in node_info_map.items():
            resource_type = node.get("resource_type")
            database = node.get("database_name") or ""
            schema = node.get("schema_name") or ""
            name = node.get("name") or ""

            # Build columns dict
            columns_dict = {}
            node_columns = columns_by_node.get(unique_id, [])
            for col in sorted(node_columns, key=lambda x: x.get("ordinal_position") or 0):
                col_name = col["column_name"]
                columns_dict[col_name] = {
                    "name": col_name,
                    "type": col.get("data_type") or "unknown",
                    "index": col.get("ordinal_position") or 0,
                    "comment": None,
                }

            node_entry = {
                "unique_id": unique_id,
                "metadata": {
                    "type": "table" if resource_type != "view" else "view",
                    "schema": schema,
                    "name": name,
                    "database": database,
                    "comment": None,
                    "owner": None,
                },
                "columns": columns_dict,
                "stats": {},
            }

            # Route to sources or nodes
            if resource_type == "source":
                catalog["sources"][unique_id] = node_entry
            elif resource_type in ("model", "seed", "snapshot"):
                catalog["nodes"][unique_id] = node_entry

        logger.debug(f"Built catalog with {len(catalog['nodes'])} nodes, {len(catalog['sources'])} sources")
        return catalog

    def load_manifests_and_catalogs(self) -> Tuple[Any, Any, Any, Any]:
        """
        Load manifests and catalogs from warehouse.

        Returns:
            Tuple of (curr_manifest, base_manifest, curr_catalog, base_catalog)
        """
        from dbt.contracts.graph.manifest import WritableManifest
        from dbt.contracts.results import CatalogArtifact

        curr_id, base_id = self.get_invocation_pair()

        logger.info(f"Loading warehouse metadata: curr={curr_id}, base={base_id}")

        # Build and load current manifest/catalog
        curr_manifest_dict = self._build_manifest_dict(curr_id)
        curr_catalog_dict = self._build_catalog_dict(curr_id)

        # Build and load base manifest/catalog
        base_manifest_dict = self._build_manifest_dict(base_id)
        base_catalog_dict = self._build_catalog_dict(base_id)

        # Convert to dbt objects
        curr_manifest = WritableManifest.upgrade_schema_version(curr_manifest_dict)
        base_manifest = WritableManifest.upgrade_schema_version(base_manifest_dict)

        curr_catalog = CatalogArtifact.upgrade_schema_version(curr_catalog_dict)
        base_catalog = CatalogArtifact.upgrade_schema_version(base_catalog_dict)

        logger.info(
            f"Loaded from warehouse: {len(curr_manifest.nodes)} curr nodes, " f"{len(base_manifest.nodes)} base nodes"
        )

        return curr_manifest, base_manifest, curr_catalog, base_catalog
