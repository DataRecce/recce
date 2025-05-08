import pytest


def test_default_validator():
    from recce.tasks.core import CheckValidator

    CheckValidator().validate(
        {
            "name": "test",
            "type": "row_count_diff",
            "params": {},
        }
    )

    with pytest.raises(ValueError):
        CheckValidator().validate(
            {
                "type": "row_count_diff",
            }
        )


def test_query_diff_validator():
    from recce.tasks.query import QueryDiffCheckValidator

    QueryDiffCheckValidator().validate(
        {
            "name": "test",
            "type": "query_diff",
            "params": {"sql_template": "select * from {{ model }}"},
        }
    )
    with pytest.raises(ValueError):
        QueryDiffCheckValidator().validate(
            {
                "name": "test",
                "type": "query_diff",
            }
        )


def test_lineage_diff_validator():
    from recce.tasks.lineage import LineageDiffCheckValidator

    LineageDiffCheckValidator().validate(
        {
            "name": "test",
            "type": "lineage_diff",
            "params": {},
        }
    )
    LineageDiffCheckValidator().validate(
        {
            "name": "test",
            "type": "lineage_diff",
            "view_options": {},
        }
    )
    with pytest.raises(ValueError):
        LineageDiffCheckValidator().validate(
            {
                "type": "lineage_diff",
            }
        )
