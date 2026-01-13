"""Recce Cloud - Lightweight CLI for Recce Cloud operations."""

import os
from importlib.metadata import PackageNotFoundError, version


def get_version():
    """Get version from package metadata or VERSION file."""
    # Try importlib.metadata first (works for installed packages)
    # Try both package names (nightly and official)
    for pkg_name in ["recce-cloud-nightly", "recce-cloud"]:
        try:
            return version(pkg_name)
        except PackageNotFoundError:
            pass

    # Fallback to VERSION file (for development with editable install)
    # VERSION is now at recce_cloud/recce_cloud/VERSION (same dir as __init__.py)
    version_file = os.path.join(os.path.dirname(__file__), "VERSION")
    if os.path.exists(version_file):
        with open(version_file) as fh:
            return fh.read().strip()

    # Last resort
    return "unknown"


__version__ = get_version()
