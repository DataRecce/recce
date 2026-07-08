import json
import typing as t
from decimal import Decimal
from enum import Enum

if t.TYPE_CHECKING:
    import agate
    import pandas

from pydantic import BaseModel, Field

# Warehouse DB type strings (from catalog.json) grouped by comparison semantics.
# Approximate float types carry IEEE-754 noise and must be compared with an
# epsilon on the frontend; exact-decimal and integer types must be compared
# exactly (a 1-cent DECIMAL change is a real change — never float-collapse it).
_FLOAT_DB_TYPES = frozenset(
    {"DOUBLE", "DOUBLE PRECISION", "FLOAT", "FLOAT4", "FLOAT8", "REAL", "BINARY_FLOAT", "BINARY_DOUBLE"}
)
_INTEGER_DB_TYPES = frozenset(
    {
        "INT",
        "INTEGER",
        "BIGINT",
        "SMALLINT",
        "TINYINT",
        "HUGEINT",
        "INT2",
        "INT4",
        "INT8",
        "INT16",
        "INT64",
        "INT128",
        "UINTEGER",
        "UBIGINT",
        "USMALLINT",
        "UTINYINT",
        "UHUGEINT",
    }
)
_EXACT_DECIMAL_DB_PREFIXES = ("DECIMAL", "NUMERIC", "NUMBER", "DEC")


class DataFrameColumnType(Enum):
    NUMBER = "number"
    # Approximate float column (DOUBLE/FLOAT/REAL, or a computed profile
    # aggregate). Values stay exact strings on the wire; only this label tells
    # the frontend to compare them with a magnitude-relative epsilon rather than
    # exact string-inequality. Distinct from NUMBER, which stays exact.
    FLOAT = "float"
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

    @classmethod
    def from_db_type(cls, db_type: str) -> t.Optional["DataFrameColumnType"]:
        """Map a warehouse DB type string (from catalog.json) to its comparison type.

        Only NUMERIC db types get a confident comparison mapping:
        - DECIMAL/NUMERIC/NUMBER -> NUMBER  (exact — the cycle-4 guard: never
          float-collapse a high-precision decimal)
        - DOUBLE/FLOAT/REAL      -> FLOAT   (approximate — epsilon on compare)
        - INT variants           -> INTEGER

        Non-numeric or unrecognized types return None, telling the caller to keep
        whatever type `from_agate` already inferred (safe, exact by default).
        """
        if not db_type:
            return None
        # Strip precision/scale e.g. "DECIMAL(38,2)" -> "DECIMAL", uppercase.
        base = db_type.split("(")[0].strip().upper()
        if base in _FLOAT_DB_TYPES:
            return cls.FLOAT
        if base in _INTEGER_DB_TYPES:
            return cls.INTEGER
        if base.startswith(_EXACT_DECIMAL_DB_PREFIXES):
            return cls.NUMBER
        return None


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

    def stamp_column_types(self, type_map: t.Dict[str, "DataFrameColumnType"]) -> "DataFrame":
        """Override column comparison types by name, in place.

        `type_map` keys are column names (matched case-insensitively); each matched
        column's `type` is replaced. Columns absent from the map keep the type
        `from_agate`/`from_pandas` already inferred — this is the exact fallback for
        ad-hoc/expression columns and any column when the catalog is absent (AC9).
        Only the column-level label changes; row values are untouched.

        Returns self so callers can chain.
        """
        if not type_map:
            return self
        lowered = {name.lower(): col_type for name, col_type in type_map.items()}
        for column in self.columns:
            new_type = lowered.get(column.name.lower())
            if new_type is not None:
                column.type = new_type
        return self

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
