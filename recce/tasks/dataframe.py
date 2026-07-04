import json
import typing as t
from decimal import Decimal
from enum import Enum

if t.TYPE_CHECKING:
    import agate
    import pandas
from pydantic import BaseModel, Field


class DataFrameColumnType(Enum):
    NUMBER = "number"
    INTEGER = "integer"
    TEXT = "text"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    TIMEDELTA = "timedelta"
    UNKNOWN = "unknown"

    @classmethod
    def from_string(cls, type_str: str) -> "DataFrameColumnType":
        """Convert string to DataFrameColumnType enum.

        Args:
            type_str: String representation of the type (e.g., "integer", "text")

        Returns:
            DataFrameColumnType enum value
        """
        type_str = type_str.lower().strip()
        try:
            return cls(type_str)
        except ValueError:
            return cls.UNKNOWN


class DataFrameColumn(BaseModel):
    key: t.Optional[str] = None
    name: str
    type: DataFrameColumnType

    def __init__(self, **data):
        """Initialize DataFrameColumn, auto-setting key=name if key is missing."""
        if "key" not in data or data["key"] is None:
            data["key"] = data.get("name")
        super().__init__(**data)


class DataFrame(BaseModel):
    columns: t.List[DataFrameColumn]
    data: t.List[tuple]
    limit: t.Optional[int] = Field(None, description="Limit the number of rows returned")
    more: t.Optional[bool] = Field(None, description="Whether there are more rows to fetch")
    total_row_count: t.Optional[int] = Field(None, description="Total row count from the full query (before limit)")

    @staticmethod
    def from_agate(table: "agate.Table", limit: t.Optional[int] = None, more: t.Optional[bool] = None):
        from recce.adapter.dbt_adapter import dbt_version

        if dbt_version < "v1.8":
            import dbt.clients.agate_helper as agate_helper
        else:
            import dbt_common.clients.agate_helper as agate_helper

        import agate

        columns = []

        for col_name, col_type in zip(table.column_names, table.column_types):

            has_integer = hasattr(agate_helper, "Integer")

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
            columns.append(DataFrameColumn(key=col_name, name=col_name, type=col_type))

        def _convert(col_type, v):
            if not isinstance(v, Decimal):
                return v
            # Non-finite Decimals (NaN/Infinity) are not JSON-serializable, so
            # convert them to float regardless of column type (GitHub issue #476).
            if not v.is_finite():
                return float(v)
            # NUMBER columns are floating aggregates (avg, stddev, percentiles, …).
            # Pydantic v2 serializes Decimal as a JSON *string*, so an unchanged
            # table whose stat is e.g. Decimal("0.30000000000000004") would reach
            # the frontend as the string "0.30000000000000004" and compare unequal
            # to "0.3" — a phantom float diff (DRC-3025). A NUMBER stat is a real
            # number, and these are shown at 2-5 decimals, so float64 is the correct
            # display-precision wire type: coerce it here, at the source, so the
            # value is a number end-to-end and the grid's epsilon comparison applies.
            # INTEGER columns are intentionally left as-is: they compare exactly (no
            # float noise) and float64 would lose precision above 2**53.
            if col_type == DataFrameColumnType.NUMBER:
                return float(v)
            return v

        def _row_values(row):
            return tuple(_convert(col.type, v) for col, v in zip(columns, row.values()))

        data = [_row_values(row) for row in table.rows]
        df = DataFrame(
            columns=columns,
            data=data,
            limit=limit,
            more=more,
        )
        return df

    @staticmethod
    def from_pandas(pandas_df: "pandas.DataFrame", limit: t.Optional[int] = None, more: t.Optional[bool] = None):
        columns = []
        for column in pandas_df.columns:
            dtype = pandas_df[column].dtype
            if dtype == "int64":
                col_type = DataFrameColumnType.INTEGER
            elif dtype == "float64":
                col_type = DataFrameColumnType.NUMBER
            elif dtype == "object":
                col_type = DataFrameColumnType.TEXT
            elif dtype == "bool":
                col_type = DataFrameColumnType.BOOLEAN
            else:
                col_type = DataFrameColumnType.UNKNOWN
            columns.append(DataFrameColumn(name=column, type=col_type))

        s = pandas_df.to_json(orient="values")
        data = json.loads(s)

        df = DataFrame(
            columns=columns,
            data=data,
            limit=limit,
            more=more,
        )
        return df

    @staticmethod
    def from_data(
        columns: t.Dict[str, str],
        data: t.List[tuple],
        limit: t.Optional[int] = None,
        more: t.Optional[bool] = None,
    ):
        """Create a DataFrame from columns and data directly.

        Args:
            columns: Dict defining the schema where keys are column names and values are type strings.
                     Type strings can be: "number", "integer", "text", "boolean", "date", "datetime", "timedelta"
            data: List of rows (each row is a list/tuple/sequence of values)
            limit: Optional limit on the number of rows returned
            more: Optional flag indicating whether there are more rows to fetch

        Returns:
            DataFrame instance

        Examples:
            # Using simple dict format
            columns = {"idx": "integer", "name": "text", "impacted": "boolean"}
            data = [[0, "model_a", True], [1, "model_b", False]]
            df = DataFrame.from_data(columns, data)
        """
        # Convert dict columns to DataFrameColumn objects
        processed_columns = []
        for key, type_str in columns.items():
            col_type = DataFrameColumnType.from_string(type_str)
            processed_columns.append(DataFrameColumn(key=key, name=key, type=col_type))

        df = DataFrame(
            columns=processed_columns,
            data=data,
            limit=limit,
            more=more,
        )
        return df
