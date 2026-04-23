"""Shared utilities for cloud API error handling in API endpoints."""

import logging

from recce.util.recce_cloud import RecceCloudException

logger = logging.getLogger("uvicorn")


def log_cloud_exception(msg: str, exc: RecceCloudException):
    """Log cloud API errors at appropriate severity based on HTTP status code.

    4xx errors (client errors like 403 Forbidden, 404 Not Found) are logged as
    warnings since they represent expected outcomes. 5xx errors (server failures)
    are logged as errors since they indicate unexpected system issues.
    """
    if exc.status_code is not None and exc.status_code >= 500:
        logger.error(msg)
    else:
        logger.warning(msg)
