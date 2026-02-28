"""
Delete helper functions for recce-cloud CLI.
"""

import sys

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.factory import create_platform_client
from recce_cloud.constants import SESSION_TYPE_PR, SESSION_TYPE_PROD, ExitCode
from recce_cloud.error_handling import cloud_error_handler


def delete_existing_session(console, token: str, session_id: str):
    """
    Delete a session by ID using RECCE_API_TOKEN (user interactive workflow).

    This is the generic workflow that requires a pre-existing session ID.
    """
    # Initialize client
    with cloud_error_handler(
        console, "initialize API client", exit_code=ExitCode.INIT_ERROR
    ):
        client = RecceCloudClient(token)

    # Delete the session
    console.print(f'Deleting session ID "{session_id}"')
    with cloud_error_handler(console, "delete session"):
        client.delete_session(session_id)

    # Success!
    console.rule("Deleted Successfully", style="green")
    console.print(f'Deleted session ID "{session_id}" from Recce Cloud')
    sys.exit(0)


def delete_with_platform_apis(console, token: str, ci_info, prod: bool):
    """
    Delete session using platform-specific APIs (CI/CD workflow).

    This workflow uses platform APIs to find and delete sessions.
    """
    # Validate platform support
    if ci_info.platform not in ["github-actions", "gitlab-ci"]:
        console.print(
            "[red]Error:[/red] Platform-specific delete requires GitHub Actions or GitLab CI environment"
        )
        console.print(f"Detected platform: {ci_info.platform or 'unknown'}")
        console.print(
            "Either run this command in a supported CI environment or provide --session-id for generic delete"
        )
        sys.exit(1)

    # Create platform-specific client (ValueError, not RecceCloudException)
    try:
        client = create_platform_client(token, ci_info)
    except ValueError as e:
        console.print("[red]Error:[/red] Failed to create platform client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # Determine session type
    session_type = SESSION_TYPE_PROD if prod else SESSION_TYPE_PR

    # Delete session
    console.rule("Deleting session", style="blue")

    # Determine what to display based on session type
    if session_type == SESSION_TYPE_PROD:
        console.print("Deleting production/base session...")
    elif session_type == SESSION_TYPE_PR:
        console.print(f"Deleting PR/MR session (PR #{ci_info.pr_number})...")
    else:
        console.print("Deleting session...")

    with cloud_error_handler(console, "delete session"):
        delete_response = client.delete_session(
            pr_number=ci_info.pr_number,
            session_type=session_type,
        )

    session_id = delete_response.get("session_id")
    if not session_id:
        console.print("[red]Error:[/red] Incomplete response from delete session API")
        console.print(f"Response: {delete_response}")
        sys.exit(4)

    console.print(f"[green]Deleted Session ID:[/green] {session_id}")

    # Success!
    console.rule("Deleted Successfully", style="green")
    console.print(f'Deleted session ID "{session_id}" from Recce Cloud')

    if ci_info.pr_url:
        console.print(f"Pull request: {ci_info.pr_url}")

    sys.exit(0)
