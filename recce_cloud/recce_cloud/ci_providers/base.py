"""
Base CI provider interface.
"""

import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class CIInfo:
    """Information extracted from CI environment."""

    platform: Optional[str] = None  # "github-actions", "gitlab-ci", etc.
    cr_number: Optional[int] = None  # Change request number (PR/MR)
    cr_url: Optional[str] = None  # Change request URL (for session linking)
    session_type: Optional[str] = None  # "cr", "prod", "dev"
    commit_sha: Optional[str] = None  # Full commit SHA
    base_branch: Optional[str] = None  # Target/base branch
    source_branch: Optional[str] = None  # Source/head branch
    repository: Optional[str] = None  # Repository path (owner/repo or group/project)
    access_token: Optional[str] = None  # CI-provided access token (GITHUB_TOKEN, CI_JOB_TOKEN)


class BaseCIProvider(ABC):
    """Abstract base class for CI provider detection and info extraction."""

    @abstractmethod
    def can_handle(self) -> bool:
        """
        Check if this provider can handle the current environment.

        Returns:
            True if the provider's CI platform is detected
        """
        pass

    @abstractmethod
    def extract_ci_info(self) -> CIInfo:
        """
        Extract CI information from environment variables.

        Returns:
            CIInfo object with extracted information
        """
        pass

    @staticmethod
    def run_git_command(command: list[str]) -> Optional[str]:
        """
        Run a git command and return output.

        Args:
            command: Git command as list (e.g., ['git', 'rev-parse', 'HEAD'])

        Returns:
            Command output stripped of whitespace, or None if command fails
        """
        try:
            result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=5)
            return result.stdout.strip()
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return None

    @staticmethod
    def determine_session_type(cr_number: Optional[int], source_branch: Optional[str]) -> str:
        """
        Determine session type based on context.

        Args:
            cr_number: Change request number (PR/MR)
            source_branch: Source branch name

        Returns:
            Session type: "cr", "prod", or "dev"
        """
        if cr_number is not None:
            return "cr"
        if source_branch in ["main", "master"]:
            return "prod"
        return "dev"
