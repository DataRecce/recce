"""
Profile management for ~/.recce/profile.yml.

This module manages user credentials stored in the shared profile file,
compatible with Recce OSS.
"""

import os
import threading
import uuid
from typing import Any, Dict, Optional

import yaml

USER_HOME = os.path.expanduser("~")
RECCE_USER_HOME = os.path.join(USER_HOME, ".recce")
RECCE_USER_PROFILE = os.path.join(RECCE_USER_HOME, "profile.yml")

_profile_lock = threading.Lock()


def _ensure_recce_home() -> None:
    """Ensure ~/.recce directory exists."""
    os.makedirs(RECCE_USER_HOME, exist_ok=True)


def _generate_profile() -> Dict[str, Any]:
    """Generate a new profile with a unique user ID."""
    _ensure_recce_home()
    user_id = uuid.uuid4().hex
    profile = {"user_id": user_id, "anonymous_tracking": True}
    with open(RECCE_USER_PROFILE, "w", encoding="utf-8") as f:
        yaml.dump(profile, f, default_flow_style=False)
    return profile


def load_profile() -> Dict[str, Any]:
    """
    Load user profile from ~/.recce/profile.yml.

    Creates a new profile if one doesn't exist.

    Returns:
        Dict containing user_id, api_token (if set), and anonymous_tracking.
    """
    with _profile_lock:
        if not os.path.exists(RECCE_USER_PROFILE):
            return _generate_profile()

        with open(RECCE_USER_PROFILE, "r", encoding="utf-8") as f:
            profile = yaml.safe_load(f)
            if profile is None or profile.get("user_id") is None:
                return _generate_profile()
            return profile


def update_profile(updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update user profile with new values.

    Args:
        updates: Dictionary of values to update.

    Returns:
        Updated profile dictionary.
    """
    profile = load_profile()
    profile.update(updates)
    _ensure_recce_home()
    with open(RECCE_USER_PROFILE, "w", encoding="utf-8") as f:
        yaml.dump(profile, f, default_flow_style=False)
    return profile


def get_api_token() -> Optional[str]:
    """
    Get the stored API token.

    Returns:
        API token string if set, None otherwise.
    """
    return load_profile().get("api_token")


def update_api_token(token: str) -> Dict[str, Any]:
    """
    Update the stored API token.

    Args:
        token: New API token to store.

    Returns:
        Updated profile dictionary.
    """
    return update_profile({"api_token": token})


def clear_api_token() -> Dict[str, Any]:
    """
    Clear the stored API token.

    Returns:
        Updated profile dictionary.
    """
    profile = load_profile()
    if "api_token" in profile:
        del profile["api_token"]
    _ensure_recce_home()
    with open(RECCE_USER_PROFILE, "w", encoding="utf-8") as f:
        yaml.dump(profile, f, default_flow_style=False)
    return profile


def get_user_id() -> Optional[str]:
    """
    Get the stored user ID.

    Returns:
        User ID string.
    """
    return load_profile().get("user_id")


def get_profile_path() -> str:
    """
    Get the path to the profile file.

    Returns:
        Path to ~/.recce/profile.yml.
    """
    return RECCE_USER_PROFILE
