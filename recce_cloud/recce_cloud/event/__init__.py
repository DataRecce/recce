import os
import re
import sys
from datetime import datetime, timezone

import sentry_sdk

from recce_cloud import get_version

__version__ = get_version()


def init():
    """Initialize Sentry error tracking for recce_cloud."""
    if os.environ.get("RECCE_DISABLE_SENTRY") == "1":
        return

    try:
        sentry_env = _get_sentry_env()
        sentry_dsn = _get_sentry_dsn()
        release_version = __version__ if sentry_env != "development" else None
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=sentry_env,
            release=release_version,
            traces_sample_rate=1.0,
        )
        sentry_sdk.set_tag("recce_cloud.version", __version__)
        sentry_sdk.set_tag("platform", sys.platform)
        sentry_sdk.set_tag("is_ci_env", _is_ci_env())
        sentry_sdk.set_tag("system_timezone", _get_system_timezone())
    except Exception:
        # Sentry init failure should never break the CLI
        pass


def capture_exception(e):
    sentry_sdk.capture_exception(e)


def flush_exceptions():
    sentry_sdk.flush()


def set_exception_tag(key, value):
    sentry_sdk.set_tag(key, value)


def _get_sentry_dsn():
    dsn_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "SENTRY_DNS"))
    try:
        with open(dsn_file, encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return None


def _get_sentry_env():
    if ".dev" in __version__:
        return "development"
    elif re.match(r"^\d+\.\d+\.\d+\.\d{8}[a|b|rc]?.*$", __version__):
        return "nightly"
    elif "a" in __version__:
        return "alpha"
    elif "b" in __version__:
        return "beta"
    elif "rc" in __version__:
        return "release-candidate"
    return "production"


def _is_ci_env():
    ci_vars = ["CI", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "JENKINS_URL", "BUILDKITE"]
    return any(os.environ.get(var) for var in ci_vars)


def _get_system_timezone():
    return datetime.now(timezone.utc).astimezone().tzinfo
