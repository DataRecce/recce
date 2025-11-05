#!/usr/bin/env python
"""
Recce Cloud CLI - Lightweight command for managing Recce Cloud operations.
"""

import os
import sys

import click
import requests
from rich.console import Console

from recce_cloud import __version__
from recce_cloud.api.client import RecceCloudClient, RecceCloudException
from recce_cloud.artifact import get_adapter_type, verify_artifacts_path


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
    - RECCE_API_TOKEN: Recce Cloud API token (required)

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
    - RECCE_API_TOKEN: Recce Cloud API token (required)

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
    console = Console()

    # Validate session ID
    if not session_id:
        console.print("[red]Error:[/red] Session ID is required")
        console.print("Provide --session-id or set RECCE_SESSION_ID environment variable")
        sys.exit(2)

    # 1. Validate artifacts exist
    if not verify_artifacts_path(target_path):
        console.print(f"[red]Error:[/red] Invalid target path: {target_path}")
        console.print("Please provide a valid target path containing manifest.json and catalog.json.")
        sys.exit(3)

    manifest_path = os.path.join(target_path, "manifest.json")
    catalog_path = os.path.join(target_path, "catalog.json")

    # 2. Extract adapter type from manifest
    try:
        adapter_type = get_adapter_type(manifest_path)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to parse adapter type from manifest.json")
        console.print(f"Reason: {e}")
        sys.exit(3)

    # 3. Get authentication token
    token = os.getenv("RECCE_API_TOKEN")
    if not token:
        console.print("[red]Error:[/red] No authentication token provided")
        console.print("Set RECCE_API_TOKEN environment variable")
        sys.exit(2)

    # 4. Initialize API client
    try:
        client = RecceCloudClient(token)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to initialize API client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # 5. Get session info (org_id, project_id)
    console.print(f'Uploading artifacts for session ID "{session_id}"')
    try:
        session = client.get_session(session_id)
        if session.get("status") == "error":
            console.print(f"[red]Error:[/red] {session.get('message')}")
            sys.exit(2)

        org_id = session.get("org_id")
        if org_id is None:
            console.print(f"[red]Error:[/red] Session ID {session_id} does not belong to any organization.")
            sys.exit(2)

        project_id = session.get("project_id")
        if project_id is None:
            console.print(f"[red]Error:[/red] Session ID {session_id} does not belong to any project.")
            sys.exit(2)

    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to get session info")
        console.print(f"Reason: {e.reason}")
        sys.exit(2)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to get session info")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # 6. Get presigned URLs
    try:
        presigned_urls = client.get_upload_urls_by_session_id(org_id, project_id, session_id)
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to get upload URLs")
        console.print(f"Reason: {e.reason}")
        sys.exit(4)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to get upload URLs")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # 7. Upload manifest.json
    console.print(f'Uploading manifest from path "{manifest_path}"')
    try:
        with open(manifest_path, "rb") as f:
            response = requests.put(presigned_urls["manifest_url"], data=f.read())
        if response.status_code not in [200, 204]:
            raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
    except Exception as e:
        console.print("[red]Error:[/red] Failed to upload manifest.json")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # 8. Upload catalog.json
    console.print(f'Uploading catalog from path "{catalog_path}"')
    try:
        with open(catalog_path, "rb") as f:
            response = requests.put(presigned_urls["catalog_url"], data=f.read())
        if response.status_code not in [200, 204]:
            raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
    except Exception as e:
        console.print("[red]Error:[/red] Failed to upload catalog.json")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # 9. Update session metadata
    try:
        client.update_session(org_id, project_id, session_id, adapter_type)
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to update session metadata")
        console.print(f"Reason: {e.reason}")
        sys.exit(4)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to update session metadata")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # Success!
    console.rule("Uploaded Successfully", style="green")
    console.print(
        f'Uploaded dbt artifacts to Recce Cloud for session ID "{session_id}" from "{os.path.abspath(target_path)}"'
    )
    sys.exit(0)


if __name__ == "__main__":
    cloud_cli()
