"""
Base API client for Recce Cloud.
"""

import os
from abc import ABC, abstractmethod
from typing import Dict, Optional

import requests

from recce_cloud.api.exceptions import RecceCloudException


class BaseRecceCloudClient(ABC):
    """Abstract base class for platform-specific Recce Cloud API clients."""

    def __init__(self, token: str, api_host: Optional[str] = None):
        """
        Initialize the API client.

        Args:
            token: Authentication token (GITHUB_TOKEN, CI_JOB_TOKEN, or RECCE_API_TOKEN)
            api_host: Recce Cloud API host (defaults to RECCE_CLOUD_API_HOST or https://cloud.datarecce.io)
        """
        self.token = token
        self.api_host = api_host or os.getenv("RECCE_CLOUD_API_HOST", "https://cloud.datarecce.io")

    def _make_request(self, method: str, url: str, **kwargs) -> Dict:
        """
        Make an HTTP request to Recce Cloud API.

        Args:
            method: HTTP method (GET, POST, PUT, etc.)
            url: Full URL for the request
            **kwargs: Additional arguments passed to requests

        Returns:
            Response JSON as dictionary

        Raises:
            RecceCloudException: If the request fails
        """
        headers = kwargs.pop("headers", {})
        headers.update(
            {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            }
        )

        try:
            response = requests.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            reason = str(e)
            if e.response is not None:
                try:
                    error_detail = e.response.json()
                    reason = error_detail.get("message", str(e))
                except Exception:
                    reason = e.response.text or str(e)
            raise RecceCloudException(reason=reason, status_code=e.response.status_code if e.response else None)
        except requests.exceptions.RequestException as e:
            raise RecceCloudException(reason=str(e))

    @abstractmethod
    def touch_recce_session(
        self,
        branch: str,
        adapter_type: str,
        cr_number: Optional[int] = None,
        commit_sha: Optional[str] = None,
    ) -> Dict:
        """
        Create or touch a Recce session.

        Args:
            branch: Branch name
            adapter_type: DBT adapter type (e.g., 'postgres', 'snowflake', 'bigquery')
            cr_number: Change request number (PR/MR number) for CR sessions
            commit_sha: Commit SHA (GitLab requires this)

        Returns:
            Dictionary containing:
                - session_id: Session ID
                - manifest_upload_url: Presigned URL for manifest.json upload
                - catalog_upload_url: Presigned URL for catalog.json upload
        """
        pass

    @abstractmethod
    def upload_completed(self, session_id: str, commit_sha: Optional[str] = None) -> Dict:
        """
        Notify Recce Cloud that upload is complete.

        Args:
            session_id: Session ID from touch_recce_session
            commit_sha: Commit SHA (GitLab requires this)

        Returns:
            Empty dictionary or acknowledgement
        """
        pass
