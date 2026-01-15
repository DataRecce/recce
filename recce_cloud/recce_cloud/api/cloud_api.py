"""
Recce Cloud API client for organization and project operations.

This is a lightweight API client for the init command, supporting
organization and project listing.
"""

import os
from typing import Any, Dict, List, Optional

import requests

RECCE_CLOUD_API_HOST = os.environ.get("RECCE_CLOUD_API_HOST", "https://cloud.datarecce.io")


class CloudAPIError(Exception):
    """Raised when an API call fails."""

    def __init__(self, message: str, status_code: int, reason: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.reason = reason


class CloudAPI:
    """
    Lightweight Recce Cloud API client.

    Provides methods for listing organizations and projects.
    """

    def __init__(self, token: str):
        """
        Initialize the API client.

        Args:
            token: Recce Cloud API token.
        """
        if not token:
            raise ValueError("Token cannot be empty")
        self.token = token
        self.base_url = f"{RECCE_CLOUD_API_HOST}/api/v2"

    def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs,
    ) -> requests.Response:
        """
        Make an authenticated API request.

        Args:
            method: HTTP method (GET, POST, etc.).
            endpoint: API endpoint path.
            **kwargs: Additional arguments to pass to requests.

        Returns:
            Response object.
        """
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.token}"

        return requests.request(
            method,
            url,
            headers=headers,
            timeout=30,
            **kwargs,
        )

    def list_organizations(self) -> List[Dict[str, Any]]:
        """
        List all organizations the user has access to.

        Returns:
            List of organization dictionaries with id, name, slug fields.

        Raises:
            CloudAPIError: If the API call fails.
        """
        response = self._request("GET", "/organizations")

        if response.status_code != 200:
            raise CloudAPIError(
                message="Failed to list organizations",
                status_code=response.status_code,
                reason=response.text,
            )

        data = response.json()
        return data.get("organizations", [])

    def list_projects(self, org_id: str) -> List[Dict[str, Any]]:
        """
        List all projects in an organization.

        Args:
            org_id: Organization ID or slug.

        Returns:
            List of project dictionaries with id, name, slug fields.

        Raises:
            CloudAPIError: If the API call fails.
        """
        response = self._request("GET", f"/organizations/{org_id}/projects")

        if response.status_code != 200:
            raise CloudAPIError(
                message="Failed to list projects",
                status_code=response.status_code,
                reason=response.text,
            )

        data = response.json()
        return data.get("projects", [])

    def get_organization(self, org_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific organization by ID or slug.

        Args:
            org_id: Organization ID or slug.

        Returns:
            Organization dictionary, or None if not found.
        """
        try:
            orgs = self.list_organizations()
            for org in orgs:
                # Compare as strings to handle both int and str IDs
                if str(org.get("id")) == str(org_id) or org.get("slug") == org_id or org.get("name") == org_id:
                    return org
        except CloudAPIError:
            pass
        return None

    def get_project(self, org_id: str, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific project by ID or slug.

        Args:
            org_id: Organization ID or slug.
            project_id: Project ID or slug.

        Returns:
            Project dictionary, or None if not found.
        """
        try:
            projects = self.list_projects(org_id)
            for project in projects:
                # Compare as strings to handle both int and str IDs
                if (
                    str(project.get("id")) == str(project_id)
                    or project.get("slug") == project_id
                    or project.get("name") == project_id
                ):
                    return project
        except CloudAPIError:
            pass
        return None
