from typing import Dict, Set, Tuple

from recce.models.types import CllData


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


def find_column_dependencies(node_id: str, node_column_id: str, parent_map: Dict, child_map: Dict) -> Tuple[Set, Set]:
    upstream_cols = set()
    downstream_cols = set()
    upstream_cols.update(find_upstream(node_id, parent_map), find_upstream(node_column_id, parent_map))
    downstream_cols.update(find_downstream(node_id, child_map), find_downstream(node_column_id, child_map))

    return upstream_cols, downstream_cols


def filter_column_lineage(cll_data: CllData, relevant_columns: Set) -> CllData:

    for node_id, node_obj in cll_data.nodes.items():
        filtered_node_columns = {}

        for col_name, col_data in node_obj.columns.items():
            full_col_id = f"{node_id}_{col_name}"
            if full_col_id in relevant_columns:
                filtered_node_columns[col_name] = col_data

        node_obj.columns = filtered_node_columns
        node_obj.depends_on.columns = [
            dep for dep in node_obj.depends_on.columns if f"{dep.node}_{dep.column}" in relevant_columns
        ]

    return cll_data
