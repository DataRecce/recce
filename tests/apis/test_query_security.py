from unittest.mock import patch

import pytest

from recce.apis.run_api import list_run_handler, wait_run_handler
from recce.apis.run_security import QUERY_FAILURE_MESSAGE, public_run
from recce.models import Run, RunType
from recce.models.types import RunStatus


@pytest.mark.asyncio
async def test_legacy_query_error_hidden_from_run_apis():
    marker = "FAKE_CREDENTIAL_MARKER"
    run = Run(type=RunType.QUERY, params={"sql_template": "select 1"}, status=RunStatus.FAILED, error=marker)
    with patch("recce.apis.run_api.RunDAO") as dao:
        dao.return_value.find_run_by_id.return_value = run
        dao.return_value.list.return_value = [run]
        detail = await wait_run_handler(run.run_id, timeout=1)
        listed = await list_run_handler()
    assert detail.error == QUERY_FAILURE_MESSAGE
    assert listed[0]["error"] == QUERY_FAILURE_MESSAGE
    assert run.error == marker  # Response redaction must not mutate stored state.


def test_non_query_error_is_preserved():
    run = Run(type=RunType.VALUE_DIFF, params={}, status=RunStatus.FAILED, error="Column not found")
    assert public_run(run).error == "Column not found"
