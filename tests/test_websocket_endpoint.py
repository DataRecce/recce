"""
Integration tests for WebSocket endpoint with cloud_user_context support.
"""

import json
import unittest

from fastapi.testclient import TestClient

from recce.server import app
from recce.websocket import get_connection_manager


class TestWebSocketEndpoint(unittest.TestCase):
    """Integration tests for WebSocket endpoint."""

    def setUp(self):
        """Set up test fixtures."""
        # Initialize app.state.last_activity to avoid AttributeError
        app.state.last_activity = None
        # Reset the connection manager
        manager = get_connection_manager()
        manager._clients.clear()
        manager._user_contexts.clear()

    def tearDown(self):
        """Clean up after tests."""
        app.state.last_activity = None

    def test_websocket_ping_text(self):
        """Test plain text ping message (backward compatibility)."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            websocket.send_text("ping")
            data = websocket.receive_text()
            self.assertEqual(data, "pong")

    def test_websocket_ping_json(self):
        """Test JSON ping message."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            websocket.send_text(json.dumps({"type": "ping"}))
            data = json.loads(websocket.receive_text())
            self.assertEqual(data["type"], "pong")

    def test_websocket_cloud_user_context(self):
        """Test cloud_user_context message handling."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            message = {
                "type": "cloud_user_context",
                "version": 1,
                "user_id": "test-uuid-123",
                "user_login": "testuser",
                "user_email": "test@example.com",
            }
            websocket.send_text(json.dumps(message))
            data = json.loads(websocket.receive_text())

            self.assertEqual(data["type"], "cloud_user_context_ack")
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["user_login"], "testuser")

    def test_websocket_cloud_user_context_without_email(self):
        """Test cloud_user_context message without optional email."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            message = {
                "type": "cloud_user_context",
                "version": 1,
                "user_id": "test-uuid-123",
                "user_login": "testuser",
            }
            websocket.send_text(json.dumps(message))
            data = json.loads(websocket.receive_text())

            self.assertEqual(data["type"], "cloud_user_context_ack")
            self.assertEqual(data["status"], "ok")

    def test_websocket_cloud_user_context_invalid_message(self):
        """Test cloud_user_context with missing required fields."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            message = {
                "type": "cloud_user_context",
                "version": 1,
                # Missing user_id and user_login
            }
            websocket.send_text(json.dumps(message))
            data = json.loads(websocket.receive_text())

            self.assertEqual(data["type"], "cloud_user_context_ack")
            self.assertEqual(data["status"], "error")
            self.assertIn("error", data)

    def test_websocket_cloud_user_context_future_version(self):
        """Test cloud_user_context with future version (should still work)."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            message = {
                "type": "cloud_user_context",
                "version": 2,  # Future version
                "user_id": "test-uuid-123",
                "user_login": "testuser",
                "user_email": "test@example.com",
                "extra_field": "future_data",  # Unknown field from future version
            }
            websocket.send_text(json.dumps(message))
            data = json.loads(websocket.receive_text())

            # Should still work, just warn about version
            self.assertEqual(data["type"], "cloud_user_context_ack")
            self.assertEqual(data["status"], "ok")

    def test_websocket_invalid_json(self):
        """Test handling of invalid JSON message."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            websocket.send_text("not valid json {")
            # Should not crash, but also won't receive response for invalid JSON
            # Send a ping to verify connection is still alive
            websocket.send_text("ping")
            data = websocket.receive_text()
            self.assertEqual(data, "pong")

    def test_websocket_unknown_message_type(self):
        """Test handling of unknown message type."""
        client = TestClient(app)
        with client.websocket_connect("/api/ws") as websocket:
            message = {"type": "unknown_type", "data": "test"}
            websocket.send_text(json.dumps(message))
            # Should not crash, unknown types are silently ignored
            # Send a ping to verify connection is still alive
            websocket.send_text("ping")
            data = websocket.receive_text()
            self.assertEqual(data, "pong")

    def test_websocket_context_stored_in_manager(self):
        """Test that user context is properly stored in the connection manager."""
        client = TestClient(app)
        manager = get_connection_manager()

        # Before connection, no clients
        self.assertEqual(len(manager.clients), 0)

        with client.websocket_connect("/api/ws") as websocket:
            # After connection, one client
            self.assertEqual(len(manager.clients), 1)

            # Send user context
            message = {
                "type": "cloud_user_context",
                "version": 1,
                "user_id": "test-uuid-123",
                "user_login": "testuser",
            }
            websocket.send_text(json.dumps(message))
            websocket.receive_text()  # Consume the ack

            # Verify context is stored
            ws_client = list(manager.clients)[0]
            context = manager.get_user_context(ws_client)
            self.assertIsNotNone(context)
            self.assertEqual(context.user_id, "test-uuid-123")
            self.assertEqual(context.user_login, "testuser")

        # After disconnect, client should be removed
        # Note: TestClient may not properly trigger disconnect cleanup
        # so we don't assert on client count after disconnect

    def test_websocket_multiple_connections(self):
        """Test handling multiple simultaneous WebSocket connections."""
        client = TestClient(app)

        with client.websocket_connect("/api/ws") as ws1:
            with client.websocket_connect("/api/ws") as ws2:
                # Send different user contexts
                ws1.send_text(
                    json.dumps(
                        {
                            "type": "cloud_user_context",
                            "version": 1,
                            "user_id": "user-1",
                            "user_login": "user1",
                        }
                    )
                )
                ws2.send_text(
                    json.dumps(
                        {
                            "type": "cloud_user_context",
                            "version": 1,
                            "user_id": "user-2",
                            "user_login": "user2",
                        }
                    )
                )

                # Both should receive acks
                ack1 = json.loads(ws1.receive_text())
                ack2 = json.loads(ws2.receive_text())

                self.assertEqual(ack1["user_login"], "user1")
                self.assertEqual(ack2["user_login"], "user2")


class TestCloudUserHeaderMiddleware(unittest.TestCase):
    """Integration tests for cloud user context HTTP header middleware."""

    def setUp(self):
        """Set up test fixtures."""
        app.state.last_activity = None

    def tearDown(self):
        """Clean up after tests."""
        app.state.last_activity = None

    def test_middleware_extracts_cloud_user_headers(self):
        """Test that middleware extracts cloud user context from headers."""
        from recce.websocket import (
            CLOUD_USER_EMAIL_HEADER,
            CLOUD_USER_ID_HEADER,
            CLOUD_USER_LOGIN_HEADER,
        )

        client = TestClient(app)
        headers = {
            CLOUD_USER_ID_HEADER: "test-user-id",
            CLOUD_USER_LOGIN_HEADER: "testuser",
            CLOUD_USER_EMAIL_HEADER: "test@example.com",
        }

        # Make a request with cloud user headers
        # Use /api/health as it's a simple endpoint that doesn't require state
        response = client.get("/api/health", headers=headers)

        # The middleware should have run (request succeeds)
        self.assertEqual(response.status_code, 200)

    def test_middleware_handles_missing_headers(self):
        """Test that middleware handles requests without cloud user headers."""
        client = TestClient(app)

        # Make a request without cloud user headers
        response = client.get("/api/health")

        # Should still work
        self.assertEqual(response.status_code, 200)

    def test_middleware_handles_partial_headers(self):
        """Test that middleware handles requests with only some headers."""
        from recce.websocket import CLOUD_USER_ID_HEADER

        client = TestClient(app)
        headers = {
            CLOUD_USER_ID_HEADER: "test-user-id",
            # Missing CLOUD_USER_LOGIN_HEADER
        }

        response = client.get("/api/health", headers=headers)

        # Should still work (context will be None but no error)
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
