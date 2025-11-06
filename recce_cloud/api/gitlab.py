"""
GitLab-specific API client for Recce Cloud.
"""

from typing import Dict, Optional

from recce_cloud.api.base import BaseRecceCloudClient


class GitLabRecceCloudClient(BaseRecceCloudClient):
    """GitLab CI-specific implementation of Recce Cloud API client."""

    def __init__(self, token: str, project_path: str, repository_url: str, api_host: Optional[str] = None):
        """
        Initialize GitLab API client.

        Args:
            token: GitLab token (CI_JOB_TOKEN or RECCE_API_TOKEN)
            project_path: Project path in format "group/project"
            repository_url: Full repository URL (e.g., https://gitlab.com/group/project)
            api_host: Recce Cloud API host
        """
        super().__init__(token, api_host)
        self.project_path = project_path
        self.repository_url = repository_url

    def touch_recce_session(
        self,
        branch: str,
        adapter_type: str,
        cr_number: Optional[int] = None,
        commit_sha: Optional[str] = None,
    ) -> Dict:
        """
        Create or touch a Recce session for GitLab CI.

        Args:
            branch: Branch name
            adapter_type: DBT adapter type
            cr_number: MR IID for merge request sessions
            commit_sha: Commit SHA (required for GitLab)

        Returns:
            Dictionary containing session_id, manifest_upload_url, catalog_upload_url
        """
        url = f"{self.api_host}/api/v2/gitlab/{self.project_path}/touch-recce-session"

        payload = {
            "branch": branch,
            "adapter_type": adapter_type,
            "commit_sha": commit_sha,
            "repository_url": self.repository_url,
        }

        if cr_number is not None:
            payload["mr_iid"] = cr_number

        return self._make_request("POST", url, json=payload)

    def upload_completed(self, session_id: str, commit_sha: Optional[str] = None) -> Dict:
        """
        Notify Recce Cloud that upload is complete for GitLab.

        Args:
            session_id: Session ID from touch_recce_session
            commit_sha: Commit SHA (required for GitLab)

        Returns:
            Empty dictionary or acknowledgement
        """
        url = f"{self.api_host}/api/v2/gitlab/{self.project_path}/upload-completed"

        payload = {
            "session_id": session_id,
            "commit_sha": commit_sha,
        }

        return self._make_request("POST", url, json=payload)
