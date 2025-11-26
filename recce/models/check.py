"""
CheckDAO with cloud integration.

This module provides data access for Check objects with support for both
local (in-memory) and cloud (Recce Cloud API) storage modes.
"""

import logging
import typing
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from recce.exceptions import RecceException

from .types import Check, RunType

if typing.TYPE_CHECKING:
    from ..apis.check_api import PatchCheckIn

logger = logging.getLogger("uvicorn")


class CheckDAO:
    """
    Data Access Object for Check.

    Supports two modes:
    - Local mode: Stores checks in memory
    - Cloud mode: Stores checks in Recce Cloud via API

    The mode is determined by checking if a session_id exists in the state_loader.
    """

    def __init__(self):
        """Initialize CheckDAO."""
        self._session_info_cache = None

    @property
    def _checks(self):
        """Get checks from local context."""
        from recce.core import default_context

        return default_context().checks

    @property
    def is_cloud_user(self) -> bool:
        """
        Determine if the user is in cloud mode.

        Returns True if state_loader has a session_id, indicating cloud mode.
        Returns False otherwise, indicating local mode.

        Returns:
            bool: True if cloud mode, False if local mode
        """
        from recce.core import default_context

        ctx = default_context()
        if ctx is None or ctx.state_loader is None:
            return False

        return hasattr(ctx.state_loader, "session_id") and ctx.state_loader.session_id is not None

    def _get_session_info(self) -> tuple[str, str, str]:
        """
        Get organization ID, project ID, and session ID from state loader.

        Caches the session info to avoid repeated API calls.

        Returns:
            tuple: (org_id, project_id, session_id)

        Raises:
            RecceException: If session info cannot be retrieved
        """
        from recce.core import default_context

        if self._session_info_cache is not None:
            return self._session_info_cache

        ctx = default_context()
        state_loader = ctx.state_loader

        if not hasattr(state_loader, "session_id") or state_loader.session_id is None:
            raise RecceException("Cannot get session info: no session_id in state_loader")

        session_id = state_loader.session_id

        # Get org_id and project_id from the session
        # First check if they're already cached on the state_loader
        if hasattr(state_loader, "org_id") and hasattr(state_loader, "project_id"):
            org_id = state_loader.org_id
            project_id = state_loader.project_id
        else:
            # Fetch from cloud API
            from recce.event import get_recce_api_token
            from recce.util.recce_cloud import RecceCloud

            api_token = get_recce_api_token() or ctx.state_loader.token
            if not api_token:
                raise RecceException("Cannot access Recce Cloud: no API token available")

            recce_cloud = RecceCloud(api_token)
            session = recce_cloud.get_session(session_id)

            org_id = session.get("org_id")
            project_id = session.get("project_id")

            if not org_id or not project_id:
                raise RecceException(f"Session {session_id} does not belong to a valid organization or project")

            # Cache on state_loader for future use
            state_loader.org_id = org_id
            state_loader.project_id = project_id

        self._session_info_cache = (org_id, project_id, session_id)
        return self._session_info_cache

    @staticmethod
    def _get_cloud_client():
        """
        Get the cloud checks client.

        Returns:
            ChecksCloud: Cloud client for check operations

        Raises:
            RecceException: If cloud client cannot be initialized
        """
        from recce.core import default_context
        from recce.event import get_recce_api_token
        from recce.util.recce_cloud import RecceCloud

        ctx = default_context()

        api_token = get_recce_api_token() or ctx.state_loader.token
        if not api_token:
            raise RecceException("Cannot access Recce Cloud: no API token available")

        recce_cloud = RecceCloud(api_token)
        return recce_cloud.checks

    @staticmethod
    def _check_to_cloud_format(check: Check) -> dict:
        """
        Convert a Check object to cloud API format.

        Args:
            check: Check object to convert

        Returns:
            dict: Check data in cloud API format
        """
        return {
            "session_id": str(check.session_id) if check.session_id else None,
            "name": check.name,
            "type": check.type.value,
            "params": check.params or {},
            "created_by": check.created_by,
            "description": check.description,
            "view_options": check.view_options or {},
            "is_checked": check.is_checked,
            "is_preset": check.is_preset,
            "updated_by": check.updated_by,
            "created_at": check.created_at.isoformat() if check.created_at else None,
            "updated_at": check.updated_at.isoformat() if check.updated_at else None,
        }

    @staticmethod
    def _cloud_to_check(cloud_data: dict) -> Check:
        """
        Convert cloud API data to a Check object.

        Args:
            cloud_data: Check data from cloud API

        Returns:
            Check: Check object
        """

        logger.debug(f"Converting cloud data to Check object for check: {cloud_data.get('id')}")
        # Parse the type
        check_type = RunType(cloud_data.get("type"))

        return Check(
            check_id=UUID(cloud_data.get("id")),
            session_id=UUID(cloud_data.get("session_id")),
            name=cloud_data.get("name"),
            description=cloud_data.get("description", ""),
            type=check_type,
            params=cloud_data.get("params", {}),
            view_options=cloud_data.get("view_options", {}),
            is_checked=cloud_data.get("is_checked", False),
            is_preset=cloud_data.get("is_preset", False),
            created_by=(cloud_data.get("created_by") or {}).get("email", ""),
            updated_by=(cloud_data.get("updated_by") or {}).get("email", ""),
            created_at=datetime.fromisoformat(cloud_data["created_at"]) if cloud_data.get("created_at") else None,
            updated_at=datetime.fromisoformat(cloud_data["updated_at"]) if cloud_data.get("updated_at") else None,
        )

    def create(self, check: Check) -> Check:
        """
        Create a new check.

        In local mode: Appends check to in-memory list
        In cloud mode: Creates check via Recce Cloud API

        Args:
            check: Check object to create

        Raises:
            RecceException: If creation fails in cloud mode
        """
        if self.is_cloud_user:
            try:
                org_id, project_id, session_id = self._get_session_info()
                cloud_client = self._get_cloud_client()

                check_data = self._check_to_cloud_format(check)
                cloud_check = cloud_client.create_check(org_id, project_id, session_id, check_data)
                new_check = self._cloud_to_check(cloud_check)

                logger.debug(f"Created check {new_check.check_id} in cloud")
                return new_check
            except Exception as e:
                logger.error(f"Failed to create check in cloud: {e}")
                raise RecceException(f"Failed to create check in Recce Cloud: {e}")
        else:
            # Local mode
            self._checks.append(check)
            return check

    def find_check_by_id(self, check_id) -> Optional[Check]:
        """
        Find a check by its ID.

        In local mode: Searches in-memory list
        In cloud mode: Retrieves check from Recce Cloud API

        Args:
            check_id: Check ID (UUID or string)

        Returns:
            Check object if found, None otherwise
        """
        if self.is_cloud_user:
            try:
                org_id, project_id, session_id = self._get_session_info()
                cloud_client = self._get_cloud_client()

                cloud_data = cloud_client.get_check(org_id, project_id, session_id, str(check_id))
                return self._cloud_to_check(cloud_data)
            except Exception as e:
                logger.error(f"Failed to get check {check_id} from cloud: {e}")
                return None
        else:
            # Local mode
            for check in self._checks:
                if str(check_id) == str(check.check_id):
                    return check
            return None

    def update_check_by_id(self, check_id, patch: "PatchCheckIn") -> Optional[Check]:
        """
        Update a check by its ID.

        In local mode: Updates in-memory list
        In cloud mode: Updates via Recce Cloud API

        Args:
            check_id: Check ID (UUID or string)
            patch: Partial Check object with updated data

        Returns:
            bool: True if updated, False if not found
        """
        if self.is_cloud_user:
            try:
                org_id, project_id, session_id = self._get_session_info()
                cloud_client = self._get_cloud_client()

                # Directly send the patch object to the cloud API
                cloud_data = cloud_client.update_check(
                    org_id, project_id, session_id, str(check_id), patch.model_dump(exclude_unset=True)
                )

                logger.debug(f"Updated check {check_id} in cloud")
                return self._cloud_to_check(cloud_data)
            except Exception as e:
                logger.error(f"Failed to update check {check_id} in cloud: {e}")
                return None
        else:
            # Local mode
            check = CheckDAO().find_check_by_id(check_id)
            if check is None:
                return None

            if patch.name is not None:
                check.name = patch.name
            if patch.description is not None:
                check.description = patch.description
            if patch.params is not None:
                check.params = patch.params
            if patch.view_options is not None:
                check.view_options = patch.view_options
            if patch.is_checked is not None:
                check.is_checked = patch.is_checked
            check.updated_at = datetime.now(timezone.utc).replace(microsecond=0)

            return check

    def delete(self, check_id) -> bool:
        """
        Delete a check by its ID.

        In local mode: Removes from in-memory list
        In cloud mode: Deletes via Recce Cloud API

        Args:
            check_id: Check ID (UUID or string)

        Returns:
            bool: True if deleted, False if not found
        """
        if self.is_cloud_user:
            try:
                org_id, project_id, session_id = self._get_session_info()
                cloud_client = self._get_cloud_client()

                cloud_client.delete_check(org_id, project_id, session_id, str(check_id))
                logger.debug(f"Deleted check {check_id} from cloud")
                return True
            except Exception as e:
                logger.error(f"Failed to delete check {check_id} from cloud: {e}")
                return False
        else:
            # Local mode
            for check in self._checks:
                if str(check_id) == str(check.check_id):
                    self._checks.remove(check)
                    return True
            return False

    def list(self) -> List[Check]:
        """
        List all checks.

        In local mode: Returns copy of in-memory list
        In cloud mode: Retrieves all checks from Recce Cloud API

        Returns:
            List of Check objects
        """
        if self.is_cloud_user:
            try:
                org_id, project_id, session_id = self._get_session_info()
                logger.debug(f"Listing checks from cloud: {org_id}:{project_id}:{session_id}")
                cloud_client = self._get_cloud_client()

                cloud_checks = cloud_client.list_checks(org_id, project_id, session_id)
                return [self._cloud_to_check(check_data) for check_data in cloud_checks]
            except AttributeError as e:
                logger.error(f"Attribute error while listing checks from cloud: {e}")
                return []
            except Exception as e:
                logger.exception(e)
                # Return empty list on error to avoid breaking the UI
                return []
        else:
            # Local mode
            return list(self._checks)

    def reorder(self, source: int, destination: int):
        """
        Reorder checks.

        Note: This operation is only supported in local mode.
        In cloud mode, raises an exception as reordering must be handled server-side.

        Args:
            source: Source index
            destination: Destination index

        Raises:
            RecceException: If indices are out of range or if in cloud mode
        """
        if self.is_cloud_user:
            raise RecceException(
                "Reordering checks is not supported in cloud mode. " "Check order is managed server-side."
            )

        if source < 0 or source >= len(self._checks):
            raise RecceException("Failed to reorder checks. Source index out of range")

        if destination < 0 or destination >= len(self._checks):
            raise RecceException("Failed to reorder checks. Destination index out of range")

        check_to_move = self._checks.pop(source)
        self._checks.insert(destination, check_to_move)

    def clear(self):
        """
        Clear all checks.

        Note: This operation is only supported in local mode.
        In cloud mode, this is a no-op with a warning.
        """
        if self.is_cloud_user:
            logger.warning("Clear operation is not supported in cloud mode")
            return

        self._checks.clear()

    def mark_as_preset_check(self, check_id: UUID, order_idx: int = 0) -> None:
        """
        Mark a check as a preset check.

        This operation is only supported for cloud users. It creates a preset check
        from an existing check, which can then be used across projects.

        Args:
            check_id: Check ID (UUID)
            order_idx: Order index for the preset check (default: 0)

        Returns:
            None

        Raises:
            RecceException: If operation is attempted in local mode or if check not found
        """
        if not self.is_cloud_user:
            raise RecceException(
                "Marking checks as preset is only supported in cloud mode. This feature requires Recce Cloud."
            )

        # Get the original check
        check = self.find_check_by_id(check_id)
        if check is None:
            raise RecceException(f"Check {check_id} not found")

        try:
            org_id, project_id, session_id = self._get_session_info()
            cloud_client = self._get_cloud_client()

            # Prepare preset check data
            preset_data = {
                "name": check.name,
                "description": check.description if check.description else None,
                "type": check.type.value,
                "params": check.params if check.params else {},
                "view_options": check.view_options if check.view_options else None,
                "order_index": order_idx,  # Order index for the preset check
                "check_id": str(check_id),
            }

            # Create preset check via cloud API
            cloud_client.create_preset_check(org_id, project_id, preset_data)

            logger.debug(f"Created preset check from check {check_id}")
        except Exception as e:
            logger.error(f"Failed to mark check {check_id} as preset: {e}")
            raise RecceException(f"Failed to create preset check: {e}")

    def status(self):
        """
        Get check statistics.

        Returns:
            dict: Dictionary with 'total' and 'approved' counts
        """
        checks = self.list()
        return {"total": len(checks), "approved": len([c for c in checks if c.is_checked])}
