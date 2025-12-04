"""
Check Events API endpoints.

This module provides REST endpoints for check events (timeline/conversation),
proxying requests to Recce Cloud. This feature is only available for cloud users.
"""

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.core import default_context
from recce.event import get_recce_api_token
from recce.exceptions import RecceException
from recce.util.cloud.check_events import CheckEventsCloud
from recce.util.recce_cloud import RecceCloud, RecceCloudException

logger = logging.getLogger("uvicorn")

check_events_router = APIRouter(tags=["check_events"])


# ============================================================================
# Helper Functions
# ============================================================================


def _is_cloud_user() -> bool:
    """Check if the current user is connected to Recce Cloud."""
    ctx = default_context()
    if ctx is None or ctx.state_loader is None:
        return False
    return hasattr(ctx.state_loader, "session_id") and ctx.state_loader.session_id is not None


def _get_session_info() -> tuple:
    """
    Get organization ID, project ID, and session ID from state loader.

    Returns:
        tuple: (org_id, project_id, session_id)

    Raises:
        HTTPException: If not in cloud mode or session info unavailable
    """
    if not _is_cloud_user():
        raise HTTPException(
            status_code=400,
            detail="Check events are only available when connected to Recce Cloud.",
        )

    ctx = default_context()
    state_loader = ctx.state_loader

    session_id = state_loader.session_id

    # Check if org_id and project_id are cached
    if hasattr(state_loader, "org_id") and hasattr(state_loader, "project_id"):
        return state_loader.org_id, state_loader.project_id, session_id

    # Fetch from cloud API
    api_token = get_recce_api_token() or state_loader.token
    if not api_token:
        raise HTTPException(
            status_code=401,
            detail="Cannot access Recce Cloud: no API token available.",
        )

    try:
        recce_cloud = RecceCloud(api_token)
        session = recce_cloud.get_session(session_id)

        org_id = session.get("org_id")
        project_id = session.get("project_id")

        if not org_id or not project_id:
            raise HTTPException(
                status_code=400,
                detail=f"Session {session_id} does not belong to a valid organization or project.",
            )

        # Cache for future use
        state_loader.org_id = org_id
        state_loader.project_id = project_id

        return org_id, project_id, session_id

    except RecceCloudException as e:
        logger.error(f"Failed to get session info: {e}")
        raise HTTPException(status_code=e.status_code, detail=str(e.reason))


def _get_events_client() -> CheckEventsCloud:
    """
    Get the CheckEventsCloud client.

    Returns:
        CheckEventsCloud: Cloud client for event operations

    Raises:
        HTTPException: If client cannot be initialized
    """
    ctx = default_context()
    api_token = get_recce_api_token() or ctx.state_loader.token

    if not api_token:
        raise HTTPException(
            status_code=401,
            detail="Cannot access Recce Cloud: no API token available.",
        )

    return CheckEventsCloud(api_token)


# ============================================================================
# Pydantic Models
# ============================================================================


class CheckEventActorOut(BaseModel):
    """Actor who performed the event."""

    type: str  # "user", "recce_ai", "preset_system"
    user_id: Optional[int] = None
    login: Optional[str] = None
    fullname: Optional[str] = None


class CheckEventOut(BaseModel):
    """Check event response model."""

    id: str
    check_id: str
    event_type: str
    actor: CheckEventActorOut
    content: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    is_edited: bool = False
    is_deleted: bool = False
    created_at: str
    updated_at: str


class CreateCommentIn(BaseModel):
    """Request body for creating a comment."""

    content: str


class UpdateCommentIn(BaseModel):
    """Request body for updating a comment."""

    content: str


# ============================================================================
# API Endpoints
# ============================================================================


@check_events_router.get(
    "/checks/{check_id}/events",
    status_code=200,
    response_model=List[CheckEventOut],
)
async def list_check_events(check_id: UUID):
    """
    List all events for a check in chronological order.

    This endpoint returns all events (comments, state changes, etc.) for the
    specified check. Events are returned in chronological order (oldest first).

    Args:
        check_id: The check ID

    Returns:
        List of CheckEventOut objects

    Raises:
        400: Not connected to Recce Cloud
        401: No API token available
        404: Check not found
    """
    try:
        org_id, project_id, session_id = _get_session_info()
        client = _get_events_client()

        events = client.list_events(org_id, project_id, session_id, str(check_id))
        return events

    except RecceCloudException as e:
        logger.error(f"Failed to list check events: {e}")
        raise HTTPException(status_code=e.status_code, detail=str(e.reason))
    except RecceException as e:
        logger.error(f"Failed to list check events: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@check_events_router.get(
    "/checks/{check_id}/events/{event_id}",
    status_code=200,
    response_model=CheckEventOut,
)
async def get_check_event(check_id: UUID, event_id: UUID):
    """
    Get a specific event by ID.

    Args:
        check_id: The check ID
        event_id: The event ID

    Returns:
        CheckEventOut object

    Raises:
        400: Not connected to Recce Cloud
        401: No API token available
        404: Event not found
    """
    try:
        org_id, project_id, session_id = _get_session_info()
        client = _get_events_client()

        event = client.get_event(org_id, project_id, session_id, str(check_id), str(event_id))
        return event

    except RecceCloudException as e:
        logger.error(f"Failed to get check event: {e}")
        raise HTTPException(status_code=e.status_code, detail=str(e.reason))
    except RecceException as e:
        logger.error(f"Failed to get check event: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@check_events_router.post(
    "/checks/{check_id}/events",
    status_code=201,
    response_model=CheckEventOut,
)
async def create_comment(check_id: UUID, body: CreateCommentIn):
    """
    Create a new comment on a check.

    Args:
        check_id: The check ID
        body: Request body containing comment content

    Returns:
        Created CheckEventOut object

    Raises:
        400: Not connected to Recce Cloud or invalid content
        401: No API token available
        404: Check not found
    """
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty.")

    try:
        org_id, project_id, session_id = _get_session_info()
        client = _get_events_client()

        event = client.create_comment(org_id, project_id, session_id, str(check_id), body.content)
        return event

    except RecceCloudException as e:
        logger.error(f"Failed to create comment: {e}")
        raise HTTPException(status_code=e.status_code, detail=str(e.reason))
    except RecceException as e:
        logger.error(f"Failed to create comment: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@check_events_router.patch(
    "/checks/{check_id}/events/{event_id}",
    status_code=200,
    response_model=CheckEventOut,
)
async def update_comment(check_id: UUID, event_id: UUID, body: UpdateCommentIn):
    """
    Update an existing comment.

    Only the author or an admin can update a comment.

    Args:
        check_id: The check ID
        event_id: The event ID of the comment to update
        body: Request body containing new comment content

    Returns:
        Updated CheckEventOut object

    Raises:
        400: Not connected to Recce Cloud or invalid content
        401: No API token available
        403: Not authorized to update this comment
        404: Comment not found
    """
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty.")

    try:
        org_id, project_id, session_id = _get_session_info()
        client = _get_events_client()

        event = client.update_comment(org_id, project_id, session_id, str(check_id), str(event_id), body.content)
        return event

    except RecceCloudException as e:
        logger.error(f"Failed to update comment: {e}")
        raise HTTPException(status_code=e.status_code, detail=str(e.reason))
    except RecceException as e:
        logger.error(f"Failed to update comment: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@check_events_router.delete(
    "/checks/{check_id}/events/{event_id}",
    status_code=204,
)
async def delete_comment(check_id: UUID, event_id: UUID):
    """
    Delete a comment (soft delete).

    Only the author or an admin can delete a comment. The comment will be
    marked as deleted but remain in the timeline with a "Comment deleted" indicator.

    Args:
        check_id: The check ID
        event_id: The event ID of the comment to delete

    Raises:
        400: Not connected to Recce Cloud
        401: No API token available
        403: Not authorized to delete this comment
        404: Comment not found
    """
    try:
        org_id, project_id, session_id = _get_session_info()
        client = _get_events_client()

        client.delete_comment(org_id, project_id, session_id, str(check_id), str(event_id))

    except RecceCloudException as e:
        logger.error(f"Failed to delete comment: {e}")
        raise HTTPException(status_code=e.status_code, detail=str(e.reason))
    except RecceException as e:
        logger.error(f"Failed to delete comment: {e}")
        raise HTTPException(status_code=400, detail=str(e))
