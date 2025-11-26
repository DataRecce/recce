"""
Recce Cloud API client for check operations.

This module provides methods for managing checks (validation operations) in Recce Cloud,
including CRUD operations for checks within sessions.
"""

from typing import Dict, List

from recce.util.cloud.base import CloudBase


class ChecksCloud(CloudBase):
    """
    Client for Recce Cloud check operations.

    Provides methods to list, create, retrieve, update, and delete checks
    within Recce Cloud sessions.

    Examples:
        >>> client = ChecksCloud(token="your-api-token")
        >>> checks = client.list_checks(org_id="org123", project_id="proj456", session_id="sess789")
        >>> check = client.get_check(org_id="org123", project_id="proj456",
        ...                          session_id="sess789", check_id="check001")
    """

    def list_checks(self, org_id: str, project_id: str, session_id: str) -> List[Dict]:
        """
        List all checks in a session.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID

        Returns:
            List of check dictionaries

        Raises:
            RecceCloudException: If the request fails

        Example:
            >>> checks = client.list_checks("org123", "proj456", "sess789")
            >>> print(f"Found {len(checks)} checks")
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/checks"
        response = self._request("GET", api_url)

        self._raise_for_status(
            response,
            "Failed to list checks from Recce Cloud.",
        )

        data = response.json()
        return data.get("checks", [])

    def create_check(
        self,
        org_id: str,
        project_id: str,
        session_id: str,
        check_data: Dict,
    ) -> Dict:
        """
        Create a new check in a session.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_data: Check data to create (should include check type, params, etc.)

        Returns:
            Created check dictionary

        Raises:
            RecceCloudException: If the request fails

        Example:
            >>> check_data = {
            ...     "name": "Schema Check",
            ...     "type": "schema_diff",
            ...     "params": {"model": "customers"}
            ... }
            >>> check = client.create_check("org123", "proj456", "sess789", check_data)
            >>> print(f"Created check with ID: {check['id']}")
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/checks"
        response = self._request("POST", api_url, json=check_data)

        self._raise_for_status(
            response,
            "Failed to create check in Recce Cloud.",
        )
        data = response.json()
        return data.get("check")

    def get_check(
        self,
        org_id: str,
        project_id: str,
        session_id: str,
        check_id: str,
    ) -> Dict:
        """
        Get a specific check by ID.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID

        Returns:
            Check dictionary

        Raises:
            RecceCloudException: If the request fails or check not found

        Example:
            >>> check = client.get_check("org123", "proj456", "sess789", "check001")
            >>> print(f"Check name: {check['name']}")
            >>> print(f"Check status: {check['status']}")
        """
        api_url = (
            f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/checks/{check_id}"
        )
        response = self._request("GET", api_url)

        self._raise_for_status(
            response,
            f"Failed to get check {check_id} from Recce Cloud.",
        )

        data = response.json()
        return data.get("check", {})

    def update_check(
        self,
        org_id: str,
        project_id: str,
        session_id: str,
        check_id: str,
        check_data: Dict,
    ) -> Dict:
        """
        Update an existing check.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID
            check_data: Updated check data (partial updates supported)

        Returns:
            Updated check dictionary

        Raises:
            RecceCloudException: If the request fails

        Example:
            >>> update_data = {
            ...     "status": "approved",
            ...     "notes": "Validated successfully"
            ... }
            >>> check = client.update_check("org123", "proj456", "sess789", "check001", update_data)
            >>> print(f"Updated check status: {check['status']}")
        """
        api_url = (
            f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/checks/{check_id}"
        )
        response = self._request("PATCH", api_url, json=check_data)

        self._raise_for_status(
            response,
            f"Failed to update check {check_id} in Recce Cloud.",
        )

        data = response.json()
        return data.get("check", {})

    def delete_check(
        self,
        org_id: str,
        project_id: str,
        session_id: str,
        check_id: str,
    ) -> None:
        """
        Delete a check.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID

        Raises:
            RecceCloudException: If the request fails

        Example:
            >>> client.delete_check("org123", "proj456", "sess789", "check001")
            >>> print("Check deleted successfully")
        """
        api_url = (
            f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/checks/{check_id}"
        )
        response = self._request("DELETE", api_url)

        # DELETE typically returns 204 No Content on success
        if response.status_code not in (200, 204):
            self._raise_for_status(
                response,
                f"Failed to delete check {check_id} from Recce Cloud.",
            )

    def create_preset_check(self, org_id: str, project_id: str, check_data: Dict):
        """
        Create a preset check from an existing check.

        Args:
            org_id: Organization ID
            project_id: Project ID
            check_data: Check data including name, description, type, params, view_options, and order_index

        Returns:
            Created preset check dictionary

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/preset-checks"
        response = self._request("POST", api_url, json=check_data)

        self._raise_for_status(
            response,
            "Failed to create preset check in Recce Cloud.",
        )

        data = response.json()
        return data.get("presetCheck", {})
