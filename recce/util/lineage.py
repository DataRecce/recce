from typing import Dict, Iterable, Set, Tuple

from recce.models.types import CllColumn, CllNode


def find_upstream(node_ids: Iterable, parent_map):
    visited = set()
    upstream = set()

    def dfs(current):
        if current in visited:
            return
        visited.add(current)

        parents = parent_map.get(current, [])
        for parent in parents:
            upstream.add(parent)
            dfs(parent)

    for node_id in node_ids:
        dfs(node_id)

    return upstream


def find_downstream(node_ids: Iterable, child_map):
    visited = set()
    downstream = set()

    def dfs(current):
        if current in visited:
            return
        visited.add(current)

        children = child_map.get(current, [])
        for child in children:
            downstream.add(child)
            dfs(child)

    for node_id in node_ids:
        dfs(node_id)

    return downstream


def find_column_dependencies(node_column_id: str, parent_map: Dict, child_map: Dict) -> Tuple[Set, Set]:
    upstream_cols = find_upstream([node_column_id], parent_map)
    downstream_cols = find_downstream([node_column_id], child_map)
    return upstream_cols, downstream_cols


def filter_lineage_vertices(
    lineage_nodes: Dict[str, CllNode], lineage_columns: Dict[str, CllColumn], relevant_columns: Set[str]
) -> Tuple[Dict[str, CllNode], Dict[str, CllColumn]]:
    nodes = {}
    columns = {}

    for node_id, node in lineage_nodes.items():
        if node_id in relevant_columns:
            nodes[node_id] = node

    for col_id, column in lineage_columns.items():
        if col_id in relevant_columns:
            columns[col_id] = column

    return nodes, columns


def filter_dependency_maps(
    parent_map: Dict, child_map: Dict, relevant_ids: Set
) -> Tuple[Dict[str, Set], Dict[str, Set]]:
    p_map = {}
    c_map = {}
    for node_id, parents in parent_map.items():
        if node_id in relevant_ids:
            p_map[node_id] = {p for p in parents if p in relevant_ids}

    for node_id, children in child_map.items():
        if node_id in relevant_ids:
            c_map[node_id] = {c for c in children if c in relevant_ids}

    return p_map, c_map


def build_column_key(node_id: str, column_name: str) -> str:
    """Build a unique column key from node name and column name."""
    return f"{node_id}_{column_name}"
