from typing import List, Literal, Optional, Union

from pydantic import BaseModel

from recce.models import Check
from recce.tasks.core import CheckValidator, TaskResultDiffer


class SchemaDiffResultDiffer:
    related_node_ids: List[str] = None

    def __init__(self, check, base_lineage, curr_lineage):
        self.check = check
        self.related_node_ids = self._get_related_node_ids()
        self.changes = self._check_result_changed_fn(base_lineage, curr_lineage)
        self.changed_nodes = self._get_changed_nodes()

    def _get_related_node_ids(self) -> Union[List[str], None]:
        params = self.check.params
        if params.get("node_id"):
            return params.get("node_id") if isinstance(params.get("node_id"), list) else [params.get("node_id")]
        else:
            return TaskResultDiffer.get_node_ids_by_selector(
                select=params.get("select"),
                exclude=params.get("exclude"),
                packages=params.get("packages"),
                view_mode=params.get("view_mode"),
            )

    def _check_result_changed_fn(self, base_lineage, curr_lineage):
        base = {}
        current = {}
        base_nodes = base_lineage.get("nodes", {})
        curr_nodes = curr_lineage.get("nodes", {})
        for node_id in self.related_node_ids:
            node = curr_nodes.get(node_id) or base_nodes.get(node_id)
            if not node:
                continue

            node_name = node.get("name")
            base[node_name] = base_nodes.get(node_id, {}).get("columns", {})
            current[node_name] = curr_nodes.get(node_id, {}).get("columns", {})

        return TaskResultDiffer.diff(base, current)

    def _get_changed_nodes(self) -> Union[List[str], None]:
        if self.changes:
            return self.changes.affected_root_keys.items


class SchemaDiffParams(BaseModel):
    node_id: Optional[Union[str, List[str]]] = None
    select: Optional[str] = None
    exclude: Optional[str] = None
    packages: Optional[list[str]] = None
    view_mode: Optional[Literal["all", "changed_models"]] = None


class SchemaDiffCheckValidator(CheckValidator):
    def validate_check(self, check: Check):
        SchemaDiffParams(**check.params)
        SchemaDiffParams(**check.view_options)
