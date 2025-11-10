"""
GitHub-specific API client for Recce Cloud.
"""

from typing import Dict, Optional

from recce_cloud.api.base import BaseRecceCloudClient


class GitHubRecceCloudClient(BaseRecceCloudClient):
    """GitHub Actions-specific implementation of Recce Cloud API client."""

    def __init__(self, token: str, repository: str, api_host: Optional[str] = None):
        """
        Initialize GitHub API client.

        Args:
            token: GitHub token (GITHUB_TOKEN or RECCE_API_TOKEN)
            repository: Repository in format "owner/repo"
            api_host: Recce Cloud API host
        """
        super().__init__(token, api_host)
        self.repository = repository

    def touch_recce_session(
        self,
        branch: str,
        adapter_type: str,
        cr_number: Optional[int] = None,
    ) -> Dict:
        """
        Create or touch a Recce session for GitHub Actions.

        Args:
            branch: Branch name
            adapter_type: DBT adapter type
            cr_number: PR number for pull request sessions
            commit_sha: Not used for GitHub (optional for compatibility)

        Returns:
            Dictionary containing session_id, manifest_upload_url, catalog_upload_url
        """
        url = f"{self.api_host}/api/v2/github/{self.repository}/touch-recce-session"

        payload = {
            "branch": branch,
            "adapter_type": adapter_type,
        }

        if cr_number is not None:
            payload["pr_number"] = cr_number

        return self._make_request("POST", url, json=payload)

    def upload_completed(self, session_id: str, commit_sha: Optional[str] = None) -> Dict:
        """
        Notify Recce Cloud that upload is complete for GitHub.

        Args:
            session_id: Session ID from touch_recce_session
            commit_sha: Not used for GitHub (optional for compatibility)

        Returns:
            Empty dictionary or acknowledgement
        """
        url = f"{self.api_host}/api/v2/github/{self.repository}/upload-completed"

        payload = {
            "session_id": session_id,
        }

        return self._make_request("POST", url, json=payload)
