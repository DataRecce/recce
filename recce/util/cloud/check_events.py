"""
Recce Cloud API client for check event operations.

This module provides methods for managing check events (timeline/conversation) in Recce Cloud,
including CRUD operations for comments and retrieving state change events.
"""

from typing import Dict, List

from recce.util.cloud.base import CloudBase


class CheckEventsCloud(CloudBase):
    """
    Client for Recce Cloud check event operations.

    Provides methods to list, create, update, and delete check events
    (comments and state changes) within Recce Cloud sessions.

    Examples:
        >>> client = CheckEventsCloud(token="your-api-token")
        >>> events = client.list_events(
        ...     org_id="org123",
        ...     project_id="proj456",
        ...     session_id="sess789",
        ...     check_id="check001"
        ... )
    """

    def _build_events_url(self, org_id: str, project_id: str, session_id: str, check_id: str) -> str:
        """Build the base URL for check events endpoints."""
        return f"{self.base_url_v2}/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/checks/{check_id}/events"

    def list_events(self, org_id: str, project_id: str, session_id: str, check_id: str) -> List[Dict]:
        """
        List all events for a check in chronological order.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID

        Returns:
            List of event dictionaries

        Raises:
            RecceCloudException: If the request fails

        Example:
            >>> events = client.list_events("org123", "proj456", "sess789", "check001")
            >>> for event in events:
            ...     print(f"{event['event_type']}: {event['content']}")
        """
        api_url = self._build_events_url(org_id, project_id, session_id, check_id)
        query_params = {"include_deleted": True}
        response = self._request("GET", api_url, params=query_params)

        self._raise_for_status(
            response,
            "Failed to list check events from Recce Cloud.",
        )

        data = response.json()
        # Response is wrapped: {"events": [...]}
        return data.get("events", [])

    def get_event(self, org_id: str, project_id: str, session_id: str, check_id: str, event_id: str) -> Dict:
        """
        Get a specific event by ID.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID
            event_id: Event ID

        Returns:
            Event dictionary

        Raises:
            RecceCloudException: If the request fails or event not found
        """
        api_url = f"{self._build_events_url(org_id, project_id, session_id, check_id)}/{event_id}"
        response = self._request("GET", api_url)

        self._raise_for_status(
            response,
            f"Failed to get check event {event_id} from Recce Cloud.",
        )

        data = response.json()
        # Response is wrapped: {"event": {...}}
        return data.get("event", {})

    def create_comment(self, org_id: str, project_id: str, session_id: str, check_id: str, content: str) -> Dict:
        """
        Create a new comment on a check.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID
            content: Comment content (plain text or markdown)

        Returns:
            Created event dictionary

        Raises:
            RecceCloudException: If the request fails

        Example:
            >>> event = client.create_comment(
            ...     "org123", "proj456", "sess789", "check001",
            ...     "This looks good to me!"
            ... )
            >>> print(f"Created comment with ID: {event['id']}")
        """
        api_url = self._build_events_url(org_id, project_id, session_id, check_id)
        response = self._request("POST", api_url, json={"content": content})

        self._raise_for_status(
            response,
            "Failed to create comment in Recce Cloud.",
        )

        data = response.json()
        # Response is wrapped: {"event": {...}}
        return data.get("event", {})

    def update_comment(
        self, org_id: str, project_id: str, session_id: str, check_id: str, event_id: str, content: str
    ) -> Dict:
        """
        Update an existing comment.

        Only the author or an admin can update a comment.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID
            event_id: Event ID of the comment to update
            content: New comment content

        Returns:
            Updated event dictionary

        Raises:
            RecceCloudException: If the request fails or user is not authorized
        """
        api_url = f"{self._build_events_url(org_id, project_id, session_id, check_id)}/{event_id}"
        response = self._request("PATCH", api_url, json={"content": content})

        self._raise_for_status(
            response,
            f"Failed to update comment {event_id} in Recce Cloud.",
        )

        data = response.json()
        # Response is wrapped: {"event": {...}}
        return data.get("event", {})

    def delete_comment(self, org_id: str, project_id: str, session_id: str, check_id: str, event_id: str) -> None:
        """
        Delete a comment (soft delete).

        Only the author or an admin can delete a comment.
        The comment will be marked as deleted but remain in the timeline.

        Args:
            org_id: Organization ID
            project_id: Project ID
            session_id: Session ID
            check_id: Check ID
            event_id: Event ID of the comment to delete

        Raises:
            RecceCloudException: If the request fails or user is not authorized
        """
        api_url = f"{self._build_events_url(org_id, project_id, session_id, check_id)}/{event_id}"
        response = self._request("DELETE", api_url)

        self._raise_for_status(
            response,
            f"Failed to delete comment {event_id} in Recce Cloud.",
        )
