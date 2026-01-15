"""
Tests for recce-cloud CloudAPI client.
"""

import unittest
from unittest.mock import MagicMock, patch


class TestCloudAPI(unittest.TestCase):
    """Test cases for CloudAPI client."""

    def test_init_with_token(self):
        """Test API client initialization with token."""
        from recce_cloud.api.cloud_api import CloudAPI

        api = CloudAPI("test_token_123")
        self.assertEqual(api.token, "test_token_123")
        self.assertIn("cloud.datarecce.io", api.base_url)

    def test_init_without_token(self):
        """Test API client initialization without token raises error."""
        from recce_cloud.api.cloud_api import CloudAPI

        with self.assertRaises(ValueError):
            CloudAPI("")

        with self.assertRaises(ValueError):
            CloudAPI(None)

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_list_organizations(self, mock_request):
        """Test listing organizations."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "organizations": [
                {"id": 1, "name": "org1", "slug": "org1-slug"},
                {"id": 2, "name": "org2", "slug": "org2-slug"},
            ]
        }
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        orgs = api.list_organizations()

        self.assertEqual(len(orgs), 2)
        self.assertEqual(orgs[0]["name"], "org1")
        mock_request.assert_called_once()

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_list_organizations_error(self, mock_request):
        """Test listing organizations handles API errors."""
        from recce_cloud.api.cloud_api import CloudAPI, CloudAPIError

        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_request.return_value = mock_response

        api = CloudAPI("invalid_token")

        with self.assertRaises(CloudAPIError) as context:
            api.list_organizations()

        self.assertEqual(context.exception.status_code, 401)

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_list_projects(self, mock_request):
        """Test listing projects in an organization."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "projects": [
                {"id": 10, "name": "project1", "slug": "proj1"},
                {"id": 20, "name": "project2", "slug": "proj2"},
            ]
        }
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        projects = api.list_projects("123")

        self.assertEqual(len(projects), 2)
        self.assertEqual(projects[0]["name"], "project1")

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_get_organization_by_id(self, mock_request):
        """Test getting organization by numeric ID."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "organizations": [
                {"id": 1, "name": "org1", "slug": "org1-slug"},
                {"id": 2, "name": "org2", "slug": "org2-slug"},
            ]
        }
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        org = api.get_organization("2")

        self.assertIsNotNone(org)
        self.assertEqual(org["name"], "org2")

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_get_organization_by_name(self, mock_request):
        """Test getting organization by name."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "organizations": [
                {"id": 1, "name": "my-org", "slug": None},
                {"id": 2, "name": "other-org", "slug": None},
            ]
        }
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        org = api.get_organization("my-org")

        self.assertIsNotNone(org)
        self.assertEqual(org["id"], 1)

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_get_organization_not_found(self, mock_request):
        """Test getting non-existent organization."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"organizations": []}
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        org = api.get_organization("nonexistent")

        self.assertIsNone(org)

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_get_project_by_id(self, mock_request):
        """Test getting project by numeric ID."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "projects": [
                {"id": 10, "name": "project1", "slug": "proj1"},
                {"id": 20, "name": "project2", "slug": "proj2"},
            ]
        }
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        project = api.get_project("org1", "20")

        self.assertIsNotNone(project)
        self.assertEqual(project["name"], "project2")

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_get_project_by_name(self, mock_request):
        """Test getting project by name."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "projects": [
                {"id": 10, "name": "my-project", "slug": None},
            ]
        }
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        project = api.get_project("org1", "my-project")

        self.assertIsNotNone(project)
        self.assertEqual(project["id"], 10)

    @patch("recce_cloud.api.cloud_api.requests.request")
    def test_get_project_not_found(self, mock_request):
        """Test getting non-existent project."""
        from recce_cloud.api.cloud_api import CloudAPI

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"projects": []}
        mock_request.return_value = mock_response

        api = CloudAPI("test_token")
        project = api.get_project("org1", "nonexistent")

        self.assertIsNone(project)

    def test_request_headers(self):
        """Test that requests include authorization header."""
        from recce_cloud.api.cloud_api import CloudAPI

        with patch("recce_cloud.api.cloud_api.requests.request") as mock_request:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"organizations": []}
            mock_request.return_value = mock_response

            api = CloudAPI("my_secret_token")
            api.list_organizations()

            # Check the Authorization header was set
            call_args = mock_request.call_args
            headers = call_args.kwargs.get("headers", {})
            self.assertEqual(headers["Authorization"], "Bearer my_secret_token")


if __name__ == "__main__":
    unittest.main()
