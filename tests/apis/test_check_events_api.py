"""
Unit tests for check_events_api endpoints.

Tests the FastAPI router endpoints for check events, including
list, get, create, update, and delete operations.
"""

import asyncio
import unittest
from unittest.mock import MagicMock, patch
from uuid import UUID

from fastapi import HTTPException

from recce.apis.check_events_api import (
    CreateCommentIn,
    UpdateCommentIn,
    _get_events_client,
    _get_session_info,
    _is_cloud_user,
    create_comment,
    delete_comment,
    get_check_event,
    list_check_events,
    update_comment,
)
from recce.exceptions import RecceException
from recce.util.recce_cloud import RecceCloudException


def run_async(coro):
    """Helper to run async functions in sync tests."""
    return asyncio.get_event_loop().run_until_complete(coro)


class TestIsCloudUser(unittest.TestCase):
    """Tests for _is_cloud_user helper function."""

    @patch("recce.apis.check_events_api.default_context")
    def test_is_cloud_user_true(self, mock_context):
        """Test _is_cloud_user returns True when session_id exists."""
        mock_ctx = MagicMock()
        mock_ctx.state_loader.session_id = "test-session-id"
        mock_context.return_value = mock_ctx

        result = _is_cloud_user()

        self.assertTrue(result)

    @patch("recce.apis.check_events_api.default_context")
    def test_is_cloud_user_false_no_session(self, mock_context):
        """Test _is_cloud_user returns False when session_id is None."""
        mock_ctx = MagicMock()
        mock_ctx.state_loader.session_id = None
        mock_context.return_value = mock_ctx

        result = _is_cloud_user()

        self.assertFalse(result)

    @patch("recce.apis.check_events_api.default_context")
    def test_is_cloud_user_false_no_context(self, mock_context):
        """Test _is_cloud_user returns False when context is None."""
        mock_context.return_value = None

        result = _is_cloud_user()

        self.assertFalse(result)

    @patch("recce.apis.check_events_api.default_context")
    def test_is_cloud_user_false_no_state_loader(self, mock_context):
        """Test _is_cloud_user returns False when state_loader is None."""
        mock_ctx = MagicMock()
        mock_ctx.state_loader = None
        mock_context.return_value = mock_ctx

        result = _is_cloud_user()

        self.assertFalse(result)

    @patch("recce.apis.check_events_api.default_context")
    def test_is_cloud_user_false_no_session_id_attr(self, mock_context):
        """Test _is_cloud_user returns False when session_id attr doesn't exist."""
        mock_ctx = MagicMock(spec=[])
        mock_ctx.state_loader = MagicMock(spec=[])
        mock_context.return_value = mock_ctx

        result = _is_cloud_user()

        self.assertFalse(result)


class TestGetSessionInfo(unittest.TestCase):
    """Tests for _get_session_info helper function."""

    @patch("recce.apis.check_events_api._is_cloud_user")
    def test_get_session_info_not_cloud_user(self, mock_is_cloud):
        """Test _get_session_info raises 400 when not cloud user."""
        mock_is_cloud.return_value = False

        with self.assertRaises(HTTPException) as ctx:
            _get_session_info()

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("only available when connected to Recce Cloud", ctx.exception.detail)

    @patch("recce.apis.check_events_api.RecceCloud")
    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    @patch("recce.apis.check_events_api._is_cloud_user")
    def test_get_session_info_cached(self, mock_is_cloud, mock_context, mock_get_token, mock_recce_cloud):
        """Test _get_session_info returns cached values when available."""
        mock_is_cloud.return_value = True
        mock_ctx = MagicMock()
        mock_ctx.state_loader.session_id = "sess-123"
        mock_ctx.state_loader.org_id = "org-cached"
        mock_ctx.state_loader.project_id = "proj-cached"
        mock_context.return_value = mock_ctx

        result = _get_session_info()

        self.assertEqual(result, ("org-cached", "proj-cached", "sess-123"))
        mock_recce_cloud.assert_not_called()

    @patch("recce.apis.check_events_api.RecceCloud")
    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    @patch("recce.apis.check_events_api._is_cloud_user")
    def test_get_session_info_fetches_from_cloud(self, mock_is_cloud, mock_context, mock_get_token, mock_recce_cloud):
        """Test _get_session_info fetches from cloud when not cached."""
        mock_is_cloud.return_value = True

        # Use spec=[] to create a mock with NO auto-created attributes
        mock_state_loader = MagicMock(spec=[])
        mock_state_loader.session_id = "sess-123"
        mock_state_loader.token = "test-token"
        # org_id and project_id are NOT set, so hasattr() returns False

        mock_ctx = MagicMock()
        mock_ctx.state_loader = mock_state_loader
        mock_context.return_value = mock_ctx
        mock_get_token.return_value = "test-token"

        mock_cloud_instance = MagicMock()
        mock_cloud_instance.get_session.return_value = {
            "org_id": "org-fetched",
            "project_id": "proj-fetched",
        }
        mock_recce_cloud.return_value = mock_cloud_instance

        result = _get_session_info()

        self.assertEqual(result[0], "org-fetched")
        self.assertEqual(result[1], "proj-fetched")
        self.assertEqual(result[2], "sess-123")
        # Verify values were cached on state_loader
        self.assertEqual(mock_state_loader.org_id, "org-fetched")
        self.assertEqual(mock_state_loader.project_id, "proj-fetched")

    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    @patch("recce.apis.check_events_api._is_cloud_user")
    def test_get_session_info_no_token(self, mock_is_cloud, mock_context, mock_get_token):
        """Test _get_session_info raises 401 when no token available."""
        mock_is_cloud.return_value = True

        # Use spec=[] so hasattr(state_loader, "org_id") returns False
        mock_state_loader = MagicMock(spec=[])
        mock_state_loader.session_id = "sess-123"
        mock_state_loader.token = None

        mock_ctx = MagicMock()
        mock_ctx.state_loader = mock_state_loader
        mock_context.return_value = mock_ctx
        mock_get_token.return_value = None

        with self.assertRaises(HTTPException) as ctx:
            _get_session_info()

        self.assertEqual(ctx.exception.status_code, 401)

    @patch("recce.apis.check_events_api.RecceCloud")
    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    @patch("recce.apis.check_events_api._is_cloud_user")
    def test_get_session_info_invalid_session(self, mock_is_cloud, mock_context, mock_get_token, mock_recce_cloud):
        """Test _get_session_info raises 400 when session has no org/project."""
        mock_is_cloud.return_value = True

        # Use spec=[] so hasattr(state_loader, "org_id") returns False
        mock_state_loader = MagicMock(spec=[])
        mock_state_loader.session_id = "sess-123"
        mock_state_loader.token = "test-token"

        mock_ctx = MagicMock()
        mock_ctx.state_loader = mock_state_loader
        mock_context.return_value = mock_ctx
        mock_get_token.return_value = "test-token"

        mock_cloud_instance = MagicMock()
        mock_cloud_instance.get_session.return_value = {
            "org_id": None,
            "project_id": None,
        }
        mock_recce_cloud.return_value = mock_cloud_instance

        with self.assertRaises(HTTPException) as ctx:
            _get_session_info()

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("does not belong to a valid organization", ctx.exception.detail)

    @patch("recce.apis.check_events_api.RecceCloud")
    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    @patch("recce.apis.check_events_api._is_cloud_user")
    def test_get_session_info_cloud_exception(self, mock_is_cloud, mock_context, mock_get_token, mock_recce_cloud):
        """Test _get_session_info handles RecceCloudException."""
        mock_is_cloud.return_value = True

        # Use spec=[] so hasattr(state_loader, "org_id") returns False
        mock_state_loader = MagicMock(spec=[])
        mock_state_loader.session_id = "sess-123"
        mock_state_loader.token = "test-token"

        mock_ctx = MagicMock()
        mock_ctx.state_loader = mock_state_loader
        mock_context.return_value = mock_ctx
        mock_get_token.return_value = "test-token"

        mock_cloud_instance = MagicMock()
        mock_cloud_instance.get_session.side_effect = RecceCloudException(
            message="Failed", reason="Session not found", status_code=404
        )
        mock_recce_cloud.return_value = mock_cloud_instance

        with self.assertRaises(HTTPException) as ctx:
            _get_session_info()

        self.assertEqual(ctx.exception.status_code, 404)


class TestGetEventsClient(unittest.TestCase):
    """Tests for _get_events_client helper function."""

    @patch("recce.apis.check_events_api.CheckEventsCloud")
    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    def test_get_events_client_with_api_token(self, mock_context, mock_get_token, mock_client_class):
        """Test _get_events_client uses API token first."""
        mock_ctx = MagicMock()
        mock_ctx.state_loader.token = "state-token"
        mock_context.return_value = mock_ctx
        mock_get_token.return_value = "api-token"

        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        result = _get_events_client()

        self.assertEqual(result, mock_client)
        mock_client_class.assert_called_once_with("api-token")

    @patch("recce.apis.check_events_api.CheckEventsCloud")
    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    def test_get_events_client_with_state_token(self, mock_context, mock_get_token, mock_client_class):
        """Test _get_events_client falls back to state token."""
        mock_ctx = MagicMock()
        mock_ctx.state_loader.token = "state-token"
        mock_context.return_value = mock_ctx
        mock_get_token.return_value = None

        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        result = _get_events_client()

        self.assertEqual(result, mock_client)
        mock_client_class.assert_called_once_with("state-token")

    @patch("recce.apis.check_events_api.get_recce_api_token")
    @patch("recce.apis.check_events_api.default_context")
    def test_get_events_client_no_token(self, mock_context, mock_get_token):
        """Test _get_events_client raises 401 when no token."""
        mock_ctx = MagicMock()
        mock_ctx.state_loader.token = None
        mock_context.return_value = mock_ctx
        mock_get_token.return_value = None

        with self.assertRaises(HTTPException) as ctx:
            _get_events_client()

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("no API token", ctx.exception.detail)


class TestListCheckEventsEndpoint(unittest.TestCase):
    """Tests for list_check_events endpoint."""

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_list_check_events_success(self, mock_session_info, mock_get_client):
        """Test successful list_check_events."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.list_events.return_value = [
            {"id": "evt-1", "event_type": "comment", "content": "Test"},
            {"id": "evt-2", "event_type": "approval_change"},
        ]
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        result = run_async(list_check_events(check_id))

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["id"], "evt-1")
        mock_client.list_events.assert_called_once_with("org-1", "proj-1", "sess-1", str(check_id))

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_list_check_events_cloud_exception(self, mock_session_info, mock_get_client):
        """Test list_check_events handles RecceCloudException."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.list_events.side_effect = RecceCloudException(message="Failed", reason="Not found", status_code=404)
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        with self.assertRaises(HTTPException) as ctx:
            run_async(list_check_events(check_id))

        self.assertEqual(ctx.exception.status_code, 404)

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_list_check_events_recce_exception(self, mock_session_info, mock_get_client):
        """Test list_check_events handles RecceException."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.list_events.side_effect = RecceException("Something went wrong")
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        with self.assertRaises(HTTPException) as ctx:
            run_async(list_check_events(check_id))

        self.assertEqual(ctx.exception.status_code, 400)


class TestGetCheckEventEndpoint(unittest.TestCase):
    """Tests for get_check_event endpoint."""

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_get_check_event_success(self, mock_session_info, mock_get_client):
        """Test successful get_check_event."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.get_event.return_value = {
            "id": "evt-1",
            "event_type": "comment",
            "content": "Test",
        }
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")
        result = run_async(get_check_event(check_id, event_id))

        self.assertEqual(result["id"], "evt-1")
        mock_client.get_event.assert_called_once_with("org-1", "proj-1", "sess-1", str(check_id), str(event_id))

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_get_check_event_not_found(self, mock_session_info, mock_get_client):
        """Test get_check_event handles 404."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.get_event.side_effect = RecceCloudException(
            message="Not found", reason="Event not found", status_code=404
        )
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")

        with self.assertRaises(HTTPException) as ctx:
            run_async(get_check_event(check_id, event_id))

        self.assertEqual(ctx.exception.status_code, 404)


class TestCreateCommentEndpoint(unittest.TestCase):
    """Tests for create_comment endpoint."""

    @patch("recce.apis.check_events_api.get_current_cloud_user")
    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_create_comment_success(self, mock_session_info, mock_get_client, mock_get_cloud_user):
        """Test successful comment creation."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_get_cloud_user.return_value = None
        mock_client = MagicMock()
        mock_client.create_comment.return_value = {
            "id": "new-evt",
            "event_type": "comment",
            "content": "New comment",
        }
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        body = CreateCommentIn(content="New comment")
        result = run_async(create_comment(check_id, body))

        self.assertEqual(result["id"], "new-evt")
        mock_client.create_comment.assert_called_once_with(
            "org-1", "proj-1", "sess-1", str(check_id), "New comment", acting_user_id=None
        )

    def test_create_comment_empty_content(self):
        """Test create_comment rejects empty content."""
        check_id = UUID("12345678-1234-5678-1234-567812345678")
        body = CreateCommentIn(content="   ")

        with self.assertRaises(HTTPException) as ctx:
            run_async(create_comment(check_id, body))

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("cannot be empty", ctx.exception.detail)

    def test_create_comment_whitespace_only(self):
        """Test create_comment rejects whitespace-only content."""
        check_id = UUID("12345678-1234-5678-1234-567812345678")
        body = CreateCommentIn(content="\n\t  \n")

        with self.assertRaises(HTTPException) as ctx:
            run_async(create_comment(check_id, body))

        self.assertEqual(ctx.exception.status_code, 400)

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_create_comment_cloud_exception(self, mock_session_info, mock_get_client):
        """Test create_comment handles cloud exception."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.create_comment.side_effect = RecceCloudException(
            message="Failed", reason="Server error", status_code=500
        )
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        body = CreateCommentIn(content="New comment")

        with self.assertRaises(HTTPException) as ctx:
            run_async(create_comment(check_id, body))

        self.assertEqual(ctx.exception.status_code, 500)


class TestUpdateCommentEndpoint(unittest.TestCase):
    """Tests for update_comment endpoint."""

    @patch("recce.apis.check_events_api.get_current_cloud_user")
    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_update_comment_success(self, mock_session_info, mock_get_client, mock_get_cloud_user):
        """Test successful comment update."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_get_cloud_user.return_value = None
        mock_client = MagicMock()
        mock_client.update_comment.return_value = {
            "id": "evt-1",
            "event_type": "comment",
            "content": "Updated",
            "is_edited": True,
        }
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")
        body = UpdateCommentIn(content="Updated")
        result = run_async(update_comment(check_id, event_id, body))

        self.assertEqual(result["content"], "Updated")
        self.assertTrue(result["is_edited"])
        mock_client.update_comment.assert_called_once_with(
            "org-1", "proj-1", "sess-1", str(check_id), str(event_id), "Updated", acting_user_id=None
        )

    def test_update_comment_empty_content(self):
        """Test update_comment rejects empty content."""
        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")
        body = UpdateCommentIn(content="")

        with self.assertRaises(HTTPException) as ctx:
            run_async(update_comment(check_id, event_id, body))

        self.assertEqual(ctx.exception.status_code, 400)

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_update_comment_forbidden(self, mock_session_info, mock_get_client):
        """Test update_comment handles 403 forbidden."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.update_comment.side_effect = RecceCloudException(
            message="Forbidden", reason="Not authorized", status_code=403
        )
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")
        body = UpdateCommentIn(content="Updated")

        with self.assertRaises(HTTPException) as ctx:
            run_async(update_comment(check_id, event_id, body))

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_update_comment_not_found(self, mock_session_info, mock_get_client):
        """Test update_comment handles 404 not found."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.update_comment.side_effect = RecceCloudException(
            message="Not found", reason="Comment not found", status_code=404
        )
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")
        body = UpdateCommentIn(content="Updated")

        with self.assertRaises(HTTPException) as ctx:
            run_async(update_comment(check_id, event_id, body))

        self.assertEqual(ctx.exception.status_code, 404)


class TestDeleteCommentEndpoint(unittest.TestCase):
    """Tests for delete_comment endpoint."""

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_delete_comment_success(self, mock_session_info, mock_get_client):
        """Test successful comment deletion."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.delete_comment.return_value = None
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")

        # Should not raise
        run_async(delete_comment(check_id, event_id))

        mock_client.delete_comment.assert_called_once_with("org-1", "proj-1", "sess-1", str(check_id), str(event_id))

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_delete_comment_not_found(self, mock_session_info, mock_get_client):
        """Test delete_comment handles 404 not found."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.delete_comment.side_effect = RecceCloudException(
            message="Not found", reason="Comment not found", status_code=404
        )
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")

        with self.assertRaises(HTTPException) as ctx:
            run_async(delete_comment(check_id, event_id))

        self.assertEqual(ctx.exception.status_code, 404)

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_delete_comment_forbidden(self, mock_session_info, mock_get_client):
        """Test delete_comment handles 403 forbidden."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.delete_comment.side_effect = RecceCloudException(
            message="Forbidden", reason="Not authorized", status_code=403
        )
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")

        with self.assertRaises(HTTPException) as ctx:
            run_async(delete_comment(check_id, event_id))

        self.assertEqual(ctx.exception.status_code, 403)

    @patch("recce.apis.check_events_api._get_events_client")
    @patch("recce.apis.check_events_api._get_session_info")
    def test_delete_comment_recce_exception(self, mock_session_info, mock_get_client):
        """Test delete_comment handles RecceException."""
        mock_session_info.return_value = ("org-1", "proj-1", "sess-1")
        mock_client = MagicMock()
        mock_client.delete_comment.side_effect = RecceException("Something went wrong")
        mock_get_client.return_value = mock_client

        check_id = UUID("12345678-1234-5678-1234-567812345678")
        event_id = UUID("87654321-4321-8765-4321-876543218765")

        with self.assertRaises(HTTPException) as ctx:
            run_async(delete_comment(check_id, event_id))

        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
