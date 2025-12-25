"""
Experiment 2: Version-Agnostic Metadata Extraction

Extract metadata from any dbt manifest version (v9-v12+) without dbt-core.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class NodeMetadata:
    """Essential node metadata extracted from manifest + catalog."""

    unique_id: str
    name: str
    resource_type: str  # model, seed, snapshot, source, exposure
    package_name: str
    schema_name: str
    checksum: str  # For change detection
    raw_code: str  # SQL code
    config: Dict[str, Any] = field(default_factory=dict)
    columns: List[Dict[str, str]] = field(default_factory=list)  # [{name, type}]

    # Optional fields
    source_name: Optional[str] = None  # For sources only
    description: Optional[str] = None


@dataclass
class LineageEdge:
    """Edge in the lineage DAG."""

    child_id: str
    parent_id: str


@dataclass
class ManifestMetadata:
    """Metadata about the manifest itself."""

    dbt_version: str
    dbt_schema_version: str
    adapter_type: str
    project_name: str
    generated_at: str


class MetadataExtractor:
    """
    Extract essential metadata from dbt manifest and catalog files.

    Supports manifest versions v9-v12+ without any dbt-core dependency.
    """

    # Resource types Recce cares about
    SUPPORTED_RESOURCE_TYPES = {"model", "seed", "snapshot", "source", "exposure"}

    def __init__(self, manifest_path: str, catalog_path: Optional[str] = None):
        self.manifest_path = Path(manifest_path)
        self.catalog_path = Path(catalog_path) if catalog_path else None

        self._manifest_data: Optional[Dict] = None
        self._catalog_data: Optional[Dict] = None

    def extract(self) -> Tuple[List[NodeMetadata], List[LineageEdge], ManifestMetadata]:
        """
        Extract all metadata from manifest and catalog.

        Returns:
            Tuple of (nodes, lineage_edges, manifest_metadata)
        """
        self._load_files()

        nodes = self._extract_nodes()
        lineage = self._extract_lineage()
        metadata = self._extract_manifest_metadata()

        if self._catalog_data:
            self._enrich_with_catalog(nodes)

        return nodes, lineage, metadata

    def _load_files(self) -> None:
        """Load manifest and catalog JSON files."""
        with open(self.manifest_path) as f:
            self._manifest_data = json.load(f)

        if self.catalog_path and self.catalog_path.exists():
            with open(self.catalog_path) as f:
                self._catalog_data = json.load(f)

    def _extract_nodes(self) -> List[NodeMetadata]:
        """Extract node metadata from manifest."""
        nodes = []

        # Extract models, seeds, snapshots
        for node_id, node in self._manifest_data.get("nodes", {}).items():
            resource_type = node.get("resource_type")
            if resource_type not in self.SUPPORTED_RESOURCE_TYPES:
                continue

            nodes.append(
                NodeMetadata(
                    unique_id=node["unique_id"],
                    name=node["name"],
                    resource_type=resource_type,
                    package_name=node.get("package_name", ""),
                    schema_name=node.get("schema", ""),
                    checksum=node.get("checksum", {}).get("checksum", ""),
                    raw_code=node.get("raw_code", ""),
                    config=node.get("config", {}),
                    description=node.get("description"),
                )
            )

        # Extract sources
        for source_id, source in self._manifest_data.get("sources", {}).items():
            nodes.append(
                NodeMetadata(
                    unique_id=source["unique_id"],
                    name=source["name"],
                    resource_type="source",
                    package_name=source.get("package_name", ""),
                    schema_name=source.get("schema", ""),
                    checksum="",  # Sources don't have checksums
                    raw_code="",
                    config=source.get("config", {}),
                    source_name=source.get("source_name"),
                    description=source.get("description"),
                )
            )

        # Extract exposures
        for exposure_id, exposure in self._manifest_data.get("exposures", {}).items():
            nodes.append(
                NodeMetadata(
                    unique_id=exposure["unique_id"],
                    name=exposure["name"],
                    resource_type="exposure",
                    package_name=exposure.get("package_name", ""),
                    schema_name="",
                    checksum="",
                    raw_code="",
                    config=exposure.get("config", {}),
                    description=exposure.get("description"),
                )
            )

        return nodes

    def _extract_lineage(self) -> List[LineageEdge]:
        """Extract lineage edges from parent_map."""
        edges = []

        for child_id, parents in self._manifest_data.get("parent_map", {}).items():
            for parent_id in parents:
                edges.append(LineageEdge(child_id=child_id, parent_id=parent_id))

        return edges

    def _extract_manifest_metadata(self) -> ManifestMetadata:
        """Extract manifest metadata."""
        metadata = self._manifest_data.get("metadata", {})

        return ManifestMetadata(
            dbt_version=metadata.get("dbt_version", "unknown"),
            dbt_schema_version=metadata.get("dbt_schema_version", "unknown"),
            adapter_type=metadata.get("adapter_type", "unknown"),
            project_name=metadata.get("project_name", metadata.get("project_id", "unknown")),
            generated_at=metadata.get("generated_at", ""),
        )

    def _enrich_with_catalog(self, nodes: List[NodeMetadata]) -> None:
        """Add column information from catalog to nodes."""
        node_map = {n.unique_id: n for n in nodes}

        # Enrich from nodes catalog
        for node_id, node_catalog in self._catalog_data.get("nodes", {}).items():
            if node_id in node_map:
                columns = [
                    {"name": col["name"], "type": col["type"]}
                    for col in node_catalog.get("columns", {}).values()
                ]
                node_map[node_id].columns = columns

        # Enrich from sources catalog
        for source_id, source_catalog in self._catalog_data.get("sources", {}).items():
            if source_id in node_map:
                columns = [
                    {"name": col["name"], "type": col["type"]}
                    for col in source_catalog.get("columns", {}).values()
                ]
                node_map[source_id].columns = columns


def detect_changes(
    base_nodes: List[NodeMetadata], curr_nodes: List[NodeMetadata]
) -> Dict[str, str]:
    """
    Detect changes between base and current nodes using checksums.

    Returns:
        Dict mapping node_id to change_type ('added', 'removed', 'modified')
    """
    base_map = {n.unique_id: n for n in base_nodes}
    curr_map = {n.unique_id: n for n in curr_nodes}

    changes = {}

    # Find added and modified nodes
    for node_id, node in curr_map.items():
        if node_id not in base_map:
            changes[node_id] = "added"
        elif node.checksum and node.checksum != base_map[node_id].checksum:
            changes[node_id] = "modified"

    # Find removed nodes
    for node_id in base_map:
        if node_id not in curr_map:
            changes[node_id] = "removed"

    return changes


# --- CLI for testing ---

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python metadata_extractor.py <manifest.json> [catalog.json]")
        sys.exit(1)

    manifest_path = sys.argv[1]
    catalog_path = sys.argv[2] if len(sys.argv) > 2 else None

    extractor = MetadataExtractor(manifest_path, catalog_path)
    nodes, lineage, metadata = extractor.extract()

    print(f"=== Manifest Metadata ===")
    print(f"  dbt_version: {metadata.dbt_version}")
    print(f"  schema_version: {metadata.dbt_schema_version}")
    print(f"  adapter_type: {metadata.adapter_type}")
    print(f"  project_name: {metadata.project_name}")

    print(f"\n=== Extracted Nodes ({len(nodes)}) ===")
    for node in nodes[:5]:  # Show first 5
        cols = f", {len(node.columns)} columns" if node.columns else ""
        print(f"  {node.resource_type}: {node.name} ({node.unique_id}){cols}")
    if len(nodes) > 5:
        print(f"  ... and {len(nodes) - 5} more")

    print(f"\n=== Lineage Edges ({len(lineage)}) ===")
    for edge in lineage[:5]:
        print(f"  {edge.parent_id} -> {edge.child_id}")
    if len(lineage) > 5:
        print(f"  ... and {len(lineage) - 5} more")
