import json
import unittest
from unittest.mock import MagicMock, patch

from recce_cloud.api.client import RecceCloudClient, RecceCloudException


class RecceCloudClientTests(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures."""
        self.api_token = "rct-test-token-123"
        self.session_id = "session-123"
        self.org_id = "org-456"
        self.project_id = "project-789"

    def test_init_with_api_token(self):
        """Test client initialization with Recce API token."""
        client = RecceCloudClient(self.api_token)
        self.assertEqual(client.token, self.api_token)
        self.assertIn("/api/v2", client.base_url_v2)

    def test_init_with_none_token_raises_error(self):
        """Test client initialization with None token raises ValueError."""
        with self.assertRaises(ValueError) as context:
            RecceCloudClient(None)
        self.assertIn("Token cannot be None", str(context.exception))

    @patch("recce_cloud.api.client.requests.request")
    def test_get_session_success(self, mock_request):
        """Test successful get_session call."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "session": {
                "id": self.session_id,
                "org_id": self.org_id,
                "project_id": self.project_id,
            },
        }
        mock_request.return_value = mock_response

        result = client.get_session(self.session_id)

        self.assertEqual(result["id"], self.session_id)
        self.assertEqual(result["org_id"], self.org_id)
        self.assertEqual(result["project_id"], self.project_id)

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn(self.session_id, call_args[0][1])
        self.assertEqual(call_args[1]["headers"]["Authorization"], f"Bearer {self.api_token}")

    @patch("recce_cloud.api.client.requests.request")
    def test_get_session_not_found(self, mock_request):
        """Test get_session with 404 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Session not found"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_session(self.session_id)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("Session not found", str(context.exception))

    @patch("recce_cloud.api.client.requests.request")
    def test_get_session_forbidden(self, mock_request):
        """Test get_session with 403 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 403 response
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.json.return_value = {"detail": "Access denied"}
        mock_request.return_value = mock_response

        result = client.get_session(self.session_id)

        self.assertEqual(result["status"], "error")
        self.assertEqual(result["message"], "Access denied")

    @patch("recce_cloud.api.client.requests.request")
    def test_get_session_api_error(self, mock_request):
        """Test get_session with API returning success=False."""
        client = RecceCloudClient(self.api_token)

        # Mock response with success=False
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": False, "message": "Invalid session"}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_session(self.session_id)

        self.assertIn("Invalid session", context.exception.reason)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_upload_urls_success(self, mock_request):
        """Test successful get_upload_urls_by_session_id call."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "presigned_urls": {
                "manifest_url": "https://s3.amazonaws.com/bucket/manifest.json?token=abc",
                "catalog_url": "https://s3.amazonaws.com/bucket/catalog.json?token=def",
            }
        }
        mock_request.return_value = mock_response

        result = client.get_upload_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        self.assertIn("manifest_url", result)
        self.assertIn("catalog_url", result)
        self.assertIn("s3.amazonaws.com", result["manifest_url"])

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn(self.org_id, call_args[0][1])
        self.assertIn(self.project_id, call_args[0][1])
        self.assertIn(self.session_id, call_args[0][1])
        self.assertIn("upload-url", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_get_upload_urls_no_presigned_urls(self, mock_request):
        """Test get_upload_urls_by_session_id with no presigned URLs."""
        client = RecceCloudClient(self.api_token)

        # Mock response with null presigned_urls
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"presigned_urls": None}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_upload_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("No presigned URLs", str(context.exception))

    @patch("recce_cloud.api.client.requests.request")
    def test_get_upload_urls_failure(self, mock_request):
        """Test get_upload_urls_by_session_id with API failure."""
        client = RecceCloudClient(self.api_token)

        # Mock error response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_upload_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 500)

    @patch("recce_cloud.api.client.requests.request")
    def test_update_session_success(self, mock_request):
        """Test successful update_session call."""
        client = RecceCloudClient(self.api_token)
        adapter_type = "postgres"

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": True, "session": {"adapter_type": adapter_type}}
        mock_request.return_value = mock_response

        result = client.update_session(self.org_id, self.project_id, self.session_id, adapter_type)

        self.assertTrue(result["success"])
        self.assertEqual(result["session"]["adapter_type"], adapter_type)

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "PATCH")
        self.assertIn(self.org_id, call_args[0][1])
        self.assertIn(self.project_id, call_args[0][1])
        self.assertIn(self.session_id, call_args[0][1])
        self.assertEqual(call_args[1]["json"]["adapter_type"], adapter_type)

    @patch("recce_cloud.api.client.requests.request")
    def test_update_session_forbidden(self, mock_request):
        """Test update_session with 403 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 403 response
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.json.return_value = {"detail": "Insufficient permissions"}
        mock_request.return_value = mock_response

        result = client.update_session(self.org_id, self.project_id, self.session_id, "postgres")

        self.assertEqual(result["status"], "error")
        self.assertEqual(result["message"], "Insufficient permissions")

    @patch("recce_cloud.api.client.requests.request")
    def test_update_session_failure(self, mock_request):
        """Test update_session with API failure."""
        client = RecceCloudClient(self.api_token)

        # Mock error response
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.update_session(self.org_id, self.project_id, self.session_id, "invalid_adapter")

        self.assertEqual(context.exception.status_code, 400)

    def test_recce_cloud_exception_with_json_detail(self):
        """Test RecceCloudException parses JSON detail."""
        json_reason = json.dumps({"detail": "Invalid session ID"})
        exception = RecceCloudException(reason=json_reason, status_code=400)

        self.assertEqual(exception.status_code, 400)
        self.assertEqual(exception.reason, "Invalid session ID")
        self.assertIn("Invalid session ID", str(exception))

    def test_recce_cloud_exception_with_plain_text(self):
        """Test RecceCloudException with plain text reason."""
        plain_reason = "Connection timeout"
        exception = RecceCloudException(reason=plain_reason, status_code=500)

        self.assertEqual(exception.status_code, 500)
        self.assertEqual(exception.reason, plain_reason)

    @patch.dict("os.environ", {"RECCE_INSTANCE_ENV": "docker"})
    @patch("recce_cloud.api.client.requests.request")
    def test_docker_internal_url_replacement(self, mock_request):
        """Test localhost URL is replaced with docker internal URL."""
        client = RecceCloudClient(self.api_token)

        # Mock response with localhost URL
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "presigned_urls": {
                "manifest_url": "http://localhost:8000/manifest.json",
                "catalog_url": "http://localhost:8000/catalog.json",
            }
        }
        mock_request.return_value = mock_response

        result = client.get_upload_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        # URLs should be replaced with docker internal
        self.assertIn("host.docker.internal", result["manifest_url"])
        self.assertIn("host.docker.internal", result["catalog_url"])
        self.assertNotIn("localhost", result["manifest_url"])

    @patch("recce_cloud.api.client.requests.request")
    def test_get_download_urls_success(self, mock_request):
        """Test successful get_download_urls_by_session_id call."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "presigned_urls": {
                "manifest_url": "https://s3.amazonaws.com/bucket/manifest.json?token=xyz",
                "catalog_url": "https://s3.amazonaws.com/bucket/catalog.json?token=uvw",
            }
        }
        mock_request.return_value = mock_response

        result = client.get_download_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        self.assertIn("manifest_url", result)
        self.assertIn("catalog_url", result)
        self.assertIn("s3.amazonaws.com", result["manifest_url"])

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn(self.org_id, call_args[0][1])
        self.assertIn(self.project_id, call_args[0][1])
        self.assertIn(self.session_id, call_args[0][1])
        self.assertIn("download-url", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_get_download_urls_no_presigned_urls(self, mock_request):
        """Test get_download_urls_by_session_id with no presigned URLs."""
        client = RecceCloudClient(self.api_token)

        # Mock response with null presigned_urls
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"presigned_urls": None}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_download_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("No presigned URLs", str(context.exception))

    @patch("recce_cloud.api.client.requests.request")
    def test_get_download_urls_failure(self, mock_request):
        """Test get_download_urls_by_session_id with API failure."""
        client = RecceCloudClient(self.api_token)

        # Mock error response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_download_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 500)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_download_urls_not_found(self, mock_request):
        """Test get_download_urls_by_session_id with 404 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Session not found"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_download_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("Session not found", str(context.exception))

    @patch.dict("os.environ", {"RECCE_INSTANCE_ENV": "docker"})
    @patch("recce_cloud.api.client.requests.request")
    def test_get_download_urls_docker_internal_url_replacement(self, mock_request):
        """Test localhost URL is replaced with docker internal URL for download URLs."""
        client = RecceCloudClient(self.api_token)

        # Mock response with localhost URL
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "presigned_urls": {
                "manifest_url": "http://localhost:9000/download/manifest.json",
                "catalog_url": "http://localhost:9000/download/catalog.json",
            }
        }
        mock_request.return_value = mock_response

        result = client.get_download_urls_by_session_id(self.org_id, self.project_id, self.session_id)

        # URLs should be replaced with docker internal
        self.assertIn("host.docker.internal", result["manifest_url"])
        self.assertIn("host.docker.internal", result["catalog_url"])
        self.assertNotIn("localhost", result["manifest_url"])
        self.assertNotIn("localhost", result["catalog_url"])

    @patch("recce_cloud.api.client.requests.request")
    def test_delete_session_success(self, mock_request):
        """Test successful delete_session call."""
        client = RecceCloudClient(self.api_token)

        # Mock 204 No Content response
        mock_response = MagicMock()
        mock_response.status_code = 204
        mock_request.return_value = mock_response

        result = client.delete_session(self.session_id)

        self.assertTrue(result)

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "DELETE")
        self.assertIn(self.session_id, call_args[0][1])
        self.assertIn("sessions", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_delete_session_not_found(self, mock_request):
        """Test delete_session with 404 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Session not found"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.delete_session(self.session_id)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("Session not found", context.exception.reason)

    @patch("recce_cloud.api.client.requests.request")
    def test_delete_session_forbidden(self, mock_request):
        """Test delete_session with 403 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 403 response
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.json.return_value = {"detail": "Permission denied"}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.delete_session(self.session_id)

        self.assertEqual(context.exception.status_code, 403)
        self.assertIn("Permission denied", context.exception.reason)

    @patch("recce_cloud.api.client.requests.request")
    def test_delete_session_server_error(self, mock_request):
        """Test delete_session with 500 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 500 response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.delete_session(self.session_id)

        self.assertEqual(context.exception.status_code, 500)

    @patch("recce_cloud.api.client.requests.request")
    def test_upload_completed_success_with_json(self, mock_request):
        """Test successful upload_completed call with JSON response."""
        client = RecceCloudClient(self.api_token)

        # Mock 200 response with JSON body
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'{"message": "Upload completed"}'
        mock_response.json.return_value = {"message": "Upload completed"}
        mock_request.return_value = mock_response

        result = client.upload_completed(self.session_id)

        self.assertEqual(result["message"], "Upload completed")

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "POST")
        self.assertIn(self.session_id, call_args[0][1])
        self.assertIn("upload-completed", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_upload_completed_success_204_no_content(self, mock_request):
        """Test successful upload_completed call with 204 No Content response."""
        client = RecceCloudClient(self.api_token)

        # Mock 204 No Content response
        mock_response = MagicMock()
        mock_response.status_code = 204
        mock_response.content = b""
        mock_request.return_value = mock_response

        result = client.upload_completed(self.session_id)

        self.assertEqual(result, {})

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "POST")
        self.assertIn(self.session_id, call_args[0][1])
        self.assertIn("upload-completed", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_upload_completed_not_found(self, mock_request):
        """Test upload_completed with 404 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Session not found"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.upload_completed(self.session_id)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("Session not found", context.exception.reason)

    @patch("recce_cloud.api.client.requests.request")
    def test_upload_completed_forbidden(self, mock_request):
        """Test upload_completed with 403 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 403 response
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.json.return_value = {"detail": "Permission denied"}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.upload_completed(self.session_id)

        self.assertEqual(context.exception.status_code, 403)
        self.assertIn("Permission denied", context.exception.reason)

    @patch("recce_cloud.api.client.requests.request")
    def test_upload_completed_server_error(self, mock_request):
        """Test upload_completed with 500 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 500 response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.upload_completed(self.session_id)

        self.assertEqual(context.exception.status_code, 500)

    @patch("recce_cloud.api.client.requests.request")
    def test_list_sessions_success(self, mock_request):
        """Test successful list_sessions call."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sessions": [
                {"id": "session-1", "name": "test-session-1"},
                {"id": "session-2", "name": "test-session-2"},
            ],
            "total": 2,
        }
        mock_request.return_value = mock_response

        result = client.list_sessions(self.org_id, self.project_id)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["id"], "session-1")

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn(self.org_id, call_args[0][1])
        self.assertIn(self.project_id, call_args[0][1])
        self.assertIn("sessions", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_list_sessions_with_filters(self, mock_request):
        """Test list_sessions with filtering parameters."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sessions": [{"id": "session-1", "name": "my-session", "branch": "main"}],
            "total": 1,
        }
        mock_request.return_value = mock_response

        result = client.list_sessions(
            self.org_id,
            self.project_id,
            session_name="my-session",
            session_type="duckdb",
            branch="main",
            limit=10,
            offset=5,
        )

        self.assertEqual(len(result), 1)

        # Verify request was made with correct params
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        params = call_args[1].get("params", {})
        self.assertEqual(params["name"], "my-session")
        self.assertEqual(params["type"], "duckdb")
        self.assertEqual(params["branch"], "main")
        self.assertEqual(params["limit"], 10)
        self.assertEqual(params["offset"], 5)

    @patch("recce_cloud.api.client.requests.request")
    def test_list_sessions_not_found(self, mock_request):
        """Test list_sessions with 404 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Organization or project not found"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.list_sessions(self.org_id, self.project_id)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("Organization or project not found", context.exception.reason)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_session_by_name_success(self, mock_request):
        """Test successful get_session_by_name call."""
        client = RecceCloudClient(self.api_token)
        session_name = "my-test-session"

        # Mock successful response from list_sessions endpoint
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sessions": [{"id": "session-123", "name": session_name}],
            "total": 1,
            "success": True,
        }
        mock_request.return_value = mock_response

        result = client.get_session_by_name(self.org_id, self.project_id, session_name)

        self.assertIsNotNone(result)
        self.assertEqual(result["name"], session_name)

        # Verify request used the list sessions endpoint with name filter
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn("/sessions", call_args[0][1])
        self.assertNotIn("by-name", call_args[0][1])
        # Check that name filter is in params
        self.assertIn("params", call_args[1])
        self.assertEqual(call_args[1]["params"]["name"], session_name)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_session_by_name_not_found(self, mock_request):
        """Test get_session_by_name with session not found."""
        client = RecceCloudClient(self.api_token)

        # Mock response with empty sessions list
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sessions": [],
            "total": 0,
            "success": True,
        }
        mock_request.return_value = mock_response

        result = client.get_session_by_name(self.org_id, self.project_id, "nonexistent")

        # Should return None when no sessions match
        self.assertIsNone(result)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_session_by_name_server_error(self, mock_request):
        """Test get_session_by_name with server error."""
        client = RecceCloudClient(self.api_token)

        # Mock 500 response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_session_by_name(self.org_id, self.project_id, "test-session")

        self.assertEqual(context.exception.status_code, 500)

    # Tests for data review methods

    @patch("recce_cloud.api.client.requests.request")
    def test_generate_data_review_success(self, mock_request):
        """Test successful generate_data_review call."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "task_id": "task-456",
            "status": "pending",
        }
        mock_request.return_value = mock_response

        result = client.generate_data_review(self.org_id, self.project_id, self.session_id)

        self.assertEqual(result["task_id"], "task-456")

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "POST")
        self.assertIn(self.org_id, call_args[0][1])
        self.assertIn(self.project_id, call_args[0][1])
        self.assertIn(self.session_id, call_args[0][1])
        self.assertIn("recce_summary", call_args[0][1])
        self.assertEqual(call_args[1]["json"]["regenerate"], False)

    @patch("recce_cloud.api.client.requests.request")
    def test_generate_data_review_with_regenerate(self, mock_request):
        """Test generate_data_review with regenerate flag."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"task_id": "task-789"}
        mock_request.return_value = mock_response

        result = client.generate_data_review(self.org_id, self.project_id, self.session_id, regenerate=True)

        self.assertEqual(result["task_id"], "task-789")

        # Verify regenerate flag was passed
        call_args = mock_request.call_args
        self.assertEqual(call_args[1]["json"]["regenerate"], True)

    @patch("recce_cloud.api.client.requests.request")
    def test_generate_data_review_failure(self, mock_request):
        """Test generate_data_review with API failure."""
        client = RecceCloudClient(self.api_token)

        # Mock error response - 400 errors call response.json() for detail
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"detail": "Missing required artifacts"}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.generate_data_review(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 400)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_data_review_success(self, mock_request):
        """Test successful get_data_review call."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "session_id": self.session_id,
            "session_name": "test-session",
            "summary": "# Data Review Summary\n\nThis is a test review.",
            "trace_id": "trace-123",
        }
        mock_request.return_value = mock_response

        result = client.get_data_review(self.org_id, self.project_id, self.session_id)

        self.assertIsNotNone(result)
        self.assertEqual(result["session_id"], self.session_id)
        self.assertIn("summary", result)

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn("recce_summary", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_get_data_review_not_found(self, mock_request):
        """Test get_data_review when no review exists."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Review not found"
        mock_request.return_value = mock_response

        result = client.get_data_review(self.org_id, self.project_id, self.session_id)

        # Should return None when review doesn't exist
        self.assertIsNone(result)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_running_task_success(self, mock_request):
        """Test successful get_running_task call."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "task_id": "task-running-123",
            "status": "processing",
        }
        mock_request.return_value = mock_response

        result = client.get_running_task(self.org_id, self.project_id, self.session_id)

        self.assertIsNotNone(result)
        self.assertEqual(result["task_id"], "task-running-123")
        self.assertEqual(result["status"], "processing")

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn("running_task", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_get_running_task_not_found(self, mock_request):
        """Test get_running_task when no task is running."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "No running task"
        mock_request.return_value = mock_response

        result = client.get_running_task(self.org_id, self.project_id, self.session_id)

        # Should return None when no task is running
        self.assertIsNone(result)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_task_status_success(self, mock_request):
        """Test successful get_task_status call."""
        client = RecceCloudClient(self.api_token)
        task_id = "task-status-123"

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": task_id,
            "command": "generate_recce_summary",
            "status": "completed",
            "created_at": "2024-01-01T00:00:00Z",
            "started_at": "2024-01-01T00:00:01Z",
            "finished_at": "2024-01-01T00:00:30Z",
            "metadata": {"progress": 100},
        }
        mock_request.return_value = mock_response

        result = client.get_task_status(self.org_id, task_id)

        self.assertEqual(result["id"], task_id)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["command"], "generate_recce_summary")

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn(self.org_id, call_args[0][1])
        self.assertIn(task_id, call_args[0][1])
        self.assertIn("status", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_get_task_status_not_found(self, mock_request):
        """Test get_task_status with non-existent task."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Task not found"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_task_status(self.org_id, "nonexistent-task")

        self.assertEqual(context.exception.status_code, 404)

    @patch("recce_cloud.api.client.requests.request")
    def test_get_task_status_server_error(self, mock_request):
        """Test get_task_status with server error."""
        client = RecceCloudClient(self.api_token)

        # Mock 500 response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.get_task_status(self.org_id, "task-123")

        self.assertEqual(context.exception.status_code, 500)

    # Tests for check_prerequisites method

    @patch("recce_cloud.api.client.requests.request")
    def test_check_prerequisites_success(self, mock_request):
        """Test successful check_prerequisites call when all prerequisites met."""
        client = RecceCloudClient(self.api_token)

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "session_id": self.session_id,
            "session_name": "test-session",
            "adapter_type": "postgres",
            "has_base_session": True,
            "base_session_has_artifacts": True,
            "is_ready": True,
            "reason": None,
        }
        mock_request.return_value = mock_response

        result = client.check_prerequisites(self.org_id, self.project_id, self.session_id)

        self.assertTrue(result["is_ready"])
        self.assertEqual(result["session_id"], self.session_id)
        self.assertEqual(result["adapter_type"], "postgres")

        # Verify request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[0][0], "GET")
        self.assertIn(self.org_id, call_args[0][1])
        self.assertIn(self.project_id, call_args[0][1])
        self.assertIn(self.session_id, call_args[0][1])
        self.assertIn("check-prerequisites", call_args[0][1])

    @patch("recce_cloud.api.client.requests.request")
    def test_check_prerequisites_not_ready(self, mock_request):
        """Test check_prerequisites when prerequisites not met."""
        client = RecceCloudClient(self.api_token)

        # Mock response with is_ready=False
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "session_id": self.session_id,
            "session_name": "test-session",
            "adapter_type": None,  # Session has no artifacts
            "has_base_session": True,
            "base_session_has_artifacts": True,
            "is_ready": False,
            "reason": "Session has no artifacts (missing adapter_type)",
        }
        mock_request.return_value = mock_response

        result = client.check_prerequisites(self.org_id, self.project_id, self.session_id)

        self.assertFalse(result["is_ready"])
        self.assertIn("artifacts", result["reason"])

    @patch("recce_cloud.api.client.requests.request")
    def test_check_prerequisites_no_base_session(self, mock_request):
        """Test check_prerequisites when base session doesn't exist."""
        client = RecceCloudClient(self.api_token)

        # Mock response with no base session
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "session_id": self.session_id,
            "session_name": "test-session",
            "adapter_type": "postgres",
            "has_base_session": False,
            "base_session_has_artifacts": False,
            "is_ready": False,
            "reason": "Project has no base session configured",
        }
        mock_request.return_value = mock_response

        result = client.check_prerequisites(self.org_id, self.project_id, self.session_id)

        self.assertFalse(result["is_ready"])
        self.assertFalse(result["has_base_session"])
        self.assertIn("base session", result["reason"])

    @patch("recce_cloud.api.client.requests.request")
    def test_check_prerequisites_not_found(self, mock_request):
        """Test check_prerequisites with non-existent session."""
        client = RecceCloudClient(self.api_token)

        # Mock 404 response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Session not found"
        mock_response.json.return_value = {"detail": "Session not found"}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.check_prerequisites(self.org_id, self.project_id, "nonexistent-session")

        self.assertEqual(context.exception.status_code, 404)

    @patch("recce_cloud.api.client.requests.request")
    def test_check_prerequisites_forbidden(self, mock_request):
        """Test check_prerequisites with 403 response."""
        client = RecceCloudClient(self.api_token)

        # Mock 403 response
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.json.return_value = {"detail": "Access denied"}
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.check_prerequisites(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 403)

    @patch("recce_cloud.api.client.requests.request")
    def test_check_prerequisites_server_error(self, mock_request):
        """Test check_prerequisites with server error."""
        client = RecceCloudClient(self.api_token)

        # Mock 500 response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as context:
            client.check_prerequisites(self.org_id, self.project_id, self.session_id)

        self.assertEqual(context.exception.status_code, 500)


if __name__ == "__main__":
    unittest.main()
