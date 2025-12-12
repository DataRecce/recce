"""Utility functions for task operations."""

from typing import List, Optional

from recce.tasks.dataframe import DataFrame


def strip_identifier_quotes(identifier: str) -> str:
    """
    Strip SQL identifier quotes from a column name.

    Different databases use different quoting styles:
    - Double quotes: "column" (PostgreSQL, Snowflake, etc.)
    - Backticks: `column` (MySQL, BigQuery)
    - Square brackets: [column] (SQL Server)

    Args:
        identifier: Column name that may be quoted

    Returns:
        Column name with quotes stripped

    Examples:
        >>> strip_identifier_quotes('"myColumn"')
        'myColumn'
        >>> strip_identifier_quotes('`my_column`')
        'my_column'
        >>> strip_identifier_quotes('[Column Name]')
        'Column Name'
        >>> strip_identifier_quotes('regular_column')
        'regular_column'
    """
    if not identifier or len(identifier) < 2:
        return identifier

    # Check for double quotes
    if identifier.startswith('"') and identifier.endswith('"'):
        return identifier[1:-1]

    # Check for backticks
    if identifier.startswith("`") and identifier.endswith("`"):
        return identifier[1:-1]

    # Check for square brackets
    if identifier.startswith("[") and identifier.endswith("]"):
        return identifier[1:-1]

    return identifier


def normalize_keys_to_columns(
    keys: Optional[List[str]],
    column_keys: List[str],
) -> Optional[List[str]]:
    """
    Normalize user-provided keys to match actual column keys from the warehouse.

    Different warehouses return column names in different cases:
    - Snowflake: UPPERCASE (unless quoted)
    - PostgreSQL/Redshift: lowercase (unless quoted)
    - BigQuery: preserves original case

    This function first attempts an exact match (for quoted columns that preserve
    case), then falls back to case-insensitive matching to align user input
    with the actual column keys returned by the warehouse.

    Args:
        keys: User-provided keys (e.g., primary_keys from params)
        column_keys: Actual column keys from the query result

    Returns:
        List of keys normalized to match column_keys casing,
        or None if keys is None.
        If a key doesn't match any column, it's preserved as-is.

    Examples:
        >>> normalize_keys_to_columns(["payment_id"], ["PAYMENT_ID", "ORDER_ID"])
        ["PAYMENT_ID"]

        >>> normalize_keys_to_columns(["ID", "NAME"], ["id", "name", "value"])
        ["id", "name"]

        >>> normalize_keys_to_columns(["preCommitID"], ["preCommitID", "order_id"])
        ["preCommitID"]  # Exact match preserved for quoted columns

        >>> normalize_keys_to_columns(['"customerID"'], ["customerID", "amount"])
        ["customerID"]  # Quotes stripped, then matched

        >>> normalize_keys_to_columns(['`my_column`'], ["MY_COLUMN"])
        ["MY_COLUMN"]  # Backticks stripped, then case-insensitive match
    """
    if keys is None:
        return None

    # Strip quotes from all keys first - quotes are for SQL execution,
    # but the frontend should receive unquoted column names
    unquoted_keys = [strip_identifier_quotes(key) for key in keys]

    if not column_keys:
        return unquoted_keys

    # Build both exact and case-insensitive lookup maps
    exact_key_set = set(column_keys)
    case_insensitive_map = {col.lower(): col for col in column_keys}

    normalized = []
    for key in unquoted_keys:
        if key in exact_key_set:
            # Exact match - use as-is (handles quoted columns that preserved case)
            normalized.append(key)
        else:
            # Case-insensitive fallback
            actual_key = case_insensitive_map.get(key.lower())
            normalized.append(actual_key if actual_key is not None else key)

    return normalized


def normalize_boolean_flag_columns(df: "DataFrame") -> "DataFrame":
    """
    Normalize boolean flag columns (in_a, in_b) to lowercase for cross-warehouse consistency.

    Different warehouses return column names in different cases:
    - Snowflake: IN_A, IN_B (UPPERCASE)
    - PostgreSQL/Redshift: in_a, in_b (lowercase)
    - BigQuery: preserves original case

    This function ensures these columns are always lowercase in the DataFrame
    sent to the frontend, enabling exact string matching.

    Args:
        df: DataFrame that may contain IN_A/IN_B columns

    Returns:
        DataFrame with in_a/in_b columns normalized to lowercase
    """
    from .dataframe import DataFrame, DataFrameColumn

    normalized_columns = []
    for col in df.columns:
        key_upper = col.key.upper() if col.key else ""
        if key_upper in ("IN_A", "IN_B"):
            normalized_columns.append(DataFrameColumn(key=col.key.lower(), name=col.name.lower(), type=col.type))
        else:
            normalized_columns.append(col)

    return DataFrame(columns=normalized_columns, data=df.data, limit=df.limit, more=df.more)
