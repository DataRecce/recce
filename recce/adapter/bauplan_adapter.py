# ABOUTME: Adapter for comparing data across two Bauplan branches.
# ABOUTME: Reads lineage from a JSON file and queries data via bauplan Python SDK.
import json
import typing as t
from dataclasses import dataclass, field
from typing import Dict, Optional, Set, Type

from recce.adapter.base import BaseAdapter
from recce.models import RunType
from recce.models.types import CllColumn, CllColumnDep, CllData, CllNode
from recce.tasks import QueryDiffTask, QueryTask, RowCountDiffTask, Task
from recce.tasks.histogram import HistogramDiffTask
from recce.tasks.profile import ProfileDiffTask
from recce.tasks.top_k import TopKDiffTask
from recce.util.lineage import build_column_key

bauplan_supported_registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
    RunType.PROFILE_DIFF: ProfileDiffTask,
    RunType.HISTOGRAM_DIFF: HistogramDiffTask,
    RunType.TOP_K_DIFF: TopKDiffTask,
}


@dataclass
class BauplanAdapter(BaseAdapter):
    client: t.Any  # bauplan.Client instance
    base_ref: str
    curr_ref: str
    base_lineage: dict = field(default_factory=dict)
    curr_lineage: dict = field(default_factory=dict)

    @classmethod
    def load(cls, **kwargs):
        bauplan_refs = kwargs.get("bauplan_refs")
        if bauplan_refs is None:
            raise Exception("'--bauplan-refs BASE:CURRENT' is required")

        refs = bauplan_refs.split(":")
        if len(refs) != 2:
            raise Exception('bauplan_refs must be in the format "BASE:CURRENT"')

        base_lineage = {}
        curr_lineage = {}

        # Two separate files take precedence
        base_path = kwargs.get("bauplan_base_lineage")
        curr_path = kwargs.get("bauplan_curr_lineage")
        if base_path:
            with open(base_path) as f:
                base_lineage = json.load(f)
        if curr_path:
            with open(curr_path) as f:
                curr_lineage = json.load(f)

        # Fallback: single file with optional "base"/"current" keys
        if not base_path and not curr_path:
            lineage_path = kwargs.get("bauplan_lineage")
            if lineage_path:
                with open(lineage_path) as f:
                    data = json.load(f)
                if "base" in data or "current" in data:
                    base_lineage = data.get("base", {})
                    curr_lineage = data.get("current", {})
                else:
                    base_lineage = data
                    curr_lineage = data

        import bauplan

        client = bauplan.Client()

        return cls(
            client=client,
            base_ref=refs[0],
            curr_ref=refs[1],
            base_lineage=base_lineage,
            curr_lineage=curr_lineage,
        )

    def support_tasks(self):
        support_map = {run_type.value: True for run_type in bauplan_supported_registry}
        support_map["change_analysis"] = True
        return support_map

    def _build_lineage(self, lineage_section: dict):
        nodes = {}
        parent_map = lineage_section.get("parent_map", {})

        all_nodes = {
            **lineage_section.get("sources", {}),
            **lineage_section.get("nodes", {}),
        }
        for node_id, node_data in all_nodes.items():
            columns = {}
            for col_name, col_info in node_data.get("columns", {}).items():
                columns[col_name] = {
                    "name": col_name,
                    "type": col_info.get("type", "unknown"),
                }
            nodes[node_id] = {
                "unique_id": node_id,
                "name": node_data.get("name", node_id),
                "resource_type": node_data.get("resource_type", "model"),
                "checksum": {"checksum": node_data.get("checksum", "")},
                "columns": columns,
            }

        return dict(
            parent_map=parent_map,
            nodes=nodes,
            manifest_metadata={},
            catalog_metadata={},
        )

    def get_lineage(self, base: Optional[bool] = False):
        return self._build_lineage(self._get_lineage_section(base))

    def _get_lineage_section(self, base=False):
        """Get the lineage section for the given branch."""
        return self.base_lineage if base else self.curr_lineage

    def _get_all_nodes(self, base=False):
        section = self._get_lineage_section(base)
        return {
            **section.get("sources", {}),
            **section.get("nodes", {}),
        }

    def get_model(self, model_id: str, base=False):
        all_nodes = self._get_all_nodes(base)
        node = all_nodes.get(model_id)
        if node is None:
            return None
        columns = {}
        for col_name, col_info in node.get("columns", {}).items():
            columns[col_name] = {
                "name": col_name,
                "type": col_info.get("type", "unknown"),
            }
        return {"columns": columns}

    def get_node_name_by_id(self, unique_id):
        # Search current first, then base
        for base in [False, True]:
            all_nodes = self._get_all_nodes(base)
            node = all_nodes.get(unique_id)
            if node is not None:
                return node.get("name", unique_id)
        return None

    def select_nodes(
        self,
        select=None,
        exclude=None,
        packages=None,
        view_mode=None,
    ) -> Set[str]:
        if view_mode == "changed_models":
            # +state:modified semantics: modified nodes + their upstream parents
            lineage_diff = self.get_lineage_diff()
            modified = set(lineage_diff.diff.keys())
            parent_map = self.curr_lineage.get("parent_map", {})
            from recce.util.lineage import find_upstream

            upstream = find_upstream(modified, parent_map)
            return modified | upstream

        # "all" or default: return all nodes and sources from both branches
        result = set()
        for base in [True, False]:
            section = self._get_lineage_section(base)
            result.update(section.get("nodes", {}).keys())
            result.update(section.get("sources", {}).keys())
        return result

    def get_cll(
        self,
        node_id: Optional[str] = None,
        column: Optional[str] = None,
        change_analysis: Optional[bool] = False,
        no_cll: Optional[bool] = False,
        no_upstream: Optional[bool] = False,
        no_downstream: Optional[bool] = False,
    ) -> CllData:
        """Build column-level lineage from pre-computed lineage JSON."""
        lineage = self.curr_lineage
        parent_map_nodes = lineage.get("parent_map", {})

        # Determine which nodes to include
        if node_id is not None:
            target_node_ids = {node_id}
        else:
            # Changed nodes (from lineage diff)
            lineage_diff = self.get_lineage_diff()
            target_node_ids = set(lineage_diff.diff.keys())

        # Expand to upstream/downstream
        if not no_upstream:
            from recce.util.lineage import find_upstream

            target_node_ids = target_node_ids.union(find_upstream(target_node_ids, parent_map_nodes))
        if not no_downstream:
            child_map_nodes = self._build_child_map(parent_map_nodes)
            from recce.util.lineage import find_downstream

            target_node_ids = target_node_ids.union(find_downstream(target_node_ids, child_map_nodes))

        # Build CLL data from lineage JSON
        all_nodes = self._get_all_nodes(base=False)
        cll_nodes = {}
        cll_columns = {}
        cll_parent_map = {}

        for nid in target_node_ids:
            node_data = all_nodes.get(nid)
            if node_data is None:
                continue

            resource_type = node_data.get("resource_type", "model")
            cll_node = CllNode(
                id=nid,
                name=node_data.get("name", nid),
                package_name=node_data.get("package_name", ""),
                resource_type=resource_type,
            )

            # Node-level parent map
            cll_parent_map[nid] = set(parent_map_nodes.get(nid, []))

            # Build columns
            is_source = resource_type == "source"
            for col_name, col_info in node_data.get("columns", {}).items():
                col_id = build_column_key(nid, col_name)
                deps = []
                parent_col_ids = set()

                if not is_source:
                    for dep in col_info.get("depends_on", []):
                        dep_node = dep.get("node", "")
                        dep_col = dep.get("column", "")
                        deps.append(CllColumnDep(node=dep_node, column=dep_col))
                        parent_col_ids.add(build_column_key(dep_node, dep_col))

                transformation = col_info.get("transformation_type", "source" if is_source else "unknown")

                cll_col = CllColumn(
                    id=col_id,
                    table_id=nid,
                    name=col_name,
                    type=col_info.get("type"),
                    transformation_type=transformation,
                    depends_on=deps,
                )
                cll_columns[col_id] = cll_col
                cll_parent_map[col_id] = parent_col_ids
                cll_node.columns[col_name] = cll_col

            cll_nodes[nid] = cll_node

        # Build child_map from parent_map
        cll_child_map: Dict[str, Set[str]] = {}
        for child_id, parents in cll_parent_map.items():
            for parent_id in parents:
                cll_child_map.setdefault(parent_id, set()).add(child_id)

        # Filter to dependency chain when a specific column is requested
        if column and node_id:
            root_col_id = build_column_key(node_id, column)
            reachable = self._walk_column_chain(root_col_id, cll_parent_map, cll_child_map)
            cll_columns = {k: v for k, v in cll_columns.items() if k in reachable}
            cll_parent_map = {k: v for k, v in cll_parent_map.items() if k in reachable or k in cll_nodes}
            cll_child_map = {k: v for k, v in cll_child_map.items() if k in reachable or k in cll_nodes}
            for nid, cll_node in cll_nodes.items():
                cll_node.columns = {name: col for name, col in cll_node.columns.items() if col.id in reachable}

        # Change analysis: annotate nodes/columns with change status
        if change_analysis:
            lineage_diff = self.get_lineage_diff()
            base_all_nodes = self._get_all_nodes(base=True)

            for nid, cll_node in cll_nodes.items():
                node_diff = lineage_diff.diff.get(nid)
                if node_diff is not None:
                    cll_node.change_status = node_diff.change_status

                    # Column-level change detection
                    if node_diff.change_status == "modified":
                        base_node = base_all_nodes.get(nid, {})
                        base_cols = set(base_node.get("columns", {}).keys())
                        curr_cols = set(all_nodes.get(nid, {}).get("columns", {}).keys())

                        for col_name in curr_cols - base_cols:
                            col_id = build_column_key(nid, col_name)
                            if col_id in cll_columns:
                                cll_columns[col_id].change_status = "added"
                        for col_name in base_cols - curr_cols:
                            col_id = build_column_key(nid, col_name)
                            if col_id in cll_columns:
                                cll_columns[col_id].change_status = "removed"
                    elif node_diff.change_status == "added":
                        for col_name in cll_node.columns:
                            col_id = build_column_key(nid, col_name)
                            if col_id in cll_columns:
                                cll_columns[col_id].change_status = "added"
                    elif node_diff.change_status == "removed":
                        for col_name in cll_node.columns:
                            col_id = build_column_key(nid, col_name)
                            if col_id in cll_columns:
                                cll_columns[col_id].change_status = "removed"

        return CllData(
            nodes=cll_nodes,
            columns=cll_columns,
            parent_map=cll_parent_map,
            child_map=cll_child_map,
        )

    @staticmethod
    def _build_child_map(parent_map: dict) -> dict:
        """Invert a parent_map to produce a child_map."""
        child_map: Dict[str, list] = {}
        for child, parents in parent_map.items():
            for parent in parents:
                child_map.setdefault(parent, []).append(child)
        return child_map

    @staticmethod
    def _walk_column_chain(
        root: str,
        parent_map: Dict[str, Set[str]],
        child_map: Dict[str, Set[str]],
    ) -> Set[str]:
        """Walk upstream and downstream from a column to find all reachable columns."""
        reachable: Set[str] = set()
        queue = [root]
        while queue:
            col = queue.pop()
            if col in reachable:
                continue
            reachable.add(col)
            for parent in parent_map.get(col, set()):
                queue.append(parent)
            for child in child_map.get(col, set()):
                queue.append(child)
        return reachable

    def fetchdf_with_limit(self, sql: str, base: Optional[bool] = None, limit: Optional[int] = None) -> tuple:
        ref = self.base_ref if base else self.curr_ref
        if limit:
            limited_sql = f"SELECT * FROM ({sql}) AS q LIMIT {limit + 1}"
        else:
            limited_sql = sql
        result = self.client.query(query=limited_sql, ref=ref)
        df = result.to_pandas()
        if limit and len(df) > limit:
            return df.head(limit), True
        return df, False
