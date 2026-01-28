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
        self.assertIn("PR Number: 42", result.output)
        self.assertIn("Commit SHA: abc123de", result.output)
        self.assertIn("Source Branch: feature/test-branch", result.output)
        self.assertIn("Base Branch: main", result.output)
        self.assertIn("Upload Workflow:", result.output)
        self.assertIn("Auto-preate session and upload", result.output)
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
        self.assertIn("PR Number: 5", result.output)
        self.assertIn("Commit SHA: def456ab", result.output)
        self.assertIn("Source Branch: feature/new-models", result.output)
        self.assertIn("Base Branch: main", result.output)
        self.assertIn("Auto-preate session and upload", result.output)
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
        self.assertIn("PR Number: 25", result.output)
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
        self.assertNotIn("Auto-preate session", result.output)

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
        self.assertNotIn("PR Number:", result.output)

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
        self.assertNotIn("PR Number:", result.output)

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
                    "--pr",
                    "100",
                    "--type",
                    "pr",
                    "--dry-run",
                ],
            )

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        # Should show overridden CR number
        self.assertIn("PR Number: 100", result.output)
        self.assertIn("Session Type: pr", result.output)

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
        self.assertIn("Auto-preate session and upload", result.output)
        self.assertIn("Warning: Platform not supported for auto-session preation", result.output)

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
        self.assertIn("Session Type: pr", result.output)
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
        self.assertIn("Session Type: pr", result.output)
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
        self.assertNotIn("PR Number:", result.output)

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
        self.assertIn("Session Type: pr", result.output)
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
        3. determine_session_type(pr_number=None, source_branch='main') returns 'prod'

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
        self.assertNotIn("PR Number:", result.output)

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
        self.assertIn("Session Type: pr", result.output)
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
        self.assertIn("Session Type: pr", result.output)
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
        self.assertIn("Session Type: pr", result.output)
        self.assertIn("MR Number: 25", result.output)


class TestDoctor(unittest.TestCase):
    """Test cases for the doctor command."""

    def setUp(self):
        """Set up test fixtures."""
        self.runner = CliRunner()
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_doctor_not_logged_in(self):
        """Test doctor command when not logged in."""
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value=None):
                with patch("recce_cloud.config.project_config.get_project_binding", return_value=None):
                    result = self.runner.invoke(cloud_cli, ["doctor"])

        # Assertions
        self.assertNotEqual(result.exit_code, 0, "Should fail when not logged in")
        self.assertIn("Recce Doctor", result.output)
        self.assertIn("1. Login Status", result.output)
        self.assertIn("Not logged in", result.output)
        self.assertIn("recce-cloud login", result.output)

    def test_doctor_no_project_binding(self):
        """Test doctor command when no project is bound."""
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="test_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(True, "test@example.com")):
                    with patch("recce_cloud.config.project_config.get_project_binding", return_value=None):
                        result = self.runner.invoke(cloud_cli, ["doctor"])

        # Assertions
        self.assertNotEqual(result.exit_code, 0, "Should fail when no project binding")
        self.assertIn("Recce Doctor", result.output)
        self.assertIn("1. Login Status", result.output)
        self.assertIn("Logged in as", result.output)
        self.assertIn("test@example.com", result.output)
        self.assertIn("2. Project Binding", result.output)
        self.assertIn("No project binding found", result.output)
        self.assertIn("recce-cloud init", result.output)

    def test_doctor_env_var_project_binding(self):
        """Test doctor command with project binding from environment variables."""
        env = {
            "RECCE_ORG": "test-org",
            "RECCE_PROJECT": "test-project",
        }

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="test_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(True, "test@example.com")):
                    with patch("recce_cloud.config.project_config.get_project_binding", return_value=None):
                        # Mock API calls
                        with patch("recce_cloud.api.client.RecceCloudClient.get_organization") as mock_get_org:
                            with patch("recce_cloud.api.client.RecceCloudClient.get_project") as mock_get_project:
                                with patch(
                                    "recce_cloud.api.client.RecceCloudClient.list_sessions"
                                ) as mock_list_sessions:
                                    mock_get_org.return_value = {"id": "org-123", "slug": "test-org"}
                                    mock_get_project.return_value = {"id": "proj-456", "slug": "test-project"}
                                    mock_list_sessions.return_value = []

                                    result = self.runner.invoke(cloud_cli, ["doctor"])

        # Assertions
        self.assertIn("Bound to", result.output)
        self.assertIn("test-org/test-project", result.output)
        self.assertIn("via env vars", result.output)

    def test_doctor_all_checks_pass(self):
        """Test doctor command when all checks pass."""
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="test_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(True, "test@example.com")):
                    with patch(
                        "recce_cloud.config.project_config.get_project_binding",
                        return_value={"org_id": "org-123", "project_id": "proj-456"},
                    ):
                        # Mock API calls
                        with patch("recce_cloud.api.client.RecceCloudClient.get_organization") as mock_get_org:
                            with patch("recce_cloud.api.client.RecceCloudClient.get_project") as mock_get_project:
                                with patch(
                                    "recce_cloud.api.client.RecceCloudClient.list_sessions"
                                ) as mock_list_sessions:
                                    mock_get_org.return_value = {"id": "org-123", "slug": "myorg"}
                                    mock_get_project.return_value = {"id": "proj-456", "slug": "myproject"}
                                    mock_list_sessions.return_value = [
                                        {
                                            "id": "sess-prod",
                                            "name": "prod",
                                            "is_base": True,
                                            "adapter_type": "snowflake",
                                            "updated_at": "2026-01-20T10:00:00Z",
                                        },
                                        {
                                            "id": "sess-dev",
                                            "name": "feature-update",
                                            "is_base": False,
                                            "pr_link": None,
                                            "updated_at": "2026-01-20T11:30:00Z",
                                        },
                                    ]

                                    result = self.runner.invoke(cloud_cli, ["doctor"])

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Should pass when all checks pass: {result.output}")
        self.assertIn("Recce Doctor", result.output)
        self.assertIn("Logged in as", result.output)
        self.assertIn("Bound to", result.output)
        self.assertIn("org-123/proj-456", result.output)
        self.assertIn("Found production session", result.output)
        self.assertIn("prod", result.output)
        self.assertIn("Found dev session", result.output)
        self.assertIn("feature-update", result.output)
        self.assertIn("All checks passed", result.output)

    def test_doctor_no_production_session(self):
        """Test doctor command when no production session exists."""
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="test_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(True, "test@example.com")):
                    with patch(
                        "recce_cloud.config.project_config.get_project_binding",
                        return_value={"org": "myorg", "project": "myproject"},
                    ):
                        # Mock API calls
                        with patch("recce_cloud.api.client.RecceCloudClient.get_organization") as mock_get_org:
                            with patch("recce_cloud.api.client.RecceCloudClient.get_project") as mock_get_project:
                                with patch(
                                    "recce_cloud.api.client.RecceCloudClient.list_sessions"
                                ) as mock_list_sessions:
                                    mock_get_org.return_value = {"id": "org-123", "slug": "myorg"}
                                    mock_get_project.return_value = {"id": "proj-456", "slug": "myproject"}
                                    mock_list_sessions.return_value = []  # No sessions

                                    result = self.runner.invoke(cloud_cli, ["doctor"])

        # Assertions
        self.assertNotEqual(result.exit_code, 0, "Should fail when no production session")
        self.assertIn("No production artifacts found", result.output)
        self.assertIn("dbt docs generate --target prod", result.output)
        self.assertIn("recce-cloud upload --type prod", result.output)

    def test_doctor_production_session_no_data(self):
        """Test doctor command when production session exists but has no data (adapter is null)."""
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="test_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(True, "test@example.com")):
                    with patch(
                        "recce_cloud.config.project_config.get_project_binding",
                        return_value={"org": "myorg", "project": "myproject"},
                    ):
                        # Mock API calls
                        with patch("recce_cloud.api.client.RecceCloudClient.get_organization") as mock_get_org:
                            with patch("recce_cloud.api.client.RecceCloudClient.get_project") as mock_get_project:
                                with patch(
                                    "recce_cloud.api.client.RecceCloudClient.list_sessions"
                                ) as mock_list_sessions:
                                    mock_get_org.return_value = {"id": "org-123", "slug": "myorg"}
                                    mock_get_project.return_value = {"id": "proj-456", "slug": "myproject"}
                                    # Production session exists but has no data (adapter is null)
                                    mock_list_sessions.return_value = [
                                        {
                                            "id": "sess-prod",
                                            "name": "prod",
                                            "is_base": True,
                                            "adapter_type": None,  # No data uploaded yet
                                            "updated_at": "2026-01-20T10:00:00Z",
                                        },
                                    ]

                                    result = self.runner.invoke(cloud_cli, ["doctor"])

        # Assertions
        self.assertNotEqual(result.exit_code, 0, "Should fail when production session has no data")
        self.assertIn("Production session exists but has no data", result.output)
        self.assertIn("dbt docs generate --target prod", result.output)
        self.assertIn("recce-cloud upload --type prod", result.output)

    def test_doctor_json_output(self):
        """Test doctor command with JSON output."""
        import json

        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="test_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(True, "test@example.com")):
                    with patch(
                        "recce_cloud.config.project_config.get_project_binding",
                        return_value={"org_id": "org-123", "project_id": "proj-456"},
                    ):
                        # Mock API calls
                        with patch("recce_cloud.api.client.RecceCloudClient.get_organization") as mock_get_org:
                            with patch("recce_cloud.api.client.RecceCloudClient.get_project") as mock_get_project:
                                with patch(
                                    "recce_cloud.api.client.RecceCloudClient.list_sessions"
                                ) as mock_list_sessions:
                                    mock_get_org.return_value = {"id": "org-123", "slug": "myorg"}
                                    mock_get_project.return_value = {"id": "proj-456", "slug": "myproject"}
                                    mock_list_sessions.return_value = [
                                        {
                                            "id": "sess-prod",
                                            "name": "prod",
                                            "is_base": True,
                                            "adapter_type": "snowflake",
                                            "updated_at": "2026-01-20T10:00:00Z",
                                        },
                                        {
                                            "id": "sess-dev",
                                            "name": "dev",
                                            "is_base": False,
                                            "pr_link": None,
                                            "updated_at": "2026-01-20T11:00:00Z",
                                        },
                                    ]

                                    result = self.runner.invoke(cloud_cli, ["doctor", "--json"])

        # Assertions
        self.assertEqual(result.exit_code, 0, f"Should pass with JSON output: {result.output}")

        # Parse JSON output
        data = json.loads(result.output)
        self.assertEqual(data["login"]["status"], "pass")
        self.assertEqual(data["login"]["email"], "test@example.com")
        self.assertEqual(data["project_binding"]["status"], "pass")
        self.assertEqual(data["project_binding"]["org_id"], "org-123")
        self.assertEqual(data["project_binding"]["project_id"], "proj-456")
        self.assertEqual(data["production_metadata"]["status"], "pass")
        self.assertEqual(data["production_metadata"]["session_name"], "prod")
        self.assertEqual(data["dev_session"]["status"], "pass")
        self.assertEqual(data["dev_session"]["session_name"], "dev")
        self.assertTrue(data["all_passed"])

    def test_doctor_json_output_failure(self):
        """Test doctor command with JSON output when checks fail."""
        import json

        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value=None):
                with patch("recce_cloud.config.project_config.get_project_binding", return_value=None):
                    result = self.runner.invoke(cloud_cli, ["doctor", "--json"])

        # Assertions
        self.assertNotEqual(result.exit_code, 0, "Should fail when not logged in")

        # Parse JSON output
        data = json.loads(result.output)
        self.assertEqual(data["login"]["status"], "fail")
        self.assertEqual(data["login"]["message"], "Not logged in")
        self.assertEqual(data["project_binding"]["status"], "fail")
        self.assertFalse(data["all_passed"])

    def test_doctor_token_expired(self):
        """Test doctor command when token is expired."""
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="expired_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(False, None)):
                    with patch("recce_cloud.config.project_config.get_project_binding", return_value=None):
                        result = self.runner.invoke(cloud_cli, ["doctor"])

        # Assertions
        self.assertNotEqual(result.exit_code, 0, "Should fail when token is expired")
        self.assertIn("Token invalid or expired", result.output)
        self.assertIn("recce-cloud login", result.output)

    def test_doctor_json_output_includes_suggestion(self):
        """Test that doctor JSON output includes suggestion field."""
        import json

        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value=None):
                with patch("recce_cloud.config.project_config.get_project_binding", return_value=None):
                    result = self.runner.invoke(cloud_cli, ["doctor", "--json"])

        # Assertions
        self.assertNotEqual(result.exit_code, 0, "Should fail when not logged in")

        # Parse JSON output
        data = json.loads(result.output)
        self.assertEqual(data["login"]["status"], "fail")
        self.assertIn("suggestion", data["login"])
        self.assertIsNotNone(data["login"]["suggestion"])
        self.assertIn("recce-cloud login", data["login"]["suggestion"])


class TestGetProductionSessionId(unittest.TestCase):
    """Test cases for _get_production_session_id helper function."""

    def setUp(self):
        """Set up test fixtures."""
        self.runner = CliRunner()

    def test_get_production_session_id_no_binding(self):
        """Test _get_production_session_id when no project binding exists."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.config.project_config.get_project_binding", return_value=None):
                result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)

    def test_get_production_session_id_org_not_found(self):
        """Test _get_production_session_id when organization is not found."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch("recce_cloud.api.client.RecceCloudClient.get_organization", return_value=None):
                    result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)

    def test_get_production_session_id_org_missing_id(self):
        """Test _get_production_session_id when org response missing ID."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_organization",
                    return_value={"slug": "test-org"},  # Missing "id" key
                ):
                    result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)

    def test_get_production_session_id_project_not_found(self):
        """Test _get_production_session_id when project is not found."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_organization",
                    return_value={"id": "org-123", "slug": "test-org"},
                ):
                    with patch("recce_cloud.api.client.RecceCloudClient.get_project", return_value=None):
                        result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)

    def test_get_production_session_id_project_missing_id(self):
        """Test _get_production_session_id when project response missing ID."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_organization",
                    return_value={"id": "org-123", "slug": "test-org"},
                ):
                    with patch(
                        "recce_cloud.api.client.RecceCloudClient.get_project",
                        return_value={"slug": "test-project"},  # Missing "id" key
                    ):
                        result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)

    def test_get_production_session_id_no_production_session(self):
        """Test _get_production_session_id when no production session exists."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_organization",
                    return_value={"id": "org-123", "slug": "test-org"},
                ):
                    with patch(
                        "recce_cloud.api.client.RecceCloudClient.get_project",
                        return_value={"id": "proj-456", "slug": "test-project"},
                    ):
                        with patch(
                            "recce_cloud.api.client.RecceCloudClient.list_sessions",
                            return_value=[],  # No sessions
                        ):
                            result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)

    def test_get_production_session_id_session_missing_id(self):
        """Test _get_production_session_id when session has no ID."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_organization",
                    return_value={"id": "org-123", "slug": "test-org"},
                ):
                    with patch(
                        "recce_cloud.api.client.RecceCloudClient.get_project",
                        return_value={"id": "proj-456", "slug": "test-project"},
                    ):
                        with patch(
                            "recce_cloud.api.client.RecceCloudClient.list_sessions",
                            return_value=[
                                {
                                    "name": "prod",
                                    "is_base": True,
                                    # Missing "id" key
                                }
                            ],
                        ):
                            result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)

    def test_get_production_session_id_success(self):
        """Test _get_production_session_id returns session ID on success."""
        from rich.console import Console

        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_organization",
                    return_value={"id": "org-123", "slug": "test-org"},
                ):
                    with patch(
                        "recce_cloud.api.client.RecceCloudClient.get_project",
                        return_value={"id": "proj-456", "slug": "test-project"},
                    ):
                        with patch(
                            "recce_cloud.api.client.RecceCloudClient.list_sessions",
                            return_value=[
                                {
                                    "id": "sess-prod-123",
                                    "name": "prod",
                                    "is_base": True,
                                }
                            ],
                        ):
                            result = _get_production_session_id(console, "test_token")

        self.assertEqual(result, "sess-prod-123")

    def test_get_production_session_id_api_exception(self):
        """Test _get_production_session_id handles RecceCloudException."""
        from rich.console import Console

        from recce_cloud.api.exceptions import RecceCloudException
        from recce_cloud.cli import _get_production_session_id

        console = Console(force_terminal=True)
        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.config.project_config.get_project_binding",
                return_value={"org": "test-org", "project": "test-project"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_organization",
                    side_effect=RecceCloudException("API Error", 500),
                ):
                    result = _get_production_session_id(console, "test_token")

        self.assertIsNone(result)


class TestDiagnosticServiceAPIErrors(unittest.TestCase):
    """Test cases for diagnostic service API error handling."""

    def test_diagnostic_service_org_missing_id(self):
        """Test diagnostic service handles org response missing ID."""
        from recce_cloud.services.diagnostic_service import DiagnosticService

        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch("recce_cloud.auth.profile.get_api_token", return_value="test_token"):
                with patch("recce_cloud.auth.login.check_login_status", return_value=(True, "test@example.com")):
                    with patch(
                        "recce_cloud.config.project_config.get_project_binding",
                        return_value={"org": "test-org", "project": "test-project"},
                    ):
                        with patch(
                            "recce_cloud.api.client.RecceCloudClient.get_organization",
                            return_value={"slug": "test-org"},  # Missing "id" key
                        ):
                            service = DiagnosticService()
                            # Manually set the token and org/project to simulate login/binding checks passing
                            service._token = "test_token"
                            service._org = "test-org"
                            service._project = "test-project"

                            prod_result, dev_result = service._check_sessions()

        self.assertFalse(prod_result.passed)
        self.assertIn("missing ID", prod_result.message)

    def test_diagnostic_service_project_missing_id(self):
        """Test diagnostic service handles project response missing ID."""
        from recce_cloud.services.diagnostic_service import DiagnosticService

        env = {}

        with patch.dict(os.environ, env, clear=True):
            with patch(
                "recce_cloud.api.client.RecceCloudClient.get_organization",
                return_value={"id": "org-123", "slug": "test-org"},
            ):
                with patch(
                    "recce_cloud.api.client.RecceCloudClient.get_project",
                    return_value={"slug": "test-project"},  # Missing "id" key
                ):
                    service = DiagnosticService()
                    service._token = "test_token"
                    service._org = "test-org"
                    service._project = "test-project"

                    prod_result, dev_result = service._check_sessions()

        self.assertFalse(prod_result.passed)
        self.assertIn("missing ID", prod_result.message)


if __name__ == "__main__":
    unittest.main()
