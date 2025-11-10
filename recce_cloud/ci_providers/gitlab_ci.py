"""
GitLab CI/CD provider.
"""

import os
from typing import Optional

from recce_cloud.ci_providers.base import BaseCIProvider, CIInfo


class GitLabCIProvider(BaseCIProvider):
    """GitLab CI/CD provider implementation."""

    def can_handle(self) -> bool:
        """
        Check if running in GitLab CI.

        Returns:
            True if GITLAB_CI environment variable is 'true'
        """
        return os.getenv("GITLAB_CI") == "true"

    def extract_ci_info(self) -> CIInfo:
        """
        Extract CI information from GitLab CI environment.

        Environment variables used:
        - CI_MERGE_REQUEST_IID: Merge request number
        - CI_COMMIT_SHA: Commit SHA
        - CI_MERGE_REQUEST_TARGET_BRANCH_NAME: Target branch (MR only)
        - CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: Source branch (MR only)
        - CI_COMMIT_REF_NAME: Branch name (fallback)
        - CI_PROJECT_PATH: Repository path (group/project)
        - CI_SERVER_URL: GitLab instance URL (defaults to https://gitlab.com)
        - CI_JOB_TOKEN: Default access token (automatically provided by GitLab CI)

        Returns:
            CIInfo object with extracted information
        """
        cr_number = self._extract_mr_number()
        commit_sha = self._extract_commit_sha()
        base_branch = self._extract_base_branch()
        source_branch = self._extract_source_branch()
        repository = os.getenv("CI_PROJECT_PATH")
        access_token = os.getenv("CI_JOB_TOKEN")

        # Build CR URL (MR URL) if we have the necessary information
        cr_url = None
        if cr_number is not None and repository:
            server_url = os.getenv("CI_SERVER_URL", "https://gitlab.com")
            cr_url = f"{server_url}/{repository}/-/merge_requests/{cr_number}"

        session_type = self.determine_session_type(cr_number, source_branch)

        return CIInfo(
            platform="gitlab-ci",
            cr_number=cr_number,
            cr_url=cr_url,
            session_type=session_type,
            commit_sha=commit_sha,
            base_branch=base_branch,
            source_branch=source_branch,
            repository=repository,
            access_token=access_token,
        )

    def _extract_mr_number(self) -> Optional[int]:
        """
        Extract MR number from GitLab CI environment.

        Returns:
            MR number if detected, None otherwise
        """
        mr_iid = os.getenv("CI_MERGE_REQUEST_IID")
        if mr_iid:
            try:
                return int(mr_iid)
            except ValueError:
                pass

        return None

    def _extract_commit_sha(self) -> Optional[str]:
        """
        Extract commit SHA from GitLab CI environment.

        Returns:
            Commit SHA if detected, falls back to git command
        """
        commit_sha = os.getenv("CI_COMMIT_SHA")
        if commit_sha:
            return commit_sha

        # Fallback to git command
        return self.run_git_command(["git", "rev-parse", "HEAD"])

    def _extract_base_branch(self) -> str:
        """
        Extract base/target branch from GitLab CI environment.

        Returns:
            Base branch name, defaults to 'main' if not detected
        """
        # CI_MERGE_REQUEST_TARGET_BRANCH_NAME is only set for merge request pipelines
        base_branch = os.getenv("CI_MERGE_REQUEST_TARGET_BRANCH_NAME")
        if base_branch:
            return base_branch

        # Default to main
        return "main"

    def _extract_source_branch(self) -> Optional[str]:
        """
        Extract source branch from GitLab CI environment.

        Returns:
            Source branch name if detected
        """
        # CI_MERGE_REQUEST_SOURCE_BRANCH_NAME is only set for merge request pipelines
        source_branch = os.getenv("CI_MERGE_REQUEST_SOURCE_BRANCH_NAME")
        if source_branch:
            return source_branch

        # Fallback to CI_COMMIT_REF_NAME
        source_branch = os.getenv("CI_COMMIT_REF_NAME")
        if source_branch:
            return source_branch

        # Fallback to git command
        return self.run_git_command(["git", "branch", "--show-current"])
