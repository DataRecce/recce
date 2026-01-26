"""
Configuration resolver for Recce Cloud CLI.

Resolves org/project configuration from multiple sources with priority:
1. CLI flags (--org, --project)
2. Environment variables (RECCE_ORG, RECCE_PROJECT)
3. Local config file (.recce/config)
4. Error (no configuration found)
"""

import os
from dataclasses import dataclass
from typing import Optional

from recce_cloud.config.project_config import get_project_binding


@dataclass
class ResolvedConfig:
    """Resolved configuration with source information."""

    org_id: str
    project_id: str
    source: str  # "cli", "env", "config"


class ConfigurationError(Exception):
    """Raised when configuration cannot be resolved."""

    pass


def _validate_numeric_id(value: str, field_name: str, source: str) -> None:
    """
    Validate that a value is a numeric ID.

    Args:
        value: The value to validate.
        field_name: Name of the field (for error messages).
        source: Source of the value (for error messages).

    Raises:
        ConfigurationError: If the value is not a numeric ID.
    """
    if not value.isdigit():
        raise ConfigurationError(
            f"Invalid {field_name}: '{value}' (from {source}). "
            f"The API requires numeric IDs, not slugs. "
            f"Run 'recce-cloud init' to bind this directory to a project with proper IDs."
        )


def resolve_config(
    cli_org: Optional[str] = None,
    cli_project: Optional[str] = None,
    project_dir: Optional[str] = None,
) -> ResolvedConfig:
    """
    Resolve org/project configuration from multiple sources.

    Priority order:
    1. CLI flags (--org, --project) - highest priority
    2. Environment variables (RECCE_ORG, RECCE_PROJECT)
    3. Local config file (.recce/config)
    4. Error if nothing found

    Args:
        cli_org: Organization ID from CLI flag.
        cli_project: Project ID from CLI flag.
        project_dir: Project directory for local config lookup.

    Returns:
        ResolvedConfig with org_id, project_id, and source.

    Raises:
        ConfigurationError: If org/project cannot be resolved.
    """
    # Priority 1: CLI flags
    if cli_org and cli_project:
        _validate_numeric_id(cli_org, "org", "CLI flag --org")
        _validate_numeric_id(cli_project, "project", "CLI flag --project")
        return ResolvedConfig(org_id=cli_org, project_id=cli_project, source="cli")

    # Priority 2: Environment variables
    env_org = os.environ.get("RECCE_ORG")
    env_project = os.environ.get("RECCE_PROJECT")
    if env_org and env_project:
        _validate_numeric_id(env_org, "org", "environment variable RECCE_ORG")
        _validate_numeric_id(env_project, "project", "environment variable RECCE_PROJECT")
        return ResolvedConfig(org_id=env_org, project_id=env_project, source="env")

    # Priority 3: Local config file
    binding = get_project_binding(project_dir)
    if binding:
        org_id = binding["org_id"]
        project_id = binding["project_id"]
        _validate_numeric_id(org_id, "org_id", "config file")
        _validate_numeric_id(project_id, "project_id", "config file")
        return ResolvedConfig(
            org_id=org_id,
            project_id=project_id,
            source="config",
        )

    # Priority 4: Error
    raise ConfigurationError(
        "No project configured. Run 'recce-cloud init' to bind this directory to a project, "
        "or use --org and --project flags."
    )


def resolve_org_id(
    cli_org: Optional[str] = None,
    project_dir: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve organization ID from multiple sources.

    Args:
        cli_org: Organization ID from CLI flag.
        project_dir: Project directory for local config lookup.

    Returns:
        Organization ID, or None if not found.
    """
    if cli_org:
        return cli_org

    env_org = os.environ.get("RECCE_ORG")
    if env_org:
        return env_org

    binding = get_project_binding(project_dir)
    if binding:
        return binding["org_id"]

    return None


def resolve_project_id(
    cli_project: Optional[str] = None,
    project_dir: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve project ID or slug from multiple sources.

    Args:
        cli_project: Project ID or slug from CLI flag.
        project_dir: Project directory for local config lookup.

    Returns:
        Project ID or slug, or None if not found.
    """
    if cli_project:
        return cli_project

    env_project = os.environ.get("RECCE_PROJECT")
    if env_project:
        return env_project

    binding = get_project_binding(project_dir)
    if binding:
        return binding["project_id"]

    return None
