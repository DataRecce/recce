from typing import Union, List

from recce.tasks.core import TaskResultDiffer


class SchemaDiffResultDiffer:
    related_node_ids: List[str] = None

    def __init__(self, check, base_lineage, curr_lineage):
        self.check = check
        self.related_node_ids = self._get_related_node_ids()
        self.changes = self._check_result_changed_fn(base_lineage, curr_lineage)
        self.changed_nodes = self._get_changed_nodes()

    def _get_related_node_ids(self) -> Union[List[str], None]:
        params = self.check.params
        if params.get('node_id'):
            return [params.get('node_id')] if params.get('node_id') else []
        else:
            return TaskResultDiffer.get_node_ids_by_selector(params.get('select'), params.get('exclude'))

    def _check_result_changed_fn(self, base_lineage, curr_lineage):
        base = {}
        current = {}
        base_nodes = base_lineage.get('nodes', {})
        curr_nodes = curr_lineage.get('nodes', {})
        for node_id in self.related_node_ids:
            node = curr_nodes.get(node_id) or base_nodes.get(node_id)
            if not node:
                continue

            node_name = node.get('name')
            base[node_name] = base_nodes.get(node_id, {}).get('columns', {})
            current[node_name] = curr_nodes.get(node_id, {}).get('columns', {})

        return TaskResultDiffer.diff(base, current)

    def _get_changed_nodes(self) -> Union[List[str], None]:
        if self.changes:
            return self.changes.affected_root_keys.items
