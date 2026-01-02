"""
Integration tests for recce-cloud CLI commands.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from click.testing import CliRunner

from recce_cloud.cli import cloud_cli


class TestUploadDryRun(unittest.TestCase):
    """Test cases for the --dry-run flag in upload command."""

    def setUp(self):
        """Set up test fixtures."""
        self.runner = CliRunner()
        self.temp_dir = tempfile.mkdtemp()

        # Create mock dbt artifacts
        manifest_path = Path(self.temp_dir) / "manifest.json"
        catalog_path = Path(self.temp_dir) / "catalog.json"

        manifest_content = {
            "metadata": {"adapter_type": "postgres"},
            "nodes": {},
        }

        catalog_content = {
            "nodes": {},
        }

        import json

        with open(manifest_path, "w") as f:
            json.dump(manifest_content, f)

        with open(catalog_path, "w") as f:
            json.dump(catalog_content, f)

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_dry_run_github_actions_pr_context(self):
        """Test dry-run with GitHub Actions PR context."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_EVENT_NAME": "pull_request",
            "GITHUB_SHA": "abc123def456",
            "GITHUB_HEAD_REF": "feature/test-branch",
            "GITHUB_BASE_REF": "main",
            "RECCE_API_TOKEN": "test_token_123",
        }

        # Create mock event file
        event_file = Path(self.temp_dir) / "github_event.json"
        import json

        with open(event_file, "w") as f:
            json.dump({"pull_request": {"number": 42}}, f)

        env["GITHUB_EVENT_PATH"] = str(event_file)

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Platform Information:", result.output)
        self.assertIn("Platform: github-actions", result.output)
        self.assertIn("Repository: DataRecce/recce", result.output)
        self.assertIn("CR Number: 42", result.output)
        self.assertIn("Commit SHA: abc123de", result.output)
        self.assertIn("Source Branch: feature/test-branch", result.output)
        self.assertIn("Base Branch: main", result.output)
        self.assertIn("Upload Workflow:", result.output)
        self.assertIn("Auto-create session and upload", result.output)
        self.assertIn("Platform-specific APIs will be used", result.output)
        self.assertIn("Files to upload:", result.output)
        self.assertIn("manifest.json:", result.output)
        self.assertIn("catalog.json:", result.output)
        self.assertIn("Adapter type: postgres", result.output)
        self.assertIn("Dry run completed successfully", result.output)

    def test_dry_run_gitlab_ci_mr_context(self):
        """Test dry-run with GitLab CI MR context."""
        env = {
            "GITLAB_CI": "true",
            "CI_PROJECT_PATH": "recce/jaffle-shop",
            "CI_PROJECT_URL": "https://gitlab.com/recce/jaffle-shop",
            "CI_MERGE_REQUEST_IID": "5",
            "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "feature/new-models",
            "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "main",
            "CI_COMMIT_SHA": "def456abc789",
            "CI_SERVER_URL": "https://gitlab.com",
            "RECCE_API_TOKEN": "test_token_abc",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Platform Information:", result.output)
        self.assertIn("Platform: gitlab-ci", result.output)
        self.assertIn("Repository: recce/jaffle-shop", result.output)
        self.assertIn("CR Number: 5", result.output)
        self.assertIn("Commit SHA: def456ab", result.output)
        self.assertIn("Source Branch: feature/new-models", result.output)
        self.assertIn("Base Branch: main", result.output)
        self.assertIn("Auto-create session and upload", result.output)
        self.assertIn("Platform-specific APIs will be used", result.output)
        self.assertIn("Adapter type: postgres", result.output)

    def test_dry_run_gitlab_ci_self_hosted(self):
        """Test dry-run with self-hosted GitLab instance."""
        env = {
            "GITLAB_CI": "true",
            "CI_PROJECT_PATH": "data-team/dbt-project",
            "CI_PROJECT_URL": "https://gitlab.mycompany.com/data-team/dbt-project",
            "CI_MERGE_REQUEST_IID": "25",
            "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "develop",
            "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "production",
            "CI_COMMIT_SHA": "fedcba987654",
            "CI_SERVER_URL": "https://gitlab.mycompany.com",
            "RECCE_API_TOKEN": "test_token_xyz",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Platform: gitlab-ci", result.output)
        self.assertIn("Repository: data-team/dbt-project", result.output)
        self.assertIn("CR Number: 25", result.output)
        self.assertIn("Source Branch: develop", result.output)
        self.assertIn("Base Branch: production", result.output)

    def test_dry_run_with_session_id(self):
        """Test dry-run with existing session ID (generic workflow)."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "RECCE_API_TOKEN": "test_token_789",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                [
                    "upload",
                    "--target-path",
                    self.temp_dir,
                    "--session-id",
                    "sess_abc123xyz",
                    "--dry-run",
                ],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Upload Workflow:", result.output)
        self.assertIn("Upload to existing session", result.output)
        self.assertIn("Session ID: sess_abc123xyz", result.output)
        self.assertNotIn("Auto-create session", result.output)

    def test_dry_run_github_main_branch(self):
        """Test dry-run with GitHub Actions main branch (no PR)."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_REF": "refs/heads/main",
            "GITHUB_SHA": "xyz789abc123",
            "RECCE_API_TOKEN": "test_token_456",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Platform: github-actions", result.output)
        self.assertIn("Repository: DataRecce/recce", result.output)
        self.assertIn("Commit SHA: xyz789ab", result.output)
        # Session type depends on git branch detection, could be prod or dev
        self.assertIn("Session Type:", result.output)
        # Should not have CR number
        self.assertNotIn("CR Number:", result.output)

    def test_dry_run_gitlab_main_branch(self):
        """Test dry-run with GitLab CI main branch (no MR)."""
        env = {
            "GITLAB_CI": "true",
            "CI_PROJECT_PATH": "recce/analytics",
            "CI_PROJECT_URL": "https://gitlab.com/recce/analytics",
            "CI_COMMIT_BRANCH": "main",
            "CI_COMMIT_SHA": "123abc456def",
            "CI_SERVER_URL": "https://gitlab.com",
            "RECCE_API_TOKEN": "test_token_main",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Platform: gitlab-ci", result.output)
        self.assertIn("Repository: recce/analytics", result.output)
        # Session type depends on git branch detection, could be prod or dev
        self.assertIn("Session Type:", result.output)
        # Should not have CR number
        self.assertNotIn("CR Number:", result.output)

    def test_dry_run_with_manual_overrides(self):
        """Test dry-run with manual overrides."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_EVENT_NAME": "pull_request",
            "GITHUB_SHA": "abc123",
            "RECCE_API_TOKEN": "test_token",
        }

        # Create mock event file with PR number 42
        event_file = Path(self.temp_dir) / "github_event.json"
        import json

        with open(event_file, "w") as f:
            json.dump({"pull_request": {"number": 42}}, f)

        env["GITHUB_EVENT_PATH"] = str(event_file)

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                [
                    "upload",
                    "--target-path",
                    self.temp_dir,
                    "--cr",
                    "100",
                    "--type",
                    "cr",
                    "--dry-run",
                ],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        # Should show overridden CR number
        self.assertIn("CR Number: 100", result.output)
        self.assertIn("Session Type: cr", result.output)

    def test_dry_run_no_ci_environment(self):
        """Test dry-run without CI environment (local development)."""
        env = {
            "RECCE_API_TOKEN": "test_token_local",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                [
                    "upload",
                    "--target-path",
                    self.temp_dir,
                    "--session-id",
                    "sess_local123",
                    "--dry-run",
                ],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Upload to existing session", result.output)
        self.assertIn("Session ID: sess_local123", result.output)
        # Should not show platform information
        self.assertNotIn("Platform Information:", result.output)

    def test_dry_run_unsupported_platform_without_session_id(self):
        """Test dry-run with unsupported platform and no session ID."""
        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Auto-create session and upload", result.output)
        self.assertIn("Warning: Platform not supported for auto-session creation", result.output)

    def test_dry_run_missing_artifacts(self):
        """Test dry-run with missing dbt artifacts."""
        import shutil

        shutil.rmtree(self.temp_dir)

        env = {
            "GITHUB_ACTIONS": "true",
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        # Should fail before dry-run validation happens
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("does not exist", result.output)

    def test_dry_run_custom_target_path(self):
        """Test dry-run with custom target path."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["upload", "--target-path", self.temp_dir, "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn(self.temp_dir, result.output)
        self.assertIn("manifest.json:", result.output)
        self.assertIn("catalog.json:", result.output)


class TestDownloadDryRun(unittest.TestCase):
    """Test cases for the --dry-run flag in download command."""

    def setUp(self):
        """Set up test fixtures."""
        self.runner = CliRunner()
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_dry_run_github_actions_pr_context(self):
        """Test dry-run with GitHub Actions PR context."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_EVENT_NAME": "pull_request",
            "GITHUB_SHA": "abc123def456",
            "GITHUB_HEAD_REF": "feature/test-branch",
            "GITHUB_BASE_REF": "main",
            "GITHUB_TOKEN": "test_token_123",
        }

        # Create mock event file
        event_file = Path(self.temp_dir) / "github_event.json"
        import json

        with open(event_file, "w") as f:
            json.dump({"pull_request": {"number": 42}}, f)

        env["GITHUB_EVENT_PATH"] = str(event_file)

        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(download_dir), "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Platform Information:", result.output)
        self.assertIn("Platform: github-actions", result.output)
        self.assertIn("Repository: DataRecce/recce", result.output)
        self.assertIn("Session Type: cr", result.output)
        self.assertIn("PR Number: 42", result.output)
        self.assertIn("Download Workflow:", result.output)
        self.assertIn("Auto-detect and download PR/MR session", result.output)
        self.assertIn("Platform-specific APIs will be used", result.output)
        self.assertIn("Download destination:", result.output)
        self.assertIn("manifest.json, catalog.json", result.output)
        self.assertIn("Dry run completed successfully", result.output)

        # Download command should NOT show commit SHA or branches (irrelevant for download)
        self.assertNotIn("Commit SHA:", result.output)
        self.assertNotIn("Base Branch:", result.output)
        self.assertNotIn("Source Branch:", result.output)

    def test_dry_run_gitlab_ci_mr_context(self):
        """Test dry-run with GitLab CI MR context."""
        env = {
            "GITLAB_CI": "true",
            "CI_PROJECT_PATH": "recce/jaffle-shop",
            "CI_PROJECT_URL": "https://gitlab.com/recce/jaffle-shop",
            "CI_MERGE_REQUEST_IID": "5",
            "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "feature/new-models",
            "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "main",
            "CI_COMMIT_SHA": "def456abc789",
            "CI_SERVER_URL": "https://gitlab.com",
            "CI_JOB_TOKEN": "test_job_token_abc",
        }

        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(download_dir), "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Platform Information:", result.output)
        self.assertIn("Platform: gitlab-ci", result.output)
        self.assertIn("Repository: recce/jaffle-shop", result.output)
        self.assertIn("Session Type: cr", result.output)
        self.assertIn("MR Number: 5", result.output)
        self.assertIn("Auto-detect and download PR/MR session", result.output)
        self.assertIn("Platform-specific APIs will be used", result.output)

        # Download command should NOT show commit SHA or branches (irrelevant for download)
        self.assertNotIn("Commit SHA:", result.output)
        self.assertNotIn("Base Branch:", result.output)
        self.assertNotIn("Source Branch:", result.output)

    def test_dry_run_with_prod_flag(self):
        """Test dry-run with --prod flag for production/base session."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_EVENT_NAME": "pull_request",
            "GITHUB_SHA": "abc123",
            "GITHUB_TOKEN": "test_token",
        }

        # Create mock event file
        event_file = Path(self.temp_dir) / "github_event.json"
        import json

        with open(event_file, "w") as f:
            json.dump({"pull_request": {"number": 42}}, f)

        env["GITHUB_EVENT_PATH"] = str(event_file)
        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(download_dir), "--prod", "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Download project's production/base session", result.output)
        self.assertIn("Session Type: prod", result.output)

        # Prod session should NOT show PR/CR number
        self.assertNotIn("PR Number:", result.output)
        self.assertNotIn("CR Number:", result.output)

        # Download command should NOT show commit SHA or branches
        self.assertNotIn("Commit SHA:", result.output)
        self.assertNotIn("Base Branch:", result.output)
        self.assertNotIn("Source Branch:", result.output)

    def test_dry_run_with_session_id(self):
        """Test dry-run with existing session ID (generic workflow)."""
        env = {
            "RECCE_API_TOKEN": "test_token_789",
        }

        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                [
                    "download",
                    "--target-path",
                    str(download_dir),
                    "--session-id",
                    "sess_abc123xyz",
                    "--dry-run",
                ],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Download Workflow:", result.output)
        self.assertIn("Download from specific session ID", result.output)
        self.assertIn("Session ID: sess_abc123xyz", result.output)

    def test_dry_run_with_force_flag(self):
        """Test dry-run with --force flag."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_TOKEN": "test_token",
        }

        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(download_dir), "--force", "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Will overwrite existing files", result.output)

    def test_dry_run_existing_target_path_without_force(self):
        """Test dry-run with existing target path (without --force)."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_TOKEN": "test_token",
        }

        # Create existing target directory
        download_dir = Path(self.temp_dir) / "download"
        download_dir.mkdir()

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(download_dir), "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Warning: Target path exists (use --force to overwrite)", result.output)

    def test_dry_run_session_id_with_prod_warning(self):
        """Test dry-run shows warning when both --session-id and --prod are provided."""
        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                [
                    "download",
                    "--target-path",
                    str(download_dir),
                    "--session-id",
                    "sess_123",
                    "--prod",
                    "--dry-run",
                ],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Warning:", result.output)
        self.assertIn("--prod is ignored when --session-id is provided", result.output)

    def test_dry_run_no_ci_without_session_id(self):
        """Test dry-run without CI environment and no session ID."""
        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(download_dir), "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Warning: Platform not supported for auto-session discovery", result.output)

    def test_dry_run_gitlab_ci_self_hosted(self):
        """Test dry-run with self-hosted GitLab instance."""
        env = {
            "GITLAB_CI": "true",
            "CI_PROJECT_PATH": "data-team/dbt-project",
            "CI_PROJECT_URL": "https://gitlab.mycompany.com/data-team/dbt-project",
            "CI_MERGE_REQUEST_IID": "25",
            "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "develop",
            "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "production",
            "CI_COMMIT_SHA": "fedcba987654",
            "CI_SERVER_URL": "https://gitlab.mycompany.com",
            "CI_JOB_TOKEN": "test_job_token_xyz",
        }

        download_dir = Path(self.temp_dir) / "download"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(download_dir), "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Platform: gitlab-ci", result.output)
        self.assertIn("Repository: data-team/dbt-project", result.output)
        self.assertIn("Session Type: cr", result.output)
        self.assertIn("MR Number: 25", result.output)

        # Download command should NOT show commit SHA or branches (irrelevant for download)
        self.assertNotIn("Commit SHA:", result.output)
        self.assertNotIn("Base Branch:", result.output)
        self.assertNotIn("Source Branch:", result.output)

    def test_dry_run_github_main_branch(self):
        """Test dry-run with GitHub Actions main branch (no PR).

        Without --prod flag, the session type is auto-detected as 'prod' because:
        1. No PR number (GITHUB_HEAD_REF is not set)
        2. Branch is 'main' (from git command fallback, mocked in test)
        3. determine_session_type(cr_number=None, source_branch='main') returns 'prod'

        This allows download to work without explicit --prod flag on main branch.
        """
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_REF": "refs/heads/main",
            "GITHUB_SHA": "xyz789abc123",
            "GITHUB_TOKEN": "test_token_456",
        }

        download_dir = Path(self.temp_dir) / "download"

        # Mock git command to return "main" branch
        # This simulates the fallback when GITHUB_REF_NAME is not available
        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.ci_providers.base.BaseCIProvider.run_git_command") as mock_git:
                mock_git.return_value = "main"

                result = self.runner.invoke(
                    cloud_cli,
                    ["download", "--target-path", str(download_dir), "--dry-run"],
                )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Platform: github-actions", result.output)
        self.assertIn("Repository: DataRecce/recce", result.output)
        self.assertIn("Session Type: prod", result.output)  # Auto-detected from main branch

        # Prod session should NOT show CR number or PR number
        self.assertNotIn("PR Number:", result.output)
        self.assertNotIn("CR Number:", result.output)

        # Download command should NOT show commit SHA or branches (irrelevant for download)
        self.assertNotIn("Commit SHA:", result.output)
        self.assertNotIn("Base Branch:", result.output)
        self.assertNotIn("Source Branch:", result.output)

    def test_dry_run_custom_target_path(self):
        """Test dry-run with custom target path."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_TOKEN": "test_token",
        }

        custom_path = Path(self.temp_dir) / "custom" / "target"

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["download", "--target-path", str(custom_path), "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn(str(custom_path), result.output)
        self.assertIn("manifest.json, catalog.json", result.output)


class TestDeleteDryRun(unittest.TestCase):
    """Test cases for the --dry-run flag in delete command."""

    def setUp(self):
        """Set up test fixtures."""
        self.runner = CliRunner()
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_dry_run_github_actions_pr_context(self):
        """Test dry-run with GitHub Actions PR context."""
        env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "DataRecce/recce",
            "GITHUB_EVENT_NAME": "pull_request",
            "GITHUB_SHA": "abc123def456",
            "GITHUB_HEAD_REF": "feature/test-branch",
            "GITHUB_BASE_REF": "main",
            "GITHUB_TOKEN": "test_token_123",
        }

        # Create mock event file
        event_file = Path(self.temp_dir) / "github_event.json"
        import json

        with open(event_file, "w") as f:
            json.dump({"pull_request": {"number": 42}}, f)

        env["GITHUB_EVENT_PATH"] = str(event_file)

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["delete", "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Platform Information:", result.output)
        self.assertIn("Platform: github-actions", result.output)
        self.assertIn("Repository: DataRecce/recce", result.output)
        self.assertIn("Session Type: cr", result.output)
        self.assertIn("PR Number: 42", result.output)
        self.assertIn("Delete Workflow:", result.output)
        self.assertIn("Auto-detect and delete PR/MR session", result.output)
        self.assertIn("Platform-specific APIs will be used", result.output)
        self.assertIn("Dry run completed successfully", result.output)

    def test_dry_run_gitlab_ci_mr_context(self):
        """Test dry-run with GitLab CI MR context."""
        env = {
            "GITLAB_CI": "true",
            "CI_PROJECT_PATH": "recce/jaffle-shop",
            "CI_PROJECT_URL": "https://gitlab.com/recce/jaffle-shop",
            "CI_MERGE_REQUEST_IID": "5",
            "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "feature/new-models",
            "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "main",
            "CI_COMMIT_SHA": "def456abc789",
            "CI_SERVER_URL": "https://gitlab.com",
            "CI_JOB_TOKEN": "test_job_token_abc",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["delete", "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Platform Information:", result.output)
        self.assertIn("Platform: gitlab-ci", result.output)
        self.assertIn("Repository: recce/jaffle-shop", result.output)
        self.assertIn("Session Type: cr", result.output)
        self.assertIn("MR Number: 5", result.output)
        self.assertIn("Auto-detect and delete PR/MR session", result.output)
        self.assertIn("Platform-specific APIs will be used", result.output)

    def test_dry_run_with_session_id(self):
        """Test dry-run with existing session ID (generic workflow)."""
        env = {
            "RECCE_API_TOKEN": "test_token_789",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                [
                    "delete",
                    "--session-id",
                    "sess_abc123xyz",
                    "--dry-run",
                ],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Delete Workflow:", result.output)
        self.assertIn("Delete specific session by ID", result.output)
        self.assertIn("Session ID: sess_abc123xyz", result.output)

        # User interactive mode should NOT show session type
        self.assertNotIn("Session Type:", result.output)

    def test_dry_run_no_ci_without_session_id(self):
        """Test dry-run without CI environment and no session ID."""
        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["delete", "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Dry run mode enabled", result.output)
        self.assertIn("Warning: Platform not supported for auto-session discovery", result.output)

    def test_dry_run_gitlab_ci_self_hosted(self):
        """Test dry-run with self-hosted GitLab instance."""
        env = {
            "GITLAB_CI": "true",
            "CI_PROJECT_PATH": "data-team/dbt-project",
            "CI_PROJECT_URL": "https://gitlab.mycompany.com/data-team/dbt-project",
            "CI_MERGE_REQUEST_IID": "25",
            "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "develop",
            "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "production",
            "CI_COMMIT_SHA": "fedcba987654",
            "CI_SERVER_URL": "https://gitlab.mycompany.com",
            "CI_JOB_TOKEN": "test_job_token_xyz",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["delete", "--dry-run"],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Platform: gitlab-ci", result.output)
        self.assertIn("Repository: data-team/dbt-project", result.output)
        self.assertIn("Session Type: cr", result.output)
        self.assertIn("MR Number: 25", result.output)


if __name__ == "__main__":
    unittest.main()
