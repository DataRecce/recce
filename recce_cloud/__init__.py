"""Recce Cloud - Lightweight CLI for Recce Cloud operations."""

import os


def get_version():
    """Get version from VERSION file."""
    # Try recce_cloud/VERSION first (for standalone package)
    version_file = os.path.join(os.path.dirname(__file__), "VERSION")
    if os.path.exists(version_file):
        with open(version_file) as fh:
            return fh.read().strip()

    # Fallback to ../recce/VERSION (for development)
    version_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "recce", "VERSION"))
    if os.path.exists(version_file):
        with open(version_file) as fh:
            return fh.read().strip()

    # Last resort
    return "unknown"


__version__ = get_version()
