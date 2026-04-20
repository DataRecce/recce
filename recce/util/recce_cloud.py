import json
import logging
import os
import typing
from typing import IO, Dict, Optional

import requests

from recce import get_version
from recce.event import get_user_id, is_anonymous_tracking
from recce.pull_request import PullRequestInfo

if typing.TYPE_CHECKING:
    from recce.util.cloud import ChecksCloud

RECCE_CLOUD_DEFAULT_HOST = "https://cloud.reccehq.com"
RECCE_CLOUD_API_HOST = os.environ.get("RECCE_CLOUD_API_HOST", RECCE_CLOUD_DEFAULT_HOST)
RECCE_CLOUD_BASE_URL = os.environ.get("RECCE_CLOUD_BASE_URL", os.environ.get("RECCE_CLOUD_HOST", RECCE_CLOUD_API_HOST))

DOCKER_INTERNAL_URL_PREFIX = "http://host.docker.internal"
LOCALHOST_URL_PREFIX = "http://localhost"

logger = logging.getLogger("uvicorn")


class PresignedUrlMethod:
    UPLOAD = "upload"
    DOWNLOAD = "download"


class RecceCloudException(Exception):
    def __init__(self, message: str, reason: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code

        try:
            reason = json.loads(reason).get("detail", "")
        except json.JSONDecodeError:
            pass
        self.reason = reason

    def __str__(self):
        return f"{self.args[0]} [HTTP {self.status_code}] {self.reason}"


class RecceCloud:
    def __init__(self, token: str):
        if token is None:
            raise ValueError("Token cannot be None.")
        self.token = token
        self.token_type = "github_token" if token.startswith(("ghp_", "gho_", "ghu_", "ghs_", "ghr_")) else "api_token"
        self.base_url = f"{RECCE_CLOUD_API_HOST}/api/v1"
        self.base_url_v2 = f"{RECCE_CLOUD_API_HOST}/api/v2"

        # Initialize modular clients
        self._checks_client = None

    @property
    def checks(self) -> "ChecksCloud":
        """
        Get the checks client for check operations.

        Returns:
            ChecksCloud instance for check operations

        Example:
            >>> cloud = RecceCloud(token="your-token")
            >>> checks = cloud.checks.list_checks("org", "proj", "sess")
        """
        if self._checks_client is None:
            from recce.util.cloud import ChecksCloud

            self._checks_client = ChecksCloud(self.token)
        return self._checks_client

    def _request(self, method, url, headers: Dict = None, **kwargs):
        headers = {
            **(headers or {}),
            "Authorization": f"Bearer {self.token}",
        }
        return requests.request(method, url, headers=headers, **kwargs)

    def verify_token(self) -> bool:
        if self.token_type == "github_token":
            return True
        # Verify the Recce Cloud API token
        api_url = f"{self.base_url}/verify-token"
        try:
            headers: Dict = None
            if is_anonymous_tracking():
                headers = {
                    "X-Recce-Oss-User-Id": get_user_id(),
                    "X-Recce-Oss-Version": get_version(),
                }
            response = self._request("GET", api_url, headers=headers)
            if response.status_code == 200:
                return True
        except Exception:
            pass
        return False

    def get_presigned_url_by_github_repo(
        self,
        method: PresignedUrlMethod,
        repository: str,
        artifact_name: str,
        metadata: dict = None,
        pr_id: int = None,
        branch: str = None,
    ) -> str:
        response = self._fetch_presigned_url(method, repository, artifact_name, metadata, pr_id, branch)
        return response.get("presigned_url")

    def _replace_localhost_with_docker_internal(self, url: str) -> str:
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

    def get_presigned_url_by_share_id(
        self,
        method: PresignedUrlMethod,
        share_id: str,
        metadata: dict = None,
    ) -> str:
        response = self._fetch_presigned_url_by_share_id(method, share_id, metadata=metadata)
        presigned_url = response.get("presigned_url")
        if not presigned_url:
            raise RecceCloudException(
                message="Failed to get presigned URL from Recce Cloud.",
                reason="No presigned URL returned from the server.",
                status_code=404,
            )
        presigned_url = self._replace_localhost_with_docker_internal(presigned_url)
        return presigned_url

    def get_download_presigned_url_by_github_repo_with_tags(
        self, repository: str, artifact_name: str, branch: str = None
    ) -> (str, dict):
        response = self._fetch_presigned_url(PresignedUrlMethod.DOWNLOAD, repository, artifact_name, branch=branch)
        return response.get("presigned_url"), response.get("tags", {})

    def _fetch_presigned_url(
        self,
        method: PresignedUrlMethod,
        repository: str,
        artifact_name: str,
        metadata: dict = None,
        pr_id: int = None,
        branch: str = None,
    ) -> str:
        if pr_id is not None:
            api_url = f"{self.base_url}/{repository}/pulls/{pr_id}/artifacts/{method}?artifact_name={artifact_name}&enable_ssec=true"
        elif branch is not None:
            api_url = f"{self.base_url}/{repository}/commits/{branch}/artifacts/{method}?artifact_name={artifact_name}&enable_ssec=true"
        else:
            raise ValueError("Either pr_id or sha must be provided.")
        response = self._request("POST", api_url, json=metadata)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to {method} artifact {preposition} Recce Cloud.".format(
                    method=method, preposition="from" if method == PresignedUrlMethod.DOWNLOAD else "to"
                ),
                reason=response.text,
                status_code=response.status_code,
            )
        return response.json()

    def _fetch_presigned_url_by_share_id(
        self,
        method: PresignedUrlMethod,
        share_id: str,
        metadata: dict = None,
    ):
        api_url = f"{self.base_url}/shares/{share_id}/presigned/{method}"
        data = None
        # Only provide metadata for upload requests
        if method == PresignedUrlMethod.UPLOAD:
            # Covert metadata values to strings to ensure JSON serializability
            data = {"metadata": {key: str(value) for key, value in metadata.items()}} if metadata else None
        response = self._request(
            "POST",
            api_url,
            json=data,
        )
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to {method} artifact {preposition} Recce Cloud.".format(
                    method=method, preposition="from" if method == PresignedUrlMethod.DOWNLOAD else "to"
                ),
                reason=response.text,
                status_code=response.status_code,
            )
        return response.json()

    def get_artifact_metadata(self, pr_info: PullRequestInfo) -> dict:
        api_url = f"{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/metadata"
        response = self._request("GET", api_url)
        if response.status_code == 204:
            return None
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to get artifact metadata from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        return response.json()

    def purge_artifacts(self, repository: str, pr_id: int = None, branch: str = None):
        if pr_id is not None:
            api_url = f"{self.base_url}/{repository}/pulls/{pr_id}/artifacts"
            error_message = "Failed to purge artifacts from Recce Cloud."
        elif branch is not None:
            api_url = f"{self.base_url}/{repository}/commits/{branch}/artifacts"
            error_message = "Failed to delete artifacts from Recce Cloud."
        else:
            raise ValueError(
                "Please either run this command from within a pull request context "
                "or specify a branch using the --branch option."
            )
        response = self._request("DELETE", api_url)
        if response.status_code != 204:
            raise RecceCloudException(
                message=error_message,
                reason=response.text,
                status_code=response.status_code,
            )

    def check_artifacts_exists(self, pr_info: PullRequestInfo) -> bool:
        api_url = f"{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/metadata"
        response = self._request("GET", api_url)
        if response.status_code == 200:
            return True
        elif response.status_code == 204:
            return False
        else:
            raise RecceCloudException(
                message="Failed to check if artifacts exist in Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )

    def share_state(self, file_name: str, file_io: IO):
        api_url = f"{self.base_url}/recce-state/upload"
        files = {"file": (file_name, file_io, "application/json")}
        response = self._request("POST", api_url, files=files)
        if response.status_code == 403:
            return {"status": "error", "message": response.json().get("detail")}
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to share Recce state.", reason=response.text, status_code=response.status_code
            )
        return response.json()

    def update_github_pull_request_check(self, pr_info: PullRequestInfo, metadata: dict = None):
        api_url = f"{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/github/checks"
        try:
            self._request("POST", api_url, json=metadata)
        except Exception as e:
            # We don't care the response of this request, so we don't need to raise any exception.
            logger.debug(f"Failed to update the GitHub PR check. Reason: {str(e)}")

    def get_user_info(self) -> Dict:
        api_url = f"{self.base_url}/users"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to get user info from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        return response.json().get("user")

    def get_session(self, session_id: str):
        api_url = f"{self.base_url_v2}/sessions/{session_id}"
        response = self._request("GET", api_url)
        if response.status_code == 403:
            return {"status": "error", "message": response.json().get("detail")}
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to get session from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        if data["success"] is not True:
            raise RecceCloudException(
                message="Failed to get session from Recce Cloud.",
                reason=data.get("message", "Unknown error"),
                status_code=response.status_code,
            )
        return data["session"]

    def update_session(self, org_id: str, project_id: str, session_id: str, adapter_type: str):
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}"
        data = {"adapter_type": adapter_type}
        response = self._request("PATCH", api_url, json=data)
        if response.status_code == 403:
            return {"status": "error", "message": response.json().get("detail")}
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to update session in Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        return response.json()

    def get_download_urls_by_session_id(self, org_id: str, project_id: str, session_id: str) -> dict[str, str]:
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/download-url"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to download session from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        if data["presigned_urls"] is None:
            raise RecceCloudException(
                message="No presigned URLs returned from the server.",
                reason="",
                status_code=404,
            )

        presigned_urls = data["presigned_urls"]
        for key, url in presigned_urls.items():
            presigned_urls[key] = self._replace_localhost_with_docker_internal(url)
        return presigned_urls

    def get_base_session_download_urls(self, org_id: str, project_id: str, session_id: str = None) -> dict[str, str]:
        """Get download URLs for the base session of a project.

        If session_id is provided, the server resolves PR-specific base if available.
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/base-session/download-url"
        if session_id:
            api_url += f"?session_id={session_id}"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to download base session from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        if data["presigned_urls"] is None:
            raise RecceCloudException(
                message="No presigned URLs returned from the server.",
                reason="",
                status_code=404,
            )

        presigned_urls = data["presigned_urls"]
        for key, url in presigned_urls.items():
            presigned_urls[key] = self._replace_localhost_with_docker_internal(url)
        return presigned_urls

    def get_upload_urls_by_session_id(self, org_id: str, project_id: str, session_id: str) -> dict[str, str]:
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/upload-url"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to get upload URLs for session from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        if data["presigned_urls"] is None:
            raise RecceCloudException(
                message="No presigned URLs returned from the server.",
                reason="",
                status_code=404,
            )

        presigned_urls = data["presigned_urls"]
        for key, url in presigned_urls.items():
            presigned_urls[key] = self._replace_localhost_with_docker_internal(url)
        return presigned_urls

    def post_recce_state_uploaded_by_session_id(self, org_id: str, project_id: str, session_id: str):
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/recce-state-uploaded"
        response = self._request("POST", api_url)
        if response.status_code != 204:
            raise RecceCloudException(
                message="Failed to notify state uploaded for session in Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )

    def list_organizations(self) -> list:
        """List all organizations the user has access to."""
        api_url = f"{self.base_url_v2}/organizations"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to list organizations from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        return data.get("organizations", [])

    def list_projects(self, org_id: str) -> list:
        """List all projects in an organization."""
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to list projects from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        return data.get("projects", [])

    def list_sessions(self, org_id: str, project_id: str) -> list:
        """List all sessions in a project."""
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions"
        response = self._request("GET", api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message="Failed to list sessions from Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        return data.get("sessions", [])

    def create_session(self, org_id: str, project_id: str, name: str, adapter_type: Optional[str] = None) -> dict:
        """Create a new session in a project."""
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions"
        data = {"name": name}
        if adapter_type:
            data["adapter_type"] = adapter_type
        response = self._request("POST", api_url, json=data)
        if response.status_code not in [200, 201]:
            raise RecceCloudException(
                message="Failed to create session in Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        result = response.json()
        if "session" in result:
            return result["session"]
        return result

    def upload_completed(self, session_id: str):
        """Notify Recce Cloud that artifact upload is complete."""
        api_url = f"{self.base_url_v2}/sessions/{session_id}/upload-completed"
        response = self._request("POST", api_url)
        if response.status_code not in [200, 204]:
            raise RecceCloudException(
                message="Failed to notify upload completion.",
                reason=response.text,
                status_code=response.status_code,
            )

    def create_warehouse_connection(self, org_id: str, name: str, config: dict) -> dict:
        """Create a warehouse connection in an organization.

        Cloud API: POST /v2/organizations/{org_id}/warehouse-connections
        Request body: { name: str, config: dict }
        Config must contain a 'type' field (e.g., 'snowflake', 'bigquery').
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/warehouse-connections"
        data = {"name": name, "config": config}
        response = self._request("POST", api_url, json=data)
        if response.status_code not in [200, 201]:
            raise RecceCloudException(
                message="Failed to create warehouse connection in Recce Cloud.",
                reason=response.text,
                status_code=response.status_code,
            )
        result = response.json()
        return result.get("warehouse_connection", result)

    def bind_warehouse_connection_to_project(
        self,
        org_id: str,
        project_id: str,
        warehouse_connection_id: str,
    ) -> dict:
        """Bind a warehouse connection to a project.

        Cloud API: PUT /v2/organizations/{org_id}/projects/{project_id}/warehouse-connection
        Request body: { warehouse_connection_id: UUID }
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}" f"/projects/{project_id}/warehouse-connection"
        data = {"warehouse_connection_id": warehouse_connection_id}
        response = self._request("PUT", api_url, json=data)
        if response.status_code not in [200, 201]:
            raise RecceCloudException(
                message="Failed to bind warehouse connection to project.",
                reason=response.text,
                status_code=response.status_code,
            )
        return response.json()
