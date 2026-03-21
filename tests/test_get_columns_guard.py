"""DRC-3051: get_columns should raise RecceException when create_relation returns None."""

from unittest.mock import MagicMock

import pytest

from recce.adapter.dbt_adapter import DbtAdapter
from recce.exceptions import RecceException


class TestGetColumnsNoneGuard:

    def test_get_columns_raises_when_relation_is_none(self):
        """get_columns raises RecceException with 'does not exist' message when model not in manifest."""
        mock_adapter = MagicMock(spec=DbtAdapter)
        mock_adapter.create_relation = MagicMock(return_value=None)
        mock_adapter.get_columns = DbtAdapter.get_columns.__get__(mock_adapter)

        with pytest.raises(RecceException, match="does not exist in base environment"):
            mock_adapter.get_columns("nonexistent_model", base=True)

    def test_get_columns_raises_current_env_message(self):
        """Error message should say 'current' when base=False."""
        mock_adapter = MagicMock(spec=DbtAdapter)
        mock_adapter.create_relation = MagicMock(return_value=None)
        mock_adapter.get_columns = DbtAdapter.get_columns.__get__(mock_adapter)

        with pytest.raises(RecceException, match="does not exist in current environment"):
            mock_adapter.get_columns("nonexistent_model", base=False)
