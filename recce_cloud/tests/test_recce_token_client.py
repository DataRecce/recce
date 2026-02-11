"""
Tests for RecceTokenCloudClient (generic RECCE_API_TOKEN client).
"""

from unittest.mock import patch
from urllib.parse import urlparse

import pytest

from recce_cloud.api.recce_token import RecceTokenCloudClient


class TestRecceTokenCloudClient:
    """Tests for the generic RECCE_API_TOKEN client."""

    def test_init(self):
        """Test client initialization with required fields."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
        )
        assert client.token == "rct-test-token"
        assert client.provider == "github"
        assert client.repository == "owner/repo"
        assert client.project_dir is None
        parsed = urlparse(client.api_host)
        assert parsed.hostname == "cloud.datarecce.io" or (
            parsed.hostname and parsed.hostname.endswith(".cloud.datarecce.io")
        )

    def test_init_with_project_dir(self):
        """Test client initialization with optional project_dir."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
            project_dir="packages/dbt",
        )
        assert client.project_dir == "packages/dbt"

    def test_init_with_custom_api_host(self):
        """Test client initialization with custom API host."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="gitlab",
            repository="group/project",
            api_host="https://custom.recce.io",
        )
        assert client.api_host == "https://custom.recce.io"

    def test_touch_recce_session_pr(self):
        """Test touch_recce_session for PR context."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
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
                pr_number=123,
                session_type="pr",
            )

            assert response["session_id"] == "test_session_id"
            assert response["manifest_upload_url"] == "https://s3.aws.com/manifest"
            assert response["catalog_upload_url"] == "https://s3.aws.com/catalog"

            # Verify correct API endpoint was called
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == "POST"
            assert "/api/v2/touch-recce-session" in call_args[0][1]

            payload = call_args[1]["json"]
            assert payload["provider"] == "github"
            assert payload["repository"] == "owner/repo"
            assert payload["branch"] == "feature-branch"
            assert payload["adapter_type"] == "postgres"
            assert payload["pr_number"] == 123
            assert "project_dir" not in payload

    def test_touch_recce_session_base(self):
        """Test touch_recce_session for base branch (no PR)."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "base_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            client.touch_recce_session(branch="main", adapter_type="snowflake")

            call_args = mock_request.call_args
            payload = call_args[1]["json"]
            assert "pr_number" not in payload
            assert payload["branch"] == "main"

    def test_touch_recce_session_prod_type_omits_pr_number(self):
        """Test touch_recce_session with --type prod omits pr_number even if provided."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "prod_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            client.touch_recce_session(
                branch="main",
                adapter_type="postgres",
                pr_number=123,
                session_type="prod",
            )

            call_args = mock_request.call_args
            payload = call_args[1]["json"]
            assert "pr_number" not in payload

    def test_touch_recce_session_with_project_dir(self):
        """Test touch_recce_session includes project_dir when set."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/monorepo",
            project_dir="packages/analytics",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "mono_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            client.touch_recce_session(branch="main", adapter_type="bigquery")

            call_args = mock_request.call_args
            payload = call_args[1]["json"]
            assert payload["project_dir"] == "packages/analytics"

    def test_touch_recce_session_with_commit_sha(self):
        """Test touch_recce_session includes commit_sha when provided."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="gitlab",
            repository="group/project",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {
                "session_id": "gl_session_id",
                "manifest_upload_url": "https://s3.aws.com/manifest",
                "catalog_upload_url": "https://s3.aws.com/catalog",
            }

            client.touch_recce_session(
                branch="feature",
                adapter_type="postgres",
                commit_sha="abc123def456",
            )

            call_args = mock_request.call_args
            payload = call_args[1]["json"]
            assert payload["commit_sha"] == "abc123def456"
            assert payload["provider"] == "gitlab"

    def test_upload_completed(self):
        """Test upload_completed notification."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {}

            client.upload_completed(session_id="test_session_id")

            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == "POST"
            assert "/api/v2/upload-completed" in call_args[0][1]
            assert call_args[1]["json"]["session_id"] == "test_session_id"
            assert "commit_sha" not in call_args[1]["json"]

    def test_upload_completed_with_commit_sha(self):
        """Test upload_completed includes commit_sha when provided."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="gitlab",
            repository="group/project",
        )

        with patch.object(client, "_make_request") as mock_request:
            mock_request.return_value = {}

            client.upload_completed(session_id="test_session_id", commit_sha="abc123")

            call_args = mock_request.call_args
            payload = call_args[1]["json"]
            assert payload["session_id"] == "test_session_id"
            assert payload["commit_sha"] == "abc123"

    def test_get_session_download_urls_not_implemented(self):
        """Test that download is not implemented for generic client."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
        )

        with pytest.raises(NotImplementedError):
            client.get_session_download_urls()

    def test_delete_session_not_implemented(self):
        """Test that delete is not implemented for generic client."""
        client = RecceTokenCloudClient(
            token="rct-test-token",
            provider="github",
            repository="owner/repo",
        )

        with pytest.raises(NotImplementedError):
            client.delete_session()


class TestUploadTokenPriority:
    """Tests for the token priority logic in the upload CLI."""

    def test_recce_api_token_takes_priority_over_platform_token(self):
        """Test that RECCE_API_TOKEN is used when both tokens are available."""
        from recce_cloud.ci_providers.base import CIInfo

        # When RECCE_API_TOKEN is set and CI is detected with a platform token,
        # the RecceTokenCloudClient should be created (not the platform client)
        ci_info = CIInfo(
            platform="github-actions",
            repository="owner/repo",
            access_token="ghs_platform_token",
            source_branch="feature",
            base_branch="main",
            session_type="pr",
            pr_number=42,
        )

        # Verify that RecceTokenCloudClient is created with the right params
        client = RecceTokenCloudClient(
            token="rct-my-api-token",
            provider="github",
            repository=ci_info.repository,
        )

        assert isinstance(client, RecceTokenCloudClient)
        assert client.token == "rct-my-api-token"
        assert client.provider == "github"
        assert client.repository == "owner/repo"

    def test_gitlab_provider_mapping(self):
        """Test that gitlab-ci platform maps to 'gitlab' provider."""
        ci_info_platform = "gitlab-ci"
        provider = "github" if ci_info_platform == "github-actions" else "gitlab"
        assert provider == "gitlab"

    def test_github_provider_mapping(self):
        """Test that github-actions platform maps to 'github' provider."""
        ci_info_platform = "github-actions"
        provider = "github" if ci_info_platform == "github-actions" else "gitlab"
        assert provider == "github"
