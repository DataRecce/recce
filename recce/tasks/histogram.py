import math
import re
from datetime import date, datetime
from typing import Optional

from dateutil.relativedelta import relativedelta
from pydantic import BaseModel

from recce.core import default_context
from recce.models import Check
from recce.tasks import Task
from recce.tasks.core import CheckValidator, TaskResultDiffer
from recce.tasks.query import QueryMixin

sql_datetime_types = [
    "DATE",
    "DATETIME",
    "TIMESTAMP",
    "TIME",
    "YEAR",  # Specific to MySQL/MariaDB
    "DATETIME2",
    "SMALLDATETIME",
    "DATETIMEOFFSET",  # Specific to SQL Server
    "INTERVAL",  # Common in PostgreSQL and Oracle
    "TIMESTAMPTZ",
    "TIMETZ",  # Specific to PostgreSQL
    "TIMESTAMP WITH TIME ZONE",
    "TIMESTAMP WITH LOCAL TIME ZONE",  # Oracle
    "TIMESTAMP_LTZ",
    "TIMESTAMP_NTZ",
    "TIMESTAMP_TZ",  # Specific to Snowflake
]

sql_integer_types = [
    "TINYINT",
    "SMALLINT",
    "MEDIUMINT",
    "INT",
    "INTEGER",
    "BIGINT",  # Common across most databases
    "INT2",
    "INT4",
    "INT8",  # PostgreSQL specific aliases
    "UNSIGNED BIG INT",  # SQLite specific
    "NUMBER",  # Oracle, can be used as an integer with precision and scale
    "NUMERIC",  # Generally available in many SQL databases, used with precision and scale
    "SMALLSERIAL",
    "SERIAL",
    "BIGSERIAL",  # PostgreSQL auto-increment types
    "IDENTITY",
    "SMALLIDENTITY",
    "BIGIDENTITY",  # SQL Server specific auto-increment types
    "BYTEINT",  # Specific to Snowflake, for storing very small integers
]

sql_not_supported_types = [
    "CHAR",
    "VARCHAR",
    "TINYTEXT",
    "TEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
    "NCHAR",
    "NVARCHAR",
    "VARCHAR2",
    "NVARCHAR2",
    "CLOB",
    "NCLOB",
    "VARCHAR(MAX)",
    "XML",
    "JSON",
    "BOOLEAN",  # PostgreSQL, SQLite, and others with native boolean support
    "TINYINT(1)",  # MySQL/MariaDB uses TINYINT(1) to represent boolean values
    "BIT",  # SQL Server and others use BIT to represent boolean values, where 1 is true and 0 is false
    "NUMBER(1)",  # Oracle uses NUMBER(1) where 1 is true and 0 is false, as it does not have a native BOOLEAN type
    "BOOL",  # Snowflake and PostgreSQL also support BOOL as an alias for BOOLEAN
]

sql_not_supported_types_pattern = [
    r"^(CHAR|VARCHAR|NCHAR|NVARCHAR|VARCHAR2|NVARCHAR2)\(\d+\)$",  # String types with lengths
]


def _is_histogram_supported(column_type):
    if column_type.upper() in sql_not_supported_types:
        return False

    for pattern in sql_not_supported_types_pattern:
        if re.match(pattern, column_type.upper()):
            return False
    return True


def generate_histogram_sql_integer(node, column, min_value, max_value, num_bins=50):
    bin_size = math.ceil((max_value - min_value) / num_bins) or 1

    sql = f"""
    WITH value_ranges AS (
        SELECT
            {min_value} as min_value,
            {max_value} as max_value
    ),
    bin_parameters AS (
        SELECT
            min_value,
            max_value,
            {bin_size} AS bin_size
        FROM value_ranges
    ),
    binned_values AS (
        SELECT
            {column} as column_value,
            FLOOR(({column} - (SELECT min_value FROM bin_parameters)) / (SELECT bin_size FROM bin_parameters)) AS bin
        FROM {{{{ ref("{node}") }}}},
        bin_parameters
    ),
    bin_edges AS (
        SELECT
            bin,
            COUNT(*) AS count
        FROM binned_values, bin_parameters
        GROUP BY bin
        ORDER BY bin
    )

    SELECT bin, count FROM bin_edges
    """
    return sql, bin_size


def generate_histogram_sql_numeric(node, column, min_value, max_value, num_bins=50):
    bin_size = (max_value - min_value) / num_bins
    sql = f"""
        WITH value_ranges AS (
            SELECT
                {min_value} as min_value,
                {max_value} as max_value
        ),
        bin_parameters AS (
            SELECT
                min_value,
                max_value,
                {bin_size} AS bin_size
            FROM value_ranges
        ),
        binned_values AS (
            SELECT
                {column} as column_value,
                FLOOR(({column} - (SELECT min_value FROM bin_parameters)) / (SELECT bin_size FROM bin_parameters)) AS bin
            FROM {{{{ ref("{node}") }}}},
            bin_parameters
        ),
        bin_edges AS (
            SELECT
                bin,
                COUNT(*) AS count
            FROM binned_values, bin_parameters
            GROUP BY bin
            ORDER BY bin
        )

        SELECT bin, count FROM bin_edges
        """
    return sql, bin_size


class HistogramDiffParams(BaseModel):
    model: str
    column_name: str
    column_type: str
    num_bins: Optional[int] = 50


def query_numeric_histogram(task, node, column, column_type, min_value, max_value, num_bins=50):
    if column_type.upper() in sql_integer_types:
        if max_value - min_value < num_bins:
            num_bins = int(max_value - min_value + 1)
        histogram_sql, bin_size = generate_histogram_sql_integer(node, column, min_value, max_value, num_bins)
    else:
        histogram_sql, bin_size = generate_histogram_sql_numeric(node, column, min_value, max_value, num_bins)

    base = None
    try:
        base = task.execute_sql(histogram_sql, base=True)
    except Exception as e:
        print(e)
    finally:
        task.check_cancel()

    curr = None
    try:
        curr = task.execute_sql(histogram_sql, base=False)
    except Exception as e:
        print(e)
    finally:
        task.check_cancel()

    bin_edges = [None] * (num_bins + 1)
    labels = [""] * (num_bins + 1)

    base_result = {}
    curr_result = {}
    for i in range(num_bins + 1):
        val = int(min_value) + i * bin_size
        bin_edges[i] = val
        labels[i] = f"{val}-{val + bin_size}"

    if base is not None:
        counts = [0] * num_bins
        for row in base.rows:
            bin = row[0]
            count = row[1]
            if bin is not None:
                i = int(bin)
                if i < num_bins:
                    counts[i] = count
                else:
                    counts[num_bins - 1] += count
        base_result = {
            "counts": counts,
        }
    if curr is not None:
        counts = [0] * num_bins
        for row in curr.rows:
            bin = row[0]
            count = row[1]
            if bin is not None:
                i = int(bin)
                if i < num_bins:
                    counts[i] = count
                else:
                    counts[num_bins - 1] += count
        curr_result = {
            "counts": counts,
        }
    return base_result, curr_result, bin_edges, labels


def query_datetime_histogram(task, node, column, min_value, max_value):
    days_delta = (max_value - min_value).days
    print(max_value, min_value, days_delta)
    # _type = None
    if days_delta > 365 * 4:
        _type = "yearly"
        dmin = date(min_value.year, 1, 1)
        if max_value.year < 3000:
            dmax = date(max_value.year, 1, 1) + relativedelta(years=+1)
        else:
            dmax = date(3000, 1, 1)
        interval_years = math.ceil((dmax.year - dmin.year) / 50)
        interval = relativedelta(years=+interval_years)
        num_buckets = math.ceil((dmax.year - dmin.year) / interval.years)
        bin_edges = [dmin + relativedelta(year=i) for i in range(num_buckets + 1)]
        sql = f"""
        SELECT
            {{{{ date_trunc("year", "{column}") }}}} as year,
            COUNT(*) AS counts
        FROM {{{{ ref("{node}") }}}}
        WHERE {column} IS NOT NULL
        GROUP BY year
        ORDER BY year
        """
    elif days_delta > 60:
        _type = "monthly"
        interval = relativedelta(months=+1)
        dmin = date(min_value.year, min_value.month, 1)
        if max_value.year < 3000:
            dmax = date(max_value.year, max_value.month, 1) + interval
        else:
            dmax = date(3000, 1, 1)
        period = relativedelta(dmax, dmin)
        num_buckets = period.years * 12 + period.months
        bin_edges = [dmin + relativedelta(months=i) for i in range(num_buckets + 1)]
        sql = f"""
        SELECT
            {{{{ date_trunc("month", "{column}") }}}} as month,
            COUNT(*) AS counts
        FROM {{{{ ref("{node}") }}}}
        WHERE {column} IS NOT NULL
        GROUP BY month
        ORDER BY month
        """
    else:
        _type = "daily"
        interval = relativedelta(days=+1)
        dmin = date(min_value.year, min_value.month, min_value.day)
        if max_value.year < 3000:
            dmax = date(max_value.year, max_value.month, max_value.day) + interval
        else:
            dmax = date(3000, 1, 1)
        num_buckets = (dmax - dmin).days
        bin_edges = [dmin + relativedelta(day=i) for i in range(num_buckets + 1)]
        sql = f"""
        SELECT
            {{{{ date_trunc("day", "{column}") }}}} as day,
            COUNT(*) AS counts
        FROM {{{{ ref("{node}") }}}}
        WHERE {column} IS NOT NULL
        GROUP BY day
        ORDER BY day
        """

    base = None
    curr = None
    try:
        base = task.execute_sql(sql, base=True)
    except Exception as e:
        print(e)
    finally:
        task.check_cancel()
    try:
        curr = task.execute_sql(sql, base=False)
    except Exception as e:
        print(e)
    finally:
        task.check_cancel()

    base_counts = [0] * num_buckets
    print(_type)
    for d, v in base.rows:
        i = bin_edges.index(d.date()) if isinstance(d, datetime) else bin_edges.index(d)
        base_counts[i] = v
    curr_counts = [0] * num_buckets
    for d, v in curr.rows:
        i = bin_edges.index(d.date()) if isinstance(d, datetime) else bin_edges.index(d)
        curr_counts[i] = v
    base_result = {
        "counts": base_counts,
    }
    curr_result = {
        "counts": curr_counts,
    }

    return base_result, curr_result, bin_edges


class HistogramDiffTask(Task, QueryMixin):
    def __init__(self, params):
        super().__init__()
        self.params = HistogramDiffParams(**params)
        self.connection = None

    def execute(self):
        context = default_context()
        if context.adapter_type == "bauplan":
            return self.execute_bauplan()

        from recce.adapter.dbt_adapter import DbtAdapter

        result = {}

        dbt_adapter: DbtAdapter = context.adapter
        node = self.params.model
        column = self.params.column_name
        num_bins = self.params.num_bins or 50
        column_type = self.params.column_type

        if _is_histogram_supported(column_type) is False:
            raise ValueError(f"Column type {column_type} is not supported for histogram analysis")

        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()
            min_max_sql = f"""
                SELECT
                    MIN({column}) as min,
                    MAX({column}) as max,
                    COUNT({column}) as total
                FROM {{{{ ref("{node}") }}}}
                """
            # Get the mix/max values from both the base and current environments

            min_max_base = self.execute_sql(min_max_sql, base=True)
            min_max_curr = self.execute_sql(min_max_sql, base=False)

            def get_min_max(fn, base, curr):
                if base is None and curr is None:
                    return None
                if base is None:
                    return curr
                if curr is None:
                    return base
                return fn(base, curr)

            min_value = get_min_max(min, min_max_base[0][0], min_max_curr[0][0])
            max_value = get_min_max(max, min_max_base[0][1], min_max_curr[0][1])
            base_total = min_max_base[0][2]
            curr_total = min_max_curr[0][2]

            # Get histogram data from both the base and current environments
            labels = None
            if min_value is None or max_value is None:
                base_result = {
                    "counts": [],
                }
                current_result = {
                    "counts": [],
                }
                bin_edges = []
                labels = []
            elif column_type.upper() in sql_datetime_types:
                base_result, current_result, bin_edges = query_datetime_histogram(
                    self, node, column, min_value, max_value
                )
            else:
                base_result, current_result, bin_edges, labels = query_numeric_histogram(
                    self, node, column, column_type, min_value, max_value, num_bins
                )
            if base_result:
                base_result["total"] = base_total
            if current_result:
                current_result["total"] = curr_total
            result["base"] = base_result
            result["current"] = current_result
            result["min"] = min_value
            result["max"] = max_value
            result["bin_edges"] = bin_edges
            result["labels"] = labels
        return result

    def execute_bauplan(self):
        adapter = default_context().adapter
        node = self.params.model
        column = self.params.column_name
        num_bins = self.params.num_bins or 50
        column_type = self.params.column_type
        node_name = adapter.get_node_name_by_id(node) or node

        if _is_histogram_supported(column_type) is False:
            raise ValueError(f"Column type {column_type} is not supported for histogram analysis")

        result = {}

        # Get min/max from both branches
        min_max_sql = f"SELECT MIN({column}) as min, MAX({column}) as max, COUNT({column}) as total FROM {node_name}"
        df_base, _ = adapter.fetchdf_with_limit(min_max_sql, base=True)
        df_curr, _ = adapter.fetchdf_with_limit(min_max_sql, base=False)

        min_base, max_base, total_base = df_base.iloc[0]["min"], df_base.iloc[0]["max"], df_base.iloc[0]["total"]
        min_curr, max_curr, total_curr = df_curr.iloc[0]["min"], df_curr.iloc[0]["max"], df_curr.iloc[0]["total"]

        def safe_min(a, b):
            if a is None:
                return b
            if b is None:
                return a
            return min(a, b)

        def safe_max(a, b):
            if a is None:
                return b
            if b is None:
                return a
            return max(a, b)

        min_value = safe_min(min_base, min_curr)
        max_value = safe_max(max_base, max_curr)

        if min_value is None or max_value is None or min_value == max_value:
            result["base"] = {"counts": [], "total": total_base}
            result["current"] = {"counts": [], "total": total_curr}
            result["min"] = min_value
            result["max"] = max_value
            result["bin_edges"] = []
            result["labels"] = []
            return result

        # Generate histogram buckets
        bin_width = (max_value - min_value) / num_bins
        bin_edges = [min_value + i * bin_width for i in range(num_bins + 1)]

        # Build histogram SQL using CASE WHEN for bucket assignment
        cases = []
        for i in range(num_bins):
            low = bin_edges[i]
            high = bin_edges[i + 1]
            if i == num_bins - 1:
                cases.append(f"WHEN {column} >= {low} AND {column} <= {high} THEN {i}")
            else:
                cases.append(f"WHEN {column} >= {low} AND {column} < {high} THEN {i}")

        histogram_sql = f"""
            SELECT CASE {' '.join(cases)} END as bucket, COUNT(*) as cnt
            FROM {node_name}
            WHERE {column} IS NOT NULL
            GROUP BY bucket
            ORDER BY bucket
        """

        df_base_hist, _ = adapter.fetchdf_with_limit(histogram_sql, base=True)
        df_curr_hist, _ = adapter.fetchdf_with_limit(histogram_sql, base=False)

        # Fill counts array
        def fill_counts(df, num_bins):
            counts = [0] * num_bins
            for _, row in df.iterrows():
                bucket = row["bucket"]
                if bucket is not None and 0 <= int(bucket) < num_bins:
                    counts[int(bucket)] = int(row["cnt"])
            return counts

        labels = [f"[{bin_edges[i]:.2f}, {bin_edges[i + 1]:.2f})" for i in range(num_bins)]
        labels[-1] = f"[{bin_edges[-2]:.2f}, {bin_edges[-1]:.2f}]"

        result["base"] = {"counts": fill_counts(df_base_hist, num_bins), "total": int(total_base) if total_base else 0}
        result["current"] = {"counts": fill_counts(df_curr_hist, num_bins), "total": int(total_curr) if total_curr else 0}
        result["min"] = min_value
        result["max"] = max_value
        result["bin_edges"] = bin_edges
        result["labels"] = labels

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class HistogramDiffTaskResultDiffer(TaskResultDiffer):
    def _check_result_changed_fn(self, result):
        return TaskResultDiffer.diff(result["base"], result["current"])


class HistogramDiffCheckValidator(CheckValidator):

    def validate_check(self, check: Check):
        try:
            HistogramDiffParams(**check.params)
        except Exception as e:
            raise ValueError(f"Invalid check: {str(e)}")
