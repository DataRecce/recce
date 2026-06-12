import hashlib
import os
import re
import sys
import threading
import uuid
from datetime import datetime, timezone
from hashlib import sha256
from typing import Dict

import sentry_sdk

import recce
import recce.git
from recce import get_version, is_ci_env, is_recce_cloud_instance
from recce import yaml as pyml
from recce.event.collector import Collector
from recce.github import (
    get_github_codespace_available_at,
    get_github_codespace_info,
    get_github_codespace_name,
    is_github_codespace,
)

USER_HOME = os.path.expanduser("~")
RECCE_USER_HOME = os.path.join(USER_HOME, ".recce")
RECCE_USER_PROFILE = os.path.join(RECCE_USER_HOME, "profile.yml")
RECCE_USER_EVENT_PATH = os.path.join(RECCE_USER_HOME, ".unsend_events.json")

__version__ = get_version()
_collector = Collector()
user_profile_lock = threading.Lock()

# Amplitude event_type -> PostHog event name. Names not listed pass through
# unchanged (command / api_event / load_state / codespace_instance). Bracketed
# Amplitude names are flattened to snake_case; event_source="oss-cli"
# disambiguates against the Cloud project (P4 design / D-event-map).
_PH_EVENT_MAP = {
    "[Experiment] single_environment": "single_environment",
    "Connect OSS to Cloud": "oss_connect_to_cloud",
}


def init():
    api_key = _get_api_key()
    user_profile = load_user_profile()

    # Amplitude init
    _collector.set_api_key(api_key)
    _collector.set_user_id(user_profile.get("user_id"))
    _collector.set_unsend_events_file(RECCE_USER_EVENT_PATH)

    # Sentry init
    sentry_env = _get_sentry_env()
    sentry_dns = _get_sentry_dns()
    release_version = __version__ if sentry_env != "development" else None
    sentry_sdk.init(
        dsn=sentry_dns,
        environment=sentry_env,
        release=release_version,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
    )
    sentry_sdk.set_tag("recce.version", __version__)
    sentry_sdk.set_tag("platform", sys.platform)
    sentry_sdk.set_tag("is_ci_env", is_ci_env())
    sentry_sdk.set_tag("is_github_codespace", is_github_codespace())
    sentry_sdk.set_tag("is_recce_cloud_instance", is_recce_cloud_instance())
    sentry_sdk.set_tag("system_timezone", get_system_timezone())


def get_user_id():
    return load_user_profile().get("user_id")


def get_recce_api_token():
    return load_user_profile().get("api_token")


def update_recce_api_token(token):
    return update_user_profile({"api_token": token})


def is_anonymous_tracking():
    return load_user_profile().get("anonymous_tracking", False)


def _get_sentry_dns():
    dns_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "SENTRY_DNS"))
    with open(dns_file, encoding="utf-8") as f:
        dns = f.read().strip()
        return dns


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


def _get_api_key():
    if os.getenv("RECCE_EVENT_API_KEY"):
        # For local testing purpose
        return os.getenv("RECCE_EVENT_API_KEY")

    config_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "CONFIG"))
    try:
        with open(config_file, encoding="utf-8") as fh:
            config = pyml.load(fh)
            return config.get("event_api_key")
    except Exception:
        return None


def _generate_user_profile():
    try:
        os.makedirs(RECCE_USER_HOME, exist_ok=True)
    except Exception:
        # TODO: should show warning message but not raise exception
        print("Please disable command tracking to continue.")
        exit(1)
    if is_github_codespace() is True:
        salted_name = f"codespace-{get_github_codespace_name()}"
        user_id = hashlib.sha256(salted_name.encode()).hexdigest()
    else:
        user_id = uuid.uuid4().hex
    with open(RECCE_USER_PROFILE, "w+", encoding="utf-8") as f:
        pyml.dump({"user_id": user_id, "anonymous_tracking": True}, f)
    return dict(user_id=user_id, anonymous_tracking=True)


def load_user_profile():
    with user_profile_lock:
        if not os.path.exists(RECCE_USER_PROFILE):
            user_profile = _generate_user_profile()
        else:
            with open(RECCE_USER_PROFILE, "r", encoding="utf-8") as f:
                user_profile = pyml.load(f)
                if user_profile is None or user_profile.get("user_id") is None:
                    user_profile = _generate_user_profile()

        return user_profile


def update_user_profile(update_values):
    original = load_user_profile()
    original.update(update_values)
    with open(RECCE_USER_PROFILE, "w+", encoding="utf-8") as f:
        pyml.dump(original, f)
    return original


def flush_events(command=None):
    # Amplitude flush (unchanged).
    _collector.send_events()

    # PostHog flush — mirror recce_cloud shutdown(); primary flush hook for the
    # short-lived CLI (atexit registered in _get_client is the safety net).
    try:
        from recce.event.posthog_telemetry import shutdown as _ph_shutdown

        _ph_shutdown()
    except Exception:
        pass


def should_log_event():
    try:
        with open(RECCE_USER_PROFILE, "r", encoding="utf-8") as f:
            user_profile = pyml.load(f)
    except FileNotFoundError:
        return False
    # TODO: default anonymous_tracking to false if field is not present
    tracking = user_profile.get("anonymous_tracking", False)
    tracking = tracking and isinstance(tracking, bool)
    if not tracking:
        return False

    if not _collector.is_ready():
        return False

    return True


def log_event(prop, event_type, **kwargs):
    if should_log_event() is False:
        return

    repo = recce.git.hosting_repo()
    if repo is not None:
        prop["repository"] = sha256(repo.encode()).hexdigest()

    branch = recce.git.current_branch()
    if branch is not None:
        prop["branch"] = sha256(branch.encode()).hexdigest()

    runner = recce.get_runner()
    if runner is not None:
        prop["runner_type"] = runner

        if runner == "github codespaces":
            prop["codespaces_name"] = get_github_codespace_name()

    payload = dict(
        **prop,
    )

    # Amplitude path (unchanged).
    _collector.log_event(payload, event_type)

    # PostHog mirror (dual-write). The should_log_event() gate above guards both
    # paths identically (D5). PostHog reuses the SAME hashed repository/branch
    # values already in payload. The **kwargs (e.g. params=ctx.params) are
    # intentionally NOT forwarded — they can carry unhashed paths.
    if not event_type.startswith("[Performance] "):
        # [Performance] events are emitted to PostHog explicitly as a single
        # 'performance' event (D9) by log_performance — skip the generic
        # passthrough here to avoid a double-fire.
        try:
            from recce.event.posthog_telemetry import track as _ph_track

            _ph_event = _PH_EVENT_MAP.get(event_type, event_type)
            _ph_track(_ph_event, dict(payload))
        except Exception:
            pass


def log_api_event(endpoint_name, prop):
    prop = dict(
        **prop,
        endpoint_name=endpoint_name,
    )
    log_event(prop, "api_event")
    _collector.schedule_flush()


def log_load_state(command="server", single_env=False):
    from recce.models import CheckDAO

    checks = 0
    preset_checks = 0

    for check in CheckDAO().list():
        checks += 1
        if check.is_preset:
            preset_checks += 1

    prop = dict(
        command=command,
        checks=checks,
        preset_checks=preset_checks,
    )

    if command == "server":
        prop["single_env"] = single_env

    log_event(prop, "load_state")
    if command == "server":
        _collector.schedule_flush()


def log_codespaces_events(command):
    # Only log when the recce is running in GitHub Codespaces
    codespace = get_github_codespace_info()
    if codespace is None:
        return

    user_prop = dict(
        location=codespace.get("location"),
        is_prebuild=codespace.get("prebuild", False),
    )

    prop = dict(
        machine=codespace.get("machine", {}).get("display_name"),
        codespaces_name=get_github_codespace_name(),
    )

    # Codespace created event, send once
    codespace_created_at = load_user_profile().get("codespace_created_at")
    if codespace_created_at is None:
        created_at = datetime.fromisoformat(codespace.get("created_at"))
        prop["state"] = "created"
        # Amplitude direct emit (unchanged) — bypasses the log_event gate.
        _collector.log_event(prop, "codespace_instance", event_triggered_at=created_at, user_properties=user_prop)
        # PostHog mirror — this path does NOT go through log_event's gate, so
        # re-gate with should_log_event() and flatten user_prop + event time.
        if should_log_event():
            _ph_codespace(prop, user_prop, created_at)
        update_user_profile({"codespace_created_at": codespace.get("created_at")})

    # Codespace available event, send multiple times as start/stop it
    available_at = get_github_codespace_available_at(codespace)
    if available_at and available_at.isoformat() != load_user_profile().get("codespace_available_at"):
        prop["state"] = "available"
        # Amplitude direct emit (unchanged).
        _collector.log_event(prop, "codespace_instance", event_triggered_at=available_at, user_properties=user_prop)
        # PostHog mirror (re-gated).
        if should_log_event():
            _ph_codespace(prop, user_prop, available_at)
        update_user_profile({"codespace_available_at": available_at.isoformat()})

    # Codespace instance event should be flushed immediately
    _collector.send_events()


def _ph_codespace(prop, user_prop, event_triggered_at):
    # PostHog has no user_properties bucket — flatten user_prop + the event time
    # (ISO-8601 string) onto the event props.
    try:
        from recce.event.posthog_telemetry import track as _ph_track

        _ph_track(
            "codespace_instance",
            {
                **prop,
                **user_prop,
                "event_triggered_at": event_triggered_at.isoformat(),
            },
        )
    except Exception:
        pass


def log_single_env_event():
    prop = dict(
        action="launch_server",
    )
    log_event(prop, "[Experiment] single_environment")
    _collector.schedule_flush()


def log_performance(feature_name: str, metrics: Dict):
    prop = metrics
    # Amplitude builds a dynamic '[Performance] {feature_name}' event type (unchanged).
    log_event(prop, f"[Performance] {feature_name}")
    _collector.schedule_flush()

    # PostHog (D9): a SINGLE 'performance' event with a `feature` property +
    # flattened metrics. The generic _PH_EVENT_MAP can't synthesize `feature`
    # from the interpolated name, so emit explicitly here. This path's Amplitude
    # emit went through log_event's gate; re-gate the PostHog emit too so it
    # no-ops exactly when log_event would have.
    if should_log_event():
        try:
            from recce.event.posthog_telemetry import track as _ph_track

            _ph_track("performance", {"feature": feature_name, **metrics})
        except Exception:
            pass


def log_connected_to_cloud():
    log_event({"action": "connected_to_cloud"}, "Connect OSS to Cloud")
    _collector.schedule_flush()


def capture_exception(e):
    user_id = load_user_profile().get("user_id")
    if is_ci_env() is True:
        user_id = f"{user_id}_CI"

    sentry_sdk.set_tag("user_id", user_id)
    sentry_sdk.capture_exception(e)


def flush_exceptions():
    sentry_sdk.flush()


def set_exception_tag(key, value):
    sentry_sdk.set_tag(key, value)


def get_system_timezone():
    return datetime.now(timezone.utc).astimezone().tzinfo
