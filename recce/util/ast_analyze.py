from typing import Any, Optional

import sqlglot.expressions as exp
from pydantic import BaseModel, Field
from sqlglot import parse_one
from sqlglot.errors import SqlglotError

from recce.models.types import CllData


class JoinInfo(BaseModel):
    table: str
    join_type: str
    condition: Optional[str] = None


class ProjectionInfo(BaseModel):
    name: str
    source_columns: list[str] = Field(default_factory=list)
    is_aggregate: bool = False
    is_derived: bool = False


class AggregationInfo(BaseModel):
    function: str
    column: Optional[str] = None


class SqlStructure(BaseModel):
    refs: list[str] = Field(default_factory=list)
    projections: list[ProjectionInfo] = Field(default_factory=list)
    filters: list[str] = Field(default_factory=list)
    joins: list[JoinInfo] = Field(default_factory=list)
    group_by: list[str] = Field(default_factory=list)
    having: list[str] = Field(default_factory=list)
    order_by: list[str] = Field(default_factory=list)
    aggregations: list[AggregationInfo] = Field(default_factory=list)
    case_expressions: list[str] = Field(default_factory=list)
    distinct: bool = False
    has_subquery: bool = False
    has_cte: bool = False
    is_set_operation: bool = False
    unparseable: bool = False


def _projection_from(select_item: exp.Expression) -> ProjectionInfo:
    if isinstance(select_item, exp.Alias):
        name = select_item.alias
        inner = select_item.this
    elif isinstance(select_item, exp.Star):
        return ProjectionInfo(name="*")
    else:
        name = select_item.alias_or_name
        inner = select_item

    is_aggregate = inner.find(exp.AggFunc) is not None
    is_derived = not isinstance(inner, exp.Column)
    source_columns = [c.name for c in inner.find_all(exp.Column)]
    return ProjectionInfo(
        name=name,
        source_columns=source_columns,
        is_aggregate=is_aggregate,
        is_derived=is_derived,
    )


def _flatten_and(condition: exp.Expression) -> list[exp.Expression]:
    if isinstance(condition, exp.And):
        return _flatten_and(condition.left) + _flatten_and(condition.right)
    return [condition]


def _join_info(join: exp.Join) -> JoinInfo:
    side = join.args.get("side")
    kind = join.args.get("kind")
    if side:
        join_type = side.upper()
    elif kind and kind.upper() == "CROSS":
        join_type = "CROSS"
    else:
        join_type = "INNER"

    on = join.args.get("on")
    condition = on.sql() if on is not None else None

    table = join.this
    table_name = table.name if isinstance(table, exp.Table) else table.sql()

    return JoinInfo(table=table_name, join_type=join_type, condition=condition)


def _aggregation_info(agg: exp.AggFunc) -> AggregationInfo:
    function = agg.key.upper()
    inner = agg.this
    if inner is None or isinstance(inner, exp.Star):
        return AggregationInfo(function=function, column=None)
    col = inner.find(exp.Column) if not isinstance(inner, exp.Column) else inner
    column_name = col.name if col is not None else None
    return AggregationInfo(function=function, column=column_name)


def _top_level_selects(tree: exp.Expression) -> list[exp.Select]:
    """Return the SELECT legs of the outermost tree.

    For a plain SELECT, returns [tree]. For UNION / INTERSECT / EXCEPT (any
    sqlglot ``exp.Union`` subclass), recurses into ``left`` / ``right`` and
    returns each leg's SELECT. Selects inside CTEs and subqueries are not
    returned — those are walked separately by ``find_all`` for aggregations
    and case expressions.
    """
    if isinstance(tree, exp.Union):
        return _top_level_selects(tree.left) + _top_level_selects(tree.right)
    if isinstance(tree, exp.Select):
        return [tree]
    return []


def analyze_sql(compiled_sql: str, dialect: Optional[str] = None) -> SqlStructure:
    try:
        tree = parse_one(compiled_sql, dialect=dialect)
    except SqlglotError:
        return SqlStructure(unparseable=True)

    # Exclude CTE alias names from refs — they are internal aliases, not
    # upstream tables. Without this, every staging-style model with `WITH
    # source AS (...) SELECT * FROM source` leaks the CTE name as a "ref".
    cte_names = {cte.alias_or_name for cte in tree.find_all(exp.CTE)}
    refs = sorted({t.name for t in tree.find_all(exp.Table) if t.name not in cte_names})

    projections: list[ProjectionInfo] = []
    filters: list[str] = []
    joins: list[JoinInfo] = []
    group_by: list[str] = []
    having: list[str] = []
    order_by: list[str] = []
    aggregations: list[AggregationInfo] = []

    selects = _top_level_selects(tree)
    distinct = False
    for select in selects:
        for select_item in select.expressions:
            projections.append(_projection_from(select_item))

        where = select.args.get("where")
        if where is not None:
            for predicate in _flatten_and(where.this):
                filters.append(predicate.sql())

        for join in select.args.get("joins") or []:
            joins.append(_join_info(join))

        group = select.args.get("group")
        if group is not None:
            for item in group.expressions:
                group_by.append(item.sql())

        having_clause = select.args.get("having")
        if having_clause is not None:
            having.append(having_clause.this.sql())

        order = select.args.get("order")
        if order is not None:
            for item in order.expressions:
                order_by.append(item.sql())

        if select.args.get("distinct") is not None:
            distinct = True

    for agg in tree.find_all(exp.AggFunc):
        aggregations.append(_aggregation_info(agg))

    case_expressions = [c.sql() for c in tree.find_all(exp.Case)]

    has_subquery = tree.find(exp.Subquery) is not None
    has_cte = tree.find(exp.With) is not None
    is_set_operation = isinstance(tree, exp.Union)

    return SqlStructure(
        refs=refs,
        projections=projections,
        filters=filters,
        joins=joins,
        group_by=group_by,
        having=having,
        order_by=order_by,
        aggregations=aggregations,
        case_expressions=case_expressions,
        distinct=distinct,
        has_subquery=has_subquery,
        has_cte=has_cte,
        is_set_operation=is_set_operation,
    )


def get_compiled_sql_from_manifest(manifest: Any, model_id: str) -> Optional[str]:
    node = manifest.nodes.get(model_id)
    if node is None:
        return None
    compiled = getattr(node, "compiled_code", None)
    return compiled or None


def collect_downstream(cll_data: CllData, model_id: str) -> dict:
    """Find models and columns downstream of model_id using CllData.child_map.

    child_map is keyed by either node_id or column_id ({node_id}_{column_name}),
    and values are sets of dependent ids. Column ownership is resolved via
    CllColumn.table_id (populated by build_full_cll_map).
    """
    if model_id not in cll_data.nodes:
        return {"models": [], "columns": []}

    models: set[str] = set()
    columns: list[dict] = []
    seen_cols: set[tuple] = set()

    # Node-level downstream
    for child_id in cll_data.child_map.get(model_id, set()):
        if child_id == model_id:
            continue
        if child_id in cll_data.nodes:
            models.add(child_id)

    # Column-level downstream: walk each column of the source model
    for col_name in cll_data.nodes[model_id].columns:
        col_id = f"{model_id}_{col_name}"
        for child_col_id in cll_data.child_map.get(col_id, set()):
            child_col = cll_data.columns.get(child_col_id)
            if child_col is None or child_col.table_id == model_id:
                continue
            entry = (child_col.table_id, child_col.name)
            if entry in seen_cols:
                continue
            seen_cols.add(entry)
            columns.append({"node": child_col.table_id, "column": child_col.name})
            if child_col.table_id:
                models.add(child_col.table_id)

    return {"models": sorted(models), "columns": columns}
