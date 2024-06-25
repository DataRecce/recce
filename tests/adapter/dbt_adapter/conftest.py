import pytest

from recce.core import set_default_context
from .dbt_test_helper import DbtTestHelper


@pytest.fixture
def dbt_test_helper():
    helper = DbtTestHelper()
    context = helper.context
    set_default_context(context)
    yield helper
    helper.cleanup()
