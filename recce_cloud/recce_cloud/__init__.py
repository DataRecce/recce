"""Recce Cloud - Lightweight CLI for Recce Cloud operations."""

import os
from importlib.metadata import PackageNotFoundError, version


def get_version():
    """Get version from package metadata or VERSION file."""
    # Try importlib.metadata first (works for installed packages)
    try:
        return version("recce-cloud")
    except PackageNotFoundError:
        pass

    # Fallback to VERSION file (for development with editable install)
    # VERSION is at recce_cloud/VERSION, __file__ is at recce_cloud/recce_cloud/__init__.py
    version_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "VERSION"))
    if os.path.exists(version_file):
        with open(version_file) as fh:
            return fh.read().strip()

    # Last resort
    return "unknown"


__version__ = get_version()
