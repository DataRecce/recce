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
from recce_cloud.download import (
    download_from_existing_session,
    download_with_platform_apis,
)
from recce_cloud.upload import upload_to_existing_session, upload_with_platform_apis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(console=Console(stderr=True), show_time=False, show_path=False)],
)
logger = logging.getLogger(__name__)

# Suppress CI detector logs since we display formatted output in the CLI
logging.getLogger("recce_cloud.ci_providers.detector").setLevel(logging.WARNING)


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
    Upload dbt artifacts (manifest.json, catalog.json) to Recce Cloud.

    \b
    Authentication (auto-detected):
    - RECCE_API_TOKEN (for --session-id workflow)
    - GITHUB_TOKEN (GitHub Actions)
    - CI_JOB_TOKEN (GitLab CI)

    \b
    Common Examples:
      # Auto-create session in PR/MR
      recce-cloud upload

      # Upload production metadata from main branch
      recce-cloud upload --type prod

      # Upload to specific session
      recce-cloud upload --session-id abc123

      # Custom target path
      recce-cloud upload --target-path custom-target
    """
    console = Console()

    # 1. Auto-detect CI environment information
    console.rule("CI Environment Detection", style="blue")
    try:
        ci_info = CIDetector.detect()
        ci_info = CIDetector.apply_overrides(ci_info, cr=cr, session_type=session_type)

        # Display detected CI information immediately
        if ci_info:
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
        else:
            console.print("[yellow]No CI environment detected[/yellow]")
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

    # 5. Choose upload workflow based on whether session_id is provided
    if session_id:
        # Generic workflow: Upload to existing session using session ID
        # This workflow requires RECCE_API_TOKEN
        token = os.getenv("RECCE_API_TOKEN")
        if not token:
            console.print("[red]Error:[/red] No RECCE_API_TOKEN provided")
            console.print("Set RECCE_API_TOKEN environment variable for session-based upload")
            sys.exit(2)

        upload_to_existing_session(console, token, session_id, manifest_path, catalog_path, adapter_type, target_path)
    else:
        # Platform-specific workflow: Use platform APIs to create session and upload
        # This workflow MUST use CI job tokens (CI_JOB_TOKEN or GITHUB_TOKEN)
        if not ci_info or not ci_info.access_token:
            console.print("[red]Error:[/red] Platform-specific upload requires CI environment")
            console.print("Either run in GitHub Actions/GitLab CI or provide --session-id for generic upload")
            sys.exit(2)

        token = ci_info.access_token
        if ci_info.platform == "github-actions":
            console.print("[cyan]Info:[/cyan] Using GITHUB_TOKEN for platform-specific authentication")
        elif ci_info.platform == "gitlab-ci":
            console.print("[cyan]Info:[/cyan] Using CI_JOB_TOKEN for platform-specific authentication")

        upload_with_platform_apis(console, token, ci_info, manifest_path, catalog_path, adapter_type, target_path)


@cloud_cli.command()
@click.option(
    "--target-path",
    type=click.Path(),
    default="target",
    help="Path to directory where artifacts will be downloaded (default: 'target')",
)
@click.option(
    "--session-id",
    envvar="RECCE_SESSION_ID",
    help="Recce Cloud session ID to download artifacts from (or use RECCE_SESSION_ID env var). "
    "If not provided, session will be found automatically using platform-specific APIs (GitHub/GitLab).",
)
@click.option(
    "--prod",
    is_flag=True,
    help="Download production/base session instead of PR/MR session",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Show what would be downloaded without actually downloading",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Overwrite existing files without prompting",
)
def download(target_path, session_id, prod, dry_run, force):
    """
    Download dbt artifacts (manifest.json, catalog.json) from Recce Cloud.

    \b
    Authentication (auto-detected):
    - RECCE_API_TOKEN (for --session-id workflow)
    - GITHUB_TOKEN (GitHub Actions)
    - CI_JOB_TOKEN (GitLab CI)

    \b
    Common Examples:
      # Auto-find and download current PR/MR session
      recce-cloud download

      # Download project's production/base session
      recce-cloud download --prod

      # Download from specific session ID
      recce-cloud download --session-id abc123

      # Download prod session to target-base
      recce-cloud download --prod --target-path target-base

      # Force overwrite existing files
      recce-cloud download --force
    """
    console = Console()

    # Validate flag combinations
    if session_id and prod:
        console.print("[yellow]Warning:[/yellow] --prod is ignored when --session-id is provided")

    # Determine session type from --prod flag
    session_type = "prod" if prod else None

    # 1. Auto-detect CI environment information
    console.rule("CI Environment Detection", style="blue")
    try:
        ci_info = CIDetector.detect()
        ci_info = CIDetector.apply_overrides(ci_info, session_type=session_type)

        # Display detected CI information immediately
        if ci_info:
            info_table = []
            if ci_info.platform:
                info_table.append(f"[cyan]Platform:[/cyan] {ci_info.platform}")

            if ci_info.repository:
                info_table.append(f"[cyan]Repository:[/cyan] {ci_info.repository}")

            if ci_info.session_type:
                info_table.append(f"[cyan]Session Type:[/cyan] {ci_info.session_type}")

            # Only show CR number and URL for CR sessions (not for prod)
            if ci_info.session_type == "cr" and ci_info.cr_number is not None:
                if ci_info.platform == "github-actions":
                    info_table.append(f"[cyan]PR Number:[/cyan] {ci_info.cr_number}")
                elif ci_info.platform == "gitlab-ci":
                    info_table.append(f"[cyan]MR Number:[/cyan] {ci_info.cr_number}")
                else:
                    info_table.append(f"[cyan]CR Number:[/cyan] {ci_info.cr_number}")

            # Only show CR URL for CR sessions
            if ci_info.session_type == "cr" and ci_info.cr_url:
                if ci_info.platform == "github-actions":
                    info_table.append(f"[cyan]PR URL:[/cyan] {ci_info.cr_url}")
                elif ci_info.platform == "gitlab-ci":
                    info_table.append(f"[cyan]MR URL:[/cyan] {ci_info.cr_url}")
                else:
                    info_table.append(f"[cyan]CR URL:[/cyan] {ci_info.cr_url}")

            for line in info_table:
                console.print(line)
        else:
            console.print("[yellow]No CI environment detected[/yellow]")
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Failed to detect CI environment: {e}")
        console.print("Continuing without CI metadata...")
        ci_info = None

    # 2. Handle dry-run mode (before authentication or API calls)
    if dry_run:
        console.rule("Dry Run Summary", style="yellow")
        console.print("[yellow]Dry run mode enabled - no actual download will be performed[/yellow]")
        console.print()

        # Display platform information if detected
        if ci_info and ci_info.platform:
            console.print("[cyan]Platform Information:[/cyan]")
            console.print(f"  • Platform: {ci_info.platform}")
            if ci_info.repository:
                console.print(f"  • Repository: {ci_info.repository}")
            if ci_info.session_type:
                console.print(f"  • Session Type: {ci_info.session_type}")
            if ci_info.session_type == "cr" and ci_info.cr_number is not None:
                console.print(f"  • CR Number: {ci_info.cr_number}")
            console.print()

        # Display download summary
        console.print("[cyan]Download Workflow:[/cyan]")
        if session_id:
            console.print("  • Download from specific session ID")
            console.print(f"  • Session ID: {session_id}")
        else:
            if prod:
                console.print("  • Download project's production/base session")
            else:
                console.print("  • Auto-detect and download PR/MR session")

            if ci_info and ci_info.platform in ["github-actions", "gitlab-ci"]:
                console.print("  • Platform-specific APIs will be used")
            else:
                console.print("  • [yellow]Warning: Platform not supported for auto-session discovery[/yellow]")

        console.print()
        console.print("[cyan]Download destination:[/cyan]")
        console.print(f"  • Target path: {os.path.abspath(target_path)}")
        console.print("  • Files: manifest.json, catalog.json")
        if force:
            console.print("  • Will overwrite existing files")
        elif os.path.exists(target_path):
            console.print("  • [yellow]Warning: Target path exists (use --force to overwrite)[/yellow]")

        console.print()
        console.print("[green]✓[/green] Dry run completed successfully")
        sys.exit(0)

    # 3. Choose download workflow based on whether session_id is provided
    if session_id:
        # Generic workflow: Download from existing session using session ID
        # This workflow requires RECCE_API_TOKEN
        token = os.getenv("RECCE_API_TOKEN")
        if not token:
            console.print("[red]Error:[/red] No RECCE_API_TOKEN provided")
            console.print("Set RECCE_API_TOKEN environment variable for session-based download")
            sys.exit(2)

        download_from_existing_session(console, token, session_id, target_path, force)
    else:
        # Platform-specific workflow: Use platform APIs to find session and download
        # This workflow MUST use CI job tokens (CI_JOB_TOKEN or GITHUB_TOKEN)
        if not ci_info or not ci_info.access_token:
            console.print("[red]Error:[/red] Platform-specific download requires CI environment")
            console.print("Either run in GitHub Actions/GitLab CI or provide --session-id for generic download")
            sys.exit(2)

        token = ci_info.access_token
        if ci_info.platform == "github-actions":
            console.print("[cyan]Info:[/cyan] Using GITHUB_TOKEN for platform-specific authentication")
        elif ci_info.platform == "gitlab-ci":
            console.print("[cyan]Info:[/cyan] Using CI_JOB_TOKEN for platform-specific authentication")

        download_with_platform_apis(console, token, ci_info, target_path, force)


if __name__ == "__main__":
    cloud_cli()
