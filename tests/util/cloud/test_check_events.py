"""
Unit tests for CheckEventsCloud client.

Tests the cloud API client for check event operations including
list, get, create, update, and delete operations.
"""

import unittest
from unittest.mock import MagicMock, patch

from recce.util.cloud.check_events import CheckEventsCloud


class TestCheckEventsCloud(unittest.TestCase):
    """Tests for CheckEventsCloud client."""

    def setUp(self):
        """Set up test fixtures."""
        self.token = "test-api-token"
        self.client = CheckEventsCloud(self.token)
        self.org_id = "org-123"
        self.project_id = "proj-456"
        self.session_id = "sess-789"
        self.check_id = "check-001"
        self.event_id = "event-001"

    def test_init_with_api_token(self):
        """Test initialization with API token."""
        client = CheckEventsCloud("test-api-token")
        self.assertEqual(client.token, "test-api-token")
        self.assertEqual(client.token_type, "api_token")

    def test_init_with_github_token(self):
        """Test initialization with GitHub token."""
        client = CheckEventsCloud("ghp_test123")
        self.assertEqual(client.token, "ghp_test123")
        self.assertEqual(client.token_type, "github_token")

    def test_init_with_none_token_raises(self):
        """Test initialization with None token raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            CheckEventsCloud(None)
        self.assertIn("Token cannot be None", str(ctx.exception))

    def test_build_events_url(self):
        """Test URL building for events endpoint."""
        url = self.client._build_events_url(self.org_id, self.project_id, self.session_id, self.check_id)
        expected = (
            f"{self.client.base_url_v2}/organizations/{self.org_id}"
            f"/projects/{self.project_id}/sessions/{self.session_id}"
            f"/checks/{self.check_id}/events"
        )
        self.assertEqual(url, expected)


class TestCheckEventsCloudListEvents(unittest.TestCase):
    """Tests for list_events method."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = CheckEventsCloud("test-token")
        self.org_id = "org-123"
        self.project_id = "proj-456"
        self.session_id = "sess-789"
        self.check_id = "check-001"

    @patch.object(CheckEventsCloud, "_request")
    @patch.object(CheckEventsCloud, "_raise_for_status")
    def test_list_events_success(self, mock_raise, mock_request):
        """Test successful list_events call."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "events": [
                {"id": "event-1", "event_type": "comment", "content": "Test"},
                {"id": "event-2", "event_type": "approval_change"},
            ]
        }
        mock_request.return_value = mock_response

        result = self.client.list_events(self.org_id, self.project_id, self.session_id, self.check_id)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["id"], "event-1")
        mock_request.assert_called_once()
        mock_raise.assert_called_once()

    @patch.object(CheckEventsCloud, "_request")
    @patch.object(CheckEventsCloud, "_raise_for_status")
    def test_list_events_empty(self, mock_raise, mock_request):
        """Test list_events with no events."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"events": []}
        mock_request.return_value = mock_response

        result = self.client.list_events(self.org_id, self.project_id, self.session_id, self.check_id)

        self.assertEqual(result, [])

    @patch.object(CheckEventsCloud, "_request")
    @patch.object(CheckEventsCloud, "_raise_for_status")
    def test_list_events_includes_deleted(self, mock_raise, mock_request):
        """Test that list_events includes deleted events."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"events": []}
        mock_request.return_value = mock_response

        self.client.list_events(self.org_id, self.project_id, self.session_id, self.check_id)

        # Verify include_deleted=True is passed
        call_args = mock_request.call_args
        self.assertIn("params", call_args.kwargs)
        self.assertTrue(call_args.kwargs["params"]["include_deleted"])


class TestCheckEventsCloudGetEvent(unittest.TestCase):
    """Tests for get_event method."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = CheckEventsCloud("test-token")
        self.org_id = "org-123"
        self.project_id = "proj-456"
        self.session_id = "sess-789"
        self.check_id = "check-001"
        self.event_id = "event-001"

    @patch.object(CheckEventsCloud, "_request")
    @patch.object(CheckEventsCloud, "_raise_for_status")
    def test_get_event_success(self, mock_raise, mock_request):
        """Test successful get_event call."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "event": {
                "id": self.event_id,
                "event_type": "comment",
                "content": "Test comment",
            }
        }
        mock_request.return_value = mock_response

        result = self.client.get_event(self.org_id, self.project_id, self.session_id, self.check_id, self.event_id)

        self.assertEqual(result["id"], self.event_id)
        self.assertEqual(result["content"], "Test comment")
        mock_request.assert_called_once_with("GET", unittest.mock.ANY)


class TestCheckEventsCloudCreateComment(unittest.TestCase):
    """Tests for create_comment method."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = CheckEventsCloud("test-token")
        self.org_id = "org-123"
        self.project_id = "proj-456"
        self.session_id = "sess-789"
        self.check_id = "check-001"

    @patch.object(CheckEventsCloud, "_request")
    @patch.object(CheckEventsCloud, "_raise_for_status")
    def test_create_comment_success(self, mock_raise, mock_request):
        """Test successful comment creation."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "event": {
                "id": "new-event-id",
                "event_type": "comment",
                "content": "New comment",
            }
        }
        mock_request.return_value = mock_response

        result = self.client.create_comment(self.org_id, self.project_id, self.session_id, self.check_id, "New comment")

        self.assertEqual(result["id"], "new-event-id")
        self.assertEqual(result["content"], "New comment")
        mock_request.assert_called_once_with(
            "POST", unittest.mock.ANY, json={"content": "New comment"}, acting_user_id=None
        )


class TestCheckEventsCloudUpdateComment(unittest.TestCase):
    """Tests for update_comment method."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = CheckEventsCloud("test-token")
        self.org_id = "org-123"
        self.project_id = "proj-456"
        self.session_id = "sess-789"
        self.check_id = "check-001"
        self.event_id = "event-001"

    @patch.object(CheckEventsCloud, "_request")
    @patch.object(CheckEventsCloud, "_raise_for_status")
    def test_update_comment_success(self, mock_raise, mock_request):
        """Test successful comment update."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "event": {
                "id": self.event_id,
                "event_type": "comment",
                "content": "Updated content",
                "is_edited": True,
            }
        }
        mock_request.return_value = mock_response

        result = self.client.update_comment(
            self.org_id,
            self.project_id,
            self.session_id,
            self.check_id,
            self.event_id,
            "Updated content",
        )

        self.assertEqual(result["content"], "Updated content")
        self.assertTrue(result["is_edited"])
        mock_request.assert_called_once_with(
            "PATCH", unittest.mock.ANY, json={"content": "Updated content"}, acting_user_id=None
        )


class TestCheckEventsCloudDeleteComment(unittest.TestCase):
    """Tests for delete_comment method."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = CheckEventsCloud("test-token")
        self.org_id = "org-123"
        self.project_id = "proj-456"
        self.session_id = "sess-789"
        self.check_id = "check-001"
        self.event_id = "event-001"

    @patch.object(CheckEventsCloud, "_request")
    @patch.object(CheckEventsCloud, "_raise_for_status")
    def test_delete_comment_success(self, mock_raise, mock_request):
        """Test successful comment deletion."""
        mock_response = MagicMock()
        mock_request.return_value = mock_response

        # Should not raise, returns None
        result = self.client.delete_comment(
            self.org_id,
            self.project_id,
            self.session_id,
            self.check_id,
            self.event_id,
        )

        self.assertIsNone(result)
        mock_request.assert_called_once_with("DELETE", unittest.mock.ANY)
        mock_raise.assert_called_once()


if __name__ == "__main__":
    unittest.main()
