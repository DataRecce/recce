"""Tests for task utility functions."""

import pytest
from recce.tasks.utils import normalize_keys_to_columns


class TestNormalizeKeysToColumns:
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
