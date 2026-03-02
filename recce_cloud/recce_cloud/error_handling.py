"""
Standardized error handling for recce-cloud CLI operations.
"""

import sys
from contextlib import contextmanager

from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.constants import ExitCode


@contextmanager
def cloud_error_handler(console, action, exit_code=ExitCode.API_ERROR, fatal=True):
    """
    Context manager for standardized error handling.

    Args:
        console: Rich console for output.
        action: Description of the action (e.g., "get upload URLs").
        exit_code: Exit code to use on fatal error.
        fatal: If True, sys.exit on error. If False, print warning and continue.

    Usage:
        with cloud_error_handler(console, "get session info", exit_code=ExitCode.INIT_ERROR):
            session = client.get_session(session_id)

        # Non-fatal (warning only):
        with cloud_error_handler(console, "notify upload completion", fatal=False):
            client.upload_completed(session_id)
    """
    try:
        yield
    except RecceCloudException as e:
        _handle_error(console, action, e.reason, fatal, exit_code)
    except Exception as e:
        _handle_error(console, action, str(e), fatal, exit_code)


def _handle_error(console, action, reason, fatal, exit_code):
    """Print error/warning message and optionally exit."""
    tag = "[red]Error:[/red]" if fatal else "[yellow]Warning:[/yellow]"
    console.print(f"{tag} Failed to {action}")
    console.print(f"Reason: {reason}")
    if fatal:
        sys.exit(exit_code)
