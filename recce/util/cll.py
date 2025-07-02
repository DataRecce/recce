import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import sqlglot.expressions as exp
from sqlglot import Dialect, parse_one
from sqlglot.errors import OptimizeError, SqlglotError
from sqlglot.optimizer import Scope, traverse_scope
from sqlglot.optimizer.qualify import qualify

from recce.exceptions import RecceException
from recce.models.types import CllColumn, CllColumnDep

CllResult = Tuple[
    List[CllColumnDep],  # Model to column dependencies
    Dict[str, CllColumn],  # Column to column dependencies
]


@dataclass
class CLLPerformanceTracking:
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


def _cll_column(proj, table_alias_map) -> CllColumn:
    # given an expression, return the columns depends on
    # [{node: table, column: column}, ...]
    type = "source"
    depends_on: List[CllColumnDep] = []

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
            depends_on.append(CllColumnDep(table, column.name))
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

    return CllColumn(type=type, depends_on=depends_on)


def _dedeup_depends_on(depends_on: List[CllColumnDep]) -> List[CllColumnDep]:
    # deduplicate the depends_on list
    dedup_set = set()
    dedup_list = []
    for col_dep in depends_on:
        node_col = col_dep.node + "." + col_dep.column
        if node_col not in dedup_set:
            dedup_list.append(col_dep)
            dedup_set.add(node_col)
    return dedup_list


def _cll_set_scope(scope: Scope, scope_cll_map: dict[Scope, CllResult]) -> CllResult:
    # model-to-column
    m2c: List[CllColumnDep] = []
    # column-to-column
    c2c_map: Dict[str, CllColumn] = {}

    for union_scope in scope.union_scopes:
        sub_scope_result = scope_cll_map.get(union_scope)
        if sub_scope_result is None:
            raise RecceException(f"Scope {union_scope} not found in scope_cll_map")
        sub_m2c, sub_c2c_map = sub_scope_result

        for k, v in sub_c2c_map.items():
            if k not in c2c_map:
                c2c_map[k] = v
            else:
                c2c_map[k].depends_on.extend(v.depends_on)
                c2c_map[k].transformation_type = "derived"

        m2c.extend(sub_m2c)
    return m2c, c2c_map


def _cll_select_scope(scope: Scope, scope_cll_map: dict[Scope, CllResult]) -> CllResult:
    assert scope.expression.key == "select"

    # model-to-column
    m2c: List[CllColumnDep] = []
    # column-to-column
    c2c_map: Dict[str, CllColumn] = {}

    table_alias_map = {t.alias_or_name: t.name for t in scope.tables}
    select = scope.expression

    def source_column_dependency(ref_column: exp.Column) -> Optional[CllColumn]:
        column_name = ref_column.name
        table_name = ref_column.table if ref_column.table != "" else next(iter(table_alias_map.values()))
        source = scope.sources.get(table_name, None)  # transformation_type: exp.Table | Scope
        if isinstance(source, Scope):
            ref_cll_result = scope_cll_map.get(source)
            if ref_cll_result is None:
                return None
            _, sub_c2c_map = ref_cll_result
            return sub_c2c_map.get(column_name)
        elif isinstance(source, exp.Table):
            return CllColumn(
                name=column_name,
                transformation_type="passthrough",
                depends_on=[CllColumnDep(node=source.name, column=column_name)],
            )
        else:
            return None

    def subquery_cll(subquery: exp.Subquery) -> Optional[CllResult]:
        select = subquery.find(exp.Select)
        if select is None:
            return None

        matched_scope = None
        for sub_scope in scope.subquery_scopes:
            if sub_scope.expression == select:
                matched_scope = sub_scope
                break
        if matched_scope is None:
            return None

        return scope_cll_map.get(matched_scope)

    for proj in scope.expression.selects:
        transformation_type = "source"
        column_depends_on: List[CllColumnDep] = []
        root = proj.this if isinstance(proj, exp.Alias) else proj
        for expression in root.walk(bfs=False):
            if isinstance(expression, exp.Column):
                ref_column_dependency = source_column_dependency(expression)
                if ref_column_dependency is not None:
                    column_depends_on.extend(ref_column_dependency.depends_on)
                    if ref_column_dependency.transformation_type == "derived":
                        transformation_type = "derived"
                    elif ref_column_dependency.transformation_type == "renamed":
                        if transformation_type == "source" or transformation_type == "passthrough":
                            transformation_type = "renamed"
                    elif ref_column_dependency.transformation_type == "passthrough":
                        if transformation_type == "source":
                            transformation_type = "passthrough"
                else:
                    column_depends_on.append(CllColumnDep(expression.table, expression.name))
                    if transformation_type == "source":
                        transformation_type = "passthrough"

            elif isinstance(expression, (exp.Paren, exp.Identifier)):
                pass
            else:
                transformation_type = "derived"

        column_depends_on = _dedeup_depends_on(column_depends_on)

        if len(column_depends_on) == 0 and transformation_type != "source":
            transformation_type = "source"

        if isinstance(proj, exp.Alias):
            alias = proj
            if transformation_type == "passthrough" and column_depends_on[0].column != alias.alias_or_name:
                transformation_type = "renamed"

        c2c_map[proj.alias_or_name] = CllColumn(
            name=proj.alias_or_name, transformation_type=transformation_type, depends_on=column_depends_on
        )

    def selected_column_dependency(ref_column: exp.Column) -> Optional[CllColumn]:
        column_name = ref_column.name
        return c2c_map.get(column_name)

    # joins clause: Reference the source columns
    if select.args.get("joins"):
        joins = select.args.get("joins")
        for join in joins:
            if isinstance(join, exp.Join):
                for ref_column in join.find_all(exp.Column):
                    if source_column_dependency(ref_column) is not None:
                        m2c.extend(source_column_dependency(ref_column).depends_on)

    # where clauses: Reference the source columns
    if select.args.get("where"):
        where = select.args.get("where")
        if isinstance(where, exp.Where):
            for ref_column in where.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)
            for subquery in where.find_all(exp.Subquery):
                sub_cll = subquery_cll(subquery)
                if sub_cll is not None:
                    sub_m2c, sub_c2c_map = sub_cll
                    m2c.extend(sub_m2c)
                    for sub_c in sub_c2c_map.values():
                        m2c.extend(sub_c.depends_on)

    # group by clause: Reference the source columns, column index
    if select.args.get("group"):
        group = select.args.get("group")
        if isinstance(group, exp.Group):
            for ref_column in group.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)

    # having clause: Reference the source columns, selected columns
    if select.args.get("having"):
        having = select.args.get("having")
        if isinstance(having, exp.Having):
            for ref_column in having.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)
                elif selected_column_dependency(ref_column) is not None:
                    m2c.extend(selected_column_dependency(ref_column).depends_on)
            for subquery in having.find_all(exp.Subquery):
                sub_cll = subquery_cll(subquery)
                if sub_cll is not None:
                    sub_m2c, sub_c2c_map = sub_cll
                    m2c.extend(sub_m2c)
                    for sub_c in sub_c2c_map.values():
                        m2c.extend(sub_c.depends_on)

    # order by clause: Reference the source columns, selected columns, column index
    if select.args.get("order"):
        order = select.args.get("order")
        if isinstance(order, exp.Order):
            for ref_column in order.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)
                elif selected_column_dependency(ref_column) is not None:
                    m2c.extend(selected_column_dependency(ref_column).depends_on)

    for source in scope.sources.values():
        scope_cll_result = scope_cll_map.get(source)
        if scope_cll_result is None:
            continue
        sub_m2c, _ = scope_cll_result
        m2c.extend(sub_m2c)

    m2c = _dedeup_depends_on(m2c)

    return m2c, c2c_map


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

    result = None
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

    if result is None:
        raise RecceException("Failed to extract CLL from SQL")
    return result
