from typing import Dict, Set, Tuple

from recce.models.types import CllColumn, CllData, CllNode


def find_upstream(node, parent_map):
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

    dfs(node)
    return upstream


def find_downstream(node, child_map):
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

    dfs(node)
    return downstream


def build_dependency_maps(cll_data: CllData) -> Tuple[Dict[str, Set], Dict[str, Set]]:
    parent_map = {}
    child_map = {}

    for node_id, node_data in cll_data.nodes.items():
        for dep_node in node_data.depends_on.nodes:
            if node_id not in parent_map:
                parent_map[node_id] = set()
            parent_map[node_id].add(dep_node)

            if dep_node not in child_map:
                child_map[dep_node] = set()
            child_map[dep_node].add(node_id)

        for col_name, col_data in node_data.columns.items():
            current_col_id = f"{node_id}_{col_name}"

            for dep in col_data.depends_on:
                dep_col_id = f"{dep.node}_{dep.column}"

                if current_col_id not in parent_map:
                    parent_map[current_col_id] = set()
                parent_map[current_col_id].add(dep_col_id)

                if dep_col_id not in child_map:
                    child_map[dep_col_id] = set()
                child_map[dep_col_id].add(current_col_id)

        for dep in node_data.depends_on.columns:
            dep_col_id = f"{dep.node}_{dep.column}"

            if node_id not in parent_map:
                parent_map[node_id] = set()
            parent_map[node_id].add(dep_col_id)

            if dep_col_id not in child_map:
                child_map[dep_col_id] = set()
            child_map[dep_col_id].add(node_id)

    return parent_map, child_map


def build_lineage_vertices(cll_data: CllData) -> Tuple[Dict[str, CllNode], Dict[str, CllColumn]]:
    lineage_nodes = {}
    lineage_columns = {}

    for cll_node_id, node in cll_data.nodes.items():
        lineage_nodes[cll_node_id] = node.copy()

        for name, cll_column in node.columns.items():
            column_key = f"{cll_node_id}_{name}"
            lineage_columns[column_key] = cll_column.copy()
            lineage_columns[column_key].id = column_key
            lineage_columns[column_key].table_id = cll_node_id

    return lineage_nodes, lineage_columns


def find_column_dependencies(node_column_id: str, parent_map: Dict, child_map: Dict) -> Tuple[Set, Set]:
    upstream_cols = find_upstream(node_column_id, parent_map)
    downstream_cols = find_downstream(node_column_id, child_map)
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
    parent_map: Dict, child_map: Dict, relevant_columns: Set
) -> Tuple[Dict[str, Set], Dict[str, Set]]:
    p_map = {}
    c_map = {}
    for node_id, parents in parent_map.items():
        if node_id in relevant_columns:
            p_map[node_id] = {p for p in parents if p in relevant_columns}

    for node_id, children in child_map.items():
        if node_id in relevant_columns:
            c_map[node_id] = {c for c in children if c in relevant_columns}

    return p_map, c_map
