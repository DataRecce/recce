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
