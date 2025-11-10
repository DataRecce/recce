#!/usr/bin/env python
"""
Recce Cloud CLI - Lightweight command for managing Recce Cloud operations.
"""

import logging
import os
import sys

import click
from rich.console import Console
from rich.logging import RichHandler

from recce_cloud import __version__
from recce_cloud.artifact import get_adapter_type, verify_artifacts_path
from recce_cloud.ci_providers import CIDetector
from recce_cloud.upload import upload_to_existing_session, upload_with_platform_apis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(console=Console(stderr=True), show_time=False, show_path=False)],
)
logger = logging.getLogger(__name__)


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
    help="Recce Cloud session ID to upload artifacts to (or use RECCE_SESSION_ID env var). "
    "If not provided, session will be created automatically using platform-specific APIs (GitHub/GitLab).",
)
@click.option(
    "--cr",
    type=int,
    help="Change request number (PR/MR) (overrides auto-detection)",
)
@click.option(
    "--type",
    "session_type",
    type=click.Choice(["cr", "prod", "dev"]),
    help="Session type (overrides auto-detection)",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Show what would be uploaded without actually uploading",
)
def upload(target_path, session_id, cr, session_type, dry_run):
    """
    Upload dbt artifacts to Recce Cloud session.

    Lightweight replacement for 'recce upload-session' designed for CI/CD environments.
    Supports two workflows: auto-session creation (GitHub/GitLab) or upload to existing session.

    \b
    What gets uploaded:
    - manifest.json: dbt project structure and model definitions
    - catalog.json: database catalog information and statistics

    \b
    Upload Workflows:

    1. Platform-Specific (Recommended for GitHub Actions & GitLab CI):
       - Automatically creates session using platform APIs
       - No --session-id required
       - Detects PR/MR context and links session automatically
       - Example: recce-cloud upload

    2. Generic (For existing sessions or other CI platforms):
       - Upload to pre-existing session using session ID
       - Requires --session-id parameter
       - Example: recce-cloud upload --session-id abc123

    \b
    The upload process:
    1. Auto-detect CI/CD platform (GitHub Actions, GitLab CI, etc.)
    2. Validate dbt artifact files exist and are valid JSON
    3. Extract adapter type from manifest.json
    4. Authenticate with Recce Cloud (RECCE_API_TOKEN or CI token)
    5. Create/touch session (platform-specific) OR get session info (generic)
    6. Upload artifacts to S3 using presigned URLs
    7. Notify upload completion (platform-specific only)

    \b
    About Recce Cloud Sessions:
    - Sessions compare base (production) and current (PR/MR) environments
    - Each session stores manifests/catalogs from both environments
    - Sessions are linked to PRs/MRs for team collaboration and review
    - Platform-specific workflow automatically handles session creation

    \b
    Authentication Priority:
    1. RECCE_API_TOKEN environment variable (explicit token)
    2. GITHUB_TOKEN (GitHub Actions) or CI_JOB_TOKEN (GitLab CI)
    3. Error if no token available

    \b
    Auto-Detection:
    This command automatically detects:
    - CI/CD Platform: GitHub Actions, GitLab CI (others supported with --session-id)
    - Repository: GitHub owner/repo or GitLab group/project
    - Branch: Source branch and base branch
    - Change Request: PR number (GitHub) or MR IID (GitLab)
    - Commit: Current commit SHA

    \b
    Environment Variables:
    - RECCE_SESSION_ID: Target session ID (optional, for generic workflow)
    - RECCE_API_TOKEN: Recce Cloud API token (recommended)
    - GITHUB_TOKEN: GitHub authentication (auto-detected)
    - CI_JOB_TOKEN: GitLab authentication (auto-detected)

    \b
    Examples:

    # Platform-specific workflow (GitHub Actions)
    recce-cloud upload

    # Platform-specific workflow (GitLab CI)
    recce-cloud upload

    # Generic workflow with session ID
    export RECCE_SESSION_ID=abc123
    recce-cloud upload

    # Custom target path with manual overrides
    recce-cloud upload --target-path my-target --cr 456 --type cr

    \b
    Exit Codes:
    0 - Success
    1 - Platform not supported (for platform-specific workflow)
    2 - Authentication error
    3 - File validation error (missing or invalid manifest/catalog)
    4 - Upload error
    """
    console = Console()

    # 1. Auto-detect CI environment information
    console.rule("Auto-detecting CI environment", style="blue")
    try:
        ci_info = CIDetector.detect()
        ci_info = CIDetector.apply_overrides(ci_info, cr=cr, session_type=session_type)
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Failed to detect CI environment: {e}")
        console.print("Continuing without CI metadata...")
        ci_info = None

    # 2. Validate artifacts exist
    if not verify_artifacts_path(target_path):
        console.print(f"[red]Error:[/red] Invalid target path: {target_path}")
        console.print("Please provide a valid target path containing manifest.json and catalog.json.")
        sys.exit(3)

    manifest_path = os.path.join(target_path, "manifest.json")
    catalog_path = os.path.join(target_path, "catalog.json")

    # Display detected CI information
    if ci_info:
        console.rule("Detected CI Information", style="blue")
        info_table = []
        if ci_info.platform:
            info_table.append(f"[cyan]Platform:[/cyan] {ci_info.platform}")

        # Display CR number as PR or MR based on platform
        if ci_info.cr_number is not None:
            if ci_info.platform == "github-actions":
                info_table.append(f"[cyan]PR Number:[/cyan] {ci_info.cr_number}")
            elif ci_info.platform == "gitlab-ci":
                info_table.append(f"[cyan]MR Number:[/cyan] {ci_info.cr_number}")
            else:
                info_table.append(f"[cyan]CR Number:[/cyan] {ci_info.cr_number}")

        # Display CR URL as PR URL or MR URL based on platform
        if ci_info.cr_url:
            if ci_info.platform == "github-actions":
                info_table.append(f"[cyan]PR URL:[/cyan] {ci_info.cr_url}")
            elif ci_info.platform == "gitlab-ci":
                info_table.append(f"[cyan]MR URL:[/cyan] {ci_info.cr_url}")
            else:
                info_table.append(f"[cyan]CR URL:[/cyan] {ci_info.cr_url}")

        if ci_info.session_type:
            info_table.append(f"[cyan]Session Type:[/cyan] {ci_info.session_type}")
        if ci_info.commit_sha:
            info_table.append(f"[cyan]Commit SHA:[/cyan] {ci_info.commit_sha[:8]}...")
        if ci_info.base_branch:
            info_table.append(f"[cyan]Base Branch:[/cyan] {ci_info.base_branch}")
        if ci_info.source_branch:
            info_table.append(f"[cyan]Source Branch:[/cyan] {ci_info.source_branch}")
        if ci_info.repository:
            info_table.append(f"[cyan]Repository:[/cyan] {ci_info.repository}")

        for line in info_table:
            console.print(line)

    # 3. Extract adapter type from manifest
    try:
        adapter_type = get_adapter_type(manifest_path)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to parse adapter type from manifest.json")
        console.print(f"Reason: {e}")
        sys.exit(3)

    # 4. Handle dry-run mode (before authentication or API calls)
    if dry_run:
        console.rule("Dry Run Summary", style="yellow")
        console.print("[yellow]Dry run mode enabled - no actual upload will be performed[/yellow]")
        console.print()

        # Display platform information if detected
        if ci_info and ci_info.platform:
            console.print("[cyan]Platform Information:[/cyan]")
            console.print(f"  • Platform: {ci_info.platform}")
            if ci_info.repository:
                console.print(f"  • Repository: {ci_info.repository}")
            if ci_info.cr_number is not None:
                console.print(f"  • CR Number: {ci_info.cr_number}")
            if ci_info.commit_sha:
                console.print(f"  • Commit SHA: {ci_info.commit_sha[:8]}")
            if ci_info.source_branch:
                console.print(f"  • Source Branch: {ci_info.source_branch}")
            if ci_info.base_branch:
                console.print(f"  • Base Branch: {ci_info.base_branch}")
            if ci_info.session_type:
                console.print(f"  • Session Type: {ci_info.session_type}")
            console.print()

        # Display upload summary
        console.print("[cyan]Upload Workflow:[/cyan]")
        if session_id:
            console.print("  • Upload to existing session")
            console.print(f"  • Session ID: {session_id}")
        else:
            console.print("  • Auto-create session and upload")
            if ci_info and ci_info.platform in ["github-actions", "gitlab-ci"]:
                console.print("  • Platform-specific APIs will be used")
            else:
                console.print("  • [yellow]Warning: Platform not supported for auto-session creation[/yellow]")

        console.print()
        console.print("[cyan]Files to upload:[/cyan]")
        console.print(f"  • manifest.json: {os.path.abspath(manifest_path)}")
        console.print(f"  • catalog.json: {os.path.abspath(catalog_path)}")
        console.print(f"  • Adapter type: {adapter_type}")

        console.print()
        console.print("[green]✓[/green] Dry run completed successfully")
        sys.exit(0)

    # 5. Get authentication token
    token = os.getenv("RECCE_API_TOKEN")

    # Fallback to CI-detected token if RECCE_API_TOKEN not set
    if not token and ci_info and ci_info.access_token:
        token = ci_info.access_token
        if ci_info.platform == "github-actions":
            console.print("[cyan]Info:[/cyan] Using GITHUB_TOKEN for authentication")
        elif ci_info.platform == "gitlab-ci":
            console.print("[cyan]Info:[/cyan] Using CI_JOB_TOKEN for authentication")

    if not token:
        console.print("[red]Error:[/red] No authentication token provided")
        console.print("Set RECCE_API_TOKEN environment variable or ensure CI token is available")
        sys.exit(2)

    # 6. Choose upload workflow based on whether session_id is provided
    if session_id:
        # Generic workflow: Upload to existing session using session ID
        upload_to_existing_session(console, token, session_id, manifest_path, catalog_path, adapter_type, target_path)
    else:
        # Platform-specific workflow: Use platform APIs to create session and upload
        upload_with_platform_apis(console, token, ci_info, manifest_path, catalog_path, adapter_type, target_path)


if __name__ == "__main__":
    cloud_cli()
