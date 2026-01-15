"""
Authentication module for Recce Cloud CLI.

This module provides browser-based OAuth authentication and credential management.
It is designed to be standalone (duplicated from Recce OSS) to support future
repository separation.
"""

from recce_cloud.auth.profile import (
    get_api_token,
    get_user_id,
    load_profile,
    update_api_token,
)

__all__ = [
    "get_api_token",
    "get_user_id",
    "load_profile",
    "update_api_token",
]
