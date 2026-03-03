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


if __name__ == "__main__":
    unittest.main()
