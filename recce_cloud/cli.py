#!/usr/bin/env python
"""
Recce Cloud CLI - Lightweight command for managing Recce Cloud operations.
"""

import sys

import click

from recce_cloud import __version__


@click.group()
def cloud_cli():
    """
    Recce Cloud CLI - Manage Recce Cloud sessions and state files.

    A lightweight tool for CI/CD environments to interact with Recce Cloud
    without the heavy dependencies of the full recce package.
    """
    pass


@cloud_cli.command()
def version():
    """Show the version of recce-cloud."""
    click.echo(__version__)


@cloud_cli.command()
@click.option(
    "--target-path",
    type=click.Path(exists=True),
    default="target",
    help="Path to dbt target directory containing manifest.json and catalog.json",
)
@click.option(
    "--session-id",
    envvar="RECCE_SESSION_ID",
    help="Recce Cloud session ID to upload artifacts to (or use RECCE_SESSION_ID env var)",
)
def upload(target_path, session_id):
    """
    Upload dbt artifacts to Recce Cloud session.

    Lightweight replacement for 'recce upload-session' designed for CI/CD environments.
    Uploads manifest.json and catalog.json from the dbt target directory to a specific
    Recce Cloud session.

    \b
    What gets uploaded:
    - manifest.json: dbt project structure and model definitions
    - catalog.json: database catalog information and statistics

    \b
    The upload process:
    1. Validate dbt artifact files exist and are valid JSON
    2. Auto-detect Git repository and branch information
    3. Auto-detect Pull/Merge Request information (if in PR context)
    4. Auto-detect CI/CD platform information
    5. Authenticate with Recce Cloud API
    6. Upload artifacts to S3 for the session
    7. Update session metadata (links session to PR/MR via pr_link)

    \b
    About Recce Cloud Sessions:
    - Sessions compare base (production) and current (PR) environments
    - Each session stores manifests/catalogs from both environments
    - Sessions are linked to PRs/MRs for team collaboration and review
    - This enables automated PR gating and impact analysis in CI/CD

    \b
    Authentication:
    Uses environment variables for authentication:
    - RECCE_API_TOKEN: Recce Cloud API token (primary)
    - GITHUB_TOKEN: GitHub token (fallback, commonly available in GitHub Actions)

    \b
    Auto-Detection:
    This command automatically detects your environment:
    - SCM Provider: GitHub, GitLab, Bitbucket, or generic git
    - CI/CD Platform: GitHub Actions, GitLab CI, Bitbucket Pipelines, CircleCI, etc.
    - Git Information: repository, branch, commit hash
    - PR/MR Information: ID, title, URL (used to link session to PR/MR)

    \b
    Environment Variables:
    - RECCE_SESSION_ID: Target session ID for upload (required)
    - RECCE_API_TOKEN: Recce Cloud API token
    - GITHUB_TOKEN: GitHub token (fallback for authentication)
    - RECCE_CLOUD_API_HOST: Custom API host (default: https://cloud.datarecce.io)

    \b
    Examples:
    # Upload from default target directory with session ID from env
    export RECCE_SESSION_ID=abc123
    recce-cloud upload

    \b
    # Upload from custom target path
    recce-cloud upload --target-path my-target --session-id abc123

    \b
    # Typical CI/CD usage (GitHub Actions)
    recce-cloud upload --session-id ${{ steps.create-session.outputs.session-id }}

    \b
    Exit Codes:
    0 - Success
    1 - Environment detection error
    2 - Authentication error
    3 - File validation error (missing or invalid manifest/catalog)
    4 - Upload error
    """
    # Basic flow structure - implementation will be added in subsequent tasks
    click.echo("Upload dbt artifacts to Recce Cloud Session:")
    click.echo(f"  Session ID: {session_id or 'not provided'}")
    click.echo(f"  Target path: {target_path}")
    click.echo("  1. Validate manifest.json and catalog.json")
    click.echo("  2. Extract Git/PR/CI information")
    click.echo("  3. Authenticate with Recce Cloud API")
    click.echo("  4. Upload artifacts to S3")
    click.echo("  5. Update session metadata")
    click.echo("\nImplementation coming soon...")
    sys.exit(0)


if __name__ == "__main__":
    cloud_cli()
