"""
CI provider detection and orchestration.
"""

import logging
import os
from typing import Optional

from recce_cloud.ci_providers.base import BaseCIProvider, CIInfo
from recce_cloud.ci_providers.github_actions import GitHubActionsProvider
from recce_cloud.ci_providers.gitlab_ci import GitLabCIProvider

logger = logging.getLogger(__name__)


class CIDetector:
    """
    Detects CI platform and extracts information.

    Supports:
    - GitHub Actions
    - GitLab CI/CD
    - Generic fallback (git commands)
    """

    # Order matters: check in priority order
    PROVIDERS = [
        GitHubActionsProvider,
        GitLabCIProvider,
    ]

    @classmethod
    def detect(cls) -> CIInfo:
        """
        Detect CI platform and extract information.

        Returns:
            CIInfo object with detected information
        """
        # Try each provider in order
        for provider_class in cls.PROVIDERS:
            provider = provider_class()
            if provider.can_handle():
                logger.info(f"CI Platform: {provider_class.__name__.replace('Provider', '')}")
                ci_info = provider.extract_ci_info()
                cls._log_detected_values(ci_info)
                return ci_info

        # No CI platform detected, use generic fallback
        logger.info("No CI platform detected, using git fallback")
        ci_info = cls._fallback_detection()
        cls._log_detected_values(ci_info)
        return ci_info

    @classmethod
    def apply_overrides(
        cls,
        ci_info: CIInfo,
        cr: Optional[int] = None,
        session_type: Optional[str] = None,
    ) -> CIInfo:
        """
        Apply manual overrides to detected CI information.

        Args:
            ci_info: Detected CI information
            cr: Manual change request number override
            session_type: Manual session type override

        Returns:
            CIInfo with overrides applied
        """
        # Log overrides
        if cr is not None and cr != ci_info.cr_number:
            logger.info(f"Using manual override: --cr {cr} (detected: {ci_info.cr_number})")
            ci_info.cr_number = cr
            # Rebuild CR URL if we have repository info
            if ci_info.repository:
                if ci_info.platform == "github-actions":
                    ci_info.cr_url = f"https://github.com/{ci_info.repository}/pull/{cr}"
                elif ci_info.platform == "gitlab-ci":
                    server_url = os.getenv("CI_SERVER_URL", "https://gitlab.com")
                    ci_info.cr_url = f"{server_url}/{ci_info.repository}/-/merge_requests/{cr}"

        if session_type is not None and session_type != ci_info.session_type:
            logger.info(f"Using manual override: --type {session_type} (detected: {ci_info.session_type})")
            ci_info.session_type = session_type

        # Re-determine session type if CR was overridden
        if cr is not None:
            if session_type is None:  # Only if not manually overridden
                ci_info.session_type = BaseCIProvider.determine_session_type(ci_info.cr_number, ci_info.source_branch)

        return ci_info

    @classmethod
    def _fallback_detection(cls) -> CIInfo:
        """
        Fallback detection using git commands when no CI platform is detected.

        Returns:
            CIInfo with basic git information
        """
        commit_sha = BaseCIProvider.run_git_command(["git", "rev-parse", "HEAD"])
        source_branch = BaseCIProvider.run_git_command(["git", "branch", "--show-current"])

        session_type = BaseCIProvider.determine_session_type(None, source_branch)

        return CIInfo(
            platform=None,
            cr_number=None,
            session_type=session_type,
            commit_sha=commit_sha,
            base_branch="main",  # Default
            source_branch=source_branch,
            repository=None,
        )

    @classmethod
    def _log_detected_values(cls, ci_info: CIInfo) -> None:
        """
        Log detected values for transparency.

        Args:
            ci_info: Detected CI information
        """
        if ci_info.cr_number is not None:
            if ci_info.platform == "github-actions":
                logger.info(f"Detected PR number: {ci_info.cr_number}")
            elif ci_info.platform == "gitlab-ci":
                logger.info(f"Detected MR number: {ci_info.cr_number}")
            else:
                logger.info(f"Detected CR number: {ci_info.cr_number}")
        else:
            logger.info("No CR number detected")

        if ci_info.commit_sha:
            logger.info(f"Detected commit SHA: {ci_info.commit_sha[:8]}...")
        else:
            logger.warning("Could not detect commit SHA")

        logger.info(f"Detected base branch: {ci_info.base_branch}")
        logger.info(f"Detected source branch: {ci_info.source_branch}")
        logger.info(f"Session type: {ci_info.session_type}")

        if ci_info.repository:
            logger.info(f"Repository: {ci_info.repository}")
