"""
Artifact utilities for recce-cloud.

Simplified version of recce.artifact with only the functions needed
for upload-session functionality.
"""

import json
import os


def verify_artifacts_path(target_path: str) -> bool:
    """
    Verify if the target path contains valid dbt artifacts.

    Args:
        target_path: Path to the directory containing artifacts

    Returns:
        True if the target path contains manifest.json and catalog.json
    """
    if not target_path:
        return False

    if not os.path.exists(target_path):
        return False

    if not os.path.isdir(target_path):
        return False

    required_artifacts_files = ["manifest.json", "catalog.json"]

    if all(f in os.listdir(target_path) for f in required_artifacts_files):
        return True

    return False


def get_adapter_type(manifest_path: str) -> str:
    """
    Extract adapter type from manifest.json.

    Args:
        manifest_path: Path to manifest.json file

    Returns:
        Adapter type string (e.g., "postgres", "snowflake", "bigquery")

    Raises:
        Exception: If adapter type cannot be found in manifest
    """
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)
        adapter_type = manifest_data.get("metadata", {}).get("adapter_type")
        if adapter_type is None:
            raise Exception("Failed to parse adapter type from manifest.json")
        return adapter_type
