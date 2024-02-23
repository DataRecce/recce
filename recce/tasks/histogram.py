import math
from typing import TypedDict

from recce.dbt import default_dbt_context
from recce.tasks import Task
from recce.tasks.query import QueryMixin


def generate_histogram_sql_integer(node, column, min_value, max_value, num_bins=50):
    bin_size = math.ceil((max_value - min_value) / num_bins) or 1

    sql = f"""
    WITH value_ranges AS (
        SELECT
            {min_value} as min_value,
            {max_value} as max_value,
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
            ANY_VALUE(min_value) + (bin * ANY_VALUE(bin_size)) AS bin_start,
            ANY_VALUE(min_value) + ((bin + 1) * ANY_VALUE(bin_size)) AS bin_end,
            COUNT(*) AS count
        FROM binned_values, bin_parameters
        GROUP BY bin
        ORDER BY bin
    )

    SELECT bin, count FROM bin_edges
    """
    return sql, bin_size


class HistogramDiffParams(TypedDict):
    model: str
    column_name: str
    column_type: str
    num_bins: int


class HistogramDiffTask(Task, QueryMixin):
    def __init__(self, params: HistogramDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        result = {}
        from dbt.adapters.sql import SQLAdapter
        dbt_context = default_dbt_context()
        adapter: SQLAdapter = dbt_context.adapter
        node = self.params['model']
        column = self.params['column_name']
        num_bins = self.params.get('num_bins', 50)

        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()
            min_max_sql = f"""
                SELECT
                    MIN({column}) as min,
                    MAX({column}) as max
                FROM {{{{ ref("{node}") }}}}
                """
            # Get the mix/max values from both the base and current environments
            try:
                min_max_base = self.execute_sql(min_max_sql, base=True)
                min_max_curr = self.execute_sql(min_max_sql, base=False)
            except Exception as e:
                print(e)
            finally:
                self.check_cancel()

            min_value = None
            max_value = None

            if min_max_base:
                min_value = min_max_base[0][0]
                max_value = min_max_base[0][1]
            if min_max_curr:
                min_value = min(min_value, min_max_curr[0][0])
                max_value = max(max_value, min_max_curr[0][1])

            # Get histogram data from both the base and current environments
            if max_value - min_value < num_bins:
                num_bins = int(max_value - min_value + 1)
            histogram_sql, bin_size = generate_histogram_sql_integer(node, column, min_value, max_value, num_bins)

            base = None
            if min_max_base:
                try:
                    base = self.execute_sql(histogram_sql, base=True)
                except Exception as e:
                    print(e)
                finally:
                    self.check_cancel()

            curr = None
            if min_max_curr:
                try:
                    curr = self.execute_sql(histogram_sql, base=False)
                except Exception as e:
                    print(e)
                finally:
                    self.check_cancel()

            bin_edges = [None] * num_bins
            labels = [""] * num_bins
            for i in range(num_bins):
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
                        counts[i] = count
                result['base'] = {
                    'bin_edges': bin_edges,
                    'counts': counts,
                    'labels': labels,
                }
            if curr is not None:
                counts = [0] * num_bins
                for row in curr.rows:
                    bin = row[0]
                    count = row[1]
                    if bin is not None:
                        i = int(bin)
                        counts[i] = count
                result['current'] = {
                    'bin_edges': bin_edges,
                    'counts': counts,
                    'labels': labels,
                }
        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
