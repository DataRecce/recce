"""
Recce Cloud API client for lightweight operations.

Simplified version of recce.util.recce_cloud.RecceCloud with only
the methods needed for upload-session functionality.
"""

import os

import requests

from recce_cloud.api.exceptions import RecceCloudException

RECCE_CLOUD_API_HOST = os.environ.get("RECCE_CLOUD_API_HOST", "https://cloud.datarecce.io")

DOCKER_INTERNAL_URL_PREFIX = "http://host.docker.internal"
LOCALHOST_URL_PREFIX = "http://localhost"


class RecceCloudClient:
    """
    Lightweight Recce Cloud API client.

    Supports authentication with Recce Cloud API token (starts with "rct-").
    """

    def __init__(self, token: str):
        if token is None:
            raise ValueError("Token cannot be None.")
        self.token = token
        self.base_url_v2 = f"{RECCE_CLOUD_API_HOST}/api/v2"

    def _request(self, method: str, url: str, headers: dict = None, **kwargs):
        """Make authenticated HTTP request to Recce Cloud API."""
        headers = {
            **(headers or {}),
            "Authorization": f"Bearer {self.token}",
        }
        return requests.request(method, url, headers=headers, **kwargs)

    def _replace_localhost_with_docker_internal(self, url: str) -> str:
        """Convert localhost URLs to docker internal URLs if running in Docker."""
        if url is None:
            return None
        if (
            os.environ.get("RECCE_SHARE_INSTANCE_ENV") == "docker"
            or os.environ.get("RECCE_TASK_INSTANCE_ENV") == "docker"
            or os.environ.get("RECCE_INSTANCE_ENV") == "docker"
        ):
            # For local development, convert the presigned URL from localhost to host.docker.internal
            if url.startswith(LOCALHOST_URL_PREFIX):
                return url.replace(LOCALHOST_URL_PREFIX, DOCKER_INTERNAL_URL_PREFIX)
        return url

    def get_session(self, session_id: str) -> dict:
        """
        Get session information from Recce Cloud.

        Args:
            session_id: The session ID to retrieve

        Returns:
            dict containing session information with keys:
                - org_id: Organization ID
                - project_id: Project ID
                - ... other session fields

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/sessions/{session_id}"
        response = self._request("GET", api_url)
        if response.status_code == 403:
            return {"status": "error", "message": response.json().get("detail")}
        if response.status_code != 200:
            raise RecceCloudException(
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        if data["success"] is not True:
            raise RecceCloudException(
                reason=data.get("message", "Unknown error"),
                status_code=response.status_code,
            )
        return data["session"]

    def get_upload_urls_by_session_id(self, org_id: str, project_id: str, session_id: str) -> dict:
        """
        Get presigned S3 upload URLs for a session.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID

        Returns:
            dict with keys:
                - manifest_url: Presigned URL for uploading manifest.json
                - catalog_url: Presigned URL for uploading catalog.json

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/upload-url"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        if data["presigned_urls"] is None:
            raise RecceCloudException(
                reason="No presigned URLs returned from the server.",
                status_code=404,
            )

        presigned_urls = data["presigned_urls"]
        for key, url in presigned_urls.items():
            presigned_urls[key] = self._replace_localhost_with_docker_internal(url)
        return presigned_urls

    def update_session(self, org_id: str, project_id: str, session_id: str, adapter_type: str) -> dict:
        """
        Update session metadata with adapter type.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            adapter_type: dbt adapter type (e.g., "postgres", "snowflake", "bigquery")

        Returns:
            dict containing updated session information

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}"
        data = {"adapter_type": adapter_type}
        response = self._request("PATCH", api_url, json=data)
        if response.status_code == 403:
            return {"status": "error", "message": response.json().get("detail")}
        if response.status_code != 200:
            raise RecceCloudException(
                reason=response.text,
                status_code=response.status_code,
            )
        return response.json()
