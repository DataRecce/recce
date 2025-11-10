"""
CI/CD Provider detection and information extraction.
"""

from recce_cloud.ci_providers.detector import CIDetector
from recce_cloud.ci_providers.github_actions import GitHubActionsProvider
from recce_cloud.ci_providers.gitlab_ci import GitLabCIProvider

__all__ = ["CIDetector", "GitHubActionsProvider", "GitLabCIProvider"]
