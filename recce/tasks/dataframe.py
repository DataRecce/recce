from enum import Enum
from typing import List, Optional

import agate
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
    columns: List[DataFrameColumn]
    data: List[tuple]
    limit: Optional[int] = Field(None, description="Limit the number of rows returned")
    more: Optional[bool] = Field(None, description="Whether there are more rows to fetch")

    @staticmethod
    def from_agate(table: agate.Table, limit: Optional[int] = None, more: Optional[bool] = None):
        columns = []

        for col_name, col_type in zip(table.column_names, table.column_types):
            import dbt.clients.agate_helper
            has_integer = hasattr(dbt.clients.agate_helper, 'Integer')

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
            elif has_integer and isinstance(col_type, dbt.clients.agate_helper.Integer):
                col_type = DataFrameColumnType.INTEGER
            else:
                col_type = DataFrameColumnType.UNKNOWN
            columns.append(DataFrameColumn(name=col_name, type=col_type))
        data = [row.values() for row in table.rows]
        df = DataFrame(
            columns=columns,
            data=data,
            limit=limit,
            more=more,
        )
        return df
