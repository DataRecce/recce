"""
Upload helper functions for recce-cloud CLI.
"""

import os
import sys

import requests

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.api.factory import create_platform_client


def upload_to_existing_session(
    console, token: str, session_id: str, manifest_path: str, catalog_path: str, adapter_type: str, target_path: str
):
    """
    Upload artifacts to an existing Recce Cloud session using session ID.

    This is the generic workflow that requires a pre-existing session ID.
    """
    try:
        client = RecceCloudClient(token)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to initialize API client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # Get session info (org_id, project_id)
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

    # Get presigned URLs
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

    # Upload manifest.json
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

    # Upload catalog.json
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

    # Update session metadata
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


def upload_with_platform_apis(
    console, token: str, ci_info, manifest_path: str, catalog_path: str, adapter_type: str, target_path: str
):
    """
    Upload artifacts using platform-specific APIs (GitHub Actions or GitLab CI).

    This workflow uses touch-recce-session to create a session automatically.
    """
    # Validate platform support
    if ci_info.platform not in ["github-actions", "gitlab-ci"]:
        console.print("[red]Error:[/red] Platform-specific upload requires GitHub Actions or GitLab CI environment")
        console.print(f"Detected platform: {ci_info.platform or 'unknown'}")
        console.print(
            "Either run this command in a supported CI environment or provide --session-id for generic upload"
        )
        sys.exit(1)

    # Create platform-specific client
    try:
        client = create_platform_client(token, ci_info)
    except ValueError as e:
        console.print("[red]Error:[/red] Failed to create platform client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # Touch session to create or get session ID
    console.rule("Creating/touching session", style="blue")
    try:
        session_response = client.touch_recce_session(
            branch=ci_info.source_branch or ci_info.base_branch or "main",
            adapter_type=adapter_type,
            cr_number=ci_info.cr_number,
            commit_sha=ci_info.commit_sha,
        )

        session_id = session_response.get("session_id")
        manifest_upload_url = session_response.get("manifest_upload_url")
        catalog_upload_url = session_response.get("catalog_upload_url")

        if not session_id or not manifest_upload_url or not catalog_upload_url:
            console.print("[red]Error:[/red] Incomplete response from touch-recce-session API")
            console.print(f"Response: {session_response}")
            sys.exit(4)

        console.print(f"[green]Session ID:[/green] {session_id}")

    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to create/touch session")
        console.print(f"Reason: {e.reason}")
        sys.exit(4)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to create/touch session")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # Upload manifest.json
    console.print(f'Uploading manifest from path "{manifest_path}"')
    try:
        with open(manifest_path, "rb") as f:
            response = requests.put(manifest_upload_url, data=f.read())
        if response.status_code not in [200, 204]:
            raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
    except Exception as e:
        console.print("[red]Error:[/red] Failed to upload manifest.json")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # Upload catalog.json
    console.print(f'Uploading catalog from path "{catalog_path}"')
    try:
        with open(catalog_path, "rb") as f:
            response = requests.put(catalog_upload_url, data=f.read())
        if response.status_code not in [200, 204]:
            raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
    except Exception as e:
        console.print("[red]Error:[/red] Failed to upload catalog.json")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # Notify upload completion
    console.print("Notifying upload completion...")
    try:
        client.upload_completed(session_id=session_id, commit_sha=ci_info.commit_sha)
    except RecceCloudException as e:
        console.print("[yellow]Warning:[/yellow] Failed to notify upload completion")
        console.print(f"Reason: {e.reason}")
        # Non-fatal, continue
    except Exception as e:
        console.print("[yellow]Warning:[/yellow] Failed to notify upload completion")
        console.print(f"Reason: {e}")
        # Non-fatal, continue

    # Success!
    console.rule("Uploaded Successfully", style="green")
    console.print(f'Uploaded dbt artifacts to Recce Cloud for session ID "{session_id}"')
    console.print(f'Artifacts from: "{os.path.abspath(target_path)}"')

    if ci_info.cr_url:
        console.print(f"Change request: {ci_info.cr_url}")

    sys.exit(0)
