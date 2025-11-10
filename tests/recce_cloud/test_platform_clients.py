"""
Tests for platform-specific Recce Cloud API clients.
"""

import os
from unittest.mock import patch
from urllib.parse import urlparse

import pytest

from recce_cloud.api.factory import create_platform_client
from recce_cloud.api.github import GitHubRecceCloudClient
from recce_cloud.api.gitlab import GitLabRecceCloudClient
from recce_cloud.ci_providers.base import CIInfo


class TestGitHubRecceCloudClient:
    """Tests for GitHub Actions API client."""

    def test_init(self):
        """Test client initialization."""
        client = GitHubRecceCloudClient(token="test_token", repository="owner/repo")
        assert client.token == "test_token"
        assert client.repository == "owner/repo"
        parsed = urlparse(client.api_host)
        # Accept main domain or subdomains:
        assert parsed.hostname == "cloud.datarecce.io" or (
            parsed.hostname and parsed.hostname.endswith(".cloud.datarecce.io")
        )

    def test_touch_recce_session_pr(self):
        """Test touch_recce_session for PR context."""
        client = GitHubRecceCloudClient(token="test_token", repository="owner/repo")

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "test_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            response = client.touch_recce_session(branch="feature-branch", adapter_type="postgres", cr_number=123)

            assert response["session_id"] == "test_session_id"
            assert response["manifest_upload_url"] == "https://s3.aws.com/manifest"
            assert response["catalog_upload_url"] == "https://s3.aws.com/catalog"

            # Verify correct API endpoint was called
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == "POST"
            assert "github/owner/repo/touch-recce-session" in call_args[0][1]
            assert call_args[1]["json"]["branch"] == "feature-branch"
            assert call_args[1]["json"]["adapter_type"] == "postgres"
            assert call_args[1]["json"]["pr_number"] == 123

    def test_touch_recce_session_base(self):
        """Test touch_recce_session for base branch context."""
        client = GitHubRecceCloudClient(token="test_token", repository="owner/repo")

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "base_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            client.touch_recce_session(branch="main", adapter_type="snowflake")

            # Verify pr_number is not in the payload when cr_number is None
            call_args = mock_request.call_args
            assert "pr_number" not in call_args[1]["json"]

    def test_upload_completed(self):
        """Test upload_completed notification."""
        client = GitHubRecceCloudClient(token="test_token", repository="owner/repo")

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {}

            client.upload_completed(session_id="test_session_id")

            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == "POST"
            assert "github/owner/repo/upload-completed" in call_args[0][1]
            assert call_args[1]["json"]["session_id"] == "test_session_id"


class TestGitLabRecceCloudClient:
    """Tests for GitLab CI API client."""

    def test_init(self):
        """Test client initialization."""
        client = GitLabRecceCloudClient(
            token="test_token",
            project_path="group/project",
            repository_url="https://gitlab.com/group/project",
        )
        assert client.token == "test_token"
        assert client.project_path == "group/project"
        assert client.repository_url == "https://gitlab.com/group/project"

    def test_touch_recce_session_mr(self):
        """Test touch_recce_session for MR context."""
        client = GitLabRecceCloudClient(
            token="test_token",
            project_path="group/project",
            repository_url="https://gitlab.com/group/project",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "test_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            response = client.touch_recce_session(
                branch="feature-branch",
                adapter_type="postgres",
                cr_number=456,
                commit_sha="abc123def456",
            )

            assert response["session_id"] == "test_session_id"

            # Verify correct API endpoint and payload
            call_args = mock_request.call_args
            assert call_args[0][0] == "POST"
            assert "gitlab/group/project/touch-recce-session" in call_args[0][1]
            payload = call_args[1]["json"]
            assert payload["branch"] == "feature-branch"
            assert payload["adapter_type"] == "postgres"
            assert payload["mr_iid"] == 456
            assert payload["commit_sha"] == "abc123def456"
            assert payload["repository_url"] == "https://gitlab.com/group/project"

    def test_touch_recce_session_base(self):
        """Test touch_recce_session for base branch context."""
        client = GitLabRecceCloudClient(
            token="test_token",
            project_path="group/project",
            repository_url="https://gitlab.com/group/project",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "base_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            client.touch_recce_session(branch="main", adapter_type="bigquery", commit_sha="base123")

            # Verify mr_iid is not in the payload when cr_number is None
            call_args = mock_request.call_args
            assert "mr_iid" not in call_args[1]["json"]

    def test_upload_completed(self):
        """Test upload_completed notification."""
        client = GitLabRecceCloudClient(
            token="test_token",
            project_path="group/project",
            repository_url="https://gitlab.com/group/project",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {}

            client.upload_completed(session_id="test_session_id", commit_sha="commit456")

            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == "POST"
            assert "gitlab/group/project/upload-completed" in call_args[0][1]
            payload = call_args[1]["json"]
            assert payload["session_id"] == "test_session_id"
            assert payload["commit_sha"] == "commit456"


class TestFactoryCreatePlatformClient:
    """Tests for create_platform_client factory function."""

    def test_create_github_client(self):
        """Test creating GitHub client."""
        ci_info = CIInfo(platform="github-actions", repository="owner/repo")

        client = create_platform_client(token="test_token", ci_info=ci_info)

        assert isinstance(client, GitHubRecceCloudClient)
        assert client.repository == "owner/repo"

    def test_create_github_client_from_env(self):
        """Test creating GitHub client with environment fallback."""
        with patch.dict(os.environ, {"GITHUB_REPOSITORY": "owner/repo"}):
            ci_info = CIInfo(platform="github-actions")

            client = create_platform_client(token="test_token", ci_info=ci_info)

            assert isinstance(client, GitHubRecceCloudClient)
            assert client.repository == "owner/repo"

    def test_create_github_client_missing_repository(self):
        """Test error when GitHub repository information is missing."""
        ci_info = CIInfo(platform="github-actions")

        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="GitHub repository information is required"):
                create_platform_client(token="test_token", ci_info=ci_info)

    def test_create_gitlab_client(self):
        """Test creating GitLab client."""
        with patch.dict(
            os.environ,
            {"CI_PROJECT_URL": "https://gitlab.com/group/project"},
        ):
            ci_info = CIInfo(platform="gitlab-ci", repository="group/project")

            client = create_platform_client(token="test_token", ci_info=ci_info)

            assert isinstance(client, GitLabRecceCloudClient)
            assert client.project_path == "group/project"
            assert client.repository_url == "https://gitlab.com/group/project"

    def test_create_gitlab_client_from_env(self):
        """Test creating GitLab client with environment fallback."""
        with patch.dict(
            os.environ,
            {
                "CI_PROJECT_PATH": "group/project",
                "CI_PROJECT_URL": "https://gitlab.com/group/project",
            },
        ):
            ci_info = CIInfo(platform="gitlab-ci")

            client = create_platform_client(token="test_token", ci_info=ci_info)

            assert isinstance(client, GitLabRecceCloudClient)
            assert client.project_path == "group/project"

    def test_create_gitlab_client_missing_project_path(self):
        """Test error when GitLab project path is missing."""
        with patch.dict(os.environ, {}, clear=True):
            ci_info = CIInfo(platform="gitlab-ci")

            with pytest.raises(ValueError, match="GitLab project path is required"):
                create_platform_client(token="test_token", ci_info=ci_info)

    def test_create_gitlab_client_missing_project_url(self):
        """Test error when GitLab project URL is missing."""
        with patch.dict(os.environ, {"CI_PROJECT_PATH": "group/project"}, clear=True):
            ci_info = CIInfo(platform="gitlab-ci", repository="group/project")

            with pytest.raises(ValueError, match="GitLab project URL is required"):
                create_platform_client(token="test_token", ci_info=ci_info)

    def test_create_client_unsupported_platform(self):
        """Test error for unsupported platform."""
        ci_info = CIInfo(platform="unsupported-ci")

        with pytest.raises(ValueError, match="Unsupported platform"):
            create_platform_client(token="test_token", ci_info=ci_info)

    def test_auto_detect_ci_info(self):
        """Test automatic CI detection when ci_info is not provided."""
        with patch.dict(
            os.environ,
            {
                "GITHUB_ACTIONS": "true",
                "GITHUB_REPOSITORY": "owner/repo",
                "GITHUB_SHA": "abc123",
            },
            clear=True,
        ):
            client = create_platform_client(token="test_token")

            assert isinstance(client, GitHubRecceCloudClient)
            assert client.repository == "owner/repo"
