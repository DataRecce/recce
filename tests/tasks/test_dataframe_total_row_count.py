from recce.tasks.dataframe import DataFrame, DataFrameColumn, DataFrameColumnType


def test_dataframe_total_row_count_default_none():
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
    )
    assert df.total_row_count is None


def test_dataframe_total_row_count_set():
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
        total_row_count=50000,
    )
    assert df.total_row_count == 50000


def test_dataframe_total_row_count_serialization():
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
        total_row_count=12345,
    )
    d = df.model_dump()
    assert d["total_row_count"] == 12345


def test_dataframe_total_row_count_none_excluded_from_json():
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
    )
    d = df.model_dump(exclude_none=True)
    assert "total_row_count" not in d
