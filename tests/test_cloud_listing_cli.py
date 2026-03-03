import unittest
from unittest.mock import Mock, patch

from click.testing import CliRunner

from recce.cli import list_organizations, list_projects, list_sessions
from recce.exceptions import RecceConfigException
from recce.util.recce_cloud import RecceCloudException


class TestCloudListingCLI(unittest.TestCase):
    """Test cases for the cloud listing CLI commands."""

    def setUp(self):
        """Set up test fixtures."""
        self.runner = CliRunner()

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_organizations_success(self, mock_recce_cloud, mock_prepare_token):
        """Test successful list-organizations command."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_organizations.return_value = [
            {"id": 1, "name": "org1", "display_name": "Organization 1"},
            {"id": 2, "name": "org2", "display_name": "Organization 2"},
        ]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command
        result = self.runner.invoke(list_organizations, [])

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Organizations", result.output)
        self.assertIn("org1", result.output)
        self.assertIn("Organization 1", result.output)
        self.assertIn("org2", result.output)
        self.assertIn("Organization 2", result.output)
        mock_cloud_instance.list_organizations.assert_called_once()

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_organizations_empty(self, mock_recce_cloud, mock_prepare_token):
        """Test list-organizations command with no organizations."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_organizations.return_value = []
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command
        result = self.runner.invoke(list_organizations, [])

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("No organizations found", result.output)

    @patch("recce.cli.prepare_api_token")
    def test_list_organizations_invalid_token(self, mock_prepare_token):
        """Test list-organizations command with invalid token."""
        # Setup mock to raise exception
        mock_prepare_token.side_effect = RecceConfigException("Invalid token")

        # Test command
        result = self.runner.invoke(list_organizations, [])

        # Assertions
        self.assertEqual(result.exit_code, 1)

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_projects_with_cli_arg(self, mock_recce_cloud, mock_prepare_token):
        """Test list-projects command with CLI argument."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_projects.return_value = [
            {"id": 1, "name": "project1", "display_name": "Project 1"},
            {"id": 2, "name": "project2", "display_name": "Project 2"},
        ]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command with CLI argument
        result = self.runner.invoke(list_projects, ["--organization", "8"])

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Projects in Organization 8", result.output)
        self.assertIn("project1", result.output)
        self.assertIn("Project 1", result.output)
        mock_cloud_instance.list_projects.assert_called_once_with("8")

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_projects_with_env_var(self, mock_recce_cloud, mock_prepare_token):
        """Test list-projects command with environment variable."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_projects.return_value = [{"id": 1, "name": "project1", "display_name": "Project 1"}]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command with environment variable
        result = self.runner.invoke(list_projects, [], env={"RECCE_ORGANIZATION_ID": "8"})

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Projects in Organization 8", result.output)
        self.assertIn("project1", result.output)
        mock_cloud_instance.list_projects.assert_called_once_with("8")

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_projects_cli_overrides_env(self, mock_recce_cloud, mock_prepare_token):
        """Test list-projects command where CLI argument overrides environment variable."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_projects.return_value = [{"id": 1, "name": "project1", "display_name": "Project 1"}]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command with both env var and CLI arg (CLI should win)
        result = self.runner.invoke(list_projects, ["--organization", "10"], env={"RECCE_ORGANIZATION_ID": "8"})

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Projects in Organization 10", result.output)
        # Verify CLI argument (10) was used, not env var (8)
        mock_cloud_instance.list_projects.assert_called_once_with("10")

    @patch("recce.cli.prepare_api_token")
    def test_list_projects_missing_organization(self, mock_prepare_token):
        """Test list-projects command with missing organization ID."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"

        # Test command without organization ID
        result = self.runner.invoke(list_projects, [])

        # Assertions
        self.assertEqual(result.exit_code, 1)
        self.assertIn("Organization ID is required", result.output)
        self.assertIn("--organization", result.output)
        self.assertIn("RECCE_ORGANIZATION_ID", result.output)

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_projects_empty(self, mock_recce_cloud, mock_prepare_token):
        """Test list-projects command with no projects."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_projects.return_value = []
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command
        result = self.runner.invoke(list_projects, ["--organization", "8"])

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("No projects found in organization 8", result.output)

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_sessions_with_cli_args(self, mock_recce_cloud, mock_prepare_token):
        """Test list-sessions command with CLI arguments."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_sessions.return_value = [
            {"id": "session1", "name": "PR-123", "is_base": False},
            {"id": "session2", "name": "Base Session", "is_base": True},
        ]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command with CLI arguments
        result = self.runner.invoke(list_sessions, ["--organization", "8", "--project", "7"])

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Sessions in Project 7", result.output)
        self.assertIn("PR-123", result.output)
        self.assertIn("Base Session", result.output)
        self.assertIn("✓", result.output)  # Base session marker
        mock_cloud_instance.list_sessions.assert_called_once_with("8", "7")

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_sessions_with_env_vars(self, mock_recce_cloud, mock_prepare_token):
        """Test list-sessions command with environment variables."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_sessions.return_value = [{"id": "session1", "name": "Session 1", "is_base": False}]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command with environment variables
        result = self.runner.invoke(list_sessions, [], env={"RECCE_ORGANIZATION_ID": "8", "RECCE_PROJECT_ID": "7"})

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Sessions in Project 7", result.output)
        self.assertIn("Session 1", result.output)
        mock_cloud_instance.list_sessions.assert_called_once_with("8", "7")

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_sessions_mixed_env_and_cli(self, mock_recce_cloud, mock_prepare_token):
        """Test list-sessions command with mixed environment variables and CLI args."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_sessions.return_value = [{"id": "session1", "name": "Session 1", "is_base": False}]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command with env var for org and CLI arg for project
        result = self.runner.invoke(list_sessions, ["--project", "9"], env={"RECCE_ORGANIZATION_ID": "8"})

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Sessions in Project 9", result.output)
        # Verify it used env var for org (8) and CLI arg for project (9)
        mock_cloud_instance.list_sessions.assert_called_once_with("8", "9")

    @patch("recce.cli.prepare_api_token")
    def test_list_sessions_missing_organization(self, mock_prepare_token):
        """Test list-sessions command with missing organization ID."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"

        # Test command without organization ID
        result = self.runner.invoke(list_sessions, ["--project", "7"])

        # Assertions
        self.assertEqual(result.exit_code, 1)
        self.assertIn("Organization ID is required", result.output)
        self.assertIn("--organization", result.output)
        self.assertIn("RECCE_ORGANIZATION_ID", result.output)

    @patch("recce.cli.prepare_api_token")
    def test_list_sessions_missing_project(self, mock_prepare_token):
        """Test list-sessions command with missing project ID."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"

        # Test command without project ID
        result = self.runner.invoke(list_sessions, ["--organization", "8"])

        # Assertions
        self.assertEqual(result.exit_code, 1)
        self.assertIn("Project ID is required", result.output)
        self.assertIn("--project", result.output)
        self.assertIn("RECCE_PROJECT_ID", result.output)

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_sessions_empty(self, mock_recce_cloud, mock_prepare_token):
        """Test list-sessions command with no sessions."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_sessions.return_value = []
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command
        result = self.runner.invoke(list_sessions, ["--organization", "8", "--project", "7"])

        # Assertions
        self.assertEqual(result.exit_code, 0)
        self.assertIn("No sessions found in project 7", result.output)

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_list_sessions_api_error(self, mock_recce_cloud, mock_prepare_token):
        """Test list-sessions command with API error."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_sessions.side_effect = RecceCloudException("Access denied", "Forbidden", 403)
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command
        result = self.runner.invoke(list_sessions, ["--organization", "8", "--project", "7"])

        # Assertions
        self.assertEqual(result.exit_code, 1)
        self.assertIn("Error", result.output)

    @patch("recce.cli.prepare_api_token")
    @patch("recce.util.recce_cloud.RecceCloud")
    def test_sessions_base_session_display(self, mock_recce_cloud, mock_prepare_token):
        """Test that base sessions are properly marked with checkmark."""
        # Setup mocks
        mock_prepare_token.return_value = "test-token"
        mock_cloud_instance = Mock()
        mock_cloud_instance.list_sessions.return_value = [
            {"id": "session1", "name": "Regular Session", "is_base": False},
            {"id": "session2", "name": "Base Session", "is_base": True},
            {"id": "session3", "name": "Another Regular", "is_base": False},
        ]
        mock_recce_cloud.return_value = mock_cloud_instance

        # Test command
        result = self.runner.invoke(list_sessions, ["--organization", "8", "--project", "7"])

        # Assertions
        self.assertEqual(result.exit_code, 0)
        output_lines = result.output.split("\n")

        # Find the base session line and verify it has the checkmark
        base_session_line = None
        for line in output_lines:
            if "Base Session" in line:
                base_session_line = line
                break

        self.assertIsNotNone(base_session_line)
        self.assertIn("✓", base_session_line)


if __name__ == "__main__":
    unittest.main()
