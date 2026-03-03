"""
Project configuration management for .recce/config.

This module manages local project binding stored in the project directory.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

RECCE_CONFIG_DIR = ".recce"
RECCE_CONFIG_FILE = "config"


def get_config_path(project_dir: Optional[str] = None) -> Path:
    """
    Get the path to the local config file.

    Args:
        project_dir: Project directory path. Defaults to current directory.

    Returns:
        Path to .recce/config file.
    """
    base_dir = Path(project_dir) if project_dir else Path.cwd()
    return base_dir / RECCE_CONFIG_DIR / RECCE_CONFIG_FILE


def get_config_dir(project_dir: Optional[str] = None) -> Path:
    """
    Get the path to the .recce directory.

    Args:
        project_dir: Project directory path. Defaults to current directory.

    Returns:
        Path to .recce directory.
    """
    base_dir = Path(project_dir) if project_dir else Path.cwd()
    return base_dir / RECCE_CONFIG_DIR


def load_config(project_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Load configuration from .recce/config.

    Args:
        project_dir: Project directory path. Defaults to current directory.

    Returns:
        Configuration dictionary, or empty dict if file doesn't exist.
    """
    config_path = get_config_path(project_dir)
    if not config_path.exists():
        return {}

    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
        return config if config else {}


def save_config(config: Dict[str, Any], project_dir: Optional[str] = None) -> None:
    """
    Save configuration to .recce/config.

    Args:
        config: Configuration dictionary to save.
        project_dir: Project directory path. Defaults to current directory.
    """
    config_dir = get_config_dir(project_dir)
    config_path = get_config_path(project_dir)

    # Ensure .recce directory exists
    config_dir.mkdir(parents=True, exist_ok=True)

    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)


def get_project_binding(project_dir: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get the current project binding from .recce/config.

    Args:
        project_dir: Project directory path. Defaults to current directory.

    Returns:
        Dictionary with org_id, project_id, bound_at, bound_by fields,
        or None if not bound.
    """
    config = load_config(project_dir)
    cloud_config = config.get("cloud", {})

    if not cloud_config.get("org_id") or not cloud_config.get("project_id"):
        return None

    return {
        "org_id": cloud_config.get("org_id"),
        "project_id": cloud_config.get("project_id"),
        "bound_at": cloud_config.get("bound_at"),
        "bound_by": cloud_config.get("bound_by"),
    }


def save_project_binding(
    org_id: str,
    project_id: str,
    bound_by: Optional[str] = None,
    project_dir: Optional[str] = None,
) -> None:
    """
    Save project binding to .recce/config.

    Args:
        org_id: Organization ID.
        project_id: Project ID.
        bound_by: Email of user who created the binding.
        project_dir: Project directory path. Defaults to current directory.
    """
    # Validate IDs before writing to disk
    if not str(org_id).isdigit():
        raise ValueError(f"Invalid org_id: '{org_id}' (expected numeric ID)")
    if not str(project_id).isdigit():
        raise ValueError(f"Invalid project_id: '{project_id}' (expected numeric ID)")

    config = load_config(project_dir)

    config["version"] = 1
    config["cloud"] = {
        "org_id": org_id,
        "project_id": project_id,
        "bound_at": datetime.now(timezone.utc).isoformat(),
    }

    if bound_by:
        config["cloud"]["bound_by"] = bound_by

    save_config(config, project_dir)


def clear_project_binding(project_dir: Optional[str] = None) -> bool:
    """
    Clear project binding from .recce/config.

    Args:
        project_dir: Project directory path. Defaults to current directory.

    Returns:
        True if binding was cleared, False if no binding existed.
    """
    config = load_config(project_dir)

    if "cloud" not in config:
        return False

    del config["cloud"]
    save_config(config, project_dir)
    return True


def add_to_gitignore(project_dir: Optional[str] = None) -> bool:
    """
    Add .recce/ to .gitignore if not already present.

    Args:
        project_dir: Project directory path. Defaults to current directory.

    Returns:
        True if .gitignore was modified, False otherwise.
    """
    base_dir = Path(project_dir) if project_dir else Path.cwd()
    gitignore_path = base_dir / ".gitignore"

    # Check if .recce/ is already in .gitignore
    if gitignore_path.exists():
        with open(gitignore_path, "r", encoding="utf-8") as f:
            content = f.read()
            if ".recce/" in content or ".recce" in content:
                return False

    # Append .recce/ to .gitignore
    with open(gitignore_path, "a", encoding="utf-8") as f:
        if gitignore_path.exists():
            # Check if file ends with newline
            with open(gitignore_path, "r", encoding="utf-8") as rf:
                content = rf.read()
                if content and not content.endswith("\n"):
                    f.write("\n")
        f.write("\n# Recce Cloud local config\n.recce/\n")

    return True
