"""
Unit tests for WebSocket connection management and user context.
"""

import threading
import unittest
from unittest.mock import MagicMock

from recce.models.websocket import CloudUserContext, CloudUserContextMessage
from recce.websocket import (
    CLOUD_USER_EMAIL_HEADER,
    CLOUD_USER_ID_HEADER,
    CLOUD_USER_LOGIN_HEADER,
    WebSocketConnectionManager,
    extract_cloud_user_from_headers,
    get_current_cloud_user,
    set_current_cloud_user,
)


class TestCloudUserContext(unittest.TestCase):
    """Tests for CloudUserContext dataclass."""

    def test_create_context(self):
        """Test creating a CloudUserContext."""
        context = CloudUserContext(user_id="user-123", user_login="testuser", user_email="test@example.com")
        self.assertEqual(context.user_id, "user-123")
        self.assertEqual(context.user_login, "testuser")
        self.assertEqual(context.user_email, "test@example.com")
        self.assertIsNotNone(context.received_at)

    def test_create_context_without_email(self):
        """Test creating a CloudUserContext without optional email."""
        context = CloudUserContext(user_id="user-123", user_login="testuser")
        self.assertEqual(context.user_id, "user-123")
        self.assertEqual(context.user_login, "testuser")
        self.assertIsNone(context.user_email)

    def test_to_dict(self):
        """Test converting context to dictionary."""
        context = CloudUserContext(user_id="user-123", user_login="testuser", user_email="test@example.com")
        result = context.to_dict()
        self.assertEqual(result["user_id"], "user-123")
        self.assertEqual(result["user_login"], "testuser")
        self.assertEqual(result["user_email"], "test@example.com")
        self.assertIn("received_at", result)


class TestCloudUserContextMessage(unittest.TestCase):
    """Tests for CloudUserContextMessage parsing."""

    def test_parse_valid_message(self):
        """Test parsing a valid cloud_user_context message."""
        data = {
            "type": "cloud_user_context",
            "version": 1,
            "user_id": "uuid-123",
            "user_login": "clouduser",
            "user_email": "cloud@example.com",
        }
        message = CloudUserContextMessage(**data)
        self.assertEqual(message.type, "cloud_user_context")
        self.assertEqual(message.version, 1)
        self.assertEqual(message.user_id, "uuid-123")
        self.assertEqual(message.user_login, "clouduser")
        self.assertEqual(message.user_email, "cloud@example.com")

    def test_parse_message_without_email(self):
        """Test parsing message without optional email field."""
        data = {
            "type": "cloud_user_context",
            "version": 1,
            "user_id": "uuid-123",
            "user_login": "clouduser",
        }
        message = CloudUserContextMessage(**data)
        self.assertIsNone(message.user_email)

    def test_to_context(self):
        """Test converting message to CloudUserContext."""
        data = {
            "type": "cloud_user_context",
            "version": 1,
            "user_id": "uuid-123",
            "user_login": "clouduser",
            "user_email": "cloud@example.com",
        }
        message = CloudUserContextMessage(**data)
        context = message.to_context()
        self.assertIsInstance(context, CloudUserContext)
        self.assertEqual(context.user_id, "uuid-123")
        self.assertEqual(context.user_login, "clouduser")
        self.assertEqual(context.user_email, "cloud@example.com")

    def test_invalid_message_missing_required(self):
        """Test that missing required fields raise validation error."""
        from pydantic import ValidationError

        data = {
            "type": "cloud_user_context",
            "version": 1,
            # Missing user_id and user_login
        }
        with self.assertRaises(ValidationError):
            CloudUserContextMessage(**data)


class TestWebSocketConnectionManager(unittest.TestCase):
    """Tests for WebSocketConnectionManager."""

    def test_connect_and_disconnect(self):
        """Test connecting and disconnecting WebSockets."""
        manager = WebSocketConnectionManager()
        ws = MagicMock()

        manager.connect(ws)
        self.assertIn(ws, manager.clients)

        manager.disconnect(ws)
        self.assertNotIn(ws, manager.clients)

    def test_disconnect_never_connected(self):
        """Test disconnecting a WebSocket that was never connected."""
        manager = WebSocketConnectionManager()
        ws = MagicMock()

        # Should not raise
        manager.disconnect(ws)
        self.assertNotIn(ws, manager.clients)

    def test_set_and_get_user_context(self):
        """Test setting and getting user context."""
        manager = WebSocketConnectionManager()
        ws = MagicMock()
        context = CloudUserContext(user_id="user-123", user_login="testuser")

        manager.connect(ws)
        manager.set_user_context(ws, context)

        retrieved = manager.get_user_context(ws)
        self.assertEqual(retrieved.user_id, "user-123")
        self.assertEqual(retrieved.user_login, "testuser")

    def test_get_user_context_not_set(self):
        """Test getting user context when not set returns None."""
        manager = WebSocketConnectionManager()
        ws = MagicMock()

        manager.connect(ws)
        retrieved = manager.get_user_context(ws)
        self.assertIsNone(retrieved)

    def test_disconnect_clears_context(self):
        """Test that disconnect clears user context."""
        manager = WebSocketConnectionManager()
        ws = MagicMock()
        context = CloudUserContext(user_id="user-123", user_login="testuser")

        manager.connect(ws)
        manager.set_user_context(ws, context)
        manager.disconnect(ws)

        retrieved = manager.get_user_context(ws)
        self.assertIsNone(retrieved)

    def test_has_user_context(self):
        """Test checking if WebSocket has user context."""
        manager = WebSocketConnectionManager()
        ws = MagicMock()

        manager.connect(ws)
        self.assertFalse(manager.has_user_context(ws))

        manager.set_user_context(ws, CloudUserContext(user_id="user-123", user_login="testuser"))
        self.assertTrue(manager.has_user_context(ws))

    def test_multiple_connections(self):
        """Test managing multiple WebSocket connections."""
        manager = WebSocketConnectionManager()
        ws1 = MagicMock()
        ws2 = MagicMock()
        context1 = CloudUserContext(user_id="user-1", user_login="user1")
        context2 = CloudUserContext(user_id="user-2", user_login="user2")

        manager.connect(ws1)
        manager.connect(ws2)
        manager.set_user_context(ws1, context1)
        manager.set_user_context(ws2, context2)

        self.assertEqual(len(manager.clients), 2)
        self.assertEqual(manager.get_user_context(ws1).user_id, "user-1")
        self.assertEqual(manager.get_user_context(ws2).user_id, "user-2")

        manager.disconnect(ws1)
        self.assertEqual(len(manager.clients), 1)
        self.assertIsNone(manager.get_user_context(ws1))
        self.assertEqual(manager.get_user_context(ws2).user_id, "user-2")

    def test_clients_returns_copy(self):
        """Test that clients property returns a copy of the set."""
        manager = WebSocketConnectionManager()
        ws = MagicMock()

        manager.connect(ws)
        clients = manager.clients

        # Modifying the returned set should not affect the manager
        clients.clear()
        self.assertEqual(len(manager.clients), 1)

    def test_thread_safety(self):
        """Test that operations are thread-safe."""
        manager = WebSocketConnectionManager()
        errors = []

        def worker():
            try:
                for _ in range(100):
                    ws = MagicMock()
                    manager.connect(ws)
                    manager.set_user_context(ws, CloudUserContext(user_id="user-123", user_login="testuser"))
                    _ = manager.get_user_context(ws)
                    manager.disconnect(ws)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)


class TestCurrentUserContext(unittest.TestCase):
    """Tests for current user context accessor."""

    def setUp(self):
        """Clear context before each test."""
        set_current_cloud_user(None)

    def tearDown(self):
        """Clear context after each test."""
        set_current_cloud_user(None)

    def test_get_and_set_context(self):
        """Test getting and setting current user context."""
        context = CloudUserContext(user_id="user-123", user_login="testuser")

        # Initially None
        self.assertIsNone(get_current_cloud_user())

        # Set context
        set_current_cloud_user(context)
        retrieved = get_current_cloud_user()
        self.assertEqual(retrieved.user_id, "user-123")

        # Clear context
        set_current_cloud_user(None)
        self.assertIsNone(get_current_cloud_user())


class TestExtractCloudUserFromHeaders(unittest.TestCase):
    """Tests for extract_cloud_user_from_headers function."""

    def test_extract_with_all_headers(self):
        """Test extracting user context with all headers present."""
        headers = {
            CLOUD_USER_ID_HEADER: "user-uuid-123",
            CLOUD_USER_LOGIN_HEADER: "testuser",
            CLOUD_USER_EMAIL_HEADER: "test@example.com",
        }
        context = extract_cloud_user_from_headers(headers)
        self.assertIsNotNone(context)
        self.assertEqual(context.user_id, "user-uuid-123")
        self.assertEqual(context.user_login, "testuser")
        self.assertEqual(context.user_email, "test@example.com")

    def test_extract_without_email(self):
        """Test extracting user context without optional email header."""
        headers = {
            CLOUD_USER_ID_HEADER: "user-uuid-123",
            CLOUD_USER_LOGIN_HEADER: "testuser",
        }
        context = extract_cloud_user_from_headers(headers)
        self.assertIsNotNone(context)
        self.assertEqual(context.user_id, "user-uuid-123")
        self.assertEqual(context.user_login, "testuser")
        self.assertIsNone(context.user_email)

    def test_extract_missing_user_id(self):
        """Test that missing user_id returns None."""
        headers = {
            CLOUD_USER_LOGIN_HEADER: "testuser",
            CLOUD_USER_EMAIL_HEADER: "test@example.com",
        }
        context = extract_cloud_user_from_headers(headers)
        self.assertIsNone(context)

    def test_extract_missing_user_login(self):
        """Test that missing user_login returns None."""
        headers = {
            CLOUD_USER_ID_HEADER: "user-uuid-123",
            CLOUD_USER_EMAIL_HEADER: "test@example.com",
        }
        context = extract_cloud_user_from_headers(headers)
        self.assertIsNone(context)

    def test_extract_empty_headers(self):
        """Test that empty headers returns None."""
        headers = {}
        context = extract_cloud_user_from_headers(headers)
        self.assertIsNone(context)

    def test_extract_case_insensitive(self):
        """Test that header extraction is case-insensitive."""
        headers = {
            "x-recce-user-id": "user-uuid-123",
            "X-RECCE-USER-LOGIN": "testuser",
            "X-Recce-User-Email": "test@example.com",
        }
        context = extract_cloud_user_from_headers(headers)
        self.assertIsNotNone(context)
        self.assertEqual(context.user_id, "user-uuid-123")
        self.assertEqual(context.user_login, "testuser")


if __name__ == "__main__":
    unittest.main()
