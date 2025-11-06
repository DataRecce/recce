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


if __name__ == "__main__":
    unittest.main()
