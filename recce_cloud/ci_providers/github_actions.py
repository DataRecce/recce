"""
GitHub Actions CI provider.
"""

import json
import os
from typing import Optional

from recce_cloud.ci_providers.base import BaseCIProvider, CIInfo


class GitHubActionsProvider(BaseCIProvider):
    """GitHub Actions CI provider implementation."""

    def can_handle(self) -> bool:
        """
        Check if running in GitHub Actions.

        Returns:
            True if GITHUB_ACTIONS environment variable is 'true'
        """
        return os.getenv("GITHUB_ACTIONS") == "true"

    def extract_ci_info(self) -> CIInfo:
        """
        Extract CI information from GitHub Actions environment.

        Environment variables used:
        - GITHUB_EVENT_PATH: Path to event payload JSON (for PR number)
        - GITHUB_SHA: Commit SHA
        - GITHUB_BASE_REF: Base/target branch (PR only)
        - GITHUB_HEAD_REF: Source/head branch (PR only)
        - GITHUB_REF_NAME: Branch name (fallback)
        - GITHUB_REPOSITORY: Repository (owner/repo)
        - GITHUB_TOKEN: Default access token (automatically provided by GitHub Actions)

        Returns:
            CIInfo object with extracted information
        """
        cr_number = self._extract_pr_number()
        commit_sha = self._extract_commit_sha()
        base_branch = self._extract_base_branch()
        source_branch = self._extract_source_branch()
        repository = os.getenv("GITHUB_REPOSITORY")
        access_token = os.getenv("GITHUB_TOKEN")

        # Build CR URL (PR URL) if we have the necessary information
        cr_url = None
        if cr_number is not None and repository:
            cr_url = f"https://github.com/{repository}/pull/{cr_number}"

        session_type = self.determine_session_type(cr_number, source_branch)

        return CIInfo(
            platform="github-actions",
            cr_number=cr_number,
            cr_url=cr_url,
            session_type=session_type,
            commit_sha=commit_sha,
            base_branch=base_branch,
            source_branch=source_branch,
            repository=repository,
            access_token=access_token,
        )

    def _extract_pr_number(self) -> Optional[int]:
        """
        Extract PR number from GitHub event payload.

        Returns:
            PR number if detected, None otherwise
        """
        event_path = os.getenv("GITHUB_EVENT_PATH")
        if not event_path or not os.path.exists(event_path):
            return None

        try:
            with open(event_path, "r") as f:
                event_data = json.load(f)
                pr_data = event_data.get("pull_request", {})
                pr_number = pr_data.get("number")
                if pr_number is not None:
                    return int(pr_number)
        except (json.JSONDecodeError, ValueError, OSError):
            pass

        return None

    def _extract_commit_sha(self) -> Optional[str]:
        """
        Extract commit SHA from GitHub Actions environment.

        Returns:
            Commit SHA if detected, falls back to git command
        """
        commit_sha = os.getenv("GITHUB_SHA")
        if commit_sha:
            return commit_sha

        # Fallback to git command
        return self.run_git_command(["git", "rev-parse", "HEAD"])

    def _extract_base_branch(self) -> str:
        """
        Extract base/target branch from GitHub Actions environment.

        Returns:
            Base branch name, defaults to 'main' if not detected
        """
        # GITHUB_BASE_REF is only set for pull_request events
        base_branch = os.getenv("GITHUB_BASE_REF")
        if base_branch:
            return base_branch

        # Default to main
        return "main"

    def _extract_source_branch(self) -> Optional[str]:
        """
        Extract source/head branch from GitHub Actions environment.

        Returns:
            Source branch name if detected
        """
        # GITHUB_HEAD_REF is only set for pull_request events
        source_branch = os.getenv("GITHUB_HEAD_REF")
        if source_branch:
            return source_branch

        # Fallback to GITHUB_REF_NAME
        source_branch = os.getenv("GITHUB_REF_NAME")
        if source_branch:
            return source_branch

        # Fallback to git command
        return self.run_git_command(["git", "branch", "--show-current"])
