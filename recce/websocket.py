"""
WebSocket connection manager with per-connection user context storage.

This module provides thread-safe storage and retrieval of user context
for WebSocket connections, particularly for shared instances where
Recce Cloud proxies authenticated user information.
"""

import logging
from contextvars import ContextVar
from threading import Lock
from typing import Dict, Optional, Set

from fastapi import WebSocket

from recce.models.websocket import CloudUserContext

logger = logging.getLogger("uvicorn")


class WebSocketConnectionManager:
    """
    Thread-safe manager for WebSocket connections and their associated user contexts.

    This class maintains:
    - A set of active WebSocket connections (for broadcasting)
    - A mapping of connections to user contexts (for attribution)
    """

    def __init__(self):
        self._clients: Set[WebSocket] = set()
        self._user_contexts: Dict[int, CloudUserContext] = {}  # Use id(websocket) as key
        self._lock = Lock()

    @property
    def clients(self) -> Set[WebSocket]:
        """Get a copy of the current client set."""
        with self._lock:
            return set(self._clients)

    def connect(self, websocket: WebSocket) -> None:
        """Register a new WebSocket connection."""
        with self._lock:
            self._clients.add(websocket)
            logger.debug(f"WebSocket connected. Total clients: {len(self._clients)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """
        Remove a WebSocket connection and its associated user context.

        This method is safe to call even if the websocket was never registered.
        """
        with self._lock:
            self._clients.discard(websocket)
            self._user_contexts.pop(id(websocket), None)
            logger.debug(f"WebSocket disconnected. Total clients: {len(self._clients)}")

    def set_user_context(self, websocket: WebSocket, context: CloudUserContext) -> None:
        """
        Associate a user context with a WebSocket connection.

        Args:
            websocket: The WebSocket connection
            context: The user context from Recce Cloud
        """
        with self._lock:
            self._user_contexts[id(websocket)] = context
            logger.info(
                f"User context set for WebSocket: user_login={context.user_login}, " f"user_id={context.user_id}"
            )

    def get_user_context(self, websocket: WebSocket) -> Optional[CloudUserContext]:
        """
        Get the user context for a WebSocket connection.

        Args:
            websocket: The WebSocket connection

        Returns:
            The user context if set, None otherwise
        """
        with self._lock:
            return self._user_contexts.get(id(websocket))

    def has_user_context(self, websocket: WebSocket) -> bool:
        """Check if a WebSocket has an associated user context."""
        with self._lock:
            return id(websocket) in self._user_contexts


# Global connection manager instance
connection_manager = WebSocketConnectionManager()


def get_connection_manager() -> WebSocketConnectionManager:
    """Get the global connection manager instance."""
    return connection_manager


# Context variable to store the current user context during request processing
_current_user_context: ContextVar[Optional[CloudUserContext]] = ContextVar("current_user_context", default=None)


def get_current_cloud_user() -> Optional[CloudUserContext]:
    """
    Get the current cloud user context.

    This returns the user context set for the current async context,
    which is typically set when processing actions from a WebSocket
    connection with an associated user.

    Returns:
        The CloudUserContext if available, None otherwise
    """
    return _current_user_context.get()


def set_current_cloud_user(context: Optional[CloudUserContext]) -> None:
    """
    Set the current cloud user context.

    This should be called when processing actions that need user attribution.

    Args:
        context: The user context or None to clear
    """
    _current_user_context.set(context)


# HTTP header names for cloud user context
CLOUD_USER_ID_HEADER = "X-Recce-User-Id"
CLOUD_USER_LOGIN_HEADER = "X-Recce-User-Login"
CLOUD_USER_EMAIL_HEADER = "X-Recce-User-Email"


def extract_cloud_user_from_headers(headers: dict) -> Optional[CloudUserContext]:
    """
    Extract cloud user context from HTTP request headers.

    This is used by middleware to set user context for HTTP requests
    when Recce Cloud proxies requests with user identification headers.

    Args:
        headers: Dictionary of HTTP headers (case-insensitive keys)

    Returns:
        CloudUserContext if required headers are present, None otherwise
    """
    # Headers may be case-insensitive, so normalize to lowercase for lookup
    normalized = {k.lower(): v for k, v in headers.items()}

    user_id = normalized.get(CLOUD_USER_ID_HEADER.lower())
    user_login = normalized.get(CLOUD_USER_LOGIN_HEADER.lower())
    user_email = normalized.get(CLOUD_USER_EMAIL_HEADER.lower())

    # Both user_id and user_login are required
    if not user_id or not user_login:
        return None

    context = CloudUserContext(
        user_id=user_id,
        user_login=user_login,
        user_email=user_email,
    )
    logger.debug(f"Extracted cloud user from headers: user_login={user_login}, user_id={user_id}")
    return context
