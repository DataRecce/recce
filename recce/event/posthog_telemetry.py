"""
PostHog telemetry for the Recce OSS CLI.

Mirrors recce_cloud/recce_cloud/telemetry.py 1:1 in structure, rewired to the
OSS identity / opt-out / common-props contract (P4 design):

- event_source="oss-cli" on every event (D4)
- distinct_id = the SAME profile.yml user_id Amplitude's collector uses
  (uuid4 hex / sha256-of-codespace), with a `_CI` suffix in CI (D6)
- $process_person_profile=False on every capture so anonymous CLI users create
  NO PostHog person rows (D6)
- opt-out reuses the existing OSS gate recce.event.should_log_event() (D5)
- RECCE_DISABLE_TELEMETRY kill switch disables ONLY the PostHog path (D12)
- hardcoded prod phc_ write-only key (lands in shared prod project 267645),
  RECCE_POSTHOG_API_KEY env override for staging/test isolation

The `posthog` package is imported lazily (only inside _get_client) so OSS
startup is unaffected and the dependency is soft at import time — a missing
install yields a graceful no-op client, never a crash.
"""

import atexit
import hashlib
import logging
import os
import platform
import sys

logger = logging.getLogger(__name__)

_client = None  # type: Any
_initialized = False

# Same host as recce_cloud/telemetry.py.
POSTHOG_HOST = "https://us.i.posthog.com"

# PostHog project API key for production — write-only public token (phc_),
# safe for client-side embedding. Copied verbatim from
# recce_cloud/recce_cloud/telemetry.py. Data lands in shared prod project
# 267645 (D4).
_POSTHOG_KEY_PROD = "phc_WDJMPIYB2WTasN3sVxwIasBOSTjZ9rVTkpqf5lVKeRL"

# Mandatory disambiguation tag on every OSS event (D4).
EVENT_SOURCE = "oss-cli"


def _is_kill_switched():
    # type: () -> bool
    """Return True when the PostHog path is disabled via env (D12).

    PostHog-scoped during the dual-run window — does NOT gate Amplitude/Sentry.
    """
    return bool(os.environ.get("RECCE_DISABLE_TELEMETRY"))


def _get_api_key():
    # type: () -> str
    """PostHog project API key for event ingestion.

    OSS has no prod-host concept (unlike recce_cloud), so the prod key is
    ALWAYS available — opt-out is the off switch (D5), not host detection.
    RECCE_POSTHOG_API_KEY overrides for staging/test isolation.
    """
    return os.environ.get("RECCE_POSTHOG_API_KEY") or _POSTHOG_KEY_PROD


def _should_track():
    # type: () -> bool
    """Single source of truth = the existing OSS opt-out gate.

    Reuses recce.event.should_log_event() so PostHog honors the EXACT same
    opt-out semantics as Amplitude (profile.yml anonymous_tracking, D5).
    """
    try:
        from recce.event import should_log_event

        return bool(should_log_event())
    except Exception:
        return False


def _get_distinct_id():
    # type: () -> str
    """Anonymous distinct_id = the SAME profile.yml user_id Amplitude uses.

    uuid4 hex (normal) / sha256-of-codespace (Codespaces), with a `_CI` suffix
    when running in CI (mirrors collector._get_user_id + capture_exception). (D6)
    """
    try:
        import recce
        from recce.event import load_user_profile

        uid = load_user_profile().get("user_id")
        if recce.is_ci_env() is True:
            uid = f"{uid}_CI"
        return uid or "unknown"
    except Exception:
        return "unknown"


def anonymize(value):
    # type: (str) -> str
    """Hash sensitive data (16-char prefix, mirrors recce_cloud).

    Provided ONLY for net-new hashing. Existing repository/branch/target_path
    props keep their full 64-char sha256 values computed at the call sites so
    recce-insight joins remain stable.
    """
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def get_common_properties():
    # type: () -> Dict[str, Any]
    """Props attached to every event (the user_properties Amplitude flattened).

    PostHog has no separate user_properties bucket, so these are flattened onto
    the event. runner_type / hashed repository / branch are per-call and merged
    at the call site, not here.
    """
    import recce
    import recce.github

    return {
        "event_source": EVENT_SOURCE,
        "version": recce.get_version(),
        "python_version": "{}.{}".format(sys.version_info.major, sys.version_info.minor),
        "is_ci": recce.is_ci_env(),
        "is_github_codespace": recce.github.is_github_codespace(),
        "is_recce_cloud_instance": recce.is_recce_cloud_instance(),
        "os_platform": sys.platform,
        "os_version": platform.platform(),
        "user_id": _get_distinct_id(),
    }


def track(event, properties=None):
    # type: (str, Optional[Dict[str, Any]]) -> None
    """Capture a PostHog event. No-op if disabled / no client. Never raises."""
    if _is_kill_switched():
        return
    try:
        client = _get_client()
        if client is None:
            return
        all_props = get_common_properties()
        all_props.update(properties or {})
        # Manage identity ourselves via distinct_id + the user_id property;
        # do NOT create PostHog person rows for anonymous CLI users (D6).
        all_props["$process_person_profile"] = False
        client.capture(
            distinct_id=_get_distinct_id(),
            event=event,
            properties=all_props,
        )
    except Exception as e:
        logger.debug("PostHog track error: %s", e)


def _get_client():
    # type: () -> Any
    """Lazy singleton PostHog client. Returns None (graceful no-op) when
    kill-switched, opted out, no key, or the posthog import/init fails."""
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True

    if _is_kill_switched():
        return None

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
            # OSS CLI runs on the end-user's machine, so the request IP is the
            # real user's — enable geoip so PostHog resolves `country` (parity
            # with what Amplitude captured, powers recce-insight country_distribution).
            # (recce_cloud sets this True because there events come from the backend,
            # where the IP is the server's and geo would be meaningless.)
            disable_geoip=False,
        )
        atexit.register(shutdown)
        return _client
    except Exception as e:
        logger.debug("PostHog init failed: %s", e)
        return None


def shutdown():
    # type: () -> None
    """Flush pending events and stop background threads (CLI exit / flush hook)."""
    global _client
    if _client:
        try:
            _client.shutdown()
        except Exception:
            pass
        _client = None
