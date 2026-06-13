import pytest
from jinja2 import Template
from sqlglot import parse_one

from recce.tasks import ProfileDiffTask, ProfileTask
from recce.tasks.profile import PROFILE_COLUMN_JINJA_TEMPLATE

csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

csv_data_base = """
    customer_id,name,age
    1,Alice,35
    2,Bob,25
    3,Charlie,35
    """


def test_profile(dbt_test_helper):
    dbt_test_helper.create_model("customers", None, csv_data_curr)
    params = dict(model="customers")
    task = ProfileTask(params)
    run_result = task.execute()

    assert len(run_result.current.data) == 3


def test_profile_with_selected_columns(dbt_test_helper):
    dbt_test_helper.create_model("customers", None, csv_data_curr)
    params = dict(model="customers", columns=["name", "age"])
    task = ProfileTask(params)
    run_result = task.execute()
    assert len(run_result.current.data) == 2


def test_profile_diff(dbt_test_helper):
    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    params = dict(model="customers")
    task = ProfileDiffTask(params)
    run_result = task.execute()

    assert len(run_result.current.data) == 3
    assert len(run_result.base.data) == 3


def test_profile_diff_with_selected_columns(dbt_test_helper):
    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    params = dict(model="customers", columns=["name", "age"])
    task = ProfileDiffTask(params)
    run_result = task.execute()
    assert len(run_result.current.data) == 2
    assert len(run_result.base.data) == 2


# Empty table has no rows — the SQL used to divide by count(*) and fail with
# "division by zero". After the nullif() fix, an empty side produces one row
# per column with row_count=0 and NULL proportions.
csv_data_empty = """
        customer_id,name,age
        """


def test_profile_diff_current_empty(dbt_test_helper):
    dbt_test_helper.create_model("customers", csv_data_base, csv_data_empty)
    params = dict(model="customers")
    task = ProfileDiffTask(params)
    run_result = task.execute()

    # Still returns a row per column on both sides.
    assert len(run_result.base.data) == 3
    assert len(run_result.current.data) == 3

    # Row counts are populated: base has 3, current has 0.
    def _row_count(df, col_name):
        col_names = [c.name for c in df.columns]
        idx_name = col_names.index("column_name")
        idx_rc = col_names.index("row_count")
        for row in df.data:
            if row[idx_name] == col_name:
                return row[idx_rc]
        return None

    assert _row_count(run_result.base, "customer_id") == 3
    assert _row_count(run_result.current, "customer_id") == 0


def test_profile_diff_both_empty(dbt_test_helper):
    dbt_test_helper.create_model("customers", csv_data_empty, csv_data_empty)
    params = dict(model="customers")
    task = ProfileDiffTask(params)
    run_result = task.execute()

    # No crash; one row per column on each side.
    assert len(run_result.base.data) == 3
    assert len(run_result.current.data) == 3


def test_validator():
    from recce.tasks.profile import ProfileCheckValidator

    def validate(params: dict = {}, view_options: dict = {}):
        ProfileCheckValidator().validate(
            {
                "name": "test",
                "type": "profile_diff",
                "params": params,
                "view_options": view_options,
            }
        )

    validate(
        {
            "model": "customers",
        }
    )

    with pytest.raises(ValueError):
        validate({})


# =============================================================================
# Snowflake column-case regression tests (DRC-3674)
#
# Root cause: profile_diff / profile filtered the requested columns with a
# case-sensitive membership test (``column.name in selected_columns``).
# get_columns() returns physical catalog names, which case-folding warehouses
# (e.g. Snowflake) store UPPERCASE, while the cloud summary agent supplies
# lowercase manifest-convention names. The exact-case filter dropped EVERY
# column, so the per-column profiling loop never ran and the result came back
# completely empty:
#   {"base":{"columns":[],"data":[]},"current":{"columns":[],"data":[]}}
#
# DuckDB preserves the CSV-header casing, so an UPPERCASE header reproduces the
# Snowflake physical-name casing end-to-end (no mocking needed).
#
# Fix: lowercase both sides of the membership test before filtering, so
# lowercase input resolves to the physical (uppercase) columns and yields the
# same non-empty profile as uppercase input. No-op on already-lowercase
# duckdb models and on quoted/case-sensitive identifiers (the SQL still profiles
# via the physical column.name).
# =============================================================================

csv_data_uppercase = """
        CUSTOMER_ID,CUSTOMER_LIFETIME_VALUE,NET_CUSTOMER_LIFETIME_VALUE
        1,100,90
        2,200,180
        3,300,270
        """


def test_profile_diff_lowercase_columns_on_uppercase_physical(dbt_test_helper):
    """DRC-3674: lowercase requested columns must resolve against UPPERCASE physical names.

    Pre-fix: lowercase input yields 0 columns / 0 rows on both sides (empty profile).
    Post-fix: lowercase input returns the SAME non-empty profile as uppercase input.
    """
    dbt_test_helper.create_model("snowflake_customers", csv_data_uppercase, csv_data_uppercase)

    lower = ProfileDiffTask(
        dict(model="snowflake_customers", columns=["customer_lifetime_value", "net_customer_lifetime_value"])
    ).execute()
    upper = ProfileDiffTask(
        dict(model="snowflake_customers", columns=["CUSTOMER_LIFETIME_VALUE", "NET_CUSTOMER_LIFETIME_VALUE"])
    ).execute()

    # Lowercase must not be empty (the production bug).
    assert len(lower.base.data) == 2
    assert len(lower.current.data) == 2

    # Lowercase and uppercase requests must be identical.
    assert len(lower.base.data) == len(upper.base.data)
    assert len(lower.current.data) == len(upper.current.data)

    # Profiled the physical (uppercase) columns, not the lowercase request strings.
    profiled = {row[0] for row in lower.current.data}
    assert profiled == {"CUSTOMER_LIFETIME_VALUE", "NET_CUSTOMER_LIFETIME_VALUE"}


def test_profile_lowercase_columns_on_uppercase_physical(dbt_test_helper):
    """DRC-3674: single-sided ProfileTask must also resolve lowercase → physical names."""
    dbt_test_helper.create_model("snowflake_customers", None, csv_data_uppercase)

    lower = ProfileTask(dict(model="snowflake_customers", columns=["customer_lifetime_value"])).execute()
    upper = ProfileTask(dict(model="snowflake_customers", columns=["CUSTOMER_LIFETIME_VALUE"])).execute()

    assert len(lower.current.data) == 1
    assert len(lower.current.data) == len(upper.current.data)
    assert lower.current.data[0][0] == "CUSTOMER_LIFETIME_VALUE"


def test_profile_diff_lowercase_is_noop_on_lowercase_physical(dbt_test_helper):
    """Adapter-safety: case-insensitive matching is a no-op when physical names are already lowercase (duckdb)."""
    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    run_result = ProfileDiffTask(dict(model="customers", columns=["name", "age"])).execute()
    assert len(run_result.current.data) == 2
    assert len(run_result.base.data) == 2


def test_profile_column_jinja_template():

    class DummyAdapter:
        def __init__(self, database_type="duckdb"):
            self.database_type = database_type

        def quote(self, col):
            quote_marks = {
                "athena": '"',
                "bigquery": "`",
                "databricks": "`",
                "duckdb": '"',
                "postgres": '"',
                "redshift": '"',
                "snowflake": '"',
                "sqlite": '"',
                "sqlserver": '"',
                "trino": '"',
            }
            quote_mark = quote_marks.get(self.database_type, '"')
            return f"{quote_mark}{col}{quote_mark}"

    class DummyDbt:
        def __init__(self, database_type="Postgres"):
            self.database_type = database_type

        def type_bigint(self):
            bigint_types = {
                "athena": "BIGINT",
                "bigquery": "INT64",
                "databricks": "BIGINT",
                "duckdb": "BIGINT",
                "postgres": "BIGINT",
                "redshift": "BIGINT",
                "snowflake": "NUMBER",
                "sqlite": "INTEGER",
                "sqlserver": "BIGINT",
                "trino": "BIGINT",
            }
            return bigint_types.get(self.database_type, "bigint")

        def type_numeric(self):
            numeric_types = {
                "athena": "DECIMAL",
                "bigquery": "NUMERIC",
                "databricks": "DECIMAL",
                "duckdb": "DECIMAL",
                "postgres": "NUMERIC",
                "redshift": "DECIMAL",
                "snowflake": "NUMBER",
                "sqlite": "NUMERIC",
                "sqlserver": "DECIMAL",
                "trino": "DECIMAL",
            }
            return numeric_types.get(self.database_type, "numeric")

        def type_string(self):
            string_types = {
                "athena": "VARCHAR",
                "bigquery": "STRING",
                "databricks": "STRING",
                "duckdb": "VARCHAR",
                "postgres": "TEXT",
                "redshift": "VARCHAR",
                "snowflake": "VARCHAR",
                "sqlite": "TEXT",
                "sqlserver": "VARCHAR",
                "trino": "VARCHAR",
            }
            return string_types.get(self.database_type, "varchar")

    test_db_column_types = {
        "athena": [
            "boolean",
            "int",
            "double",
            "decimal",
            "char",
            "string",
            "binary",
            "date",
            "array",
            "struct",
            "map",
        ],
        "bigquery": [
            "array",
            "bool",
            "bytes",
            "date",
            "datetime",
            "interval",
            "json",
            "int64",
            "bignumeric",
            "range",
            "string",
            "struct",
            "time",
            "timestamp",
        ],
        "databricks": [
            "bigint",
            "binary",
            "boolean",
            "date",
            "decimal",
            "double",
            "float",
            "int",
            "interval",
            "void",
            "string",
            "timestamp",
            "array",
            "map",
            "struct",
            "variant",
            "object",
        ],
        "duckdb": [
            "boolean",
            "integer",
            "bigint",
            "real",
            "double",
            "decimal",
            "varchar",
            "date",
            "time",
            "timestamp",
            "blob",
            "array",
            "list",
            "struct",
            "map",
            "union",
            "uuid",
            "json",
        ],
        "postgres": [
            "bigint",
            "bigserial",
            "bit",
            "boolean",
            "box",
            "bytea",
            "character",
            "cidr",
            "circle",
            "date",
            "double precision",
            "inet",
            "integer",
            "interval",
            "json",
            "jsonb",
            "line",
            "lseg",
            "macaddr",
            "money",
            "numeric",
            "path",
            "pg_lsn",
            "point",
            "polygon",
            "real",
            "smallint",
            "smallserial",
            "serial",
            "text",
            "time",
            "timestamp",
            "tsquery",
            "tsvector",
            "txid_snapshot",
            "uuid",
            "xml",
            "array",
        ],
        "redshift": [
            "smallint",
            "integer",
            "bigint",
            "decimal",
            "real",
            "double precision",
            "boolean",
            "char",
            "varchar",
            "date",
            "timestamp",
            "timestamptz",
            "super",
            "time",
            "timetz",
            "varbyte",
            "geometry",
            "geography",
            "hllsketch",
        ],
        "snowflake": [
            "number",
            "decimal",
            "numeric",
            "int",
            "integer",
            "bigint",
            "smallint",
            "tinyint",
            "byteint",
            "float",
            "float4",
            "float8",
            "double",
            "double precision",
            "real",
            "varchar",
            "char",
            "character",
            "string",
            "text",
            "binary",
            "varbinary",
            "boolean",
            "date",
            "datetime",
            "time",
            "timestamp",
            "timestamp_ltz",
            "timestamp_ntz",
            "timestamp_tz",
            "variant",
            "object",
            "array",
            "geography",
            "geometry",
        ],
        "sqlite": ["integer", "real", "text", "blob", "numeric", "boolean", "date", "datetime", "json"],
        "trino": [
            "boolean",
            "tinyint",
            "smallint",
            "integer",
            "bigint",
            "real",
            "double",
            "decimal",
            "varchar",
            "char",
            "varbinary",
            "json",
            "date",
            "time",
            "timestamp",
            "timestamp with time zone",
            "interval year to month",
            "interval day to second",
            "array",
            "map",
            "row",
            "ipaddress",
            "uuid",
            "hyperloglog",
            "p4hyperloglog",
            "qdigest",
        ],
        "sqlserver": [
            "bigint",
            "int",
            "smallint",
            "tinyint",
            "bit",
            "decimal",
            "numeric",
            "money",
            "smallmoney",
            "float",
            "real",
            "date",
            "datetime",
            "datetime2",
            "smalldatetime",
            "time",
            "char",
            "varchar",
            "text",
            "nchar",
            "nvarchar",
            "ntext",
            "binary",
            "varbinary",
            "image",
            "timestamp",
            "uniqueidentifier",
            "xml",
            "cursor",
            "table",
            "sql_variant",
        ],
    }

    for db_type, column_types in test_db_column_types.items():
        for column_type in column_types:
            context = {
                "column_type": column_type,
                "column_name": "profile_column",
                "db_type": db_type,
                "relation": "test_table",
                "adapter": DummyAdapter(),
                "dbt": DummyDbt(),
            }

            sql = Template(PROFILE_COLUMN_JINJA_TEMPLATE).render(context)
            dialect = db_type if db_type != "sqlserver" else "tsql"
            parse_one(sql, read=dialect)
