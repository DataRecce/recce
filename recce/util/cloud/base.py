"""
Base class for Recce Cloud API clients.

This module provides the common functionality shared across all cloud API clients.
"""

import os
from typing import Dict, Optional

import requests

from recce.util.recce_cloud import (
    DOCKER_INTERNAL_URL_PREFIX,
    LOCALHOST_URL_PREFIX,
    RECCE_CLOUD_API_HOST,
    RecceCloudException,
)


class CloudBase:
    """
    Base class for Recce Cloud API operations.

    Provides common functionality for making authenticated requests to the Recce Cloud API,
    including request handling, error management, and Docker environment URL conversion.

    Attributes:
        token: Authentication token (API token or GitHub token)
        token_type: Type of token ("api_token" or "github_token")
        base_url: Base URL for API v1 endpoints
        base_url_v2: Base URL for API v2 endpoints
    """

    def __init__(self, token: str):
        """
        Initialize the CloudBase client.

        Args:
            token: Authentication token for Recce Cloud API

        Raises:
            ValueError: If token is None
        """
        if token is None:
            raise ValueError("Token cannot be None.")

        self.token = token
        self.token_type = "github_token" if token.startswith(("ghp_", "gho_", "ghu_", "ghs_", "ghr_")) else "api_token"
        self.base_url = f"{RECCE_CLOUD_API_HOST}/api/v1"
        self.base_url_v2 = f"{RECCE_CLOUD_API_HOST}/api/v2"

    def _request(self, method: str, url: str, headers: Optional[Dict] = None, **kwargs):
        """
        Make an authenticated HTTP request to Recce Cloud API.

        Args:
            method: HTTP method (GET, POST, PATCH, DELETE, etc.)
            url: Full URL for the request
            headers: Optional additional headers
            **kwargs: Additional arguments passed to requests.request

        Returns:
            Response object from requests library
        """
        headers = {
            **(headers or {}),
            "Authorization": f"Bearer {self.token}",
        }
        url = self._replace_localhost_with_docker_internal(url)
        return requests.request(method, url, headers=headers, **kwargs)

    @staticmethod
    def _replace_localhost_with_docker_internal(url: str) -> Optional[str]:
        """
        Convert localhost URLs to docker internal URLs if running in Docker.

        This is useful for local development when Recce is running inside a Docker container
        and needs to access localhost services on the host machine.

        Args:
            url: URL that might contain localhost

        Returns:
            URL with localhost replaced by host.docker.internal if in Docker, otherwise original URL
        """
        if url is None:
            return None

        if (
            os.environ.get("RECCE_SHARE_INSTANCE_ENV") == "docker"
            or os.environ.get("RECCE_TASK_INSTANCE_ENV") == "docker"
            or os.environ.get("RECCE_INSTANCE_ENV") == "docker"
        ):
            if url.startswith(LOCALHOST_URL_PREFIX):
                return url.replace(LOCALHOST_URL_PREFIX, DOCKER_INTERNAL_URL_PREFIX)

        return url

    def _raise_for_status(self, response, message: str):
        """
        Raise RecceCloudException if the response status is not successful.

        Args:
            response: Response object from requests
            message: Error message to include in the exception

        Raises:
            RecceCloudException: If response status code is not 2xx
        """
        if not response.ok:
            raise RecceCloudException(
                message=message,
                reason=response.text,
                status_code=response.status_code,
            )
