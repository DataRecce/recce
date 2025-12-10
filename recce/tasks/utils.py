"""Utility functions for task operations."""

from typing import List, Optional


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
    """
    if keys is None:
        return None

    if not column_keys:
        return keys

    # Build both exact and case-insensitive lookup maps
    exact_key_set = set(column_keys)
    case_insensitive_map = {col.lower(): col for col in column_keys}

    normalized = []
    for key in keys:
        if key in exact_key_set:
            # Exact match - use as-is (handles quoted columns)
            normalized.append(key)
        else:
            # Case-insensitive fallback
            actual_key = case_insensitive_map.get(key.lower())
            normalized.append(actual_key if actual_key is not None else key)

    return normalized
