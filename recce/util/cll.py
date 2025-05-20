import time
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional

import sqlglot.expressions as exp
from sqlglot import Dialect, parse_one
from sqlglot.errors import OptimizeError, SqlglotError
from sqlglot.optimizer import Scope, traverse_scope
from sqlglot.optimizer.qualify import qualify

from recce.exceptions import RecceException
from recce.util import SingletonMeta


@dataclass
class CLLPerformanceTracking(metaclass=SingletonMeta):
    lineage_start = None
    lineage_elapsed = None
    column_lineage_start = None
    column_lineage_elapsed = None

    total_nodes = None
    sqlglot_error_nodes = 0
    other_error_nodes = 0

    def start_lineage(self):
        self.lineage_start = time.perf_counter_ns()

    def end_lineage(self):
        if self.lineage_start is None:
            return
        self.lineage_elapsed = (time.perf_counter_ns() - self.lineage_start) / 1000000

    def start_column_lineage(self):
        self.column_lineage_start = time.perf_counter_ns()

    def end_column_lineage(self):
        if self.column_lineage_start is None:
            return
        self.column_lineage_elapsed = (time.perf_counter_ns() - self.column_lineage_start) / 1000000

    def set_total_nodes(self, total_nodes):
        self.total_nodes = total_nodes

    def increment_sqlglot_error_nodes(self):
        self.sqlglot_error_nodes += 1

    def increment_other_error_nodes(self):
        self.other_error_nodes += 1

    def to_dict(self):
        return {
            "lineage_elapsed_ms": self.lineage_elapsed,
            "column_lineage_elapsed_ms": self.column_lineage_elapsed,
            "total_nodes": self.total_nodes,
            "sqlglot_error_nodes": self.sqlglot_error_nodes,
            "other_error_nodes": self.other_error_nodes,
        }

    def reset(self):
        self.lineage_start = None
        self.lineage_elapsed = None
        self.column_lineage_start = None
        self.column_lineage_elapsed = None

        self.total_nodes = None
        self.sqlglot_error_nodes = 0
        self.other_error_nodes = 0


@dataclass
class ColumnLevelDependsOn:
    node: str
    column: str


@dataclass
class ColumnLevelDependencyColumn:
    type: Literal["source", "passthrough", "renamed", "derived"]
    depends_on: List[ColumnLevelDependsOn]


@dataclass()
class CllResult:
    # Model to column dependencies
    depends_on: List[ColumnLevelDependsOn]

    # Column to column dependencies
    columns: Dict[str, ColumnLevelDependencyColumn]


def _cll_column(proj, table_alias_map) -> ColumnLevelDependencyColumn:
    # given an expression, return the columns depends on
    # [{node: table, column: column}, ...]
    type = "source"
    depends_on: List[ColumnLevelDependsOn] = []

    # instance of Column
    if isinstance(proj, exp.Alias):
        # 'select a as b'
        # 'select CURRENT_TIMESTAMP() as create_at'
        root = proj.this

    for expression in root.walk(bfs=False):
        if isinstance(expression, exp.Column):
            column = expression
            alias = column.table

            if alias is None:
                table = next(iter(table_alias_map.values()))
            else:
                table = table_alias_map.get(alias, alias)
            depends_on.append(ColumnLevelDependsOn(table, column.name))
            if type == "source":
                type = "passthrough"
        elif isinstance(expression, (exp.Paren, exp.Identifier)):
            pass
        else:
            type = "derived"

    depends_on = _dedeup_depends_on(depends_on)

    if len(depends_on) == 0:
        type = "source"

    if isinstance(proj, exp.Alias):
        alias = proj
        if type == "passthrough" and depends_on[0].column != alias.alias_or_name:
            type = "renamed"

    return ColumnLevelDependencyColumn(type=type, depends_on=depends_on)


def cll_old(sql, schema=None, dialect=None) -> Dict[str, ColumnLevelDependencyColumn]:
    result = cll(sql, schema=schema, dialect=dialect)
    return result.columns


def _dedeup_depends_on(depends_on: List[ColumnLevelDependsOn]) -> List[ColumnLevelDependsOn]:
    # deduplicate the depends_on list
    dedup_set = set()
    dedup_list = []
    for col_dep in depends_on:
        node_col = col_dep.node + "." + col_dep.column
        if node_col not in dedup_set:
            dedup_list.append(col_dep)
            dedup_set.add(node_col)
    return dedup_list


def _dedeup_cll_result(cll_result: CllResult):
    cll_result.depends_on = _dedeup_depends_on(cll_result.depends_on)
    for column in cll_result.columns.values():
        column.depends_on = _dedeup_depends_on(column.depends_on)


def _cll_set_scope(scope: Scope, scope_cll_map: dict[Scope, CllResult]) -> CllResult:
    result = CllResult(depends_on=[], columns={})
    scope_lineage = result.columns

    for union_scope in scope.union_scopes:
        sub_scope_result = scope_cll_map.get(union_scope)

        for k, v in sub_scope_result.columns.items():
            if k not in result.columns:
                scope_lineage[k] = v
            else:
                scope_lineage[k].depends_on.extend(v.depends_on)
                scope_lineage[k].type = "derived"

        result.depends_on.extend(sub_scope_result.depends_on)
    return result


def _cll_select_scope(scope: Scope, scope_cll_map: dict[Scope, CllResult]) -> CllResult:
    assert scope.expression.key == "select"

    column_dep_map = {}
    model_depends_on = []
    table_alias_map = {t.alias_or_name: t.name for t in scope.tables}
    select = scope.expression

    def source_column_dependency(ref_column: exp.Column) -> Optional[ColumnLevelDependencyColumn]:
        column_name = ref_column.name
        table_name = ref_column.table if ref_column.table != "" else next(iter(table_alias_map.values()))
        source = scope.sources.get(table_name, None)  # type: exp.Table | Scope
        if isinstance(source, Scope):
            ref_cll = scope_cll_map.get(source)
            if ref_cll is None:
                return None
            return ref_cll.columns.get(column_name)
        elif isinstance(source, exp.Table):
            return ColumnLevelDependencyColumn(
                type="passthrough", depends_on=[ColumnLevelDependsOn(source.name, column_name)]
            )
        else:
            return None

    for proj in scope.expression.selects:
        type = "source"
        column_depends_on: List[ColumnLevelDependsOn] = []
        root = proj.this if isinstance(proj, exp.Alias) else proj
        for expression in root.walk(bfs=False):
            if isinstance(expression, exp.Column):
                ref_column_dependency = source_column_dependency(expression)
                if ref_column_dependency is not None:
                    column_depends_on.extend(ref_column_dependency.depends_on)
                    if ref_column_dependency.type == "derived":
                        type = "derived"
                    elif ref_column_dependency.type == "renamed":
                        if type == "source" or type == "passthrough":
                            type = "renamed"
                    elif ref_column_dependency.type == "passthrough":
                        if type == "source":
                            type = "passthrough"
                else:
                    column_depends_on.append(ColumnLevelDependsOn(expression.table, expression.name))
                    if type == "source":
                        type = "passthrough"

            elif isinstance(expression, (exp.Paren, exp.Identifier)):
                pass
            else:
                type = "derived"

        column_depends_on = _dedeup_depends_on(column_depends_on)

        if len(column_depends_on) == 0 and type != "source":
            type = "source"

        if isinstance(proj, exp.Alias):
            alias = proj
            if type == "passthrough" and column_depends_on[0].column != alias.alias_or_name:
                type = "renamed"

        column_dep_map[proj.alias_or_name] = ColumnLevelDependencyColumn(type=type, depends_on=column_depends_on)

    def selected_column_dependency(ref_column: exp.Column) -> Optional[ColumnLevelDependencyColumn]:
        column_name = ref_column.name
        return column_dep_map.get(column_name)

    # joins clause: Reference the source columns
    if select.args.get("joins"):
        joins = select.args.get("joins")
        for join in joins:
            if isinstance(join, exp.Join):
                for ref_column in join.find_all(exp.Column):
                    if source_column_dependency(ref_column) is not None:
                        model_depends_on.extend(source_column_dependency(ref_column).depends_on)

    # where clauses: Reference the source columns
    if select.args.get("where"):
        where = select.args.get("where")
        if isinstance(where, exp.Where):
            for ref_column in where.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    model_depends_on.extend(source_column_dependency(ref_column).depends_on)

    # group by clause: Reference the source columns, column index
    if select.args.get("group"):
        group = select.args.get("group")
        if isinstance(group, exp.Group):
            for ref_column in group.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    model_depends_on.extend(source_column_dependency(ref_column).depends_on)

    # having clause: Reference the source columns, selected columns
    if select.args.get("having"):
        having = select.args.get("having")
        if isinstance(having, exp.Having):
            for ref_column in having.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    model_depends_on.extend(source_column_dependency(ref_column).depends_on)
                elif selected_column_dependency(ref_column) is not None:
                    model_depends_on.extend(selected_column_dependency(ref_column).depends_on)

    # order by clause: Reference the source columns, selected columns, column index
    if select.args.get("order"):
        order = select.args.get("order")
        if isinstance(order, exp.Order):
            for ref_column in order.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    model_depends_on.extend(source_column_dependency(ref_column).depends_on)
                elif selected_column_dependency(ref_column) is not None:
                    model_depends_on.extend(selected_column_dependency(ref_column).depends_on)

    for source in scope.sources.values():
        scope_result = scope_cll_map.get(source)
        if scope_result is not None:
            model_depends_on.extend(scope_result.depends_on)

    model_depends_on = _dedeup_depends_on(model_depends_on)

    return CllResult(columns=column_dep_map, depends_on=model_depends_on)


def cll(sql, schema=None, dialect=None) -> CllResult:
    # given a sql, return the cll for the sql
    # {
    #     'depends_on': [{'node': 'model_id', 'column': 'column'}],
    #     'columns': {
    #         'column1': {
    #             'type': 'derived',
    #             'depends_on': [{'node': 'model_id', 'column': 'column'}],
    #         }
    #     }
    # }

    dialect = Dialect.get(dialect) if dialect is not None else None

    try:
        expression = parse_one(sql, dialect=dialect)
    except SqlglotError as e:
        raise RecceException(f"Failed to parse SQL: {str(e)}")

    try:
        expression = qualify(expression, schema=schema, dialect=dialect)
    except OptimizeError as e:
        raise RecceException(f"Failed to optimize SQL: {str(e)}")
    except SqlglotError as e:
        raise RecceException(f"Failed to qualify SQL: {str(e)}")

    result = CllResult(depends_on=[], columns={})
    scope_cll_map = {}
    for scope in traverse_scope(expression):
        scope_type = scope.expression.key
        if scope_type == "union" or scope_type == "intersect" or scope_type == "except":
            result = _cll_set_scope(scope, scope_cll_map)
        elif scope_type == "select":
            result = _cll_select_scope(scope, scope_cll_map)
        else:
            continue

        scope_cll_map[scope] = result

    return result
