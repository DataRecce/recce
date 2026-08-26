import math
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal, localcontext
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
    "YEAR",  # Specific to MySQL/MariaDB
    "DATETIME2",
    "SMALLDATETIME",
    "DATETIMEOFFSET",  # Specific to SQL Server
    "INTERVAL",  # Common in PostgreSQL and Oracle
    "TIMESTAMPTZ",
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
    "SMALLSERIAL",
    "SERIAL",
    "BIGSERIAL",  # PostgreSQL auto-increment types
    "IDENTITY",
    "SMALLIDENTITY",
    "BIGIDENTITY",  # SQL Server specific auto-increment types
    "BYTEINT",  # Specific to Snowflake, for storing very small integers
    "INT64",  # BigQuery
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
    "TIME",
    "TIMETZ",
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


def is_integral_histogram_type(column_type):
    """Return whether an adapter-reported type can only contain integral values."""
    normalized_type = column_type.strip().upper()
    if normalized_type in sql_integer_types:
        return True

    numeric_match = re.fullmatch(r"(?:DECIMAL|NUMERIC|NUMBER)\(\s*\d+\s*(?:,\s*(\d+)\s*)?\)", normalized_type)
    return numeric_match is not None and (numeric_match.group(1) is None or numeric_match.group(1) == "0")


@dataclass(frozen=True)
class NumericHistogramGeometry:
    width: Decimal
    bin_edges: list[Decimal]

    @property
    def num_bins(self):
        return len(self.bin_edges) - 1


def _decimal_value(value):
    return Decimal(str(value))


def _decimal_sql_literal(value):
    decimal_value = _decimal_value(value)
    if decimal_value == 0:
        return "0"
    literal = format(decimal_value, "f")
    return literal.rstrip("0").rstrip(".") if "." in literal else literal


def _decimal_result_value(value):
    decimal_value = _decimal_value(value)
    try:
        result = float(decimal_value)
    except (OverflowError, ValueError) as error:
        raise ValueError(
            f"Histogram Decimal {decimal_value} cannot be represented as a finite JSON number without value change"
        ) from error
    if not math.isfinite(result) or _decimal_value(result) != decimal_value:
        raise ValueError(
            f"Histogram Decimal {decimal_value} cannot be represented as a finite JSON number without value change"
        )
    return int(decimal_value) if decimal_value == decimal_value.to_integral_value() else result


def _decimal_display_value(value):
    """Convert a display-only extremum, keeping magnitude instead of failing the run.

    Bin edges must survive JSON unchanged because they define bucket boundaries, so they
    go through _decimal_result_value. The reported minimum and maximum are labels: a
    BIGINT id past 2**53 or a DECIMAL(38, 18) amount cannot round-trip through a double,
    and refusing them would fail a histogram that computed correctly.
    """
    decimal_value = _decimal_value(value)
    try:
        result = float(decimal_value)
    except (OverflowError, ValueError) as error:
        raise ValueError(f"Histogram Decimal {decimal_value} cannot be represented as a finite JSON number") from error
    if not math.isfinite(result) or (result == 0 and decimal_value != 0):
        raise ValueError(f"Histogram Decimal {decimal_value} cannot be represented as a finite JSON number")
    return int(decimal_value) if decimal_value == decimal_value.to_integral_value() else result


def nice_histogram_width(raw_width):
    """Round a positive Decimal width up to the approved nice-width series."""
    raw_width = _decimal_value(raw_width)
    if raw_width <= 0:
        return Decimal("1")

    with localcontext() as context:
        context.prec = max(context.prec, len(raw_width.as_tuple().digits) + 5)
        scale = Decimal("1").scaleb(raw_width.adjusted())
        mantissa = raw_width / scale
        for candidate in (Decimal("1"), Decimal("2"), Decimal("2.5"), Decimal("5"), Decimal("10")):
            if mantissa <= candidate:
                return candidate * scale
    raise AssertionError("nice histogram width candidates must include an upper bound")


def numeric_histogram_geometry(min_value, max_value, num_bins=50, *, is_integer=False):
    """Build Decimal bin geometry that covers the complete numeric domain."""
    minimum = _decimal_value(min_value)
    maximum = _decimal_value(max_value)
    requested_bins = max(int(num_bins), 1)
    precision = (
        max(
            len(minimum.as_tuple().digits),
            len(maximum.as_tuple().digits),
            len(str(requested_bins)),
        )
        + 8
    )
    with localcontext() as context:
        context.prec = max(context.prec, precision)
        raw_width = (maximum - minimum) / requested_bins
        width = nice_histogram_width(raw_width)
        if is_integer and width < 1:
            width = Decimal("1")

        lower_bin = (minimum / width).to_integral_value(rounding=ROUND_FLOOR)
        lower_edge = lower_bin * width
        if minimum >= 0 and (minimum / width).to_integral_value(rounding=ROUND_CEILING) <= 1:
            lower_edge = Decimal("0")

        edge_count = (maximum - lower_edge) / width
        num_edges = max(1, int(edge_count.to_integral_value(rounding=ROUND_CEILING)))
        bin_edges = [lower_edge + width * i for i in range(num_edges + 1)]
    return NumericHistogramGeometry(width=width, bin_edges=bin_edges)


def _generate_histogram_sql(node, column, min_value, max_value, num_bins, bin_size):
    min_literal = _decimal_sql_literal(min_value)
    max_literal = _decimal_sql_literal(max_value)
    bin_size_literal = _decimal_sql_literal(bin_size)
    decimal_min = _decimal_value(min_value)
    decimal_bin_size = _decimal_value(bin_size)
    internal_boundary_cases = "\n".join(
        f"                WHEN {column} < {_decimal_sql_literal(decimal_min + decimal_bin_size * index)} THEN {index - 1}"
        for index in range(1, num_bins)
    )

    sql = f"""
    WITH value_ranges AS (
        SELECT
            {min_literal} as min_value,
            {max_literal} as max_value
    ),
    bin_parameters AS (
        SELECT
            min_value,
            max_value,
            {bin_size_literal} AS bin_size
        FROM value_ranges
    ),
    binned_values AS (
        SELECT
            {column} as column_value,
            CASE
                WHEN {column} IS NULL THEN NULL
                WHEN {column} < (SELECT min_value FROM bin_parameters)
                    OR {column} > (SELECT max_value FROM bin_parameters)
                    THEN FLOOR(({column} - (SELECT min_value FROM bin_parameters)) / (SELECT bin_size FROM bin_parameters))
                WHEN {column} = (SELECT max_value FROM bin_parameters) THEN {num_bins - 1}
{internal_boundary_cases}
                ELSE {num_bins - 1}
            END AS bin
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


def generate_histogram_sql_integer(node, column, min_value, max_value, num_bins=50, bin_size=None):
    if bin_size is None:
        bin_size = Decimal(max(math.ceil((max_value - min_value) / num_bins), 1))
    return _generate_histogram_sql(node, column, min_value, max_value, num_bins, bin_size)


def generate_histogram_sql_numeric(node, column, min_value, max_value, num_bins=50, bin_size=None):
    if bin_size is None:
        bin_size = (_decimal_value(max_value) - _decimal_value(min_value)) / max(int(num_bins), 1)
    return _generate_histogram_sql(node, column, min_value, max_value, num_bins, bin_size)


class HistogramDiffParams(BaseModel):
    model: str
    column_name: str
    column_type: str
    num_bins: Optional[int] = 50


def query_numeric_histogram(task, node, column, column_type, min_value, max_value, num_bins=50):
    is_integer = is_integral_histogram_type(column_type)
    geometry = numeric_histogram_geometry(min_value, max_value, num_bins, is_integer=is_integer)
    min_edge = geometry.bin_edges[0]
    max_edge = geometry.bin_edges[-1]
    num_bins = geometry.num_bins
    if is_integer:
        histogram_sql, _ = generate_histogram_sql_integer(node, column, min_edge, max_edge, num_bins, geometry.width)
    else:
        histogram_sql, _ = generate_histogram_sql_numeric(node, column, min_edge, max_edge, num_bins, geometry.width)

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

    base_result = {}
    curr_result = {}
    labels = [
        f"{_decimal_sql_literal(edge)}-{_decimal_sql_literal(edge + geometry.width)}" for edge in geometry.bin_edges
    ]
    bin_edges = [_decimal_result_value(edge) for edge in geometry.bin_edges]

    if base is not None:
        counts = [0] * num_bins
        for row in base.rows:
            bin = row[0]
            count = row[1]
            if bin is not None:
                i = int(bin)
                if i < 0 or i >= num_bins:
                    raise ValueError(f"Histogram bucket {i} is outside the computed edge domain")
                counts[i] = count
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
                if i < 0 or i >= num_bins:
                    raise ValueError(f"Histogram bucket {i} is outside the computed edge domain")
                counts[i] = count
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
            if column_type.upper() in sql_datetime_types or min_value is None:
                result["min"] = min_value
                result["max"] = max_value
            else:
                result["min"] = _decimal_display_value(min_value)
                result["max"] = _decimal_display_value(max_value)
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
            params = HistogramDiffParams(**check.params)
        except Exception as e:
            raise ValueError(f"Invalid check: {str(e)}")

        if _is_histogram_supported(params.column_type) is False:
            raise ValueError(f"Column type {params.column_type} is not supported for histogram analysis")
