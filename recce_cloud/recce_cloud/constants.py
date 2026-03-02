"""
Shared constants for recce-cloud CLI.
"""

import os
from enum import IntEnum

# Session types (plain strings for Click compatibility)
SESSION_TYPE_PR = "pr"
SESSION_TYPE_PROD = "prod"
SESSION_TYPE_DEV = "dev"
SESSION_TYPES = [SESSION_TYPE_PR, SESSION_TYPE_PROD, SESSION_TYPE_DEV]
SESSION_TYPES_UPLOAD = [SESSION_TYPE_PR, SESSION_TYPE_PROD]


# Exit codes
class ExitCode(IntEnum):
    SUCCESS = 0
    CONFIG_ERROR = 1
    INIT_ERROR = 2
    FILE_ERROR = 3
    API_ERROR = 4


# URL constants
DEFAULT_CLOUD_HOST = "https://cloud.datarecce.io"

# Docker URL constants (for local dev presigned URL rewriting)
DOCKER_INTERNAL_URL_PREFIX = "http://host.docker.internal"
LOCALHOST_URL_PREFIX = "http://localhost"


def get_api_host():
    """Get Recce Cloud API host from env or default."""
    return os.environ.get("RECCE_CLOUD_API_HOST", DEFAULT_CLOUD_HOST)


def get_base_url():
    """Get Recce Cloud base URL for web UI links."""
    return os.environ.get("RECCE_CLOUD_BASE_URL", get_api_host())
