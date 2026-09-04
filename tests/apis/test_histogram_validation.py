from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from recce.apis.check_api import (
    CreateCheckIn,
    PatchCheckIn,
    RunCheckIn,
    create_check,
    run_check_handler,
    update_check_handler,
)
from recce.apis.run_api import CreateRunIn, create_run_handler
from recce.models.types import Check, RunType

INVALID_HISTOGRAM_PARAMS = {
    "model": "customers",
    "column_name": "created_time",
    "column_type": "TIME(6) WITH TIME ZONE",
}
VALID_HISTOGRAM_PARAMS = {
    "model": "customers",
    "column_name": "customer_id",
    "column_type": "INTEGER",
}


def _histogram_check() -> Check:
    return Check(
        name="time histogram",
        type=RunType.HISTOGRAM_DIFF,
        params=INVALID_HISTOGRAM_PARAMS,
    )


@pytest.mark.asyncio
async def test_saved_check_create_rejects_time_alias_before_persistence():
    """Catch POST /checks persisting a time-only histogram definition."""
    check_dao = MagicMock()
    check_dao.create.return_value = _histogram_check()

    with (
        patch("recce.apis.check_func.CheckDAO", return_value=check_dao),
        patch("recce.apis.check_api.CheckOut.from_check", return_value=MagicMock()),
    ):
        with pytest.raises(HTTPException) as error:
            await create_check(
                CreateCheckIn(
                    name="time histogram",
                    type=RunType.HISTOGRAM_DIFF,
                    params=INVALID_HISTOGRAM_PARAMS,
                ),
                MagicMock(),
            )

    assert error.value.status_code == 400
    assert "not supported for histogram analysis" in error.value.detail
    check_dao.create.assert_not_called()


@pytest.mark.asyncio
async def test_saved_check_patch_rejects_time_alias_before_persistence():
    """Catch PATCH /checks replacing valid params with a time-only histogram."""
    check = Check(
        name="numeric histogram",
        type=RunType.HISTOGRAM_DIFF,
        params=VALID_HISTOGRAM_PARAMS,
    )
    check_dao = MagicMock()
    check_dao.find_check_by_id.return_value = check
    check_dao.update_check_by_id.return_value = check

    with (
        patch("recce.apis.check_api.CheckDAO", return_value=check_dao),
        patch("recce.apis.check_api.CheckOut.from_check", return_value=MagicMock()),
    ):
        with pytest.raises(HTTPException) as error:
            await update_check_handler(
                check.check_id,
                PatchCheckIn(params=INVALID_HISTOGRAM_PARAMS),
                MagicMock(),
            )

    assert error.value.status_code == 400
    assert "not supported for histogram analysis" in error.value.detail
    check_dao.update_check_by_id.assert_not_called()


@pytest.mark.asyncio
async def test_saved_check_rerun_rejects_time_alias_before_submission():
    """Catch a legacy invalid saved check being queued for warehouse execution."""
    check = _histogram_check()
    check_dao = MagicMock()
    check_dao.find_check_by_id.return_value = check

    with (
        patch("recce.apis.check_api.CheckDAO", return_value=check_dao),
        patch("recce.apis.check_api.submit_run", return_value=(MagicMock(), None)) as submit_run,
    ):
        with pytest.raises(HTTPException) as error:
            await run_check_handler(check.check_id, RunCheckIn(nowait=True))

    assert error.value.status_code == 400
    assert "not supported for histogram analysis" in error.value.detail
    submit_run.assert_not_called()


@pytest.mark.asyncio
async def test_direct_run_maps_histogram_validation_to_bad_request():
    """Catch direct invalid histogram parameters escaping the REST 400 boundary."""
    with patch(
        "recce.apis.run_api.submit_run",
        side_effect=ValueError("Column type TIME(6) is not supported for histogram analysis"),
    ):
        with pytest.raises(HTTPException) as error:
            await create_run_handler(
                CreateRunIn(
                    type="histogram_diff",
                    params=INVALID_HISTOGRAM_PARAMS,
                    nowait=True,
                )
            )

    assert error.value.status_code == 400
    assert "not supported for histogram analysis" in error.value.detail
