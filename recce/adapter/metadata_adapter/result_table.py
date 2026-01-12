"""
ResultTable - Agate-compatible result table for metadata adapter.

This provides a minimal agate-like interface for query results,
enabling compatibility with tasks that use DataFrame.from_agate().
"""

from typing import Any, List, Tuple


class AgateCompatibleType:
    """Base class for agate-compatible type markers."""

    pass


class TextType(AgateCompatibleType):
    """Marker for text/string columns."""

    pass


class NumberType(AgateCompatibleType):
    """Marker for numeric columns."""

    pass


class BooleanType(AgateCompatibleType):
    """Marker for boolean columns."""

    pass


class DateType(AgateCompatibleType):
    """Marker for date columns."""

    pass


class DateTimeType(AgateCompatibleType):
    """Marker for datetime columns."""

    pass


def infer_column_type(value: Any) -> AgateCompatibleType:
    """
    Infer an agate-compatible type from a Python value.

    Args:
        value: Sample value from the column

    Returns:
        AgateCompatibleType subclass instance
    """
    if value is None:
        return TextType()

    if isinstance(value, bool):
        return BooleanType()
    if isinstance(value, (int, float)):
        return NumberType()
    if isinstance(value, str):
        return TextType()

    # Check for date/datetime types
    from datetime import date, datetime

    if isinstance(value, datetime):
        return DateTimeType()
    if isinstance(value, date):
        return DateType()

    # Default to text
    return TextType()


class ResultTable:
    """
    Minimal agate-compatible table for query results.

    Provides the interface expected by DataFrame.from_agate():
    - column_names: List of column names
    - column_types: List of type objects
    - rows: Iterable of row tuples

    Also supports:
    - limit(n): Returns new table with first n rows
    - len(rows): Number of rows
    """

    def __init__(self, column_names: List[str], rows: List[Tuple]):
        """
        Initialize result table.

        Args:
            column_names: List of column names
            rows: List of row tuples
        """
        self._column_names = column_names
        self._rows = rows
        self._column_types = self._infer_types()

    def _infer_types(self) -> List[AgateCompatibleType]:
        """Infer column types from first non-null value in each column."""
        if not self._rows or not self._column_names:
            return [TextType() for _ in self._column_names]

        types = []
        for col_idx in range(len(self._column_names)):
            col_type = TextType()  # Default
            for row in self._rows:
                if col_idx < len(row) and row[col_idx] is not None:
                    col_type = infer_column_type(row[col_idx])
                    break
            types.append(col_type)

        return types

    @property
    def column_names(self) -> List[str]:
        """Return list of column names."""
        return self._column_names

    @property
    def column_types(self) -> List[AgateCompatibleType]:
        """Return list of column types."""
        return self._column_types

    @property
    def rows(self) -> List[Tuple]:
        """Return list of row tuples."""
        return self._rows

    def limit(self, n: int) -> "ResultTable":
        """
        Return a new table with at most n rows.

        Args:
            n: Maximum number of rows

        Returns:
            New ResultTable with limited rows
        """
        return ResultTable(self._column_names, self._rows[:n])

    def __len__(self) -> int:
        """Return number of rows."""
        return len(self._rows)

    def __iter__(self):
        """Iterate over rows."""
        return iter(self._rows)
