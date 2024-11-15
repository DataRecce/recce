import json
import typing as t
from decimal import Decimal
from enum import Enum

if t.TYPE_CHECKING:
    import agate
    import pandas
from pydantic import BaseModel, Field


class DataFrameColumnType(Enum):
    NUMBER = 'number'
    INTEGER = 'integer'
    TEXT = 'text'
    BOOLEAN = 'boolean'
    DATE = 'date'
    DATETIME = 'datetime'
    TIMEDELTA = 'timedelta'
    UNKNOWN = 'unknown'


class DataFrameColumn(BaseModel):
    name: str
    type: DataFrameColumnType


class DataFrame(BaseModel):
    columns: t.List[DataFrameColumn]
    data: t.List[tuple]
    limit: t.Optional[int] = Field(None, description="Limit the number of rows returned")
    more: t.Optional[bool] = Field(None, description="Whether there are more rows to fetch")

    @staticmethod
    def from_agate(table: 'agate.Table', limit: t.Optional[int] = None, more: t.Optional[bool] = None):
        from recce.adapter.dbt_adapter import dbt_version
        if dbt_version < 'v1.8':
            import dbt.clients.agate_helper as agate_helper
        else:
            import dbt_common.clients.agate_helper as agate_helper

        import agate
        columns = []

        for col_name, col_type in zip(table.column_names, table.column_types):

            has_integer = hasattr(agate_helper, 'Integer')

            if isinstance(col_type, agate.Number):
                col_type = DataFrameColumnType.NUMBER
            elif isinstance(col_type, agate.Text):
                col_type = DataFrameColumnType.TEXT
            elif isinstance(col_type, agate.Boolean):
                col_type = DataFrameColumnType.BOOLEAN
            elif isinstance(col_type, agate.Date):
                col_type = DataFrameColumnType.DATE
            elif isinstance(col_type, agate.DateTime):
                col_type = DataFrameColumnType.DATETIME
            elif isinstance(col_type, agate.TimeDelta):
                col_type = DataFrameColumnType.TIMEDELTA
            elif has_integer and isinstance(col_type, agate_helper.Integer):
                col_type = DataFrameColumnType.INTEGER
            else:
                col_type = DataFrameColumnType.UNKNOWN
            columns.append(DataFrameColumn(name=col_name, type=col_type))

        def _row_values(row):
            # If the value is Decimal, check if it's finite. If not, convert it to float(xxx) (GitHub issue #476)
            return tuple([float(v) if isinstance(v, Decimal) and not v.is_finite() else v for v in row.values()])

        data = [_row_values(row) for row in table.rows]
        df = DataFrame(
            columns=columns,
            data=data,
            limit=limit,
            more=more,
        )
        return df

    @staticmethod
    def from_pandas(pandas_df: 'pandas.DataFrame', limit: t.Optional[int] = None, more: t.Optional[bool] = None):
        columns = []
        for column in pandas_df.columns:
            dtype = pandas_df[column].dtype
            if dtype == 'int64':
                col_type = DataFrameColumnType.INTEGER
            elif dtype == 'float64':
                col_type = DataFrameColumnType.NUMBER
            elif dtype == 'object':
                col_type = DataFrameColumnType.TEXT
            elif dtype == 'bool':
                col_type = DataFrameColumnType.BOOLEAN
            else:
                col_type = DataFrameColumnType.UNKNOWN
            columns.append(DataFrameColumn(name=column, type=col_type))

        s = pandas_df.to_json(orient='values')
        data = json.loads(s)

        df = DataFrame(
            columns=columns,
            data=data,
            limit=limit,
            more=more,
        )
        return df
