"""
Unit tests for check_api outdated check logic.

Tests _is_check_outdated(), _get_latest_artifact_time(), and CheckOut.from_check().
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException

from recce.apis.check_api import (
    CheckOut,
    CreateCheckIn,
    PatchCheckIn,
    RunCheckIn,
    _get_latest_artifact_time,
    _is_check_outdated,
    create_check,
    delete_handler,
    get_check_handler,
    list_checks_handler,
    mark_as_preset_check_handler,
    run_check_handler,
    update_check_handler,
)
from recce.models.types import Check, Run, RunType
from recce.util.recce_cloud import RecceCloudException


def run_async(coro):
    """Helper to run async functions in sync tests."""
    import asyncio

    return asyncio.get_event_loop().run_until_complete(coro)


def _make_run(run_at: str = "2026-03-20T10:00:00Z") -> Run:
    return Run(type=RunType.QUERY, run_at=run_at)


def _make_check(**kwargs) -> Check:
    defaults = dict(
        check_id=uuid4(),
        name="test check",
        description="desc",
        type=RunType.QUERY,
    )
    defaults.update(kwargs)
    return Check(**defaults)


class TestIsCheckOutdated(unittest.TestCase):
    """Tests for _is_check_outdated pure logic."""

    def test_no_last_run_returns_false(self):
        result = _is_check_outdated(None, datetime(2026, 3, 20, tzinfo=timezone.utc))
        self.assertFalse(result)

    def test_no_artifact_time_returns_false(self):
        run = _make_run()
        result = _is_check_outdated(run, None)
        self.assertFalse(result)

    def test_both_none_returns_false(self):
        result = _is_check_outdated(None, None)
        self.assertFalse(result)

    def test_artifact_newer_than_run_is_outdated(self):
        run = _make_run("2026-03-20T10:00:00Z")
        artifact_time = datetime(2026, 3, 20, 12, 0, 0, tzinfo=timezone.utc)
        self.assertTrue(_is_check_outdated(run, artifact_time))

    def test_artifact_older_than_run_is_not_outdated(self):
        run = _make_run("2026-03-20T12:00:00Z")
        artifact_time = datetime(2026, 3, 20, 10, 0, 0, tzinfo=timezone.utc)
        self.assertFalse(_is_check_outdated(run, artifact_time))

    def test_artifact_equal_to_run_is_not_outdated(self):
        run = _make_run("2026-03-20T10:00:00Z")
        artifact_time = datetime(2026, 3, 20, 10, 0, 0, tzinfo=timezone.utc)
        self.assertFalse(_is_check_outdated(run, artifact_time))

    def test_naive_artifact_time_treated_as_utc(self):
        run = _make_run("2026-03-20T10:00:00Z")
        artifact_time = datetime(2026, 3, 20, 12, 0, 0)  # naive
        self.assertTrue(_is_check_outdated(run, artifact_time))

    def test_invalid_run_at_format_returns_false(self):
        run = _make_run("not-a-date")
        artifact_time = datetime(2026, 3, 20, 12, 0, 0, tzinfo=timezone.utc)
        self.assertFalse(_is_check_outdated(run, artifact_time))

    def test_run_at_empty_string_returns_false(self):
        run = _make_run("")
        artifact_time = datetime(2026, 3, 20, 12, 0, 0, tzinfo=timezone.utc)
        self.assertFalse(_is_check_outdated(run, artifact_time))


class TestGetLatestArtifactTime(unittest.TestCase):
    """Tests for _get_latest_artifact_time with mocked context."""

    @patch("recce.apis.check_api.default_context")
    def test_returns_max_of_both_manifests(self, mock_default_context):
        base_time = datetime(2026, 3, 20, 10, 0, 0, tzinfo=timezone.utc)
        curr_time = datetime(2026, 3, 20, 12, 0, 0, tzinfo=timezone.utc)

        adapter = MagicMock()
        adapter.base_manifest.metadata.generated_at = base_time
        adapter.curr_manifest.metadata.generated_at = curr_time
        mock_default_context.return_value.adapter = adapter

        result = _get_latest_artifact_time()
        self.assertEqual(result, curr_time)

    @patch("recce.apis.check_api.default_context")
    def test_returns_base_when_only_base_has_manifest(self, mock_default_context):
        base_time = datetime(2026, 3, 20, 10, 0, 0, tzinfo=timezone.utc)

        adapter = MagicMock()
        adapter.base_manifest.metadata.generated_at = base_time
        adapter.curr_manifest = None
        mock_default_context.return_value.adapter = adapter

        result = _get_latest_artifact_time()
        self.assertEqual(result, base_time)

    @patch("recce.apis.check_api.default_context")
    def test_returns_none_when_context_is_none(self, mock_default_context):
        mock_default_context.return_value = None

        result = _get_latest_artifact_time()
        self.assertIsNone(result)

    @patch("recce.apis.check_api.default_context")
    def test_returns_none_when_no_manifests(self, mock_default_context):
        adapter = MagicMock(spec=[])  # no attributes
        mock_default_context.return_value.adapter = adapter

        result = _get_latest_artifact_time()
        self.assertIsNone(result)

    @patch("recce.apis.check_api.default_context")
    def test_returns_none_when_generated_at_not_datetime(self, mock_default_context):
        adapter = MagicMock()
        adapter.base_manifest.metadata.generated_at = "not-a-datetime"
        adapter.curr_manifest.metadata.generated_at = "also-not"
        mock_default_context.return_value.adapter = adapter

        result = _get_latest_artifact_time()
        self.assertIsNone(result)

    @patch("recce.apis.check_api.default_context", side_effect=AttributeError("no adapter"))
    def test_returns_none_on_attribute_error(self, mock_default_context):
        result = _get_latest_artifact_time()
        self.assertIsNone(result)


class TestCheckOutFromCheck(unittest.TestCase):
    """Tests for CheckOut.from_check classmethod with outdated logic."""

    @patch("recce.apis.check_api.RunDAO")
    @patch("recce.apis.check_api._get_latest_artifact_time")
    def test_check_with_no_runs_not_outdated(self, mock_artifact_time, mock_run_dao_cls):
        mock_artifact_time.return_value = datetime(2026, 3, 20, 12, 0, 0, tzinfo=timezone.utc)
        mock_run_dao_cls.return_value.list_by_check_id.return_value = []

        check = _make_check()
        out = CheckOut.from_check(check)

        self.assertFalse(out.is_outdated)
        self.assertIsNone(out.last_run)

    @patch("recce.apis.check_api.RunDAO")
    @patch("recce.apis.check_api._get_latest_artifact_time")
    def test_check_with_old_run_is_outdated(self, mock_artifact_time, mock_run_dao_cls):
        mock_artifact_time.return_value = datetime(2026, 3, 20, 12, 0, 0, tzinfo=timezone.utc)
        run = _make_run("2026-03-20T10:00:00Z")
        mock_run_dao_cls.return_value.list_by_check_id.return_value = [run]

        check = _make_check()
        out = CheckOut.from_check(check)

        self.assertTrue(out.is_outdated)
        self.assertEqual(out.last_run, run)

    @patch("recce.apis.check_api.RunDAO")
    @patch("recce.apis.check_api._get_latest_artifact_time")
    def test_check_with_recent_run_not_outdated(self, mock_artifact_time, mock_run_dao_cls):
        mock_artifact_time.return_value = datetime(2026, 3, 20, 10, 0, 0, tzinfo=timezone.utc)
        run = _make_run("2026-03-20T12:00:00Z")
        mock_run_dao_cls.return_value.list_by_check_id.return_value = [run]

        check = _make_check()
        out = CheckOut.from_check(check)

        self.assertFalse(out.is_outdated)

    @patch("recce.apis.check_api.RunDAO")
    def test_explicit_artifact_time_skips_lookup(self, mock_run_dao_cls):
        mock_run_dao_cls.return_value.list_by_check_id.return_value = []
        artifact_time = datetime(2026, 3, 20, 12, 0, 0, tzinfo=timezone.utc)

        check = _make_check()
        out = CheckOut.from_check(check, artifact_time=artifact_time)

        self.assertFalse(out.is_outdated)

    @patch("recce.apis.check_api.RunDAO")
    def test_from_check_preserves_check_fields(self, mock_run_dao_cls):
        mock_run_dao_cls.return_value.list_by_check_id.return_value = []

        check = _make_check(
            name="my check",
            description="my desc",
            is_checked=True,
            is_preset=True,
        )
        out = CheckOut.from_check(check, artifact_time=None)

        self.assertEqual(out.name, "my check")
        self.assertEqual(out.description, "my desc")
        self.assertTrue(out.is_checked)
        self.assertTrue(out.is_preset)
        self.assertEqual(out.check_id, check.check_id)


class TestCheckApiCloudExceptionPassthrough(unittest.TestCase):
    """Tests that check API endpoints pass through RecceCloudException status codes.

    DRC-3200: When Recce Cloud returns 403 (or any error), the OSS proxy
    must return that same status code to the browser, not 500.
    """

    @patch("recce.apis.check_func.get_current_cloud_user")
    @patch("recce.apis.check_func.CheckDAO")
    def test_create_check_returns_403_on_cloud_forbidden(self, mock_dao_cls, mock_get_cloud_user):
        """POST /checks should return 403 when cloud API returns 403."""
        mock_get_cloud_user.return_value = None
        mock_dao_instance = MagicMock()
        mock_dao_instance.create.side_effect = RecceCloudException(
            message="Forbidden", reason="Viewer cannot create checks", status_code=403
        )
        mock_dao_cls.return_value = mock_dao_instance

        check_in = CreateCheckIn(
            name="Test Check",
            type=RunType.SCHEMA_DIFF,
            params={"node_id": "model.test.users"},
        )
        background_tasks = MagicMock()

        with self.assertRaises(HTTPException) as ctx:
            run_async(create_check(check_in, background_tasks))

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_api.export_persistent_state")
    @patch("recce.apis.check_api.CheckDAO")
    def test_update_check_returns_403_on_cloud_forbidden(self, mock_dao_cls, mock_export):
        """PATCH /checks/{id} should return 403 when cloud API returns 403."""
        mock_dao_instance = MagicMock()
        mock_dao_instance.update_check_by_id.side_effect = RecceCloudException(
            message="Forbidden", reason="Viewer cannot update checks", status_code=403
        )
        mock_dao_cls.return_value = mock_dao_instance

        patch_in = PatchCheckIn(name="Updated")
        background_tasks = MagicMock()

        with self.assertRaises(HTTPException) as ctx:
            run_async(update_check_handler(uuid4(), patch_in, background_tasks))

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_api.export_persistent_state")
    @patch("recce.apis.check_api.CheckDAO")
    def test_delete_check_returns_403_on_cloud_forbidden(self, mock_dao_cls, mock_export):
        """DELETE /checks/{id} should return 403 when cloud API returns 403."""
        mock_dao_instance = MagicMock()
        mock_dao_instance.delete.side_effect = RecceCloudException(
            message="Forbidden", reason="Viewer cannot delete checks", status_code=403
        )
        mock_dao_cls.return_value = mock_dao_instance

        background_tasks = MagicMock()

        with self.assertRaises(HTTPException) as ctx:
            run_async(delete_handler(uuid4(), background_tasks))

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_api.export_persistent_state")
    @patch("recce.apis.check_api.CheckDAO")
    def test_mark_as_preset_returns_403_on_cloud_forbidden(self, mock_dao_cls, mock_export):
        """POST /checks/{id}/mark-as-preset should return 403 when cloud API returns 403."""
        mock_dao_instance = MagicMock()
        mock_dao_instance.mark_as_preset_check.side_effect = RecceCloudException(
            message="Forbidden", reason="Viewer cannot create presets", status_code=403
        )
        mock_dao_cls.return_value = mock_dao_instance

        background_tasks = MagicMock()

        with self.assertRaises(HTTPException) as ctx:
            run_async(mark_as_preset_check_handler(uuid4(), background_tasks))

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_api.CheckDAO")
    def test_get_check_returns_403_on_cloud_forbidden(self, mock_dao_cls):
        """GET /checks/{id} should return 403 when cloud API returns 403."""
        mock_dao_instance = MagicMock()
        mock_dao_instance.find_check_by_id.side_effect = RecceCloudException(
            message="Forbidden", reason="Viewer cannot access check", status_code=403
        )
        mock_dao_cls.return_value = mock_dao_instance

        with self.assertRaises(HTTPException) as ctx:
            run_async(get_check_handler(uuid4()))

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_api.CheckDAO")
    def test_list_checks_returns_403_on_cloud_forbidden(self, mock_dao_cls):
        """GET /checks should return 403 when cloud API returns 403."""
        mock_dao_instance = MagicMock()
        mock_dao_instance.list.side_effect = RecceCloudException(
            message="Forbidden", reason="Viewer cannot list checks", status_code=403
        )
        mock_dao_cls.return_value = mock_dao_instance

        with self.assertRaises(HTTPException) as ctx:
            run_async(list_checks_handler())

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_api.CheckDAO")
    def test_run_check_returns_403_on_cloud_forbidden(self, mock_dao_cls):
        """POST /checks/{id}/run should return 403 when cloud API returns 403 on find."""
        mock_dao_instance = MagicMock()
        mock_dao_instance.find_check_by_id.side_effect = RecceCloudException(
            message="Forbidden", reason="Viewer cannot access check", status_code=403
        )
        mock_dao_cls.return_value = mock_dao_instance

        run_in = RunCheckIn(nowait=True)

        with self.assertRaises(HTTPException) as ctx:
            run_async(run_check_handler(uuid4(), run_in))

        self.assertEqual(ctx.exception.status_code, 403)
