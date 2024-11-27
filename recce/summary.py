import os
import sys
from typing import List, Dict, Set, Union, Type, Optional
from uuid import UUID

from pydantic import BaseModel

from recce.apis.check_func import get_node_name_by_id
from recce.core import RecceContext
from recce.models import CheckDAO, RunDAO, RunType, Run
from recce.tasks.core import TaskResultDiffer
from recce.tasks.histogram import HistogramDiffTaskResultDiffer
from recce.tasks.profile import ProfileDiffResultDiffer
from recce.tasks.query import QueryDiffResultDiffer
from recce.tasks.rowcount import RowCountDiffResultDiffer
from recce.tasks.schema import SchemaDiffResultDiffer
from recce.tasks.top_k import TopKDiffTaskResultDiffer
from recce.tasks.valuediff import ValueDiffTaskResultDiffer, ValueDiffDetailTaskResultDiffer

RECCE_CLOUD_HOST = os.environ.get('RECCE_CLOUD_HOST', 'https://cloud.datarecce.io')

ADD_COLOR = '#1dce00'
MODIFIED_COLOR = '#ffa502'
REMOVE_COLOR = '#ff067e'

MAX_MERMAID_TEXT_SIZE = 50000  # source: https://mermaid.js.org/config/schema-docs/config.html#maxtextsize


def _warn(msg):
    # print to stderr
    print(f"warning: {msg}", file=sys.stderr)


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

    def _cal_row_count_delta_percentage(self):
        row_count_diff, run_result = _get_node_row_count_diff(self.id, self.name)
        if row_count_diff:
            base = run_result.get('base', 0)
            current = run_result.get('curr', 0)
            if int(current) > int(base):
                p = (int(current) - int(base)) / int(current) * 100
                return f'🔼 +{round(p, 2) if p > 0.1 else "<0.1"}%'
            else:
                p = (int(base) - int(current)) / int(current) * 100
                return f'🔽 -{round(p, 2) if p > 0.1 else "<0.1"}%'
        return None

    def _get_schema_diff(self):
        base_schema = self.base_data.get('columns', {})
        current_schema = self.current_data.get('columns', {})
        schema_diff = TaskResultDiffer.diff(base_schema, current_schema)
        return schema_diff

    def _what_changed(self, checks=None):
        changes = []
        if self.change_status == 'added':
            return ['Added Node']
        elif self.change_status == 'removed':
            return ['Removed Node']
        elif self.change_status == 'modified':
            changes.append('Code')
        row_count_delta_percentage = self._cal_row_count_delta_percentage()
        if row_count_delta_percentage:
            changes.append(f'Row Count {row_count_delta_percentage}')
        schema_diff = self._get_schema_diff()
        if schema_diff:
            changes.append('Schema')

        if checks:
            for check in checks:
                check_type = check.type
                if check_type == RunType.ROW_COUNT_DIFF or check_type == RunType.SCHEMA_DIFF:
                    # Skip the row count and schema diff check, since we already have it.
                    continue
                if check.node_ids and self.id in check.node_ids:
                    changes.append(str(check.type).replace('_', ' ').title())
        return changes

    def get_node_str(self, checks=None):
        is_changed = False
        style = None

        if self.change_status is not None:
            is_changed = True
            if self.change_status == 'added':
                style = f'style {self.id} stroke:{ADD_COLOR}'
            elif self.change_status == 'modified':
                style = f'style {self.id} stroke:{MODIFIED_COLOR}'
            elif self.change_status == 'removed':
                style = f'style {self.id} stroke:{REMOVE_COLOR}'

        if checks:
            for check in checks:
                if check.node_ids and self.id in check.node_ids:
                    is_changed = True

        content_output = f'{self.id}["{self.name}'
        if is_changed:
            content_output += '\n\n[What\'s Changed]\n'
            changes = self._what_changed(checks)
            content_output += ', '.join(changes)

        content_output += '"]\n'
        if style:
            content_output += f'{style}\n'
        return content_output


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
    node_ids: Optional[List[str]]
    changed_nodes: Optional[List[str]]

    @property
    def related_nodes(self):
        nodes = []

        for node_id in self.node_ids or []:
            name = get_node_name_by_id(node_id)
            nodes.append(name)

        return nodes


check_result_differ_registry: Dict[RunType, Type[TaskResultDiffer]] = {
    RunType.VALUE_DIFF: ValueDiffTaskResultDiffer,
    RunType.VALUE_DIFF_DETAIL: ValueDiffDetailTaskResultDiffer,
    RunType.ROW_COUNT_DIFF: RowCountDiffResultDiffer,
    RunType.QUERY_DIFF: QueryDiffResultDiffer,
    RunType.TOP_K_DIFF: TopKDiffTaskResultDiffer,
    RunType.HISTOGRAM_DIFF: HistogramDiffTaskResultDiffer,
    RunType.PROFILE_DIFF: ProfileDiffResultDiffer,
}


def differ_factory(run: Run):
    differ_clz = check_result_differ_registry.get(run.type)
    if not differ_clz:
        raise NotImplementedError()
    return differ_clz(run)


class LineageGraph:
    nodes: Dict[str, Node] = {}
    edges: Dict[str, Edge] = {}
    checks: List[CheckSummary] = None

    def create_node(self, node_id: str, node_data: dict, data_from: str = 'base'):
        if node_id not in self.nodes:
            self.nodes[node_id] = Node(node_id, node_data, data_from)
        else:
            self.nodes[node_id].update_data(node_data, data_from)

    def create_edge(self, parent_id: str, child_id: str, edge_from: str = 'base'):
        if parent_id not in self.nodes:
            _warn(f'Parent node {parent_id} not found in graph')
            return
        if child_id not in self.nodes:
            _warn(f'Child node {child_id} not found in graph')
            return

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


def _get_node_row_count_diff(node_id, node_name):
    row_count_runs = RunDAO().list(type_filter=RunType.ROW_COUNT_DIFF)
    for run in row_count_runs:
        if node_id in run.params.get('node_ids', []):
            result = run.result.get(node_name, {})
            diff = TaskResultDiffer.diff(result.get('base'), result.get('curr'))
            return diff, result
        elif run.params.get('node_id') == node_id:
            result = run.result.get(node_name, {})
            diff = TaskResultDiffer.diff(result.get('base'), result.get('curr'))
            return diff, result
    return None, None


def _generate_mismatched_nodes_summary(check: CheckSummary, limit: int = 3) -> str:
    if not check.related_nodes:
        return 'N/A'

    nodes = check.related_nodes
    if check.changed_nodes:
        # the mismatch nodes within the related nodes (when apply node selection)
        # currently only schema_diff and row_count_diff are supported to apply node selection
        nodes = check.changed_nodes

    if len(nodes) <= limit:
        return ', '.join(nodes)

    display_nodes = nodes[:limit - 1]
    return ', '.join(display_nodes) + f', and {len(nodes) - len(display_nodes)} more nodes'


def generate_summary_metadata(base_lineage, curr_lineage):
    from py_markdown_table.markdown_table import markdown_table

    base_manifest = base_lineage.get('manifest_metadata')
    base_catalog = base_lineage.get('catalog_metadata')
    curr_manifest = curr_lineage.get('manifest_metadata')
    curr_catalog = curr_lineage.get('catalog_metadata')

    metadata = [
        {
            '': 'Base',
            'Manifest': base_manifest.generated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'Catalog': base_catalog.generated_at.strftime('%Y-%m-%d %H:%M:%S') if base_catalog else 'N/A'
        },
        {
            '': 'Current',
            'Manifest': curr_manifest.generated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'Catalog': curr_catalog.generated_at.strftime('%Y-%m-%d %H:%M:%S') if curr_catalog else 'N/A'
        }
    ]

    return markdown_table(metadata).set_params(
        quote=False,
        row_sep='markdown',
        padding_width=1,
        padding_weight='right'  # Aligns the cell's contents to the beginning of the cell
    ).get_markdown()


def generate_check_summary(base_lineage, curr_lineage) -> (List[CheckSummary], Dict[str, int]):
    runs = RunDAO().list()
    checks = CheckDAO().list()
    checks_summary: List[CheckSummary] = []
    failed_checks_count = 0

    # TODO: find a way to count failed checks, currently the state file won't include failed checks

    def _find_run_by_check_id(check_id):
        runs_for_check = [r for r in runs if str(check_id) == str(r.check_id)]
        if runs_for_check:
            return runs_for_check[-1]
        return None

    for check in checks:
        run = _find_run_by_check_id(check.check_id)
        differ = None
        if run is not None and run.error is not None:
            failed_checks_count += 1
            continue
        elif check.type == RunType.SCHEMA_DIFF:
            differ = SchemaDiffResultDiffer(check, base_lineage, curr_lineage)
        elif (check.type in [RunType.ROW_COUNT_DIFF, RunType.QUERY_DIFF,
                             RunType.VALUE_DIFF, RunType.VALUE_DIFF_DETAIL, RunType.PROFILE_DIFF,
                             RunType.TOP_K_DIFF, RunType.HISTOGRAM_DIFF] and run is not None):
            # Check the result is changed or not
            differ = differ_factory(run)

        if differ and differ.changes is not None:
            checks_summary.append(
                CheckSummary(
                    id=check.check_id,
                    type=check.type,
                    name=check.name,
                    description=check.description,
                    changes=differ.changes,
                    node_ids=differ.related_node_ids,
                    changed_nodes=differ.changed_nodes
                )
            )

    return checks_summary, {
        'total': len(checks),
        'mismatch': len(checks_summary),
        'failed': failed_checks_count,
    }


def generate_mermaid_lineage_graph(graph: LineageGraph):
    content = up_to_level_content = 'graph LR\n'
    is_not_modified = False
    # Only show the modified nodes and there children
    queue = list(graph.modified_set)
    display_nodes = set()
    display_edge = set()

    if len(queue) == 0:
        is_not_modified = True

    while len(queue) > 0:

        level_nodes = len(queue)
        for _ in range(level_nodes):
            node_id = queue.pop(0)
            if node_id in display_nodes:
                # Skip if already displayed
                continue

            display_nodes.add(node_id)
            node = graph.nodes[node_id]
            content += node.get_node_str(graph.checks)
            for child_id in node.children:
                queue.append(child_id)
                edge_id = f'{node_id}-->{child_id}'
                if edge_id not in display_edge:
                    display_edge.add(edge_id)
                    content += graph.get_edge_str(edge_id)

        if len(content) > MAX_MERMAID_TEXT_SIZE:
            break

        up_to_level_content = content

    return up_to_level_content, is_not_modified, len(content) > MAX_MERMAID_TEXT_SIZE


def generate_markdown_summary(ctx: RecceContext, summary_format: str = 'markdown'):
    curr_lineage = ctx.get_lineage(base=False)
    base_lineage = ctx.get_lineage(base=True)
    summary_metadata = generate_summary_metadata(base_lineage, curr_lineage)
    graph = _build_lineage_graph(base_lineage, curr_lineage)
    graph.checks, check_statistics = generate_check_summary(base_lineage, curr_lineage)
    mermaid_content, is_empty_graph, is_partial_graph = generate_mermaid_lineage_graph(graph)
    check_content = generate_check_content(graph, check_statistics)

    if summary_format == 'mermaid':
        return mermaid_content
    elif summary_format == 'check':
        return check_content
    elif summary_format == 'markdown':

        content = '# Recce Summary\n'
        content += f'## Manifest Information\n{summary_metadata}\n'

        if is_empty_graph is False:
            content += f'''
## Lineage Graph
{"_Too many nodes to generate! Please see the full lineage graph on Recce instance._" if is_partial_graph else ''}
```mermaid
{mermaid_content}
```
'''
        else:
            content += '''
## Lineage Graph
No changed module was detected.
'''
        if check_content:
            content += check_content

        if ctx.state_loader.cloud_mode:
            pr_info = ctx.state_loader.pr_info
            content += f'\nSee PR page: {RECCE_CLOUD_HOST}/{pr_info.repository}/pulls/{pr_info.id}\n'

        return content


def generate_check_content(graph, check_statistics):
    from py_markdown_table.markdown_table import markdown_table
    content = ''
    check_content = None
    # Generate the check summary if we found any changes
    if len(graph.checks) > 0:
        data = []
        for check in graph.checks:
            data.append({
                'Name': check.name,
                'Type': str(check.type).replace('_', ' ').title(),
                'Mismatched Nodes': _generate_mismatched_nodes_summary(check),
                # Temporarily remove the type of changes, until we implement a better way to display it.
                # 'Type of Changes': _formate_changes(check.changes)
            })
        check_content = markdown_table(data).set_params(
            quote=False,
            row_sep='markdown',
            padding_width=1,
            padding_weight='right'  # Aligns the cell's contents to the beginning of the cell
        ).get_markdown()

    if check_statistics.get('total', 0) > 0:
        warning_message = ''
        statistics = {
            'Checks Run': check_statistics.get('total', 0),
            'Data Mismatch Detected': check_statistics.get('mismatch', 0),
        }
        if check_statistics.get('failed', 0) > 0:
            statistics['Incomplete Checks'] = check_statistics.get('failed', 0)
            warning_message = '''
:warning: **Incomplete Checks** refers to checks that did not successfully run due to configuration or SQL errors.
Please check the output of `recce run` for more information
'''
        check_summary = markdown_table([statistics]).set_params(quote=False, row_sep='markdown').get_markdown()
        content += f'''
## Checks Summary
{check_summary}
{warning_message}
'''
    if check_content:
        content += f'''
### Checks of Data Mismatch Detected
{check_content}
'''
    return content
