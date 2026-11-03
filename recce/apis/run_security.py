"""Public error handling for ad-hoc query runs."""

from recce.models import RunType

QUERY_RUN_TYPES = {RunType.QUERY, RunType.QUERY_BASE, RunType.QUERY_DIFF}
QUERY_FAILURE_MESSAGE = "Query failed. Check the query and try again."


def public_run_error(run):
    """Hide raw query errors, including errors loaded from older state files."""
    if run.error and run.type in QUERY_RUN_TYPES:
        return QUERY_FAILURE_MESSAGE
    return run.error


def public_run(run):
    if run is None or run.error == public_run_error(run):
        return run
    copy = run.model_copy()
    copy.error = QUERY_FAILURE_MESSAGE
    return copy
