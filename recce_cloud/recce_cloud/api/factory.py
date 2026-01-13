"""
Factory for creating platform-specific API clients.
"""

import os
from typing import Optional

from recce_cloud.api.github import GitHubRecceCloudClient
from recce_cloud.api.gitlab import GitLabRecceCloudClient
from recce_cloud.ci_providers import CIDetector
from recce_cloud.ci_providers.base import CIInfo


def create_platform_client(
    token: str,
    ci_info: Optional[CIInfo] = None,
    api_host: Optional[str] = None,
):
    """
    Create a platform-specific Recce Cloud API client based on CI environment.

    Args:
        token: Authentication token (GITHUB_TOKEN, CI_JOB_TOKEN, or RECCE_API_TOKEN)
        ci_info: CI information (auto-detected if not provided)
        api_host: Recce Cloud API host (optional)

    Returns:
        GitHubRecceCloudClient or GitLabRecceCloudClient

    Raises:
        ValueError: If platform is not supported or required information is missing
    """
    # Auto-detect CI info if not provided
    if ci_info is None:
        ci_info = CIDetector.detect()

    if ci_info.platform == "github-actions":
        repository = ci_info.repository or os.getenv("GITHUB_REPOSITORY")
        if not repository:
            raise ValueError("GitHub repository information is required but not detected")

        return GitHubRecceCloudClient(token=token, repository=repository, api_host=api_host)

    elif ci_info.platform == "gitlab-ci":
        project_path = ci_info.repository or os.getenv("CI_PROJECT_PATH")
        repository_url = os.getenv("CI_PROJECT_URL")

        if not project_path:
            raise ValueError("GitLab project path is required but not detected")
        if not repository_url:
            raise ValueError("GitLab project URL is required but not detected")

        return GitLabRecceCloudClient(
            token=token,
            project_path=project_path,
            repository_url=repository_url,
            api_host=api_host,
        )

    else:
        raise ValueError(
            f"Unsupported platform: {ci_info.platform}. " "Only GitHub Actions and GitLab CI are supported."
        )
