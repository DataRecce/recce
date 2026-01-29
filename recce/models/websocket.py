"""
WebSocket message types and user context models.

This module defines the data structures for WebSocket messages,
particularly the cloud_user_context message sent from Recce Cloud
when proxying connections to shared instances.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel


@dataclass
class CloudUserContext:
    """
    User context received from Recce Cloud for shared instance connections.

    This context identifies the authenticated user who is accessing the
    shared instance through Recce Cloud's proxy.
    """

    user_id: str
    user_login: str
    user_email: Optional[str] = None
    received_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses or logging."""
        return {
            "user_id": self.user_id,
            "user_login": self.user_login,
            "user_email": self.user_email,
            "received_at": self.received_at.isoformat() if self.received_at else None,
        }


class CloudUserContextMessage(BaseModel):
    """
    Pydantic model for parsing cloud_user_context WebSocket messages.

    Example message:
    {
        "type": "cloud_user_context",
        "version": 1,
        "user_id": "uuid-string",
        "user_login": "username",
        "user_email": "user@example.com"
    }
    """

    type: str
    version: int
    user_id: str
    user_login: str
    user_email: Optional[str] = None

    def to_context(self) -> CloudUserContext:
        """Convert the message to a CloudUserContext instance."""
        return CloudUserContext(
            user_id=self.user_id,
            user_login=self.user_login,
            user_email=self.user_email,
        )
