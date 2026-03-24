"""
Upload helper functions for recce-cloud CLI.
"""

import logging
import os

import click
import requests

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.api.factory import create_platform_client
from recce_cloud.config.resolver import ConfigurationError, resolve_config
from recce_cloud.constants import ExitCode
from recce_cloud.error_handling import cloud_error_handler

logger = logging.getLogger(__name__)


class UploadError(Exception):
    """Raised when an upload operation fails with a specific exit code."""

    def __init__(self, message: str, exit_code: int = 2):
        super().__init__(message)
        self.exit_code = exit_code


def _put_artifact(console, label: str, file_path: str, upload_url: str):
    """Upload a single artifact file to a presigned URL."""
    console.print(f'Uploading {label} from path "{file_path}"')
    with cloud_error_handler(console, f"upload {label}"):
        with open(file_path, "rb") as f:
            response = requests.put(upload_url, data=f.read())
        if response.status_code not in [200, 204]:
            raise Exception(
                f"Upload failed with status {response.status_code}: {response.text}"
            )


def upload_to_existing_session(
    console,
    token: str,
    session_id: str,
    manifest_path: str,
    catalog_path: str,
    adapter_type: str,
    target_path: str,
    session_base: bool = False,
):
    """
    Upload artifacts to an existing Recce Cloud session using session ID.

    This is the generic workflow that requires a pre-existing session ID.
    """
    # Initialize client
    with cloud_error_handler(
        console, "initialize API client", exit_code=ExitCode.INIT_ERROR
    ):
        client = RecceCloudClient(token)

    # Get session info
    console.print(f'Uploading artifacts for session ID "{session_id}"')
    with cloud_error_handler(
        console, "get session info", exit_code=ExitCode.INIT_ERROR
    ):
        session = client.get_session(session_id)

    # Inline validation stays outside
    if session.get("status") == "error":
        console.print(f"[red]Error:[/red] {session.get('message')}")
        raise UploadError(session.get("message", "Session error"))
    org_id = session.get("org_id")
    if org_id is None:
        console.print(
            f"[red]Error:[/red] Session ID {session_id} does not belong to any organization."
        )
        raise UploadError(
            f"Session ID {session_id} does not belong to any organization"
        )
    project_id = session.get("project_id")
    if project_id is None:
        console.print(
            f"[red]Error:[/red] Session ID {session_id} does not belong to any project."
        )
        raise UploadError(f"Session ID {session_id} does not belong to any project")

    if session_base:
        upload_session_base(
            console,
            token,
            session_id,
            manifest_path,
            catalog_path,
            target_path,
        )
        return

    # Get presigned URLs
    with cloud_error_handler(console, "get upload URLs"):
        presigned_urls = client.get_upload_urls_by_session_id(
            org_id, project_id, session_id
        )

    _put_artifact(console, "manifest", manifest_path, presigned_urls["manifest_url"])
    _put_artifact(console, "catalog", catalog_path, presigned_urls["catalog_url"])

    # Update session metadata
    with cloud_error_handler(console, "update session metadata"):
        client.update_session(org_id, project_id, session_id, adapter_type)

    # Notify upload completion (non-fatal)
    console.print("Notifying upload completion...")
    with cloud_error_handler(console, "notify upload completion", fatal=False):
        client.upload_completed(session_id)

    # Success!
    console.rule("Uploaded Successfully", style="green")
    console.print(
        f'Uploaded dbt artifacts to Recce Cloud for session ID "{session_id}" from "{os.path.abspath(target_path)}"'
    )


def upload_with_platform_apis(
    console,
    token: str,
    ci_info,
    manifest_path: str,
    catalog_path: str,
    adapter_type: str,
    target_path: str,
    client=None,
    session_base: bool = False,
):
    """
    Upload artifacts using touch-recce-session APIs.

    This workflow uses touch-recce-session to create a session automatically.
    Accepts an optional pre-built client (e.g., RecceTokenCloudClient); if not
    provided, creates a platform-specific client from the token and CI info.
    """
    if client is None:
        # Validate platform support
        if ci_info.platform not in ["github-actions", "gitlab-ci"]:
            console.print(
                "[red]Error:[/red] Platform-specific upload requires GitHub Actions or GitLab CI environment"
            )
            console.print(f"Detected platform: {ci_info.platform or 'unknown'}")
            console.print(
                "Either run this command in a supported CI environment or provide --session-id for generic upload"
            )
            raise UploadError("Unsupported CI platform", exit_code=1)

        # Create platform-specific client (ValueError, not RecceCloudException)
        try:
            client = create_platform_client(token, ci_info)
        except ValueError as e:
            console.print("[red]Error:[/red] Failed to create platform client")
            console.print(f"Reason: {e}")
            raise UploadError(f"Failed to create platform client: {e}")

    # Touch session to create or get session ID
    console.rule("Creating/touching session", style="blue")
    with cloud_error_handler(console, "create/touch session"):
        session_response = client.touch_recce_session(
            branch=ci_info.source_branch or ci_info.base_branch or "main",
            adapter_type=adapter_type,
            pr_number=ci_info.pr_number,
            commit_sha=ci_info.commit_sha,
            session_type=ci_info.session_type,
        )

    session_id = session_response.get("session_id")
    manifest_upload_url = session_response.get("manifest_upload_url")
    catalog_upload_url = session_response.get("catalog_upload_url")

    if not session_id or not manifest_upload_url or not catalog_upload_url:
        console.print(
            "[red]Error:[/red] Incomplete response from touch-recce-session API"
        )
        console.print(f"Response: {session_response}")
        raise UploadError(
            "Incomplete response from touch-recce-session API", exit_code=4
        )

    console.print(f"[green]Session ID:[/green] {session_id}")

    if session_base:
        upload_session_base(
            console,
            token,
            session_id,
            manifest_path,
            catalog_path,
            target_path,
            client=client,
        )
        return

    _put_artifact(console, "manifest", manifest_path, manifest_upload_url)
    _put_artifact(console, "catalog", catalog_path, catalog_upload_url)

    # Notify upload completion (non-fatal)
    console.print("Notifying upload completion...")
    with cloud_error_handler(console, "notify upload completion", fatal=False):
        client.upload_completed(session_id=session_id, commit_sha=ci_info.commit_sha)

    # Success!
    console.rule("Uploaded Successfully", style="green")
    console.print(
        f'Uploaded dbt artifacts to Recce Cloud for session ID "{session_id}"'
    )
    console.print(f'Artifacts from: "{os.path.abspath(target_path)}"')

    if ci_info.pr_url:
        console.print(f"Pull request: {ci_info.pr_url}")


def upload_with_session_name(
    console,
    token: str,
    session_name: str,
    manifest_path: str,
    catalog_path: str,
    adapter_type: str,
    target_path: str,
    skip_confirmation: bool = False,
    session_base: bool = False,
):
    """
    Upload artifacts to a session identified by name.

    If the session exists, uploads to it. If not, prompts to create a new session
    (unless skip_confirmation is True, which auto-creates).

    This workflow requires org/project configuration from either:
    - Local config file (.recce/config) via 'recce-cloud init'
    - Environment variables (RECCE_ORG, RECCE_PROJECT)
    """
    # 1. Resolve org/project configuration (ConfigurationError, not RecceCloudException)
    console.rule("Session Name Resolution", style="blue")
    try:
        config = resolve_config()
        org = config.org_id
        project = config.project_id
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
        raise UploadError("Could not resolve org/project configuration")

    # 2. Initialize API client
    with cloud_error_handler(
        console, "initialize API client", exit_code=ExitCode.INIT_ERROR
    ):
        client = RecceCloudClient(token)

    # 3. Resolve org/project IDs (they might be slugs/names in config)
    # Keep manual try/except because of logger.debug and custom error messages
    try:
        org_info = client.get_organization(org)
        if not org_info:
            console.print(
                f"[red]Error:[/red] Organization '{org}' not found or you don't have access"
            )
            raise UploadError(f"Organization '{org}' not found")
        org_id = org_info.get("id")
        if not org_id:
            console.print(f"[red]Error:[/red] Organization '{org}' response missing ID")
            raise UploadError(f"Organization '{org}' response missing ID")

        project_info = client.get_project(org_id, project)
        if not project_info:
            console.print(
                f"[red]Error:[/red] Project '{project}' not found in organization '{org}'"
            )
            raise UploadError(f"Project '{project}' not found in organization '{org}'")
        project_id = project_info.get("id")
        if not project_id:
            console.print(f"[red]Error:[/red] Project '{project}' response missing ID")
            raise UploadError(f"Project '{project}' response missing ID")
    except UploadError:
        raise
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to resolve organization/project")
        console.print(f"Reason: {e.reason}")
        raise UploadError("Failed to resolve organization/project")
    except Exception as e:
        logger.debug("Failed to resolve organization/project: %s", e, exc_info=True)
        console.print("[red]Error:[/red] Failed to resolve organization/project")
        console.print(f"  Reason: {e}")
        console.print("  Check your authentication and network connection.")
        raise UploadError(f"Failed to resolve organization/project: {e}")

    # 4. Look up session by name (keep manual try/except for logger.debug)
    console.print(f'Looking up session "{session_name}"...')
    try:
        existing_session = client.get_session_by_name(org_id, project_id, session_name)
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to look up session")
        console.print(f"Reason: {e.reason}")
        raise UploadError("Failed to look up session")
    except Exception as e:
        logger.debug("Failed to look up session: %s", e, exc_info=True)
        console.print("[red]Error:[/red] Failed to look up session")
        console.print(f"  Reason: {e}")
        console.print("  Check your network connection and try again.")
        raise UploadError(f"Failed to look up session: {e}")

    session_id = None
    if existing_session:
        # Session found, use it
        session_id = existing_session.get("id")
        console.print(
            f'[green]Found existing session:[/green] "{session_name}" (ID: {session_id})'
        )
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
                return

        # Create the session
        with cloud_error_handler(console, "create session"):
            new_session = client.create_session(
                org_id=org_id,
                project_id=project_id,
                session_name=session_name,
                adapter_type=adapter_type,
                session_type="manual",
            )
            session_id = new_session.get("id")
            console.print(
                f'[green]Created new session:[/green] "{session_name}" (ID: {session_id})'
            )

    # 5. Upload artifacts
    if session_base:
        upload_session_base(
            console,
            token,
            session_id,
            manifest_path,
            catalog_path,
            target_path,
        )
    else:
        # Get presigned URLs and upload (existing flow)
        console.rule("Uploading Artifacts", style="blue")
        with cloud_error_handler(console, "get upload URLs"):
            presigned_urls = client.get_upload_urls_by_session_id(
                org_id, project_id, session_id
            )

        _put_artifact(
            console, "manifest", manifest_path, presigned_urls["manifest_url"]
        )
        _put_artifact(console, "catalog", catalog_path, presigned_urls["catalog_url"])

        # Update session metadata (if session already existed, update adapter_type; non-fatal)
        if existing_session:
            with cloud_error_handler(console, "update session metadata", fatal=False):
                client.update_session(org_id, project_id, session_id, adapter_type)

        # Notify upload completion (non-fatal)
        console.print("Notifying upload completion...")
        with cloud_error_handler(console, "notify upload completion", fatal=False):
            client.upload_completed(session_id)

        # Success!
        console.rule("Uploaded Successfully", style="green")
        console.print("Uploaded dbt artifacts to Recce Cloud")
        console.print()
        console.print(f"[cyan]Session Name:[/cyan] {session_name}")
        console.print(f"[cyan]Session ID:[/cyan] {session_id}")
        console.print(f"[cyan]Organization:[/cyan] {org}")
        console.print(f"[cyan]Project:[/cyan] {project}")
        console.print(f"[cyan]Artifacts from:[/cyan] {os.path.abspath(target_path)}")


def upload_session_base(
    console,
    token: str,
    session_id: str,
    manifest_path: str,
    catalog_path: str,
    target_path: str,
    client=None,
):
    """
    Upload session base artifacts to an existing session.

    Gets presigned URLs for the session base subpath, uploads manifest + catalog,
    then notifies the server to set has_isolated_base=True.

    Accepts an optional pre-built client (e.g., RecceTokenCloudClient); if not
    provided, creates a RecceCloudClient and resolves org/project from the session.

    Args:
        console: Rich console for output
        token: RECCE_API_TOKEN or login profile token
        session_id: Session ID
        manifest_path: Path to manifest.json
        catalog_path: Path to catalog.json
        target_path: Original target path (for display)
        client: Optional RecceTokenCloudClient instance. If not provided,
            a RecceCloudClient is created internally.
    """
    if client is None:
        with cloud_error_handler(
            console, "initialize API client", exit_code=ExitCode.INIT_ERROR
        ):
            client = RecceCloudClient(token)

    console.rule("Uploading Session Base Artifacts", style="blue")

    # Get session base upload URLs
    if isinstance(client, RecceCloudClient):
        # RecceCloudClient (login-based) needs org_id/project_id — resolve from session
        with cloud_error_handler(console, "get session info"):
            session = client.get_session(session_id)
        org_id = session.get("org_id")
        project_id = session.get("project_id")
        if not org_id or not project_id:
            console.print("[red]Error:[/red] Could not resolve org/project for session")
            raise UploadError("Could not resolve org/project for session")
        with cloud_error_handler(console, "get session base upload URLs"):
            presigned_urls = client.get_isolated_base_upload_urls(
                org_id, project_id, session_id
            )
    else:
        # RecceTokenCloudClient, GitHubRecceCloudClient, GitLabRecceCloudClient
        # all resolve project server-side from the token
        with cloud_error_handler(console, "get session base upload URLs"):
            presigned_urls = client.get_isolated_base_upload_urls(session_id)

    _put_artifact(console, "manifest", manifest_path, presigned_urls["manifest_url"])
    _put_artifact(console, "catalog", catalog_path, presigned_urls["catalog_url"])

    # Notify upload completion (non-fatal)
    console.print("Notifying session base upload completion...")
    with cloud_error_handler(
        console, "notify session base upload completion", fatal=False
    ):
        if isinstance(client, RecceCloudClient):
            client.isolated_base_upload_completed(org_id, project_id, session_id)
        else:
            client.isolated_base_upload_completed(session_id)

    # Success
    console.rule("Session Base Uploaded Successfully", style="green")
    console.print(
        f'Uploaded session base artifacts to session "{session_id}" from "{os.path.abspath(target_path)}"'
    )
