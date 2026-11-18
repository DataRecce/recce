"""Real-DuckDB check that verified identifiers containing quote characters round-trip (DRC-5336)."""

import pytest

from recce.tasks.histogram import HistogramDiffTask
from recce.tasks.query import QueryDiffTask
from recce.tasks.top_k import TopKDiffTask
from recce.tasks.valuediff import ValueDiffDetailTask, ValueDiffTask
from tests.adapter.dbt_adapter.conftest import dbt_test_helper  # noqa: F401

WEIRD_COLUMNS = ['we"ird', "it's", "a b"]


@pytest.mark.parametrize("col", WEIRD_COLUMNS)
def test_diff_tasks_handle_columns_with_quote_characters(dbt_test_helper, col):  # noqa: F811
    """Fails if quote doubling is dropped (SQL error) or QueryDiff stores the doubled SQL spelling
    of the primary key back into params instead of the column's real name."""
    cols = {"id": "INTEGER", col: "VARCHAR", "n": "INTEGER"}
    adapter = dbt_test_helper.adapter
    with adapter.connection_named("seed"):
        for schema in (dbt_test_helper.base_schema, dbt_test_helper.curr_schema):
            defs = ", ".join('"%s" %s' % (c.replace('"', '""'), t) for c, t in cols.items())
            adapter.execute(f"CREATE TABLE {schema}.t ({defs})")
            adapter.execute(f"INSERT INTO {schema}.t VALUES (1,'p',5),(2,'q',6),(3,'r',7)")
    dbt_test_helper.create_model("t", base_sql="select 1", curr_sql="select 1", base_columns=cols, curr_columns=cols)

    assert TopKDiffTask({"model": "t", "column_name": col, "k": 5}).execute()["current"]["total"] == 3
    vd = ValueDiffTask({"model": "t", "primary_key": "id", "columns": [col]}).execute()
    assert col in [row[0] for row in vd.data.data]
    ValueDiffDetailTask({"model": "t", "primary_key": "id", "columns": [col]}).execute()
    HistogramDiffTask({"model": "t", "column_name": "n", "column_type": "INTEGER"}).execute()

    task = QueryDiffTask({"sql_template": 'select * from {{ ref("t") }}', "primary_keys": [col]})
    task.execute()
    assert task.params.primary_keys == [col]
