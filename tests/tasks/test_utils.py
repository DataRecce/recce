"""Tests for task utility functions."""

import unittest

from recce.tasks.utils import normalize_keys_to_columns


class TestNormalizeKeysToColumns(unittest.TestCase):
    """Tests for normalize_keys_to_columns function."""

    # ========================================================================
    # Warehouse-specific casing tests
    # ========================================================================

    def test_snowflake_uppercase(self):
        """Snowflake returns UPPERCASE column names."""
        keys = ["payment_id", "order_id"]
        columns = ["PAYMENT_ID", "ORDER_ID", "AMOUNT"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["PAYMENT_ID", "ORDER_ID"]

    def test_postgres_lowercase(self):
        """PostgreSQL/Redshift returns lowercase column names."""
        keys = ["Payment_ID", "Order_ID"]
        columns = ["payment_id", "order_id", "amount"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["payment_id", "order_id"]

    def test_bigquery_preserves_case(self):
        """BigQuery preserves original case."""
        keys = ["PaymentId", "OrderId"]
        columns = ["PaymentId", "OrderId", "Amount"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["PaymentId", "OrderId"]

    def test_mixed_case_matching(self):
        """Mixed case input matches correctly via case-insensitive fallback."""
        keys = ["PAYMENT_id", "order_ID"]
        columns = ["Payment_Id", "Order_Id", "Amount"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["Payment_Id", "Order_Id"]

    # ========================================================================
    # Quoted column tests (exact match first)
    # ========================================================================

    def test_quoted_column_exact_match(self):
        """Quoted columns with exact match are preserved."""
        keys = ["preCommitID"]
        columns = ["preCommitID", "order_id", "amount"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["preCommitID"]

    def test_quoted_column_exact_match_mixed_with_unquoted(self):
        """Mix of quoted (exact match) and unquoted (case-insensitive) columns."""
        keys = ["preCommitID", "ORDER_ID"]
        columns = ["preCommitID", "order_id", "amount"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["preCommitID", "order_id"]

    def test_quoted_column_case_insensitive_fallback(self):
        """If quoted column doesn't match exactly, falls back to case-insensitive."""
        keys = ["precommitid"]  # User provides lowercase
        columns = ["preCommitID", "order_id"]  # But warehouse has mixed case

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["preCommitID"]  # Falls back to case-insensitive match

    def test_multiple_quoted_columns(self):
        """Multiple quoted columns with preserved casing."""
        keys = ["preCommitID", "postCommitID", "userName"]
        columns = ["preCommitID", "postCommitID", "userName", "created_at"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["preCommitID", "postCommitID", "userName"]

    # ========================================================================
    # Edge cases and null handling
    # ========================================================================

    def test_none_keys_returns_none(self):
        """None keys input returns None."""
        result = normalize_keys_to_columns(None, ["col1", "col2"])

        assert result is None

    def test_empty_keys_returns_empty(self):
        """Empty keys list returns empty list."""
        result = normalize_keys_to_columns([], ["col1", "col2"])

        assert result == []

    def test_empty_columns_preserves_keys(self):
        """Empty columns list preserves original keys."""
        keys = ["payment_id", "order_id"]

        result = normalize_keys_to_columns(keys, [])

        assert result == ["payment_id", "order_id"]

    def test_unmatched_key_preserved(self):
        """Keys not found in columns are preserved as-is."""
        keys = ["payment_id", "nonexistent_col"]
        columns = ["PAYMENT_ID", "ORDER_ID"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["PAYMENT_ID", "nonexistent_col"]

    def test_single_key(self):
        """Single key normalization works."""
        result = normalize_keys_to_columns(["id"], ["ID", "NAME"])

        assert result == ["ID"]

    def test_special_columns_in_a_in_b(self):
        """IN_A and IN_B columns normalize correctly."""
        keys = ["in_a", "in_b"]
        columns = ["ID", "IN_A", "IN_B"]

        result = normalize_keys_to_columns(keys, columns)

        assert result == ["IN_A", "IN_B"]

    # ========================================================================
    # Case collision edge cases
    # ========================================================================

    def test_exact_match_takes_priority_over_case_insensitive(self):
        """When exact match exists, it takes priority even if case-insensitive would match differently."""
        # This tests the scenario where there might be columns that differ only by case
        keys = ["ID"]
        columns = ["ID", "id"]  # Both exist (rare but possible with quoting)

        result = normalize_keys_to_columns(keys, columns)

        # Should use exact match "ID", not fall back to case-insensitive
        assert result == ["ID"]

    def test_case_insensitive_when_no_exact_match(self):
        """Case-insensitive matching when exact match doesn't exist."""
        keys = ["Id"]  # Mixed case, won't match exactly
        columns = ["ID", "id"]  # Both exist

        result = normalize_keys_to_columns(keys, columns)

        # Falls back to case-insensitive, last one in the map wins
        # (This is acceptable - having same-name columns with different case is an edge case)
        assert result[0] in ["ID", "id"]

    # Add to tests/tasks/test_utils.py


class TestNormalizeBooleanFlagColumns(unittest.TestCase):
    """Tests for normalize_boolean_flag_columns function."""

    def test_normalizes_uppercase_in_a_in_b(self):
        """Snowflake returns UPPERCASE - should normalize to lowercase."""
        from recce.tasks.dataframe import (
            DataFrame,
            DataFrameColumn,
            DataFrameColumnType,
        )
        from recce.tasks.utils import normalize_boolean_flag_columns

        df = DataFrame(
            columns=[
                DataFrameColumn(key="ID", name="ID", type=DataFrameColumnType.INTEGER),
                DataFrameColumn(key="IN_A", name="IN_A", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="IN_B", name="IN_B", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="VALUE", name="VALUE", type=DataFrameColumnType.NUMBER),
            ],
            data=[(1, True, True, 100), (2, True, False, 200)],
        )

        result = normalize_boolean_flag_columns(df)

        column_keys = [col.key for col in result.columns]
        self.assertEqual(column_keys, ["ID", "in_a", "in_b", "VALUE"])

        column_names = [col.name for col in result.columns]
        self.assertEqual(column_names, ["ID", "in_a", "in_b", "VALUE"])

    def test_preserves_lowercase_in_a_in_b(self):
        """PostgreSQL returns lowercase - should remain unchanged."""
        from recce.tasks.dataframe import (
            DataFrame,
            DataFrameColumn,
            DataFrameColumnType,
        )
        from recce.tasks.utils import normalize_boolean_flag_columns

        df = DataFrame(
            columns=[
                DataFrameColumn(key="id", name="id", type=DataFrameColumnType.INTEGER),
                DataFrameColumn(key="in_a", name="in_a", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="in_b", name="in_b", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="value", name="value", type=DataFrameColumnType.NUMBER),
            ],
            data=[(1, True, True, 100)],
        )

        result = normalize_boolean_flag_columns(df)

        column_keys = [col.key for col in result.columns]
        self.assertEqual(column_keys, ["id", "in_a", "in_b", "value"])

    def test_handles_mixed_case_in_a_in_b(self):
        """Mixed case like In_A should normalize to lowercase."""
        from recce.tasks.dataframe import (
            DataFrame,
            DataFrameColumn,
            DataFrameColumnType,
        )
        from recce.tasks.utils import normalize_boolean_flag_columns

        df = DataFrame(
            columns=[
                DataFrameColumn(key="id", name="id", type=DataFrameColumnType.INTEGER),
                DataFrameColumn(key="In_A", name="In_A", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="In_B", name="In_B", type=DataFrameColumnType.BOOLEAN),
            ],
            data=[(1, True, False)],
        )

        result = normalize_boolean_flag_columns(df)

        column_keys = [col.key for col in result.columns]
        self.assertEqual(column_keys, ["id", "in_a", "in_b"])

    def test_preserves_other_columns(self):
        """Non in_a/in_b columns should remain unchanged."""
        from recce.tasks.dataframe import (
            DataFrame,
            DataFrameColumn,
            DataFrameColumnType,
        )
        from recce.tasks.utils import normalize_boolean_flag_columns

        df = DataFrame(
            columns=[
                DataFrameColumn(key="USER_ID", name="USER_ID", type=DataFrameColumnType.INTEGER),
                DataFrameColumn(key="IN_A", name="IN_A", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="IN_B", name="IN_B", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="base__VALUE", name="base__VALUE", type=DataFrameColumnType.NUMBER),
                DataFrameColumn(key="current__VALUE", name="current__VALUE", type=DataFrameColumnType.NUMBER),
            ],
            data=[(1, True, True, 100, 150)],
        )

        result = normalize_boolean_flag_columns(df)

        column_keys = [col.key for col in result.columns]
        # Only in_a/in_b should be lowercased
        self.assertEqual(column_keys, ["USER_ID", "in_a", "in_b", "base__VALUE", "current__VALUE"])

    def test_preserves_data(self):
        """Data should remain unchanged."""
        from recce.tasks.dataframe import (
            DataFrame,
            DataFrameColumn,
            DataFrameColumnType,
        )
        from recce.tasks.utils import normalize_boolean_flag_columns

        original_data = [(1, True, False, 100), (2, False, True, 200)]
        df = DataFrame(
            columns=[
                DataFrameColumn(key="ID", name="ID", type=DataFrameColumnType.INTEGER),
                DataFrameColumn(key="IN_A", name="IN_A", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="IN_B", name="IN_B", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="VALUE", name="VALUE", type=DataFrameColumnType.NUMBER),
            ],
            data=original_data,
        )

        result = normalize_boolean_flag_columns(df)

        self.assertEqual(result.data, original_data)

    def test_preserves_limit_and_more(self):
        """limit and more fields should be preserved."""
        from recce.tasks.dataframe import (
            DataFrame,
            DataFrameColumn,
            DataFrameColumnType,
        )
        from recce.tasks.utils import normalize_boolean_flag_columns

        df = DataFrame(
            columns=[
                DataFrameColumn(key="id", name="id", type=DataFrameColumnType.INTEGER),
                DataFrameColumn(key="IN_A", name="IN_A", type=DataFrameColumnType.BOOLEAN),
                DataFrameColumn(key="IN_B", name="IN_B", type=DataFrameColumnType.BOOLEAN),
            ],
            data=[(1, True, True)],
            limit=100,
            more=True,
        )

        result = normalize_boolean_flag_columns(df)

        self.assertEqual(result.limit, 100)
        self.assertEqual(result.more, True)

    def test_handles_dataframe_without_in_columns(self):
        """DataFrames without in_a/in_b should pass through unchanged."""
        from recce.tasks.dataframe import (
            DataFrame,
            DataFrameColumn,
            DataFrameColumnType,
        )
        from recce.tasks.utils import normalize_boolean_flag_columns

        df = DataFrame(
            columns=[
                DataFrameColumn(key="id", name="id", type=DataFrameColumnType.INTEGER),
                DataFrameColumn(key="name", name="name", type=DataFrameColumnType.TEXT),
            ],
            data=[(1, "Alice"), (2, "Bob")],
        )

        result = normalize_boolean_flag_columns(df)

        column_keys = [col.key for col in result.columns]
        self.assertEqual(column_keys, ["id", "name"])
