"""DRC-3025 — Numeric/decimal type serialization.

Backend half of the fix: stamp each result column's comparison type so the
frontend can compare approximate floats (DOUBLE/FLOAT) with an epsilon while
comparing exact decimals (DECIMAL/NUMERIC) exactly.

- DOUBLE/FLOAT/REAL  -> FLOAT   (approximate; frontend epsilon)
- DECIMAL/NUMERIC    -> NUMBER  (exact; the cycle-4 guard — never float-collapse)
- unmatched / catalog-absent -> keep from_agate type (exact fallback, AC9)
- profile avg/median/proportions -> FLOAT by construction
"""

from recce.tasks import ProfileDiffTask, QueryDiffTask, ValueDiffDetailTask
from recce.tasks.dataframe import DataFrame, DataFrameColumn
from recce.tasks.dataframe import DataFrameColumnType as T


def _types(df) -> dict:
    return {col.name.lower(): col.type for col in df.columns}


# ---------------------------------------------------------------------------
# from_db_type — DB type string -> comparison type (AC4 mapping)
# ---------------------------------------------------------------------------


def test_from_db_type_maps_double_and_float_to_float():
    for db_type in ["DOUBLE", "double", "DOUBLE PRECISION", "FLOAT", "FLOAT8", "REAL"]:
        assert T.from_db_type(db_type) == T.FLOAT, db_type


def test_from_db_type_maps_decimal_and_numeric_to_number_exact():
    for db_type in ["DECIMAL(38,2)", "DECIMAL", "NUMERIC(10,2)", "NUMBER(18,3)", "decimal(18,3)"]:
        assert T.from_db_type(db_type) == T.NUMBER, db_type


def test_from_db_type_maps_int_variants_to_integer():
    for db_type in ["INT", "INTEGER", "BIGINT", "HUGEINT", "SMALLINT"]:
        assert T.from_db_type(db_type) == T.INTEGER, db_type


def test_from_db_type_returns_none_for_non_numeric_and_empty():
    for db_type in ["VARCHAR", "TEXT", "DATE", "BOOLEAN", "INTERVAL", ""]:
        assert T.from_db_type(db_type) is None, db_type


# ---------------------------------------------------------------------------
# stamp_column_types — in-place, case-insensitive, unmatched untouched
# ---------------------------------------------------------------------------


def test_stamp_column_types_overrides_matched_keeps_unmatched():
    df = DataFrame(
        columns=[
            DataFrameColumn(name="rev", type=T.NUMBER),
            DataFrameColumn(name="price", type=T.NUMBER),
            DataFrameColumn(name="AVG", type=T.NUMBER),  # matched case-insensitively
            DataFrameColumn(name="note", type=T.TEXT),  # unmatched
        ],
        data=[],
    )
    df.stamp_column_types({"rev": T.FLOAT, "price": T.NUMBER, "avg": T.FLOAT})
    types = _types(df)
    assert types["rev"] == T.FLOAT
    assert types["price"] == T.NUMBER
    assert types["avg"] == T.FLOAT
    assert types["note"] == T.TEXT  # exact fallback preserved


def test_stamp_column_types_empty_map_is_noop():
    df = DataFrame(columns=[DataFrameColumn(name="x", type=T.NUMBER)], data=[])
    df.stamp_column_types({})
    assert df.columns[0].type == T.NUMBER


def test_float_serializes_to_float_wire_label():
    df = DataFrame(columns=[DataFrameColumn(name="x", type=T.FLOAT)], data=[])
    import json

    payload = json.loads(df.model_dump_json())
    assert payload["columns"][0]["type"] == "float"


# ---------------------------------------------------------------------------
# catalog_column_types — reads DECIMAL vs DOUBLE from the catalog (AC4)
# ---------------------------------------------------------------------------


_CSV = """
    id,revenue,price
    1,10.0,19.99
    2,20.0,29.99
    """


def test_catalog_column_types_reads_distinct_db_types(dbt_test_helper):
    cols = {"id": "INTEGER", "revenue": "DOUBLE", "price": "DECIMAL(18,2)"}
    dbt_test_helper.create_model("sales", _CSV, _CSV, base_columns=cols, curr_columns=cols)

    resolved = dbt_test_helper.adapter.catalog_column_types("sales")
    assert resolved == {"id": "INTEGER", "revenue": "DOUBLE", "price": "DECIMAL(18,2)"}


def test_catalog_column_types_absent_catalog_returns_empty(dbt_test_helper):
    # No columns dict -> catalog node not populated.
    dbt_test_helper.create_model("uncatalogued", _CSV, _CSV)
    assert dbt_test_helper.adapter.catalog_column_types("uncatalogued") == {}


# ---------------------------------------------------------------------------
# query_diff — catalog-driven stamping (AC2 / AC3), fallbacks (AC9)
# ---------------------------------------------------------------------------


def test_query_diff_stamps_double_float_and_decimal_number(dbt_test_helper):
    cols = {"id": "INTEGER", "revenue": "DOUBLE", "price": "DECIMAL(18,2)"}
    dbt_test_helper.create_model("sales_q", _CSV, _CSV, base_columns=cols, curr_columns=cols)

    params = {
        "sql_template": 'select * from {{ ref("sales_q") }}',
        "current_model": "sales_q",
    }
    result = QueryDiffTask(params).execute()

    for df in (result.base, result.current):
        types = _types(df)
        assert types["revenue"] == T.FLOAT, "DOUBLE data column must stamp FLOAT (AC2)"
        assert types["price"] == T.NUMBER, "DECIMAL data column must stay NUMBER (AC3)"
        assert types["id"] == T.INTEGER


def test_query_diff_join_stamps_from_catalog(dbt_test_helper):
    cols = {"id": "INTEGER", "revenue": "DOUBLE", "price": "DECIMAL(18,2)"}
    csv_base = """
        id,revenue,price
        1,10.0,19.99
        2,20.0,29.99
        """
    csv_curr = """
        id,revenue,price
        1,10.0,19.98
        2,20.0,29.99
        """
    dbt_test_helper.create_model("sales_j", csv_base, csv_curr, base_columns=cols, curr_columns=cols)

    params = {
        "sql_template": 'select * from {{ ref("sales_j") }}',
        "current_model": "sales_j",
        "primary_keys": ["id"],
    }
    result = QueryDiffTask(params).execute()
    types = _types(result.diff)
    assert types["revenue"] == T.FLOAT
    assert types["price"] == T.NUMBER


def test_query_diff_adhoc_no_model_keeps_exact(dbt_test_helper):
    # No current_model: ad-hoc SQL diff -> columns keep the from_agate type (exact, AC9).
    cols = {"id": "INTEGER", "revenue": "DOUBLE"}
    dbt_test_helper.create_model("sales_adhoc", _CSV, _CSV, base_columns=cols, curr_columns=cols)

    params = {"sql_template": 'select id, revenue from {{ ref("sales_adhoc") }}'}
    result = QueryDiffTask(params).execute()
    # from_agate flattens numerics to NUMBER; nothing is stamped FLOAT.
    for df in (result.base, result.current):
        assert T.FLOAT not in set(_types(df).values()), "ad-hoc diff must not epsilon (AC9)"


def test_query_diff_catalog_absent_keeps_exact(dbt_test_helper):
    # current_model set but no catalog entry -> exact fallback (AC9).
    dbt_test_helper.create_model("sales_nocat", _CSV, _CSV)
    params = {
        "sql_template": 'select * from {{ ref("sales_nocat") }}',
        "current_model": "sales_nocat",
    }
    result = QueryDiffTask(params).execute()
    for df in (result.base, result.current):
        assert T.FLOAT not in set(_types(df).values()), "catalog-absent must not epsilon (AC9)"


# ---------------------------------------------------------------------------
# value_diff detail — catalog-driven stamping (AC2 / AC3)
# ---------------------------------------------------------------------------


def test_value_diff_detail_stamps_from_catalog(dbt_test_helper):
    cols = {"id": "INTEGER", "revenue": "DOUBLE", "price": "DECIMAL(18,2)"}
    csv_base = """
        id,revenue,price
        1,10.0,19.99
        2,20.0,29.99
        """
    csv_curr = """
        id,revenue,price
        1,10.0,19.98
        2,20.0,29.99
        """
    dbt_test_helper.create_model("sales_v", csv_base, csv_curr, base_columns=cols, curr_columns=cols)

    params = {"model": "sales_v", "primary_key": ["id"]}
    result = ValueDiffDetailTask(params).execute()
    types = _types(result)
    assert types["revenue"] == T.FLOAT, "DOUBLE column must stamp FLOAT (AC2)"
    assert types["price"] == T.NUMBER, "DECIMAL column must stay NUMBER (AC3)"


# ---------------------------------------------------------------------------
# profile — approximate aggregates stamped FLOAT by construction (AC1)
# ---------------------------------------------------------------------------


def test_profile_diff_stamps_float_aggregates(dbt_test_helper):
    csv_data = """
        id,amount
        1,10.5
        2,20.5
        3,30.5
        """
    dbt_test_helper.create_model("profile_model", csv_data, csv_data)
    params = {"model": "profile_model"}
    result = ProfileDiffTask(params).execute()

    types = _types(result.current)
    assert types["avg"] == T.FLOAT
    assert types["median"] == T.FLOAT
    assert types["not_null_proportion"] == T.FLOAT
    assert types["distinct_proportion"] == T.FLOAT
    # min/max stay exact (not float-collapsed).
    assert types["min"] != T.FLOAT
    assert types["max"] != T.FLOAT
