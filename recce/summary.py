from typing import List, Dict, Set, Union, Type
from uuid import UUID

from pydantic import BaseModel

from recce.models import CheckDAO, RunDAO, RunType
from recce.tasks.core import TaskResultDiffer
from recce.tasks.histogram import HistogramDiffTaskResultDiffer
from recce.tasks.query import QueryDiffResultDiffer
from recce.tasks.rowcount import RowCountDiffResultDiffer
from recce.tasks.top_k import TopKDiffTaskResultDiffer
from recce.tasks.valuediff import ValueDiffTaskResultDiffer

ADD_COLOR = '#1dce00'
MODIFIED_COLOR = '#ffa502'
REMOVE_COLOR = '#ff067e'


class Node:
    id: str
    name: str
    data_from: str
    resource_type: str
    package_name: str
    parents: List[str]
    children: List[str]
    base_data: dict
    current_data: dict

    def __init__(self, node_id: str, node_data: dict, data_from: str = 'base'):
        self.id = node_id
        self.name = node_data['name']
        self.data_from = data_from
        self.resource_type = node_data['resource_type']
        self.package_name = node_data['package_name']
        self.children = []
        self.parents = []

        self.base_data = {}
        self.current_data = {}

        if data_from == 'base':
            self.base_data = node_data
        elif data_from == 'current':
            self.current_data = node_data

    @property
    def change_status(self):
        base_checksum = self.base_data.get('checksum', {}).get('checksum')
        curr_checksum = self.current_data.get('checksum', {}).get('checksum')
        if self.data_from == 'base':
            return 'removed'
        elif self.data_from == 'current':
            return 'added'
        elif base_checksum and curr_checksum and base_checksum != curr_checksum:
            return 'modified'
        return None

    def update_data(self, node_data: dict, data_from: str):
        if data_from not in ['base', 'current']:
            raise ValueError(f'Invalid data_from value: {data_from}')
        if self.data_from != data_from:
            self.data_from = 'both'

            if data_from == 'base':
                self.base_data = node_data
            elif data_from == 'current':
                self.current_data = node_data

    def append_parent(self, parent_id: str):
        if parent_id not in self.parents:
            self.parents.append(parent_id)

    def append_child(self, child_id: str):
        if child_id not in self.children:
            self.children.append(child_id)

    def __str__(self):
        style = None
        if self.change_status == 'added':
            style = f'style {self.id} stroke:{ADD_COLOR}'
        elif self.change_status == 'modified':
            style = f'style {self.id} stroke:{MODIFIED_COLOR}'
        elif self.change_status == 'removed':
            style = f'style {self.id} stroke:{REMOVE_COLOR}'

        if style:
            return f'{self.id}["{self.name} [{self.change_status.upper()}]"]\n{style}\n'
        return f'{self.id}["{self.name}"]\n'


class Edge:
    id: str
    edge_from: str
    child_id: str
    parent_id: str
    change_status: Union[str, None]

    def __init__(self, edge_id: str, parent_id: str, child_id: str, edge_from: str = 'base'):
        self.id = edge_id
        self.edge_from = edge_from
        self.child_id = child_id
        self.parent_id = parent_id

    def update_edge_from(self, edge_from: str):
        if self.edge_from != edge_from:
            self.edge_from = 'both'


class CheckSummary(BaseModel):
    id: UUID
    type: RunType
    name: str
    description: str
    changes: dict


check_result_differ_registry: Dict[RunType, Type[TaskResultDiffer]] = {
    RunType.VALUE_DIFF: ValueDiffTaskResultDiffer,
    RunType.ROW_COUNT_DIFF: RowCountDiffResultDiffer,
    RunType.QUERY_DIFF: QueryDiffResultDiffer,
    RunType.TOP_K_DIFF: TopKDiffTaskResultDiffer,
    RunType.HISTOGRAM_DIFF: HistogramDiffTaskResultDiffer,
}


def differ_factory(run_type: RunType, result):
    differ_clz = check_result_differ_registry.get(run_type)
    if not differ_clz:
        raise NotImplementedError()
    return differ_clz(result)


class LineageGraph:
    nodes: Dict[str, Node] = {}
    edges: Dict[str, Edge] = {}

    def create_node(self, node_id: str, node_data: dict, data_from: str = 'base'):
        if node_id not in self.nodes:
            self.nodes[node_id] = Node(node_id, node_data, data_from)
        else:
            self.nodes[node_id].update_data(node_data, data_from)

    def create_edge(self, parent_id: str, child_id: str, edge_from: str = 'base'):
        if parent_id not in self.nodes:
            raise ValueError(f'Parent node {parent_id} not found in graph')
        if child_id not in self.nodes:
            raise ValueError(f'Child node {child_id} not found in graph')

        edge_id = f'{parent_id}-->{child_id}'
        if edge_id in self.edges:
            self.edges[edge_id].update_edge_from(edge_from)
        else:
            self.edges[edge_id] = Edge(edge_id, parent_id, child_id, edge_from)
            self.nodes[parent_id].append_child(child_id)
            self.nodes[child_id].append_parent(parent_id)

    @property
    def modified_set(self) -> Set[str]:
        return set([node_id for node_id, node in self.nodes.items() if node.change_status == 'modified'])

    def get_edge_str(self, edge_id):
        edge = self.edges[edge_id]
        child = self.nodes[edge.child_id]

        if child.change_status == 'removed':
            return f'{edge.parent_id}-.->{edge.child_id}\n'
        if child.change_status is None or child.change_status == 'modified':
            return f'{edge.parent_id}---->{edge.child_id}\n'
        if child.change_status == 'added':
            return f'{edge.parent_id}-...->{edge.child_id}\n'


def _build_lineage_graph(base, current) -> LineageGraph:
    graph = LineageGraph()

    # Init Graph nodes with base & current nodes
    for node_id, node_data in base.get('nodes', {}).items():
        graph.create_node(node_id, node_data, 'base')

    for node_id, node_data in current.get('nodes', {}).items():
        if node_id not in graph.nodes:
            node = Node(node_id, node_data, 'current')
            graph.nodes[node_id] = node
        else:
            node = graph.nodes[node_id]
            node.update_data(node_data, 'current')

    # Build edges
    for child_id, parents in base.get('parent_map', {}).items():
        for parent_id in parents:
            graph.create_edge(parent_id, child_id, 'base')
    for child_id, parents in current.get('parent_map', {}).items():
        for parent_id in parents:
            graph.create_edge(parent_id, child_id, 'current')

    return graph


def _build_node_schema(lineage, node_id):
    return lineage.get('nodes', {}).get(node_id, {}).get('columns', {})


def generate_preset_check_summary(base_lineage, curr_lineage) -> List[CheckSummary]:
    runs = RunDAO().list()
    preset_checks = [check for check in CheckDAO().list() if check.is_preset is True]
    preset_checks_summary: List[CheckSummary] = []

    def _find_run_by_check_id(check_id):
        for r in runs:
            if str(check_id) == str(r.check_id):
                return r
        return None

    for check in preset_checks:
        run = _find_run_by_check_id(check.check_id)
        if check.type == RunType.SCHEMA_DIFF:
            # TODO: Check schema diff of the selected node
            node_id = check.params.get('node_id')
            base = _build_node_schema(base_lineage, node_id)
            current = _build_node_schema(curr_lineage, node_id)
            changes = TaskResultDiffer.diff(base, current)
            if changes:
                preset_checks_summary.append(
                    CheckSummary(
                        id=check.check_id,
                        type=check.type,
                        name=check.name,
                        description=check.description,
                        changes=changes)
                )
        elif str(check.type).endswith('_diff') and run is not None:
            # Check the result is changed or not
            differ = differ_factory(check.type, run.result)
            if differ.changes is not None:
                preset_checks_summary.append(
                    CheckSummary(
                        id=check.check_id,
                        type=check.type,
                        name=check.name,
                        description=check.description,
                        changes=differ.changes)
                )

    return preset_checks_summary


def generate_mermaid_lineage_graph(graph: LineageGraph):
    content = 'graph LR\n'
    # Only show the modified nodes and there children
    queue = list(graph.modified_set)
    display_nodes = set()
    display_edge = set()

    while len(queue) > 0:
        node_id = queue.pop(0)
        if node_id in display_nodes:
            # Skip if already displayed
            continue
        display_nodes.add(node_id)
        node = graph.nodes[node_id]
        content += f'{node}'
        for child_id in node.children:
            queue.append(child_id)
            edge_id = f'{node_id}-->{child_id}'
            if edge_id not in display_edge:
                display_edge.add(edge_id)
                content += graph.get_edge_str(edge_id)

    return content


def generate_markdown_summary(ctx, summary_format: str = 'markdown'):
    curr_lineage = ctx.get_lineage(base=False)
    base_lineage = ctx.get_lineage(base=True)
    graph = _build_lineage_graph(base_lineage, curr_lineage)
    preset_checks = generate_preset_check_summary(base_lineage, curr_lineage)
    preset_content = None
    mermaid_content = generate_mermaid_lineage_graph(graph)

    def _formate_changes(changes):
        return ",".join([k.replace('_', ' ').title() for k in list(changes.keys())])

    if len(preset_checks) > 0:
        from py_markdown_table.markdown_table import markdown_table
        data = []
        for check in preset_checks:
            data.append({
                'Name': check.name,
                'Type': str(check.type).replace('_', ' ').title(),
                'Description': check.description or 'N/A',
                'Type of Changes': _formate_changes(check.changes)
            })
        preset_content = markdown_table(data).set_params(quote=False, row_sep='markdown').get_markdown()

    if summary_format == 'mermaid':
        return mermaid_content
    elif summary_format == 'preset':
        return preset_content
    elif summary_format == 'markdown':
        # TODO: Check the markdown output content is longer than 65535 characters.
        # If it is, we should reduce the content length.
        content = f'''
# Recce Summary

## Lineage Graph
```mermaid
{mermaid_content}
```
'''
        if preset_content:
            content += f'''
## Impacted Preset Checks
{preset_content}
'''
        return content
