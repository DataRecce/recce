"""
Recce Cloud API clients for lightweight operations.

Provides clients for session management and report generation.
"""

import json
import logging
import os
from typing import Optional

import requests

from recce_cloud.api.exceptions import RecceCloudException

logger = logging.getLogger("recce")

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

    def get_download_urls_by_session_id(self, org_id: str, project_id: str, session_id: str) -> dict:
        """
        Get presigned S3 download URLs for a session.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID

        Returns:
            dict with keys:
                - manifest_url: Presigned URL for downloading manifest.json
                - catalog_url: Presigned URL for downloading catalog.json

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/download-url"
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

    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session by ID.

        This uses the user interactive endpoint DELETE /sessions/{session_id}.
        If the session is a base session, it will be automatically unbound first.

        Args:
            session_id: Session ID to delete

        Returns:
            True if deletion was successful

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/sessions/{session_id}"
        response = self._request("DELETE", api_url)
        if response.status_code == 204:
            return True
        if response.status_code == 403:
            raise RecceCloudException(
                reason=response.json().get("detail", "Permission denied"),
                status_code=response.status_code,
            )
        if response.status_code == 404:
            raise RecceCloudException(
                reason="Session not found",
                status_code=response.status_code,
            )
        raise RecceCloudException(
            reason=response.text,
            status_code=response.status_code,
        )


class ReportClient:
    """Client for fetching reports from Recce Cloud API."""

    def __init__(self, token: str):
        if token is None:
            raise ValueError("Token cannot be None.")
        self.token = token
        self.base_url_v2 = f"{RECCE_CLOUD_API_HOST}/api/v2"

    def _request(self, method: str, url: str, headers: dict = None, **kwargs):
        """
        Make authenticated HTTP request to Recce Cloud API.

        Raises:
            RecceCloudException: If network error occurs
        """
        headers = {
            **(headers or {}),
            "Authorization": f"Bearer {self.token}",
        }
        try:
            return requests.request(method, url, headers=headers, timeout=60, **kwargs)
        except requests.exceptions.Timeout as e:
            logger.error(f"Request timeout: {e}")
            raise RecceCloudException(
                reason="Request timed out. Please try again.",
                status_code=0,
            )
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {e}")
            raise RecceCloudException(
                reason="Failed to connect to Recce Cloud API. Please check your network connection.",
                status_code=0,
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise RecceCloudException(
                reason=f"Network error: {str(e)}",
                status_code=0,
            )

    def get_pr_metrics(
        self,
        repo: str,
        since: str = "30d",
        until: Optional[str] = None,
        base_branch: str = "main",
        merged_only: bool = True,
    ):
        """
        Fetch PR metrics report from Recce Cloud API.

        Args:
            repo: Repository full name (owner/repo)
            since: Start date (ISO format or relative like 30d)
            until: End date (ISO format or relative). Defaults to today.
            base_branch: Target branch filter
            merged_only: Only include merged PRs

        Returns:
            PRMetricsReport containing all metrics

        Raises:
            RecceCloudException: If the request fails
        """
        # Import here to avoid circular import
        from recce_cloud.report import PRMetrics, PRMetricsReport, SummaryStatistics

        api_url = f"{self.base_url_v2}/reports/pr-metrics"

        params = {
            "repo": repo,
            "since": since,
            "base_branch": base_branch,
            "merged_only": str(merged_only).lower(),
        }
        if until:
            params["until"] = until

        response = self._request("GET", api_url, params=params)

        if response.status_code == 401:
            raise RecceCloudException(
                reason="Invalid or missing API token",
                status_code=401,
            )
        if response.status_code == 404:
            raise RecceCloudException(
                reason=f"Repository not found: {repo}",
                status_code=404,
            )
        if response.status_code == 400:
            try:
                error_detail = response.json().get("detail", "Bad request")
            except json.JSONDecodeError:
                error_detail = "Bad request"
            raise RecceCloudException(
                reason=error_detail,
                status_code=400,
            )
        if response.status_code == 502:
            try:
                error_detail = response.json().get("detail", "Upstream API error")
            except json.JSONDecodeError:
                error_detail = "Upstream API error"
            raise RecceCloudException(
                reason=error_detail,
                status_code=502,
            )
        if response.status_code != 200:
            raise RecceCloudException(
                reason=response.text,
                status_code=response.status_code,
            )

        try:
            data = response.json()
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse API response: {e}")
            raise RecceCloudException(
                reason="Invalid response from API",
                status_code=response.status_code,
            )

        # Parse pull requests
        pull_requests = []
        for pr in data.get("pull_requests", []):
            pull_requests.append(
                PRMetrics(
                    pr_number=pr.get("pr_number", 0),
                    pr_title=pr.get("pr_title", ""),
                    pr_state=pr.get("pr_state", "unknown"),
                    pr_url=pr.get("pr_url", ""),
                    pr_author=pr.get("pr_author"),
                    pr_created_at=pr.get("pr_created_at"),
                    pr_merged_at=pr.get("pr_merged_at"),
                    time_to_merge=pr.get("time_to_merge"),
                    commits_before_pr_open=pr.get("commits_before_pr_open", 0),
                    commits_after_pr_open=pr.get("commits_after_pr_open", 0),
                    commits_after_summary=pr.get("commits_after_summary"),
                    commits_fetch_failed=pr.get("commits_fetch_failed", False),
                    has_recce_session=pr.get("has_recce_session", False),
                    recce_session_url=pr.get("recce_session_url"),
                    recce_checks_count=pr.get("recce_checks_count"),
                    recce_check_types=pr.get("recce_check_types"),
                    recce_summary_generated=pr.get("recce_summary_generated"),
                    recce_summary_at=pr.get("recce_summary_at"),
                )
            )

        # Parse summary statistics
        summary_data = data.get("summary", {})
        summary = SummaryStatistics(
            total_prs=summary_data.get("total_prs", len(pull_requests)),
            prs_merged=summary_data.get("prs_merged", 0),
            prs_open=summary_data.get("prs_open", 0),
            prs_with_recce_session=summary_data.get("prs_with_recce_session", 0),
            prs_with_recce_summary=summary_data.get("prs_with_recce_summary", 0),
            recce_adoption_rate=summary_data.get("recce_adoption_rate", 0.0),
            summary_generation_rate=summary_data.get("summary_generation_rate", 0.0),
            total_commits_before_pr_open=summary_data.get("total_commits_before_pr_open", 0),
            total_commits_after_pr_open=summary_data.get("total_commits_after_pr_open", 0),
            total_commits_after_summary=summary_data.get("total_commits_after_summary", 0),
            avg_commits_before_pr_open=summary_data.get("avg_commits_before_pr_open", 0.0),
            avg_commits_after_pr_open=summary_data.get("avg_commits_after_pr_open", 0.0),
            avg_commits_after_summary=summary_data.get("avg_commits_after_summary"),
            avg_time_to_merge=summary_data.get("avg_time_to_merge"),
        )

        date_range = data.get("date_range", {})
        return PRMetricsReport(
            success=data.get("success", True),
            repo=data.get("repo", repo),
            date_range_since=date_range.get("since", ""),
            date_range_until=date_range.get("until", ""),
            summary=summary,
            pull_requests=pull_requests,
        )
