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

    org: str
    project: str
    source: str  # "cli", "env", "config"


class ConfigurationError(Exception):
    """Raised when configuration cannot be resolved."""

    pass


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
        cli_org: Organization from CLI flag.
        cli_project: Project from CLI flag.
        project_dir: Project directory for local config lookup.

    Returns:
        ResolvedConfig with org, project, and source.

    Raises:
        ConfigurationError: If org/project cannot be resolved.
    """
    # Priority 1: CLI flags
    if cli_org and cli_project:
        return ResolvedConfig(org=cli_org, project=cli_project, source="cli")

    # Priority 2: Environment variables
    env_org = os.environ.get("RECCE_ORG")
    env_project = os.environ.get("RECCE_PROJECT")
    if env_org and env_project:
        return ResolvedConfig(org=env_org, project=env_project, source="env")

    # Priority 3: Local config file
    binding = get_project_binding(project_dir)
    if binding:
        return ResolvedConfig(
            org=binding["org"],
            project=binding["project"],
            source="config",
        )

    # Priority 4: Error
    raise ConfigurationError(
        "No project configured. Run 'recce-cloud init' to bind this directory to a project, "
        "or use --org and --project flags."
    )


def resolve_org(
    cli_org: Optional[str] = None,
    project_dir: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve organization from multiple sources.

    Args:
        cli_org: Organization from CLI flag.
        project_dir: Project directory for local config lookup.

    Returns:
        Organization name/slug, or None if not found.
    """
    if cli_org:
        return cli_org

    env_org = os.environ.get("RECCE_ORG")
    if env_org:
        return env_org

    binding = get_project_binding(project_dir)
    if binding:
        return binding["org"]

    return None


def resolve_project(
    cli_project: Optional[str] = None,
    project_dir: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve project from multiple sources.

    Args:
        cli_project: Project from CLI flag.
        project_dir: Project directory for local config lookup.

    Returns:
        Project name/slug, or None if not found.
    """
    if cli_project:
        return cli_project

    env_project = os.environ.get("RECCE_PROJECT")
    if env_project:
        return env_project

    binding = get_project_binding(project_dir)
    if binding:
        return binding["project"]

    return None
