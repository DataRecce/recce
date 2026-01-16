"""
Upload helper functions for recce-cloud CLI.
"""

import os
import sys

import click
import requests

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.api.factory import create_platform_client
from recce_cloud.config.resolver import ConfigurationError, resolve_config


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

    # Notify upload completion
    console.print("Notifying upload completion...")
    try:
        client.upload_completed(session_id)
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
            session_type=ci_info.session_type,
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


def upload_with_session_name(
    console,
    token: str,
    session_name: str,
    manifest_path: str,
    catalog_path: str,
    adapter_type: str,
    target_path: str,
    skip_confirmation: bool = False,
):
    """
    Upload artifacts to a session identified by name.

    If the session exists, uploads to it. If not, prompts to create a new session
    (unless skip_confirmation is True, which auto-creates).

    This workflow requires org/project configuration from either:
    - Local config file (.recce/config) via 'recce-cloud init'
    - Environment variables (RECCE_ORG, RECCE_PROJECT)
    """
    # 1. Resolve org/project configuration
    console.rule("Session Name Resolution", style="blue")
    try:
        config = resolve_config()
        org = config.org
        project = config.project
        console.print(f"[cyan]Organization:[/cyan] {org}")
        console.print(f"[cyan]Project:[/cyan] {project}")
        console.print(f"[cyan]Config Source:[/cyan] {config.source}")
    except ConfigurationError as e:
        console.print("[red]Error:[/red] Could not resolve org/project configuration")
        console.print(f"Reason: {e}")
        console.print()
        console.print("To use --session-name, you need to either:")
        console.print("  1. Run 'recce-cloud init' to bind this directory to a project")
        console.print("  2. Set RECCE_ORG and RECCE_PROJECT environment variables")
        sys.exit(2)

    # 2. Initialize API client
    try:
        client = RecceCloudClient(token)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to initialize API client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # 3. Resolve org/project IDs (they might be slugs/names in config)
    try:
        org_info = client.get_organization(org)
        if not org_info:
            console.print(f"[red]Error:[/red] Organization '{org}' not found or you don't have access")
            sys.exit(2)
        org_id = org_info["id"]

        project_info = client.get_project(org_id, project)
        if not project_info:
            console.print(f"[red]Error:[/red] Project '{project}' not found in organization '{org}'")
            sys.exit(2)
        project_id = project_info["id"]
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to resolve organization/project")
        console.print(f"Reason: {e.reason}")
        sys.exit(2)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to resolve organization/project")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # 4. Look up session by name
    console.print(f'Looking up session "{session_name}"...')
    try:
        existing_session = client.get_session_by_name(org_id, project_id, session_name)
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to look up session")
        console.print(f"Reason: {e.reason}")
        sys.exit(2)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to look up session")
        console.print(f"Reason: {e}")
        sys.exit(2)

    session_id = None
    if existing_session:
        # Session found, use it
        session_id = existing_session.get("id")
        console.print(f'[green]Found existing session:[/green] "{session_name}" (ID: {session_id})')
    else:
        # Session not found, prompt to create
        console.print(f'[yellow]Session "{session_name}" not found[/yellow]')

        if skip_confirmation:
            # Auto-create with --yes flag
            console.print("Creating new session (--yes flag specified)...")
        else:
            # Interactive confirmation
            console.print()
            if not click.confirm(f'Create new session "{session_name}"?', default=True):
                console.print("[yellow]Upload cancelled[/yellow]")
                sys.exit(0)

        # Create the session
        try:
            new_session = client.create_session(
                org_id=org_id,
                project_id=project_id,
                session_name=session_name,
                adapter_type=adapter_type,
                session_type="manual",
            )
            session_id = new_session.get("id")
            console.print(f'[green]Created new session:[/green] "{session_name}" (ID: {session_id})')
        except RecceCloudException as e:
            console.print("[red]Error:[/red] Failed to create session")
            console.print(f"Reason: {e.reason}")
            sys.exit(4)
        except Exception as e:
            console.print("[red]Error:[/red] Failed to create session")
            console.print(f"Reason: {e}")
            sys.exit(4)

    # 5. Get presigned URLs and upload
    console.rule("Uploading Artifacts", style="blue")
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

    # Update session metadata (if session already existed, update adapter_type)
    if existing_session:
        try:
            client.update_session(org_id, project_id, session_id, adapter_type)
        except RecceCloudException as e:
            console.print("[yellow]Warning:[/yellow] Failed to update session metadata")
            console.print(f"Reason: {e.reason}")
            # Non-fatal for existing sessions
        except Exception as e:
            console.print("[yellow]Warning:[/yellow] Failed to update session metadata")
            console.print(f"Reason: {e}")
            # Non-fatal for existing sessions

    # Notify upload completion
    console.print("Notifying upload completion...")
    try:
        client.upload_completed(session_id)
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
    console.print("Uploaded dbt artifacts to Recce Cloud")
    console.print()
    console.print(f"[cyan]Session Name:[/cyan] {session_name}")
    console.print(f"[cyan]Session ID:[/cyan] {session_id}")
    console.print(f"[cyan]Organization:[/cyan] {org}")
    console.print(f"[cyan]Project:[/cyan] {project}")
    console.print(f"[cyan]Artifacts from:[/cyan] {os.path.abspath(target_path)}")

    sys.exit(0)
