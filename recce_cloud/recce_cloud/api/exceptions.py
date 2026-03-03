"""
Exceptions for Recce Cloud API.
"""

import json


class RecceCloudException(Exception):
    """Exception raised when Recce Cloud API returns an error."""

    def __init__(self, reason: str, status_code: int = None):
        """
        Initialize exception.

        Args:
            reason: Error reason/message
            status_code: HTTP status code (optional)
        """
        try:
            reason = json.loads(reason).get("detail", reason)
        except (json.JSONDecodeError, AttributeError):
            pass

        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
