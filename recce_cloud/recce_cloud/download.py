"""
Download helper functions for recce-cloud CLI.
"""

import os
import sys

import requests

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.api.factory import create_platform_client


def _ensure_target_directory(console, target_path: str, force: bool = False):
    """
    Ensure target directory exists or can be created.

    Args:
        console: Rich console for output
        target_path: Path to target directory
        force: Whether to overwrite existing directory

    Raises:
        SystemExit: If directory exists without force flag or cannot be created
    """
    if os.path.exists(target_path):
        if not force:
            console.print(f"[red]Error:[/red] Target path already exists: {target_path}")
            console.print("Use --force to overwrite existing directory")
            sys.exit(3)
        console.print(f"[yellow]Warning:[/yellow] Overwriting existing path: {target_path}")
    else:
        # Create target directory
        try:
            os.makedirs(target_path, exist_ok=True)
        except Exception as e:
            console.print(f"[red]Error:[/red] Failed to create target path: {target_path}")
            console.print(f"Reason: {e}")
            sys.exit(3)


def _download_artifact(console, url: str, target_path: str, artifact_name: str):
    """
    Download a single artifact file from URL.

    Args:
        console: Rich console for output
        url: Download URL
        target_path: Path where file should be saved
        artifact_name: Human-readable name for error messages (e.g., "manifest.json")

    Raises:
        SystemExit: If download fails
    """
    console.print(f'Downloading {artifact_name} to "{target_path}"')
    try:
        response = requests.get(url)
        if response.status_code != 200:
            raise Exception(f"Download failed with status {response.status_code}: {response.text}")
        with open(target_path, "wb") as f:
            f.write(response.content)
    except Exception as e:
        console.print(f"[red]Error:[/red] Failed to download {artifact_name}")
        console.print(f"Reason: {e}")
        sys.exit(4)


def _download_artifacts(console, manifest_url: str, catalog_url: str, target_path: str):
    """
    Download manifest.json and catalog.json to target directory.

    Args:
        console: Rich console for output
        manifest_url: URL for manifest.json
        catalog_url: URL for catalog.json
        target_path: Target directory path

    Raises:
        SystemExit: If any download fails
    """
    manifest_path = os.path.join(target_path, "manifest.json")
    catalog_path = os.path.join(target_path, "catalog.json")

    _download_artifact(console, manifest_url, manifest_path, "manifest.json")
    _download_artifact(console, catalog_url, catalog_path, "catalog.json")


def download_from_existing_session(console, token: str, session_id: str, target_path: str, force: bool = False):
    """
    Download artifacts from an existing Recce Cloud session using session ID.

    This is the generic workflow that requires a pre-existing session ID.
    """
    try:
        client = RecceCloudClient(token)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to initialize API client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # Get session info (org_id, project_id)
    console.print(f'Downloading artifacts for session ID "{session_id}"')
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

    # Get presigned URLs
    try:
        presigned_urls = client.get_download_urls_by_session_id(org_id, project_id, session_id)
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to get download URLs")
        console.print(f"Reason: {e.reason}")
        sys.exit(4)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to get download URLs")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # Ensure target directory exists
    _ensure_target_directory(console, target_path, force)

    # Download artifacts
    _download_artifacts(console, presigned_urls["manifest_url"], presigned_urls["catalog_url"], target_path)

    # Success!
    console.rule("Downloaded Successfully", style="green")
    console.print(
        f'Downloaded dbt artifacts from Recce Cloud for session ID "{session_id}" to "{os.path.abspath(target_path)}"'
    )
    sys.exit(0)


def download_with_platform_apis(console, token: str, ci_info, target_path: str, force: bool = False):
    """
    Download artifacts using platform-specific APIs (GitHub Actions or GitLab CI).

    This workflow uses session-download-url to find and download artifacts.
    """
    # Validate platform support
    if ci_info.platform not in ["github-actions", "gitlab-ci"]:
        console.print("[red]Error:[/red] Platform-specific download requires GitHub Actions or GitLab CI environment")
        console.print(f"Detected platform: {ci_info.platform or 'unknown'}")
        console.print(
            "Either run this command in a supported CI environment or provide --session-id for generic download"
        )
        sys.exit(1)

    # Create platform-specific client
    try:
        client = create_platform_client(token, ci_info)
    except ValueError as e:
        console.print("[red]Error:[/red] Failed to create platform client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # Get session download URLs
    console.rule("Finding session and getting download URLs", style="blue")

    # Determine what to display based on session type
    if ci_info.session_type == "prod":
        console.print("Looking for production/base session...")
    elif ci_info.session_type == "cr":
        console.print(f"Looking for PR/MR session (CR #{ci_info.cr_number})...")
    else:
        console.print("Looking for session...")

    try:
        download_response = client.get_session_download_urls(
            cr_number=ci_info.cr_number,
            session_type=ci_info.session_type,
        )

        session_id = download_response.get("session_id")
        presigned_urls = download_response.get("presigned_urls", {})
        manifest_download_url = presigned_urls.get("manifest_url")
        catalog_download_url = presigned_urls.get("catalog_url")

        if not session_id or not manifest_download_url or not catalog_download_url:
            console.print("[red]Error:[/red] Incomplete response from session-download-url API")
            console.print(f"Response: {download_response}")
            sys.exit(4)

        console.print(f"[green]Session ID:[/green] {session_id}")

    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to get session download URLs")
        console.print(f"Reason: {e.reason}")
        sys.exit(4)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to get session download URLs")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # Ensure target directory exists
    _ensure_target_directory(console, target_path, force)

    # Download artifacts
    _download_artifacts(console, manifest_download_url, catalog_download_url, target_path)

    # Success!
    console.rule("Downloaded Successfully", style="green")
    console.print(f'Downloaded dbt artifacts from Recce Cloud for session ID "{session_id}"')
    console.print(f'Artifacts saved to: "{os.path.abspath(target_path)}"')

    if ci_info.cr_url:
        console.print(f"Change request: {ci_info.cr_url}")

    sys.exit(0)
