"""
PostHog telemetry for recce-cloud CLI.

Follows patterns from recce-cloud-infra's PostHogClient:
- Singleton client, lazy init
- Graceful no-op when API key missing
- anonymous_tracking opt-out respected
- shutdown() flushes on CLI exit
"""

import atexit
import hashlib
import logging
import os
import sys
import time
import click

logger = logging.getLogger(__name__)

_client = None  # type: Any
_initialized = False

# Same host as recce-cloud-infra
POSTHOG_HOST = "https://us.i.posthog.com"

# Bundled write-only project API key (safe to distribute).
# Override with RECCE_POSTHOG_API_KEY env var for testing.
_BUNDLED_API_KEY = ""  # TODO: fill with actual PostHog project API key


def _get_api_key():
    # type: () -> Optional[str]
    return os.environ.get("RECCE_POSTHOG_API_KEY") or _BUNDLED_API_KEY or None


def _should_track():
    # type: () -> bool
    """Check if tracking is enabled via profile."""
    try:
        from recce_cloud.auth.profile import load_profile

        profile = load_profile()
        tracking = profile.get("anonymous_tracking", False)
        return isinstance(tracking, bool) and tracking
    except Exception:
        return False


def _get_client():
    # type: () -> Any
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True

    if not _should_track():
        return None

    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        from posthog import Posthog

        _client = Posthog(
            api_key,
            host=POSTHOG_HOST,
            flush_at=10,
            flush_interval=5.0,
        )
        atexit.register(shutdown)
        return _client
    except Exception as e:
        logger.debug("PostHog init failed: %s", e)
        return None


def anonymize(value):
    # type: (str) -> str
    """Hash sensitive data. Same pattern as recce-cloud-infra."""
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def get_distinct_id():
    # type: () -> str
    """Get distinct_id from user profile."""
    try:
        from recce_cloud.auth.profile import get_user_id

        uid = get_user_id()
        return uid or "unknown"
    except Exception:
        return "unknown"


def get_common_properties():
    # type: () -> Dict[str, Any]
    """Properties included with every event."""
    from recce_cloud import __version__

    props = {
        "recce_cloud_version": __version__,
        "python_version": "{}.{}".format(
            sys.version_info.major, sys.version_info.minor
        ),
        "os_platform": sys.platform,
    }  # type: Dict[str, Any]

    try:
        from recce_cloud.ci_providers import CIDetector

        ci_info = CIDetector.detect()
        if ci_info and ci_info.platform:
            props["is_ci"] = True
            props["ci_platform"] = ci_info.platform
        else:
            props["is_ci"] = False
    except Exception:
        props["is_ci"] = False

    return props


def track(event, properties=None):
    # type: (str, Optional[Dict[str, Any]]) -> None
    """Track an event. No-op if disabled or no API key."""
    client = _get_client()
    if client is None:
        return
    try:
        all_props = get_common_properties()
        if properties:
            all_props.update(properties)
        client.capture(
            distinct_id=get_distinct_id(),
            event=event,
            properties=all_props,
        )
    except Exception as e:
        logger.debug("PostHog track error: %s", e)


def identify_user(email):
    # type: (str) -> None
    """Alias email to user_id for cross-system stitching with cloud-infra."""
    client = _get_client()
    if client is None:
        return
    try:
        from recce_cloud import __version__

        uid = get_distinct_id()
        client.alias(previous_id=email, distinct_id=uid)
        client.set(
            uid,
            {
                "email": email,
                "recce_cloud_version": __version__,
            },
        )
    except Exception as e:
        logger.debug("PostHog identify error: %s", e)


def shutdown():
    # type: () -> None
    """Flush pending events and stop background threads."""
    global _client
    if _client:
        try:
            _client.shutdown()
        except Exception:
            pass
        _client = None


class TrackedCommand(click.Command):
    """Click Command subclass that auto-tracks execution to PostHog."""

    def invoke(self, ctx):
        # type: (click.Context) -> Any
        start = time.time()
        command_name = ctx.info_name or "unknown"
        track("cli_command_started", {"command": command_name})
        try:
            result = super(TrackedCommand, self).invoke(ctx)
            duration = time.time() - start
            track(
                "cli_command_completed",
                {
                    "command": command_name,
                    "status": "success",
                    "duration_seconds": round(duration, 2),
                },
            )
            return result
        except SystemExit as e:
            duration = time.time() - start
            track(
                "cli_command_completed",
                {
                    "command": command_name,
                    "status": "error" if e.code != 0 else "success",
                    "exit_code": e.code,
                    "duration_seconds": round(duration, 2),
                },
            )
            raise
        except Exception as e:
            duration = time.time() - start
            track(
                "cli_command_completed",
                {
                    "command": command_name,
                    "status": "fatal",
                    "error_type": type(e).__name__,
                    "duration_seconds": round(duration, 2),
                },
            )
            raise
