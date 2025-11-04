"""Recce Cloud - Lightweight CLI for Recce Cloud operations."""

import os


def get_version():
    """Get version from main recce VERSION file."""
    # Reference the VERSION file from main recce package
    version_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "recce", "VERSION"))
    with open(version_file) as fh:
        version = fh.read().strip()
        return version


__version__ = get_version()
