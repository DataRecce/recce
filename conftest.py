"""Stop tests from sending errors to Sentry.

Tests run CLI commands, and a CLI command turns Sentry on. Every logger.error
after that is a real Sentry error.

Sentry cannot start without sentry_sdk.init, so patching it stops all reporting.
"""

from unittest.mock import patch

import pytest


@pytest.fixture(scope="session", autouse=True)
def _never_report_errors_from_tests():
    with patch("recce.event.sentry_sdk.init"):
        yield
