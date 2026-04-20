import unittest
from unittest.mock import Mock, patch

from recce.util.recce_cloud import RecceCloud, RecceCloudException


class TestRecceCloudListingMethods(unittest.TestCase):
    """Test cases for the new cloud listing methods in RecceCloud class."""

    def setUp(self):
        """Set up test fixtures."""
        self.token = "test-api-token"
        self.cloud = RecceCloud(self.token)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_organizations_success(self, mock_request):
        """Test successful list_organizations call."""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "organizations": [
                {"id": 1, "name": "org1", "display_name": "Organization 1"},
                {"id": 2, "name": "org2", "display_name": "Organization 2"},
            ]
        }
        mock_request.return_value = mock_response

        # Test method
        result = self.cloud.list_organizations()

        # Assertions
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "org1")
        self.assertEqual(result[1]["display_name"], "Organization 2")

        # Verify correct API call
        mock_request.assert_called_once_with("GET", f"{self.cloud.base_url_v2}/organizations")

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_organizations_empty_response(self, mock_request):
        """Test list_organizations with empty response."""
        # Mock empty response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"organizations": []}
        mock_request.return_value = mock_response

        # Test method
        result = self.cloud.list_organizations()

        # Assertions
        self.assertEqual(len(result), 0)
        self.assertEqual(result, [])

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_organizations_missing_key(self, mock_request):
        """Test list_organizations with missing organizations key."""
        # Mock response without organizations key
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_request.return_value = mock_response

        # Test method
        result = self.cloud.list_organizations()

        # Assertions
        self.assertEqual(result, [])

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_organizations_error(self, mock_request):
        """Test list_organizations with API error."""
        # Mock error response
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"
        mock_request.return_value = mock_response

        # Test method and expect exception
        with self.assertRaises(RecceCloudException) as context:
            self.cloud.list_organizations()

        # Assertions
        self.assertIn("Failed to list organizations from Recce Cloud", str(context.exception))
        self.assertEqual(context.exception.status_code, 403)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_projects_success(self, mock_request):
        """Test successful list_projects call."""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "projects": [
                {"id": 1, "name": "project1", "display_name": "Project 1"},
                {"id": 2, "name": "project2", "display_name": "Project 2"},
            ]
        }
        mock_request.return_value = mock_response

        org_id = "8"

        # Test method
        result = self.cloud.list_projects(org_id)

        # Assertions
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "project1")
        self.assertEqual(result[1]["display_name"], "Project 2")

        # Verify correct API call
        expected_url = f"{self.cloud.base_url_v2}/organizations/{org_id}/projects"
        mock_request.assert_called_once_with("GET", expected_url)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_projects_empty_response(self, mock_request):
        """Test list_projects with empty response."""
        # Mock empty response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"projects": []}
        mock_request.return_value = mock_response

        # Test method
        result = self.cloud.list_projects("8")

        # Assertions
        self.assertEqual(len(result), 0)
        self.assertEqual(result, [])

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_projects_error(self, mock_request):
        """Test list_projects with API error."""
        # Mock error response
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Organization not found"
        mock_request.return_value = mock_response

        # Test method and expect exception
        with self.assertRaises(RecceCloudException) as context:
            self.cloud.list_projects("999")

        # Assertions
        self.assertIn("Failed to list projects from Recce Cloud", str(context.exception))
        self.assertEqual(context.exception.status_code, 404)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_sessions_success(self, mock_request):
        """Test successful list_sessions call."""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sessions": [
                {"id": "session1", "name": "PR-123", "is_base": False},
                {"id": "session2", "name": "Base Session", "is_base": True},
                {"id": "session3", "name": "Dev Session", "is_base": False},
            ]
        }
        mock_request.return_value = mock_response

        org_id = "8"
        project_id = "7"

        # Test method
        result = self.cloud.list_sessions(org_id, project_id)

        # Assertions
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["name"], "PR-123")
        self.assertFalse(result[0]["is_base"])
        self.assertEqual(result[1]["name"], "Base Session")
        self.assertTrue(result[1]["is_base"])

        # Verify correct API call
        expected_url = f"{self.cloud.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions"
        mock_request.assert_called_once_with("GET", expected_url)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_sessions_empty_response(self, mock_request):
        """Test list_sessions with empty response."""
        # Mock empty response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"sessions": []}
        mock_request.return_value = mock_response

        # Test method
        result = self.cloud.list_sessions("8", "7")

        # Assertions
        self.assertEqual(len(result), 0)
        self.assertEqual(result, [])

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_sessions_error(self, mock_request):
        """Test list_sessions with API error."""
        # Mock error response
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.text = "Access denied to project"
        mock_request.return_value = mock_response

        # Test method and expect exception
        with self.assertRaises(RecceCloudException) as context:
            self.cloud.list_sessions("8", "999")

        # Assertions
        self.assertIn("Failed to list sessions from Recce Cloud", str(context.exception))
        self.assertEqual(context.exception.status_code, 403)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_list_sessions_missing_key(self, mock_request):
        """Test list_sessions with missing sessions key."""
        # Mock response without sessions key
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_request.return_value = mock_response

        # Test method
        result = self.cloud.list_sessions("8", "7")

        # Assertions
        self.assertEqual(result, [])


class TestRecceCloudBaseSessionDownloadUrls(unittest.TestCase):
    """Test cases for get_base_session_download_urls with optional session_id."""

    def setUp(self):
        self.token = "test-api-token"
        self.cloud = RecceCloud(self.token)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_get_base_session_download_urls_without_session_id(self, mock_request):
        """Without session_id, URL has no query params."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "presigned_urls": {
                "manifest_url": "http://manifest.url",
                "catalog_url": "http://catalog.url",
            }
        }
        mock_request.return_value = mock_response

        result = self.cloud.get_base_session_download_urls("org1", "proj1")

        expected_url = f"{self.cloud.base_url_v2}/organizations/org1/projects/proj1/base-session/download-url"
        mock_request.assert_called_once_with("GET", expected_url)
        self.assertIn("manifest_url", result)
        self.assertIn("catalog_url", result)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_get_base_session_download_urls_with_session_id(self, mock_request):
        """With session_id, URL includes ?session_id= query param."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "presigned_urls": {
                "manifest_url": "http://manifest.url",
                "catalog_url": "http://catalog.url",
            }
        }
        mock_request.return_value = mock_response

        result = self.cloud.get_base_session_download_urls("org1", "proj1", session_id="abc-123")

        expected_url = (
            f"{self.cloud.base_url_v2}/organizations/org1/projects/proj1/base-session/download-url?session_id=abc-123"
        )
        mock_request.assert_called_once_with("GET", expected_url)
        self.assertIn("manifest_url", result)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_get_base_session_download_urls_with_session_id_none(self, mock_request):
        """Explicit session_id=None behaves same as no session_id."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "presigned_urls": {
                "manifest_url": "http://manifest.url",
                "catalog_url": "http://catalog.url",
            }
        }
        mock_request.return_value = mock_response

        self.cloud.get_base_session_download_urls("org1", "proj1", session_id=None)

        expected_url = f"{self.cloud.base_url_v2}/organizations/org1/projects/proj1/base-session/download-url"
        mock_request.assert_called_once_with("GET", expected_url)


class TestRecceCloudCreateSession(unittest.TestCase):
    """Test cases for create_session method."""

    def setUp(self):
        self.token = "test-api-token"
        self.cloud = RecceCloud(self.token)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_create_session_success_with_session_key(self, mock_request):
        """Test create_session when response wraps in 'session' key."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"session": {"id": "sess-123", "name": "PR-42"}}
        mock_request.return_value = mock_response

        result = self.cloud.create_session("org1", "proj1", "PR-42", adapter_type="postgres")

        self.assertEqual(result["id"], "sess-123")
        self.assertEqual(result["name"], "PR-42")
        expected_url = f"{self.cloud.base_url_v2}/organizations/org1/projects/proj1/sessions"
        mock_request.assert_called_once_with("POST", expected_url, json={"name": "PR-42", "adapter_type": "postgres"})

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_create_session_success_without_session_key(self, mock_request):
        """Test create_session when response has no 'session' wrapper."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "sess-456", "name": "dev"}
        mock_request.return_value = mock_response

        result = self.cloud.create_session("org1", "proj1", "dev")

        self.assertEqual(result["id"], "sess-456")

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_create_session_without_adapter_type(self, mock_request):
        """Test create_session omits adapter_type when not provided."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"session": {"id": "sess-789"}}
        mock_request.return_value = mock_response

        self.cloud.create_session("org1", "proj1", "test-session")

        expected_url = f"{self.cloud.base_url_v2}/organizations/org1/projects/proj1/sessions"
        mock_request.assert_called_once_with("POST", expected_url, json={"name": "test-session"})

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_create_session_error(self, mock_request):
        """Test create_session with API error."""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as ctx:
            self.cloud.create_session("org1", "proj1", "bad")

        self.assertIn("Failed to create session", str(ctx.exception))
        self.assertEqual(ctx.exception.status_code, 400)


class TestRecceCloudUploadCompleted(unittest.TestCase):
    """Test cases for upload_completed method."""

    def setUp(self):
        self.token = "test-api-token"
        self.cloud = RecceCloud(self.token)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_upload_completed_success_200(self, mock_request):
        """Test upload_completed with 200 response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        # Should not raise
        self.cloud.upload_completed("sess-123")

        expected_url = f"{self.cloud.base_url_v2}/sessions/sess-123/upload-completed"
        mock_request.assert_called_once_with("POST", expected_url)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_upload_completed_success_204(self, mock_request):
        """Test upload_completed with 204 response."""
        mock_response = Mock()
        mock_response.status_code = 204
        mock_request.return_value = mock_response

        self.cloud.upload_completed("sess-456")

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_upload_completed_error(self, mock_request):
        """Test upload_completed with API error."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal error"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as ctx:
            self.cloud.upload_completed("sess-789")

        self.assertIn("Failed to notify upload completion", str(ctx.exception))
        self.assertEqual(ctx.exception.status_code, 500)


class TestRecceCloudWarehouseConnection(unittest.TestCase):
    """Test cases for warehouse connection create + bind methods."""

    def setUp(self):
        self.token = "test-api-token"
        self.cloud = RecceCloud(self.token)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_create_warehouse_connection_success_with_wrapper(self, mock_request):
        """Test successful create when response wraps in 'warehouse_connection' key."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"warehouse_connection": {"id": "wc-123", "name": "My DW"}}
        mock_request.return_value = mock_response

        result = self.cloud.create_warehouse_connection("org1", "My DW", {"type": "snowflake", "account": "abc"})

        self.assertEqual(result["id"], "wc-123")
        self.assertEqual(result["name"], "My DW")
        expected_url = f"{self.cloud.base_url_v2}/organizations/org1/warehouse-connections"
        mock_request.assert_called_once_with(
            "POST",
            expected_url,
            json={"name": "My DW", "config": {"type": "snowflake", "account": "abc"}},
        )

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_create_warehouse_connection_success_without_wrapper(self, mock_request):
        """Test successful create when response has no wrapper key."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "wc-456", "name": "DW2"}
        mock_request.return_value = mock_response

        result = self.cloud.create_warehouse_connection("org1", "DW2", {"type": "bigquery"})

        self.assertEqual(result["id"], "wc-456")

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_create_warehouse_connection_error(self, mock_request):
        """Test create_warehouse_connection with API error."""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = "Invalid config"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as ctx:
            self.cloud.create_warehouse_connection("org1", "Bad", {"type": "snowflake"})

        self.assertIn("Failed to create warehouse connection", str(ctx.exception))
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_bind_warehouse_connection_success(self, mock_request):
        """Test successful bind_warehouse_connection_to_project."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok"}
        mock_request.return_value = mock_response

        result = self.cloud.bind_warehouse_connection_to_project("org1", "proj1", "wc-123")

        self.assertEqual(result["status"], "ok")
        expected_url = f"{self.cloud.base_url_v2}/organizations/org1" f"/projects/proj1/warehouse-connection"
        mock_request.assert_called_once_with(
            "PUT",
            expected_url,
            json={"warehouse_connection_id": "wc-123"},
        )

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_bind_warehouse_connection_201(self, mock_request):
        """Test bind returns 201 (also accepted)."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"status": "created"}
        mock_request.return_value = mock_response

        result = self.cloud.bind_warehouse_connection_to_project("org1", "proj1", "wc-456")

        self.assertEqual(result["status"], "created")

    @patch("recce.util.recce_cloud.RecceCloud._request")
    def test_bind_warehouse_connection_error(self, mock_request):
        """Test bind_warehouse_connection_to_project with API error."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Project not found"
        mock_request.return_value = mock_response

        with self.assertRaises(RecceCloudException) as ctx:
            self.cloud.bind_warehouse_connection_to_project("org1", "proj-bad", "wc-123")

        self.assertIn("Failed to bind warehouse connection", str(ctx.exception))
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
