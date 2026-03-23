from functools import wraps
from unittest.mock import patch

import pytest

from recce.core import set_default_context

from .dbt_test_helper import DbtTestHelper


@pytest.fixture
def dbt_test_helper():
    with patch("recce.adapter.dbt_adapter.log_performance"):
        helper = DbtTestHelper()
        context = helper.context
        set_default_context(context)
        yield helper
        helper.cleanup()


@pytest.fixture(params=[False, True], ids=["cll_per_node", "cll_full_map"])
def cll_full_map_enabled(request, dbt_test_helper):
    """Parametrized fixture that patches get_cll to inject cll_full_map_enabled."""
    enabled = request.param
    adapter = dbt_test_helper.context.adapter
    original_get_cll = adapter.get_cll.__func__

    @wraps(original_get_cll)
    def patched_get_cll(self, *args, **kwargs):
        kwargs.setdefault("cll_full_map_enabled", enabled)
        return original_get_cll(self, *args, **kwargs)

    adapter.get_cll = patched_get_cll.__get__(adapter, type(adapter))
    yield enabled
    adapter.get_cll = original_get_cll.__get__(adapter, type(adapter))
