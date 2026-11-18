from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from recce.exceptions import RecceException
from recce.tasks.identifiers import (
    infer_output_columns,
    quote_identifier,
    resolve_order_by_identifiers,
    resolve_verified_column,
)


def _adapter(quote_sample):
    adapter = MagicMock()
    adapter.adapter.quote.return_value = quote_sample
    return adapter


@pytest.mark.parametrize(
    ("sample", "name", "expected"),
    [
        ('"x"', 'a"b', '"a""b"'),
        ("`x`", "a`b", "`a``b`"),
        ("[x]", "a]b", "[a]]b]"),
    ],
)
def test_quote_identifier_doubles_embedded_closing_quote(sample, name, expected):
    assert quote_identifier(_adapter(sample), name) == expected


def test_resolve_verified_column_returns_physical_name_case_insensitively():
    adapter = MagicMock()
    adapter.get_columns.return_value = [SimpleNamespace(column="CUSTOMER_ID")]
    assert resolve_verified_column(adapter, "m", "customer_id") == "CUSTOMER_ID"


def test_resolve_verified_column_requires_column_in_both_envs():
    adapter = MagicMock()
    adapter.get_columns.side_effect = lambda model, base: [SimpleNamespace(column="id")] + (
        [] if base else [SimpleNamespace(column="extra")]
    )
    with pytest.raises(RecceException):
        resolve_verified_column(adapter, "m", "extra")


def test_infer_output_columns_handles_aliases_and_ref_star():
    assert infer_output_columns("select 1 as id, name from t") == ["id", "name"]
    star = infer_output_columns('select * from {{ ref("orders") }}', lambda m: ["a", "b"] if m == "orders" else [])
    assert star == ["a", "b"]
    assert infer_output_columns("select * from {{ ref('x') }} join y on 1=1", lambda m: ["a"]) is None
    assert infer_output_columns("select {{ something() }} from t") is None


def test_order_by_falls_back_to_strict_syntax_when_columns_unknown():
    adapter = _adapter('"x"')
    assert resolve_order_by_identifiers(adapter, ["id"], "select * from {{ ref('x') }} join y on 1=1") == ["id"]
    with pytest.raises(RecceException):
        resolve_order_by_identifiers(adapter, ['id") --'], "select * from {{ ref('x') }} join y on 1=1")
