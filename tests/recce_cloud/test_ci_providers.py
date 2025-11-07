"""
Tests for CI provider detection and information extraction.
"""

import json
import os
from unittest.mock import mock_open, patch

from recce_cloud.ci_providers import CIDetector, GitHubActionsProvider, GitLabCIProvider
from recce_cloud.ci_providers.base import CIInfo


class TestGitHubActionsProvider:
    """Tests for GitHub Actions provider."""

    def test_can_handle_true(self):
        """Test detection when GITHUB_ACTIONS is true."""
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}):
            provider = GitHubActionsProvider()
            assert provider.can_handle() is True

    def test_can_handle_false(self):
        """Test detection when GITHUB_ACTIONS is not set."""
        with patch.dict(os.environ, {}, clear=True):
            provider = GitHubActionsProvider()
            assert provider.can_handle() is False

    def test_extract_pr_number_from_event(self):
        """Test PR number extraction from event JSON."""
        event_data = {"pull_request": {"number": 123}}
        mock_file = mock_open(read_data=json.dumps(event_data))

        with patch.dict(os.environ, {"GITHUB_EVENT_PATH": "/tmp/event.json"}):
            with patch("builtins.open", mock_file):
                with patch("os.path.exists", return_value=True):
                    provider = GitHubActionsProvider()
                    pr_number = provider._extract_pr_number()
                    assert pr_number == 123

    def test_extract_pr_number_no_event(self):
        """Test PR number extraction when event path doesn't exist."""
        with patch.dict(os.environ, {}, clear=True):
            provider = GitHubActionsProvider()
            pr_number = provider._extract_pr_number()
            assert pr_number is None

    def test_extract_commit_sha(self):
        """Test commit SHA extraction."""
        with patch.dict(os.environ, {"GITHUB_SHA": "abc123def456"}):
            provider = GitHubActionsProvider()
            commit_sha = provider._extract_commit_sha()
            assert commit_sha == "abc123def456"

    def test_extract_commit_sha_fallback(self):
        """Test commit SHA extraction with git fallback."""
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(GitHubActionsProvider, "run_git_command", return_value="git123456"):
                provider = GitHubActionsProvider()
                commit_sha = provider._extract_commit_sha()
                assert commit_sha == "git123456"

    def test_extract_base_branch(self):
        """Test base branch extraction."""
        with patch.dict(os.environ, {"GITHUB_BASE_REF": "main"}):
            provider = GitHubActionsProvider()
            base_branch = provider._extract_base_branch()
            assert base_branch == "main"

    def test_extract_base_branch_default(self):
        """Test base branch extraction defaults to main."""
        with patch.dict(os.environ, {}, clear=True):
            provider = GitHubActionsProvider()
            base_branch = provider._extract_base_branch()
            assert base_branch == "main"

    def test_extract_source_branch(self):
        """Test source branch extraction."""
        with patch.dict(os.environ, {"GITHUB_HEAD_REF": "feature-branch"}):
            provider = GitHubActionsProvider()
            source_branch = provider._extract_source_branch()
            assert source_branch == "feature-branch"

    def test_extract_source_branch_fallback(self):
        """Test source branch extraction with fallback."""
        with patch.dict(os.environ, {"GITHUB_REF_NAME": "develop"}, clear=True):
            provider = GitHubActionsProvider()
            source_branch = provider._extract_source_branch()
            assert source_branch == "develop"

    def test_extract_ci_info_pr_context(self):
        """Test full CI info extraction in PR context."""
        event_data = {"pull_request": {"number": 456}}
        mock_file = mock_open(read_data=json.dumps(event_data))

        with patch.dict(
            os.environ,
            {
                "GITHUB_ACTIONS": "true",
                "GITHUB_EVENT_PATH": "/tmp/event.json",
                "GITHUB_SHA": "abc123",
                "GITHUB_BASE_REF": "main",
                "GITHUB_HEAD_REF": "feature",
                "GITHUB_REPOSITORY": "owner/repo",
            },
        ):
            with patch("builtins.open", mock_file):
                with patch("os.path.exists", return_value=True):
                    provider = GitHubActionsProvider()
                    ci_info = provider.extract_ci_info()

                    assert ci_info.platform == "github-actions"
                    assert ci_info.cr_number == 456
                    assert ci_info.cr_url == "https://github.com/owner/repo/pull/456"
                    assert ci_info.session_type == "cr"
                    assert ci_info.commit_sha == "abc123"
                    assert ci_info.base_branch == "main"
                    assert ci_info.source_branch == "feature"
                    assert ci_info.repository == "owner/repo"

    def test_extract_ci_info_main_branch(self):
        """Test CI info extraction for main branch."""
        with patch.dict(
            os.environ,
            {
                "GITHUB_ACTIONS": "true",
                "GITHUB_SHA": "main123",
                "GITHUB_REF_NAME": "main",
                "GITHUB_REPOSITORY": "owner/repo",
            },
            clear=True,
        ):
            provider = GitHubActionsProvider()
            ci_info = provider.extract_ci_info()

            assert ci_info.platform == "github-actions"
            assert ci_info.cr_number is None
            assert ci_info.session_type == "prod"
            assert ci_info.source_branch == "main"

    def test_extract_access_token(self):
        """Test GITHUB_TOKEN detection."""
        with patch.dict(
            os.environ,
            {
                "GITHUB_ACTIONS": "true",
                "GITHUB_TOKEN": "ghp_test123token456",
                "GITHUB_SHA": "abc123",
            },
            clear=True,
        ):
            provider = GitHubActionsProvider()
            ci_info = provider.extract_ci_info()

            assert ci_info.access_token == "ghp_test123token456"

    def test_extract_access_token_not_set(self):
        """Test when GITHUB_TOKEN is not set."""
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_SHA": "abc123"}, clear=True):
            provider = GitHubActionsProvider()
            ci_info = provider.extract_ci_info()

            assert ci_info.access_token is None


class TestGitLabCIProvider:
    """Tests for GitLab CI provider."""

    def test_can_handle_true(self):
        """Test detection when GITLAB_CI is true."""
        with patch.dict(os.environ, {"GITLAB_CI": "true"}):
            provider = GitLabCIProvider()
            assert provider.can_handle() is True

    def test_can_handle_false(self):
        """Test detection when GITLAB_CI is not set."""
        with patch.dict(os.environ, {}, clear=True):
            provider = GitLabCIProvider()
            assert provider.can_handle() is False

    def test_extract_mr_number(self):
        """Test MR number extraction."""
        with patch.dict(os.environ, {"CI_MERGE_REQUEST_IID": "789"}):
            provider = GitLabCIProvider()
            mr_number = provider._extract_mr_number()
            assert mr_number == 789

    def test_extract_mr_number_none(self):
        """Test MR number extraction when not set."""
        with patch.dict(os.environ, {}, clear=True):
            provider = GitLabCIProvider()
            mr_number = provider._extract_mr_number()
            assert mr_number is None

    def test_extract_commit_sha(self):
        """Test commit SHA extraction."""
        with patch.dict(os.environ, {"CI_COMMIT_SHA": "gitlab123"}):
            provider = GitLabCIProvider()
            commit_sha = provider._extract_commit_sha()
            assert commit_sha == "gitlab123"

    def test_extract_base_branch(self):
        """Test base branch extraction."""
        with patch.dict(os.environ, {"CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "master"}):
            provider = GitLabCIProvider()
            base_branch = provider._extract_base_branch()
            assert base_branch == "master"

    def test_extract_source_branch(self):
        """Test source branch extraction."""
        with patch.dict(os.environ, {"CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "feature"}):
            provider = GitLabCIProvider()
            source_branch = provider._extract_source_branch()
            assert source_branch == "feature"

    def test_extract_ci_info_mr_context(self):
        """Test full CI info extraction in MR context."""
        with patch.dict(
            os.environ,
            {
                "GITLAB_CI": "true",
                "CI_MERGE_REQUEST_IID": "101",
                "CI_COMMIT_SHA": "gitlab456",
                "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": "main",
                "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME": "feature-x",
                "CI_PROJECT_PATH": "group/project",
                "CI_SERVER_URL": "https://gitlab.com",
            },
        ):
            provider = GitLabCIProvider()
            ci_info = provider.extract_ci_info()

            assert ci_info.platform == "gitlab-ci"
            assert ci_info.cr_number == 101
            assert ci_info.cr_url == "https://gitlab.com/group/project/-/merge_requests/101"
            assert ci_info.session_type == "cr"
            assert ci_info.commit_sha == "gitlab456"
            assert ci_info.base_branch == "main"
            assert ci_info.source_branch == "feature-x"
            assert ci_info.repository == "group/project"

    def test_extract_ci_info_mr_context_self_hosted(self):
        """Test MR URL construction for self-hosted GitLab."""
        with patch.dict(
            os.environ,
            {
                "GITLAB_CI": "true",
                "CI_MERGE_REQUEST_IID": "42",
                "CI_PROJECT_PATH": "mycompany/myproject",
                "CI_SERVER_URL": "https://gitlab.mycompany.com",
            },
            clear=True,
        ):
            provider = GitLabCIProvider()
            ci_info = provider.extract_ci_info()

            assert ci_info.cr_url == "https://gitlab.mycompany.com/mycompany/myproject/-/merge_requests/42"

    def test_extract_access_token(self):
        """Test CI_JOB_TOKEN detection."""
        with patch.dict(
            os.environ,
            {"GITLAB_CI": "true", "CI_JOB_TOKEN": "glpat-test123token456", "CI_COMMIT_SHA": "gitlab123"},
            clear=True,
        ):
            provider = GitLabCIProvider()
            ci_info = provider.extract_ci_info()

            assert ci_info.access_token == "glpat-test123token456"

    def test_extract_access_token_not_set(self):
        """Test when CI_JOB_TOKEN is not set."""
        with patch.dict(os.environ, {"GITLAB_CI": "true", "CI_COMMIT_SHA": "gitlab123"}, clear=True):
            provider = GitLabCIProvider()
            ci_info = provider.extract_ci_info()

            assert ci_info.access_token is None


class TestCIDetector:
    """Tests for CI detector."""

    def test_detect_github_actions(self):
        """Test detection of GitHub Actions."""
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_SHA": "test123"}, clear=True):
            ci_info = CIDetector.detect()
            assert ci_info.platform == "github-actions"

    def test_detect_gitlab_ci(self):
        """Test detection of GitLab CI."""
        with patch.dict(os.environ, {"GITLAB_CI": "true", "CI_COMMIT_SHA": "test456"}, clear=True):
            ci_info = CIDetector.detect()
            assert ci_info.platform == "gitlab-ci"

    def test_detect_fallback(self):
        """Test fallback detection when no CI platform detected."""
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(CIDetector, "_fallback_detection") as mock_fallback:
                mock_fallback.return_value = CIInfo(
                    platform=None, session_type="dev", commit_sha="fallback123", base_branch="main"
                )
                ci_info = CIDetector.detect()
                assert ci_info.platform is None
                assert ci_info.session_type == "dev"
                mock_fallback.assert_called_once()

    def test_apply_overrides_cr_github(self):
        """Test applying CR override for GitHub Actions."""
        ci_info = CIInfo(platform="github-actions", cr_number=100, session_type="cr", repository="owner/repo")
        ci_info = CIDetector.apply_overrides(ci_info, cr=200)

        assert ci_info.cr_number == 200
        assert ci_info.cr_url == "https://github.com/owner/repo/pull/200"
        assert ci_info.session_type == "cr"

    def test_apply_overrides_cr_gitlab(self):
        """Test applying CR override for GitLab CI."""
        with patch.dict(os.environ, {"CI_SERVER_URL": "https://gitlab.com"}):
            ci_info = CIInfo(platform="gitlab-ci", cr_number=50, session_type="cr", repository="group/project")
            ci_info = CIDetector.apply_overrides(ci_info, cr=75)

            assert ci_info.cr_number == 75
            assert ci_info.cr_url == "https://gitlab.com/group/project/-/merge_requests/75"
            assert ci_info.session_type == "cr"

    def test_apply_overrides_session_type(self):
        """Test applying session type override."""
        ci_info = CIInfo(session_type="dev")
        ci_info = CIDetector.apply_overrides(ci_info, session_type="prod")

        assert ci_info.session_type == "prod"

    def test_apply_overrides_cr_redetermines_session_type(self):
        """Test that CR override re-determines session type."""
        ci_info = CIInfo(cr_number=None, session_type="dev", source_branch="feature")
        ci_info = CIDetector.apply_overrides(ci_info, cr=100)

        assert ci_info.cr_number == 100
        assert ci_info.session_type == "cr"

    def test_fallback_detection_with_git(self):
        """Test fallback detection using git commands."""
        with patch.dict(os.environ, {}, clear=True):
            with patch("recce_cloud.ci_providers.base.BaseCIProvider.run_git_command") as mock_git:
                mock_git.side_effect = ["commit123", "feature-branch"]
                ci_info = CIDetector._fallback_detection()

                assert ci_info.platform is None
                assert ci_info.commit_sha == "commit123"
                assert ci_info.source_branch == "feature-branch"
                assert ci_info.base_branch == "main"
                assert ci_info.session_type == "dev"
