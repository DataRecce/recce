# noinspection PyUnresolvedReferences
from tests.adapter.dbt_adapter.conftest import dbt_test_helper


def test_lineage_diff(dbt_test_helper):
    sql_model1 = """
    select a from T
    """

    sql_model2 = """
    select a from {{ ref("model1") }}
    """

    sql_model2_ = """
    select
    a,b
    from
    {{ ref("model1") }}
    """

    dbt_test_helper.create_model("model1", sql_model1, sql_model1)
    dbt_test_helper.create_model("model2", sql_model2, sql_model2_)
    result = dbt_test_helper.context.get_lineage_diff()
    nodediff = result.diff.get('model1')
    assert nodediff is None
    nodediff2 = result.diff.get('model2')
    assert nodediff2 is not None and nodediff2.change_status == 'modified' and nodediff2.change_category == 'non-breaking'
