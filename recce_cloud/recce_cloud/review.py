"""
Data review helper functions for recce-cloud CLI.

Handles the business logic for generating and retrieving data reviews.
"""

import json
import os
import sys
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.exceptions import RecceCloudException

# Cloud UI configuration - use same defaults as auth/login.py
RECCE_CLOUD_API_HOST = os.environ.get("RECCE_CLOUD_API_HOST", "https://cloud.datarecce.io")
RECCE_CLOUD_BASE_URL = os.environ.get("RECCE_CLOUD_BASE_URL", RECCE_CLOUD_API_HOST)


class ReviewStatus(Enum):
    """Status of the data review generation.

    These align with Recce Cloud UI/backend task statuses where applicable.
    """

    # Terminal states (align with backend RecceTaskStatus)
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"

    # CLI-specific states
    ALREADY_EXISTS = "ALREADY_EXISTS"
    TIMEOUT = "TIMEOUT"

    # In-progress states (align with backend RecceTaskStatus)
    QUEUED = "QUEUED"
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"


@dataclass
class ReviewResult:
    """Result of a data review operation."""

    status: ReviewStatus
    session_id: Optional[str] = None
    session_name: Optional[str] = None
    review_url: Optional[str] = None
    task_id: Optional[str] = None
    error_message: Optional[str] = None
    summary: Optional[str] = None


# Default polling configuration
DEFAULT_POLL_INTERVAL_SECONDS = 5
DEFAULT_TIMEOUT_SECONDS = 300  # 5 minutes


def generate_review_url(org_id: str, project_id: str, session_id: str) -> str:
    """
    Generate the URL to view the data review.

    Args:
        org_id: Organization ID or slug.
        project_id: Project ID or slug.
        session_id: Session ID.

    Returns:
        URL string to view the data review.
    """
    # Use the Recce Cloud web UI URL (respects RECCE_CLOUD_BASE_URL env var)
    return f"{RECCE_CLOUD_BASE_URL}/{org_id}/{project_id}/{session_id}/review"


def check_prerequisites(
    client: RecceCloudClient,
    org_id: str,
    project_id: str,
    session_name: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Check prerequisites for data review generation.

    This function calls the backend API which verifies:
    1. Session must exist
    2. Session must have artifacts uploaded
    3. Base session must exist
    4. Base session must have artifacts uploaded

    Args:
        client: RecceCloudClient instance.
        org_id: Organization ID or slug.
        project_id: Project ID or slug.
        session_name: Session name to check (used if session_id not provided).
        session_id: Session ID to check directly (takes precedence over session_name).

    Returns:
        dict with:
            - success: bool indicating if all prerequisites are met
            - session: session dict if found (with id, name, adapter_type)
            - error: error message if prerequisites not met
    """
    result = {
        "success": False,
        "session": None,
        "error": None,
    }

    # If session_id is not provided, look up by session_name
    if not session_id:
        if not session_name:
            result["error"] = "Either session_id or session_name must be provided"
            return result

        try:
            session = client.get_session_by_name(org_id, project_id, session_name)
            if not session:
                result["error"] = f"Session '{session_name}' not found in project"
                return result
            session_id = session.get("id")
        except RecceCloudException as e:
            result["error"] = f"Failed to find session: {e.reason}"
            return result

    # Call the backend API to check all prerequisites
    try:
        prereq_response = client.check_prerequisites(org_id, project_id, session_id)

        # Build session dict from the response
        result["session"] = {
            "id": prereq_response.get("session_id"),
            "name": prereq_response.get("session_name"),
            "adapter_type": prereq_response.get("adapter_type"),
        }

        if prereq_response.get("is_ready"):
            result["success"] = True
        else:
            result["error"] = prereq_response.get("reason", "Prerequisites not met")

        return result

    except RecceCloudException as e:
        result["error"] = f"Failed to check prerequisites: {e.reason}"
        return result


def poll_task_status(
    client: RecceCloudClient,
    org_id: str,
    task_id: str,
    poll_interval: int = DEFAULT_POLL_INTERVAL_SECONDS,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    progress_callback=None,
) -> Dict[str, Any]:
    """
    Poll task status until completion or timeout.

    Args:
        client: RecceCloudClient instance.
        org_id: Organization ID or slug.
        task_id: Task ID to poll.
        poll_interval: Seconds between polls.
        timeout: Maximum seconds to wait.
        progress_callback: Optional callback(status_dict) called on each poll.

    Returns:
        dict with:
            - success: bool indicating if task completed successfully
            - status: final task status string
            - error: error message if failed
            - task: full task status dict
    """
    start_time = time.time()
    last_status = None

    while True:
        elapsed = time.time() - start_time
        if elapsed > timeout:
            return {
                "success": False,
                "status": "timeout",
                "error": f"Task timed out after {timeout} seconds",
                "task": None,
            }

        try:
            task_status = client.get_task_status(org_id, task_id)
        except RecceCloudException as e:
            return {
                "success": False,
                "status": "error",
                "error": f"Failed to get task status: {e.reason}",
                "task": None,
            }

        status = task_status.get("status", "unknown")

        # Call progress callback if status changed
        if progress_callback and status != last_status:
            progress_callback(task_status)
            last_status = status

        # Check terminal states (handle both lowercase and uppercase from backend)
        if status.lower() in ["completed", "succeeded"]:
            return {
                "success": True,
                "status": status,
                "error": None,
                "task": task_status,
            }
        elif status.lower() in ["failed", "error", "cancelled"]:
            error_msg = task_status.get("metadata", {}).get("error", f"Task {status}")
            return {
                "success": False,
                "status": status,
                "error": error_msg,
                "task": task_status,
            }

        # Still running, wait and poll again
        time.sleep(poll_interval)


def generate_data_review(
    console,
    client: RecceCloudClient,
    org_id: str,
    project_id: str,
    session: Dict[str, Any],
    regenerate: bool = False,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    json_output: bool = False,
) -> ReviewResult:
    """
    Generate data review for a session.

    This function handles:
    1. Checking if a review already exists
    2. Checking if a task is already running
    3. Triggering new review generation
    4. Polling for completion

    Args:
        console: Rich console for output.
        client: RecceCloudClient instance.
        org_id: Organization ID or slug.
        project_id: Project ID or slug.
        session: Session dict from API.
        regenerate: If True, regenerate even if review exists.
        timeout: Maximum seconds to wait for generation.
        json_output: If True, suppress progress output.

    Returns:
        ReviewResult with status and details.
    """
    session_id = session["id"]
    session_name = session.get("name", session_id)

    # 1. Check if review already exists (skip if regenerating)
    # Note: get_data_review() returns None for 404 (no review), so we don't need try-except for that case.
    # Let other errors (403, 500) propagate - they indicate real problems that would also fail generation.
    if not regenerate:
        existing_review = client.get_data_review(org_id, project_id, session_id)
        if existing_review and existing_review.get("summary"):
            return ReviewResult(
                status=ReviewStatus.ALREADY_EXISTS,
                session_id=session_id,
                session_name=session_name,
                review_url=generate_review_url(org_id, project_id, session_id),
                summary=existing_review.get("summary"),
            )

    # 2. Check if a task is already running
    # Note: get_running_task() returns None for 404 (no running task), so we don't need try-except.
    # Let other errors (403, 500) propagate - they indicate real problems.
    running_task = client.get_running_task(org_id, project_id, session_id)
    if running_task:
        task_id = running_task["task_id"]
        if not json_output:
            console.print(f"[yellow]Task already running:[/yellow] {task_id}")
            console.print("Waiting for completion...")
    else:
        task_id = None

    # 3. Trigger new generation if no task running
    if not task_id:
        if not json_output:
            action = "Regenerating" if regenerate else "Generating"
            console.print(f"[cyan]{action} data review...[/cyan]")

        try:
            response = client.generate_data_review(org_id, project_id, session_id, regenerate=regenerate)
            task_id = response.get("task_id")

            if not task_id:
                # Review was already generated and no new task needed
                existing_review = client.get_data_review(org_id, project_id, session_id)
                if existing_review and existing_review.get("summary"):
                    return ReviewResult(
                        status=ReviewStatus.ALREADY_EXISTS,
                        session_id=session_id,
                        session_name=session_name,
                        review_url=generate_review_url(org_id, project_id, session_id),
                        summary=existing_review.get("summary"),
                    )
                else:
                    return ReviewResult(
                        status=ReviewStatus.FAILED,
                        session_id=session_id,
                        session_name=session_name,
                        error_message="No task created and no existing review found",
                    )

        except RecceCloudException as e:
            return ReviewResult(
                status=ReviewStatus.FAILED,
                session_id=session_id,
                session_name=session_name,
                error_message=f"Failed to trigger review generation: {e.reason}",
            )

    # 4. Poll for completion
    def progress_callback(task_status):
        if not json_output:
            # Display status as-is from backend (aligned with Recce Cloud UI)
            status = task_status.get("status", "unknown")
            console.print(f"  Status: [cyan]{status}[/cyan]")

    if not json_output:
        console.print(f"[cyan]Task ID:[/cyan] {task_id}")
        console.print("Waiting for review generation to complete...")

    poll_result = poll_task_status(
        client,
        org_id,
        task_id,
        timeout=timeout,
        progress_callback=progress_callback if not json_output else None,
    )

    if poll_result["success"]:
        # Fetch the generated review
        try:
            review = client.get_data_review(org_id, project_id, session_id)
            return ReviewResult(
                status=ReviewStatus.SUCCEEDED,
                session_id=session_id,
                session_name=session_name,
                review_url=generate_review_url(org_id, project_id, session_id),
                task_id=task_id,
                summary=review.get("summary") if review else None,
            )
        except RecceCloudException as e:
            return ReviewResult(
                status=ReviewStatus.FAILED,
                session_id=session_id,
                session_name=session_name,
                task_id=task_id,
                error_message=f"Review generated but failed to fetch: {e.reason}",
            )
    elif poll_result["status"] == "timeout":
        return ReviewResult(
            status=ReviewStatus.TIMEOUT,
            session_id=session_id,
            session_name=session_name,
            task_id=task_id,
            error_message=poll_result["error"],
        )
    else:
        return ReviewResult(
            status=ReviewStatus.FAILED,
            session_id=session_id,
            session_name=session_name,
            task_id=task_id,
            error_message=poll_result["error"],
        )


def run_review_command(
    console,
    token: str,
    org_id: str,
    project_id: str,
    session_name: Optional[str] = None,
    session_id: Optional[str] = None,
    regenerate: bool = False,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    json_output: bool = False,
):
    """
    Main entry point for the review command.

    This orchestrates the full review workflow:
    1. Initialize client
    2. Check prerequisites
    3. Generate review
    4. Display results

    Args:
        console: Rich console for output.
        token: API token.
        org_id: Organization ID or slug.
        project_id: Project ID or slug.
        session_name: Session name to generate review for (used if session_id not provided).
        session_id: Session ID to generate review for (takes precedence over session_name).
        regenerate: If True, regenerate even if review exists.
        timeout: Maximum seconds to wait for generation.
        json_output: If True, output JSON instead of human-readable text.
    """
    # 1. Initialize client
    try:
        client = RecceCloudClient(token)
    except Exception as e:
        if json_output:
            print(json.dumps({"success": False, "error": f"Failed to initialize client: {e}"}))
        else:
            console.print("[red]Error:[/red] Failed to initialize API client")
            console.print(f"Reason: {e}")
        sys.exit(2)

    # 2. Check prerequisites
    if not json_output:
        console.rule("Checking Prerequisites", style="blue")

    prereq = check_prerequisites(client, org_id, project_id, session_name=session_name, session_id=session_id)

    if not prereq["success"]:
        if json_output:
            output = {
                "success": False,
                "error": prereq["error"],
            }
            if session_name:
                output["session_name"] = session_name
            if session_id:
                output["session_id"] = session_id
            print(json.dumps(output))
        else:
            console.print(f"[red]Error:[/red] {prereq['error']}")
        sys.exit(3)

    session = prereq["session"]
    resolved_session_id = session["id"]
    resolved_session_name = session.get("name") or session_id or "(unnamed)"

    if not json_output:
        console.print(f"[green]✓[/green] Session found: {resolved_session_name}")
        console.print(f"  Session ID: {resolved_session_id}")
        console.print(f"  Adapter: {session.get('adapter_type', 'unknown')}")
        console.print("[green]✓[/green] Base session available")

    # 3. Generate review
    if not json_output:
        console.rule("Generating Data Review", style="blue")

    result = generate_data_review(
        console=console,
        client=client,
        org_id=org_id,
        project_id=project_id,
        session=session,
        regenerate=regenerate,
        timeout=timeout,
        json_output=json_output,
    )

    # 4. Display results
    if json_output:
        output = {
            "success": result.status in [ReviewStatus.SUCCEEDED, ReviewStatus.ALREADY_EXISTS],
            "status": result.status.value,
            "session_id": result.session_id,
            "session_name": result.session_name,
            "review_url": result.review_url,
        }
        if result.task_id:
            output["task_id"] = result.task_id
        if result.error_message:
            output["error"] = result.error_message
        print(json.dumps(output))
    else:
        if result.status == ReviewStatus.SUCCEEDED:
            console.rule("Review Generated Successfully", style="green")
            console.print(f"[green]✓[/green] Data review generated for session '{result.session_name}'")
            console.print()
            console.print(f"[cyan]View review at:[/cyan] {result.review_url}")
        elif result.status == ReviewStatus.ALREADY_EXISTS:
            console.rule("Review Already Exists", style="green")
            console.print(f"[green]✓[/green] Data review already exists for session '{result.session_name}'")
            console.print()
            console.print(f"[cyan]View review at:[/cyan] {result.review_url}")
            console.print()
            console.print("[dim]Tip: Use --regenerate to create a new review[/dim]")
        elif result.status == ReviewStatus.TIMEOUT:
            console.rule("Review Generation Timeout", style="yellow")
            console.print("[yellow]Warning:[/yellow] Review generation is still in progress")
            console.print(f"Task ID: {result.task_id}")
            console.print("The review will be available shortly. Check the web UI for status.")
            console.print()
            console.print(f"[cyan]Check status at:[/cyan] {result.review_url}")
        else:
            console.rule("Review Generation Failed", style="red")
            console.print(f"[red]Error:[/red] {result.error_message}")

    # Exit with appropriate code
    if result.status in [ReviewStatus.SUCCEEDED, ReviewStatus.ALREADY_EXISTS]:
        sys.exit(0)
    elif result.status == ReviewStatus.TIMEOUT:
        sys.exit(0)  # Timeout is not a hard failure - task is still running
    else:
        sys.exit(4)
