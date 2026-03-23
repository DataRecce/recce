"""
Generic API client for Recce Cloud using RECCE_API_TOKEN.

This client uses the generic /api/v2/touch-recce-session and
/api/v2/upload-completed endpoints, which resolve the project
from repository context (provider + owner/repo) rather than
relying on platform-specific token verification.
"""

from typing import Dict, Optional

from recce_cloud.api.base import BaseRecceCloudClient


class RecceTokenCloudClient(BaseRecceCloudClient):
    """Client for touch-recce-session using RECCE_API_TOKEN."""

    def __init__(
        self,
        token: str,
        provider: Optional[str] = None,
        repository: Optional[str] = None,
        project_dir: Optional[str] = None,
        api_host: Optional[str] = None,
    ):
        """
        Initialize generic API client.

        Args:
            token: RECCE_API_TOKEN
            provider: Repository provider ("github" or "gitlab"), required for touch-recce-session
            repository: Repository in format "owner/repo", required for touch-recce-session
            project_dir: Optional project directory (for monorepos)
            api_host: Recce Cloud API host
        """
        super().__init__(token, api_host)
        self.provider = provider
        self.repository = repository
        self.project_dir = project_dir

    def touch_recce_session(
        self,
        branch: str,
        adapter_type: str,
        pr_number: Optional[int] = None,
        commit_sha: Optional[str] = None,
        session_type: Optional[str] = None,
    ) -> Dict:
        """
        Create or touch a Recce session using the generic endpoint.

        Args:
            branch: Branch name
            adapter_type: DBT adapter type
            pr_number: PR/MR number for pull request sessions
            commit_sha: Commit SHA (optional)
            session_type: Session type ("pr", "prod", "dev")

        Returns:
            Dictionary containing session_id, manifest_upload_url, catalog_upload_url
        """
        url = f"{self.api_host}/api/v2/touch-recce-session"

        payload = {
            "provider": self.provider,
            "repository": self.repository,
            "branch": branch,
            "adapter_type": adapter_type,
        }

        if self.project_dir:
            payload["project_dir"] = self.project_dir

        # Only include pr_number for "pr" type sessions
        if session_type == "pr" and pr_number is not None:
            payload["pr_number"] = pr_number

        if commit_sha:
            payload["commit_sha"] = commit_sha

        return self._make_request("POST", url, json=payload)

    def upload_completed(
        self, session_id: str, commit_sha: Optional[str] = None
    ) -> Dict:
        """
        Notify Recce Cloud that upload is complete.

        Args:
            session_id: Session ID from touch_recce_session
            commit_sha: Commit SHA (optional)

        Returns:
            Empty dictionary or acknowledgement
        """
        url = f"{self.api_host}/api/v2/upload-completed"

        payload = {"session_id": session_id}

        if commit_sha:
            payload["commit_sha"] = commit_sha

        return self._make_request("POST", url, json=payload)

    def isolated_base_upload_completed(self, session_id: str) -> Dict:
        """
        Notify Recce Cloud that isolated base upload is complete.

        Uses the RECCE_API_TOKEN endpoint which only requires session_id
        (no org/project context needed).

        Args:
            session_id: Session ID

        Returns:
            Empty dictionary or acknowledgement
        """
        url = f"{self.api_host}/api/v2/isolated-base/upload-completed"
        payload = {"session_id": session_id}
        return self._make_request("POST", url, json=payload)

    def get_isolated_base_upload_urls(self, session_id: str) -> Dict:
        """
        Get presigned S3 upload URLs for isolated base artifacts.

        Uses the RECCE_API_TOKEN endpoint which only requires session_id
        (no org/project context needed).

        Args:
            session_id: Session ID

        Returns:
            dict with keys:
                - manifest_url: Presigned URL for uploading base manifest.json
                - catalog_url: Presigned URL for uploading base catalog.json
        """
        from recce_cloud.api.client import replace_localhost_with_docker_internal

        url = f"{self.api_host}/api/v2/isolated-base/upload-url"
        payload = {"session_id": session_id}
        data = self._make_request("POST", url, json=payload)

        presigned_urls = data.get("presigned_urls")
        if presigned_urls is None:
            from recce_cloud.api.exceptions import RecceCloudException

            raise RecceCloudException(
                reason="No presigned URLs returned from the server.",
                status_code=404,
            )

        for key, val in presigned_urls.items():
            presigned_urls[key] = replace_localhost_with_docker_internal(val)
        return presigned_urls

    def get_session_download_urls(
        self,
        pr_number: Optional[int] = None,
        session_type: Optional[str] = None,
    ) -> Dict:
        """
        Not yet implemented for generic client.

        Raises:
            NotImplementedError: This endpoint is not yet available for RECCE_API_TOKEN.
        """
        raise NotImplementedError(
            "Session download via RECCE_API_TOKEN generic endpoint is not yet supported. "
            "Use --session-id for download, or use platform-specific tokens."
        )

    def delete_session(
        self,
        pr_number: Optional[int] = None,
        session_type: Optional[str] = None,
    ) -> Dict:
        """
        Not yet implemented for generic client.

        Raises:
            NotImplementedError: This endpoint is not yet available for RECCE_API_TOKEN.
        """
        raise NotImplementedError(
            "Session delete via RECCE_API_TOKEN generic endpoint is not yet supported. "
            "Use --session-id for delete, or use platform-specific tokens."
        )
