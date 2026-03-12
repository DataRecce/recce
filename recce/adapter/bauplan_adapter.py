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
    lineage_data: dict = field(default_factory=dict)

    @classmethod
    def load(cls, **kwargs):
        bauplan_refs = kwargs.get("bauplan_refs")
        if bauplan_refs is None:
            raise Exception("'--bauplan-refs BASE:CURRENT' is required")

        refs = bauplan_refs.split(":")
        if len(refs) != 2:
            raise Exception('bauplan_refs must be in the format "BASE:CURRENT"')

        lineage_path = kwargs.get("bauplan_lineage")
        lineage_data = {}
        if lineage_path:
            with open(lineage_path) as f:
                lineage_data = json.load(f)

        import bauplan

        client = bauplan.Client()

        return cls(
            client=client,
            base_ref=refs[0],
            curr_ref=refs[1],
            lineage_data=lineage_data,
        )

    def support_tasks(self):
        support_map = {run_type.value: True for run_type in bauplan_supported_registry}
        support_map["change_analysis"] = False
        return support_map

    def get_lineage(self, base: Optional[bool] = False):
        nodes = {}
        parent_map = self.lineage_data.get("parent_map", {})

        all_nodes = {
            **self.lineage_data.get("sources", {}),
            **self.lineage_data.get("nodes", {}),
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

    def get_model(self, model_id: str, base=False):
        all_nodes = {
            **self.lineage_data.get("sources", {}),
            **self.lineage_data.get("nodes", {}),
        }
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
        all_nodes = {
            **self.lineage_data.get("sources", {}),
            **self.lineage_data.get("nodes", {}),
        }
        node = all_nodes.get(unique_id)
        if node is None:
            return None
        return node.get("name", unique_id)

    def select_nodes(
        self,
        select=None,
        exclude=None,
        packages=None,
        view_mode=None,
    ) -> Set[str]:
        nodes = self.lineage_data.get("nodes", {})
        return set(nodes.keys())

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
