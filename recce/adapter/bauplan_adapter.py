# ABOUTME: Adapter for comparing data across two Bauplan branches.
# ABOUTME: Reads lineage from a JSON file and queries data via bauplan Python SDK.
import json
import typing as t
from dataclasses import dataclass, field
from typing import Dict, Optional, Set, Type

from recce.adapter.base import BaseAdapter
from recce.models import RunType
from recce.tasks import QueryDiffTask, QueryTask, RowCountDiffTask, Task
from recce.tasks.histogram import HistogramDiffTask
from recce.tasks.profile import ProfileDiffTask

bauplan_supported_registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
    RunType.PROFILE_DIFF: ProfileDiffTask,
    RunType.HISTOGRAM_DIFF: HistogramDiffTask,
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
        support_map["change_analysis"] = False
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
        # Include nodes from both branches
        base_nodes = self._get_lineage_section(base=True).get("nodes", {})
        curr_nodes = self._get_lineage_section(base=False).get("nodes", {})
        return set(base_nodes.keys()) | set(curr_nodes.keys())

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
