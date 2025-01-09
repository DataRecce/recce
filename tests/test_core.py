# noinspection PyUnresolvedReferences
from tests.adapter.dbt_adapter.conftest import dbt_test_helper


def test_lineage_diff(dbt_test_helper):
    sql_base = """
        select a from {{ref('a')}}
        """

    sql_curr = """
        select a, b from {{ref('a')}}
        """

    dbt_test_helper.create_model("customers_1", sql_base, sql_curr)
    result = dbt_test_helper.context.get_lineage_diff()
    nodediff = result.diff.get('customers_1')
    assert nodediff is not None and nodediff.change_status == 'modified'
