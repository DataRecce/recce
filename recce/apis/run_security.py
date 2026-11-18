"""Public error handling for ad-hoc query runs."""

from recce.models import RunType

QUERY_RUN_TYPES = {RunType.QUERY, RunType.QUERY_BASE, RunType.QUERY_DIFF}
QUERY_FAILURE_MESSAGE = "Query failed. Check the query and try again."
RUN_FAILURE_MESSAGE = "The run failed. Check the server logs for details."


def stored_run_error(run_type, error):
    """Error text to persist on a NEW failed run (DRC-5336).

    Query runs are fully redacted. Every other run type keeps Recce's own validation
    messages (``RecceException``: missing model/column/relation) and redacts anything else,
    e.g. raw warehouse driver errors. The full error is logged server-side by the caller.
    """
    from recce.exceptions import RecceException

    if run_type in QUERY_RUN_TYPES:
        return QUERY_FAILURE_MESSAGE
    if isinstance(error, RecceException):
        return str(error) if str(error) != "None" else repr(error)
    return RUN_FAILURE_MESSAGE


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
