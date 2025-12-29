"""
Delete helper functions for recce-cloud CLI.
"""

import sys

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.api.factory import create_platform_client


def delete_existing_session(console, token: str, session_id: str):
    """
    Delete a session by ID using RECCE_API_TOKEN (user interactive workflow).

    This is the generic workflow that requires a pre-existing session ID.
    """
    try:
        client = RecceCloudClient(token)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to initialize API client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # Delete the session
    console.print(f'Deleting session ID "{session_id}"')
    try:
        client.delete_session(session_id)
    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to delete session")
        console.print(f"Reason: {e.reason}")
        sys.exit(4)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to delete session")
        console.print(f"Reason: {e}")
        sys.exit(4)

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
        console.print("[red]Error:[/red] Platform-specific delete requires GitHub Actions or GitLab CI environment")
        console.print(f"Detected platform: {ci_info.platform or 'unknown'}")
        console.print(
            "Either run this command in a supported CI environment or provide --session-id for generic delete"
        )
        sys.exit(1)

    # Create platform-specific client
    try:
        client = create_platform_client(token, ci_info)
    except ValueError as e:
        console.print("[red]Error:[/red] Failed to create platform client")
        console.print(f"Reason: {e}")
        sys.exit(2)

    # Determine session type
    session_type = "prod" if prod else "cr"

    # Delete session
    console.rule("Deleting session", style="blue")

    # Determine what to display based on session type
    if session_type == "prod":
        console.print("Deleting production/base session...")
    elif session_type == "cr":
        console.print(f"Deleting PR/MR session (CR #{ci_info.cr_number})...")
    else:
        console.print("Deleting session...")

    try:
        delete_response = client.delete_session(
            cr_number=ci_info.cr_number,
            session_type=session_type,
        )

        session_id = delete_response.get("session_id")
        if not session_id:
            console.print("[red]Error:[/red] Incomplete response from delete session API")
            console.print(f"Response: {delete_response}")
            sys.exit(4)

        console.print(f"[green]Deleted Session ID:[/green] {session_id}")

    except RecceCloudException as e:
        console.print("[red]Error:[/red] Failed to delete session")
        console.print(f"Reason: {e.reason}")
        sys.exit(4)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to delete session")
        console.print(f"Reason: {e}")
        sys.exit(4)

    # Success!
    console.rule("Deleted Successfully", style="green")
    console.print(f'Deleted session ID "{session_id}" from Recce Cloud')

    if ci_info.cr_url:
        console.print(f"Change request: {ci_info.cr_url}")

    sys.exit(0)
