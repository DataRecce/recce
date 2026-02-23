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


def _nice_number(value, round_down=False):
    """Heckbert algorithm: round to nearest {1, 2, 5} x 10^n."""
    if value == 0:
        return 0
    exp = math.floor(math.log10(abs(value)))
    frac = abs(value) / (10 ** exp)
    if round_down:
        if frac < 2:
            nice = 1
        elif frac < 5:
            nice = 2
        else:
            nice = 5
    else:
        if frac <= 1:
            nice = 1
        elif frac <= 2:
            nice = 2
        elif frac <= 5:
            nice = 5
        else:
            nice = 10
    return nice * (10 ** exp)


def _compute_nice_bin_edges(min_val, max_val, target_bins, is_integer):
    """Compute nice round bin edges that cover [min_val, max_val].

    Returns (nice_min, nice_max, bin_size, num_bins).
    """
    # Convert to float to avoid decimal.Decimal / float errors
    min_val = float(min_val)
    max_val = float(max_val)
    data_range = max_val - min_val
    if data_range == 0:
        return min_val, max_val + 1, 1, 1

    raw_bin_size = data_range / target_bins
    bin_size = _nice_number(raw_bin_size)

    if is_integer:
        bin_size = max(int(bin_size), 1)

    nice_min = math.floor(min_val / bin_size) * bin_size
    # Snap to zero if it would add at most one empty leading bucket
    if min_val >= 0 and nice_min > 0 and nice_min / bin_size <= 1:
        nice_min = 0
    nice_max = math.ceil(max_val / bin_size) * bin_size

    if nice_max <= max_val:
        nice_max += bin_size

    num_bins = round((nice_max - nice_min) / bin_size)

    return nice_min, nice_max, bin_size, num_bins


def _is_histogram_supported(column_type):
    if column_type.upper() in sql_not_supported_types:
        return False

    for pattern in sql_not_supported_types_pattern:
        if re.match(pattern, column_type.upper()):
            return False
    return True


def generate_histogram_sql_integer(node, column, min_value, bin_size):
    sql = f"""
    WITH bin_parameters AS (
        SELECT
            {min_value} AS min_value,
            {bin_size} AS bin_size
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
    return sql


def generate_histogram_sql_numeric(node, column, min_value, bin_size):
    sql = f"""
        WITH bin_parameters AS (
            SELECT
                {min_value} AS min_value,
                {bin_size} AS bin_size
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
    return sql


class HistogramDiffParams(BaseModel):
    model: str
    column_name: str
    column_type: str
    num_bins: Optional[int] = 50


def query_numeric_histogram(task, node, column, column_type, min_value, max_value, num_bins=50):
    is_integer = column_type.upper() in sql_integer_types

    if is_integer and max_value - min_value < num_bins:
        # Small integer range: one bin per integer value
        num_bins = int(max_value - min_value + 1)
        nice_min = int(min_value)
        bin_size = 1
    else:
        nice_min, _nice_max, bin_size, num_bins = _compute_nice_bin_edges(
            min_value, max_value, num_bins, is_integer
        )

    if is_integer:
        histogram_sql = generate_histogram_sql_integer(node, column, nice_min, bin_size)
    else:
        histogram_sql = generate_histogram_sql_numeric(node, column, nice_min, bin_size)

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
        val = nice_min + i * bin_size
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
        from recce.adapter.dbt_adapter import DbtAdapter

        result = {}

        dbt_adapter: DbtAdapter = default_context().adapter
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
