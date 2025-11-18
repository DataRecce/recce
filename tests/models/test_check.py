"""
Tests for refactored CheckDAO with cloud integration.

Follows unittest.TestCase patterns as used in tests/state/test_cloud.py
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from uuid import uuid4

from recce.exceptions import RecceException
from recce.models.check import CheckDAO
from recce.models.types import Check, RunType


class TestCheckDAOLocalMode(unittest.TestCase):
    """Tests for CheckDAO in local mode (non-cloud)."""

    @patch("recce.core.default_context")
    def test_is_cloud_user_false_no_state_loader(self, mock_default_context):
        """Test is_cloud_user returns False when no state_loader."""
        # Setup
        mock_context = Mock()
        mock_context.checks = []
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()

        # Verify
        self.assertFalse(dao.is_cloud_user)

    @patch("recce.core.default_context")
    def test_is_cloud_user_false_no_session_id(self, mock_default_context):
        """Test is_cloud_user returns False when session_id is None."""
        # Setup
        mock_context = Mock()
        mock_context.checks = []
        mock_context.state_loader = Mock()
        mock_context.state_loader.session_id = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()

        # Verify
        self.assertFalse(dao.is_cloud_user)

    @patch("recce.core.default_context")
    def test_create_local(self, mock_default_context):
        """Test creating a check in local mode."""
        # Setup
        mock_context = Mock()
        mock_context.checks = []
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        sample_check = Check(
            check_id=uuid4(),
            name="Test Check",
            description="Test Description",
            type=RunType.SCHEMA_DIFF,
            params={"model": "customers"},
            view_options={"expanded": True},
        )

        # Execute
        dao = CheckDAO()
        dao.create(sample_check)

        # Verify
        self.assertEqual(len(mock_context.checks), 1)
        self.assertEqual(mock_context.checks[0], sample_check)

    @patch("recce.core.default_context")
    def test_find_check_by_id_local(self, mock_default_context):
        """Test finding a check by ID in local mode."""
        # Setup
        sample_check = Check(
            check_id=uuid4(),
            name="Test Check",
            type=RunType.SCHEMA_DIFF,
            params={},
        )
        mock_context = Mock()
        mock_context.checks = [sample_check]
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        found = dao.find_check_by_id(sample_check.check_id)

        # Verify
        self.assertEqual(found, sample_check)

    @patch("recce.core.default_context")
    def test_find_check_by_id_not_found_local(self, mock_default_context):
        """Test finding a non-existent check in local mode."""
        # Setup
        mock_context = Mock()
        mock_context.checks = []
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        found = dao.find_check_by_id(uuid4())

        # Verify
        self.assertIsNone(found)

    @patch("recce.core.default_context")
    def test_delete_local(self, mock_default_context):
        """Test deleting a check in local mode."""
        # Setup
        sample_check = Check(
            check_id=uuid4(),
            name="Test Check",
            type=RunType.SCHEMA_DIFF,
            params={},
        )
        mock_context = Mock()
        mock_context.checks = [sample_check]
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        result = dao.delete(sample_check.check_id)

        # Verify
        self.assertTrue(result)
        self.assertEqual(len(mock_context.checks), 0)

    @patch("recce.core.default_context")
    def test_delete_not_found_local(self, mock_default_context):
        """Test deleting a non-existent check in local mode."""
        # Setup
        mock_context = Mock()
        mock_context.checks = []
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        result = dao.delete(uuid4())

        # Verify
        self.assertFalse(result)

    @patch("recce.core.default_context")
    def test_list_local(self, mock_default_context):
        """Test listing checks in local mode."""
        # Setup
        check1 = Check(name="Check 1", type=RunType.SCHEMA_DIFF, params={})
        check2 = Check(name="Check 2", type=RunType.VALUE_DIFF, params={})
        mock_context = Mock()
        mock_context.checks = [check1, check2]
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        checks = dao.list()

        # Verify
        self.assertEqual(len(checks), 2)
        self.assertEqual(checks[0], check1)
        self.assertEqual(checks[1], check2)

    @patch("recce.core.default_context")
    def test_reorder_local(self, mock_default_context):
        """Test reordering checks in local mode."""
        # Setup
        check1 = Check(name="Check 1", type=RunType.SCHEMA_DIFF, params={})
        check2 = Check(name="Check 2", type=RunType.VALUE_DIFF, params={})
        check3 = Check(name="Check 3", type=RunType.QUERY_DIFF, params={})
        mock_context = Mock()
        mock_context.checks = [check1, check2, check3]
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        dao.reorder(0, 2)

        # Verify
        self.assertEqual(mock_context.checks[0], check2)
        self.assertEqual(mock_context.checks[1], check3)
        self.assertEqual(mock_context.checks[2], check1)

    @patch("recce.core.default_context")
    def test_reorder_out_of_range_local(self, mock_default_context):
        """Test reordering with invalid indices in local mode."""
        # Setup
        sample_check = Check(name="Check 1", type=RunType.SCHEMA_DIFF, params={})
        mock_context = Mock()
        mock_context.checks = [sample_check]
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute & Verify
        dao = CheckDAO()
        with self.assertRaisesRegex(RecceException, "Source index out of range"):
            dao.reorder(5, 0)

        with self.assertRaisesRegex(RecceException, "Destination index out of range"):
            dao.reorder(0, 5)

    @patch("recce.core.default_context")
    def test_clear_local(self, mock_default_context):
        """Test clearing checks in local mode."""
        # Setup
        sample_check = Check(name="Check 1", type=RunType.SCHEMA_DIFF, params={})
        mock_context = Mock()
        mock_context.checks = [sample_check]
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        dao.clear()

        # Verify
        self.assertEqual(len(mock_context.checks), 0)

    @patch("recce.core.default_context")
    def test_status_local(self, mock_default_context):
        """Test getting check status in local mode."""
        # Setup
        check1 = Check(name="Check 1", type=RunType.SCHEMA_DIFF, params={}, is_checked=True)
        check2 = Check(name="Check 2", type=RunType.VALUE_DIFF, params={}, is_checked=False)
        check3 = Check(name="Check 3", type=RunType.QUERY_DIFF, params={}, is_checked=True)
        mock_context = Mock()
        mock_context.checks = [check1, check2, check3]
        mock_context.state_loader = None
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        status = dao.status()

        # Verify
        self.assertEqual(status["total"], 3)
        self.assertEqual(status["approved"], 2)


class TestCheckDAOCloudMode(unittest.TestCase):
    """Tests for CheckDAO in cloud mode."""

    @patch("recce.core.default_context")
    def test_is_cloud_user_true(self, mock_default_context):
        """Test is_cloud_user returns True when session_id exists."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = "test-session-123"
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()

        # Verify
        self.assertTrue(dao.is_cloud_user)

    @patch("recce.core.default_context")
    def test_get_session_info_from_loader(self, mock_default_context):
        """Test getting session info from state_loader attributes."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = "test-session-123"
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        # Execute
        dao = CheckDAO()
        org_id, project_id, session_id = dao._get_session_info()

        # Verify
        self.assertEqual(org_id, "org-456")
        self.assertEqual(project_id, "proj-789")
        self.assertEqual(session_id, "test-session-123")

    @patch("recce.util.recce_cloud.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="test-token")
    @patch("recce.core.default_context")
    def test_get_session_info_from_api(self, mock_default_context, mock_get_token, mock_recce_cloud_class):
        """Test getting session info from API when not in loader."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = "test-session-123"
        mock_loader.org_id = "org-999"
        mock_loader.project_id = "proj-888"
        # Don't set org_id and project_id attributes

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        mock_recce_cloud = Mock()
        mock_recce_cloud_class.return_value = mock_recce_cloud

        # Execute
        dao = CheckDAO()
        org_id, project_id, session_id = dao._get_session_info()

        # Verify
        self.assertEqual(org_id, "org-999")
        self.assertEqual(project_id, "proj-888")
        self.assertEqual(session_id, "test-session-123")

        # Verify info is cached on loader
        self.assertEqual(mock_loader.org_id, "org-999")
        self.assertEqual(mock_loader.project_id, "proj-888")

    @patch("recce.util.recce_cloud.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="test-token")
    @patch("recce.core.default_context")
    def test_create_cloud(self, mock_default_context, mock_get_token, mock_recce_cloud_class):
        """Test creating a check in cloud mode."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = "test-session-123"
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        mock_cloud_client = Mock()
        mock_recce_cloud = Mock()
        mock_recce_cloud.checks = mock_cloud_client
        mock_recce_cloud_class.return_value = mock_recce_cloud

        sample_check = Check(
            session_id=uuid4(),
            name="Test Check",
            description="Test Description",
            type=RunType.SCHEMA_DIFF,
            params={"model": "customers"},
        )

        # Execute
        dao = CheckDAO()
        dao.create(sample_check)

        # Verify
        mock_cloud_client.create_check.assert_called_once()
        call_args = mock_cloud_client.create_check.call_args
        self.assertEqual(call_args[0][0], "org-456")
        self.assertEqual(call_args[0][1], "proj-789")
        self.assertEqual(call_args[0][2], "test-session-123")

        check_data = call_args[0][3]
        self.assertEqual(check_data["name"], "Test Check")
        self.assertEqual(check_data["type"], "schema_diff")

    @patch("recce.util.recce_cloud.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="test-token")
    @patch("recce.core.default_context")
    def test_find_check_by_id_cloud(self, mock_default_context, mock_get_token, mock_recce_cloud_class):
        """Test finding a check by ID in cloud mode."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = uuid4()
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        check_id = uuid4()
        cloud_check_data = {
            "id": str(check_id),
            "session_id": str(mock_loader.session_id),
            "name": "Cloud Check",
            "description": "From cloud",
            "type": "schema_diff",
            "params": {"model": "users"},
            "view_options": {},
            "is_checked": True,
            "is_preset": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        mock_cloud_client = Mock()
        mock_cloud_client.get_check.return_value = cloud_check_data
        mock_recce_cloud = Mock()
        mock_recce_cloud.checks = mock_cloud_client
        mock_recce_cloud_class.return_value = mock_recce_cloud

        # Execute
        dao = CheckDAO()
        check = dao.find_check_by_id(check_id)

        # Verify
        self.assertIsNotNone(check)
        self.assertEqual(check.name, "Cloud Check")
        self.assertEqual(check.type, RunType.SCHEMA_DIFF)
        self.assertTrue(check.is_checked)

    @patch("recce.util.recce_cloud.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="test-token")
    @patch("recce.core.default_context")
    def test_delete_cloud(self, mock_default_context, mock_get_token, mock_recce_cloud_class):
        """Test deleting a check in cloud mode."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = "test-session-123"
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        mock_cloud_client = Mock()
        mock_recce_cloud = Mock()
        mock_recce_cloud.checks = mock_cloud_client
        mock_recce_cloud_class.return_value = mock_recce_cloud

        check_id = uuid4()

        # Execute
        dao = CheckDAO()
        result = dao.delete(check_id)

        # Verify
        self.assertTrue(result)
        mock_cloud_client.delete_check.assert_called_once_with("org-456", "proj-789", "test-session-123", str(check_id))

    @patch("recce.util.recce_cloud.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="test-token")
    @patch("recce.core.default_context")
    def test_list_cloud(self, mock_default_context, mock_get_token, mock_recce_cloud_class):
        """Test listing checks in cloud mode."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = str(uuid4())
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        cloud_checks = [
            {
                "id": str(uuid4()),
                "session_id": mock_loader.session_id,
                "name": "Check 1",
                "description": "",
                "type": "schema_diff",
                "params": {},
                "view_options": {},
                "is_checked": False,
                "is_preset": False,
                "created_by": "test-user",
                "updated_by": "test-user",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid4()),
                "session_id": mock_loader.session_id,
                "name": "Check 2",
                "description": "",
                "type": "value_diff",
                "params": {},
                "view_options": {},
                "is_checked": True,
                "is_preset": False,
                "created_by": "test-user",
                "updated_by": "test-user",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        ]

        mock_cloud_client = Mock()
        mock_cloud_client.list_checks.return_value = cloud_checks
        mock_recce_cloud = Mock()
        mock_recce_cloud.checks = mock_cloud_client
        mock_recce_cloud_class.return_value = mock_recce_cloud

        # Execute
        dao = CheckDAO()
        checks = dao.list()

        # Verify
        self.assertEqual(len(checks), 2)
        self.assertEqual(checks[0].name, "Check 1")
        self.assertEqual(checks[1].name, "Check 2")
        self.assertTrue(checks[1].is_checked)

    @patch("recce.core.default_context")
    def test_reorder_cloud_raises_exception(self, mock_default_context):
        """Test that reordering raises exception in cloud mode."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = "test-session-123"
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        # Execute & Verify
        dao = CheckDAO()
        with self.assertRaisesRegex(RecceException, "not supported in cloud mode"):
            dao.reorder(0, 1)

    @patch("recce.core.default_context")
    def test_clear_cloud_no_op(self, mock_default_context):
        """Test that clear is a no-op in cloud mode."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = "test-session-123"
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        # Execute (should not raise exception)
        dao = CheckDAO()
        dao.clear()

        # Verify - no exception raised

    @patch("recce.util.recce_cloud.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="test-token")
    @patch("recce.core.default_context")
    def test_status_cloud(self, mock_default_context, mock_get_token, mock_recce_cloud_class):
        """Test getting status in cloud mode."""
        # Setup
        mock_loader = Mock()
        mock_loader.session_id = str(uuid4())
        mock_loader.org_id = "org-456"
        mock_loader.project_id = "proj-789"

        mock_context = Mock()
        mock_context.state_loader = mock_loader
        mock_default_context.return_value = mock_context

        cloud_checks = [
            {
                "id": str(uuid4()),
                "session_id": mock_loader.session_id,
                "name": "C1",
                "type": "schema_diff",
                "is_checked": True,
                "params": {},
                "view_options": {},
                "description": "",
                "is_preset": False,
                "created_by": "test-user",
                "updated_by": "test-user",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid4()),
                "session_id": mock_loader.session_id,
                "name": "C2",
                "type": "value_diff",
                "is_checked": False,
                "params": {},
                "view_options": {},
                "description": "",
                "is_preset": False,
                "created_by": "test-user",
                "updated_by": "test-user",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid4()),
                "session_id": mock_loader.session_id,
                "name": "C3",
                "type": "query_diff",
                "is_checked": True,
                "params": {},
                "view_options": {},
                "description": "",
                "is_preset": False,
                "created_by": "test-user",
                "updated_by": "test-user",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        ]

        mock_cloud_client = Mock()
        mock_cloud_client.list_checks.return_value = cloud_checks
        mock_recce_cloud = Mock()
        mock_recce_cloud.checks = mock_cloud_client
        mock_recce_cloud_class.return_value = mock_recce_cloud

        # Execute
        dao = CheckDAO()
        status = dao.status()

        # Verify
        self.assertEqual(status["total"], 3)
        self.assertEqual(status["approved"], 2)


class TestCheckDAODataTransformation(unittest.TestCase):
    """Test data transformation between local and cloud formats."""

    def test_check_to_cloud_format(self):
        """Test converting Check to cloud format."""
        # Setup
        sample_check = Check(
            session_id=uuid4(),
            name="Test Check",
            description="Test Description",
            type=RunType.SCHEMA_DIFF,
            params={"model": "customers"},
            view_options={"expanded": True},
        )

        # Execute
        dao = CheckDAO()
        cloud_data = dao._check_to_cloud_format(sample_check)

        # Verify
        self.assertEqual(str(cloud_data["session_id"]), str(sample_check.session_id))
        self.assertEqual(cloud_data["name"], "Test Check")
        self.assertEqual(cloud_data["description"], "Test Description")
        self.assertEqual(cloud_data["type"], "schema_diff")
        self.assertEqual(cloud_data["params"], {"model": "customers"})
        self.assertEqual(cloud_data["view_options"], {"expanded": True})
        self.assertFalse(cloud_data["is_checked"])
        self.assertFalse(cloud_data["is_preset"])

    def test_cloud_to_check(self):
        """Test converting cloud data to Check."""
        # Setup
        check_id = uuid4()
        session_id = uuid4()
        cloud_data = {
            "id": str(check_id),
            "session_id": str(session_id),
            "name": "Cloud Check",
            "description": "From API",
            "type": "value_diff",
            "params": {"column": "amount"},
            "view_options": {"show_diff": True},
            "is_checked": True,
            "is_preset": False,
            "created_by": "test-user",
            "updated_by": "test-user",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Execute
        dao = CheckDAO()
        check = dao._cloud_to_check(cloud_data)

        # Verify
        self.assertEqual(str(check.check_id), str(check_id))
        self.assertEqual(str(check.session_id), str(session_id))
        self.assertEqual(check.name, "Cloud Check")
        self.assertEqual(check.description, "From API")
        self.assertEqual(check.type, RunType.VALUE_DIFF)
        self.assertEqual(check.params, {"column": "amount"})
        self.assertEqual(check.view_options, {"show_diff": True})
        self.assertTrue(check.is_checked)
        self.assertFalse(check.is_preset)
        self.assertIsNotNone(check.created_at)
        self.assertIsNotNone(check.updated_at)


if __name__ == "__main__":
    unittest.main()
