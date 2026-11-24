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
from sentry_sdk.integrations.logging import LoggingIntegration

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

    if not telemetry_enabled():
        # Opted out or kill-switched: drop anything queued while opted in, and
        # never start Sentry. An uninitialized Sentry SDK makes every
        # sentry_sdk.capture_* / metrics call a no-op.
        _collector.clear_events()
        return

    # Sentry init
    sentry_env = _get_sentry_env()
    if sentry_env == "development" and not _is_development_sentry_enabled():
        return

    from sentry_sdk.integrations.argv import ArgvIntegration

    sentry_dns = _get_sentry_dns()
    sentry_sdk.init(
        dsn=sentry_dns,
        environment=sentry_env,
        release=__version__,
        traces_sample_rate=1.0,
        attach_stacktrace=False,
        # The SDK defaults server_name to the machine's hostname.
        server_name="",
        # ArgvIntegration attaches sys.argv, which can carry --cloud-token,
        # --password or --api-token.
        disabled_integrations=[ArgvIntegration()],
        # Log lines carry warehouse error text and SQL (run_func logs the task
        # failure reason): no Sentry Logs, no events, no breadcrumbs.
        integrations=[LoggingIntegration(level=None, event_level=None, breadcrumb_level=None)],
        # Opt out of the additional data collected by default in Sentry SDK 3.
        data_collection={
            "user_info": False,
            "http_bodies": [],
            "http_headers": {"request": {"mode": "off"}},
            "cookies": {"mode": "off"},
            "url_query_params": {"mode": "off"},
            "graphql": {"document": False, "variables": False},
            "gen_ai": {"inputs": False, "outputs": False},
            "mcp": {"inputs": False, "outputs": False},
            "database_query_data": False,
            "queues": False,
            # DbtAdapter's dataclass repr includes the full manifests (several GB).
            "stack_frame_variables": False,
        },
        before_send=_scrub_sentry_event,
        before_send_span=_scrub_sentry_span,
    )
    sentry_sdk.set_tag("recce.version", __version__)
    sentry_sdk.set_tag("platform", sys.platform)
    sentry_sdk.set_tag("is_ci_env", is_ci_env())
    sentry_sdk.set_tag("is_github_codespace", is_github_codespace())
    sentry_sdk.set_tag("is_recce_cloud_instance", is_recce_cloud_instance())
    sentry_sdk.set_tag("system_timezone", get_system_timezone())


# Exceptions raised by dbt, warehouse drivers and SQL tooling carry the failing
# SQL and object names in their message. Sentry keeps their type and stack,
# never their text.
_WAREHOUSE_EXCEPTION_MODULES = (
    "dbt",
    "dbt_common",
    "dbt_adapters",
    "duckdb",
    "_duckdb",
    "snowflake",
    "psycopg",
    "google",
    "databricks",
    "redshift_connector",
    "trino",
    "pyathena",
    "sqlalchemy",
    "pyodbc",
    "pymssql",
    "clickhouse",
    "oracledb",
    "pymysql",
    "MySQLdb",
    "teradatasql",
    "pyspark",
    "pyhive",
    "agate",
    "sqlglot",
)
# Span attributes never sent. Sentry SDK 3 sets process.command_args to sys.argv
# on every segment span, regardless of ArgvIntegration, and argv can carry
# --cloud-token, --password or --api-token. server.address is the local
# server_name on every span and the warehouse host (which can name the
# account) on database/socket spans; the rest identify the machine.
_SPAN_DROPPED_ATTRIBUTES = (
    "process.command_args",
    "server.address",
    "server_name",
    "sentry.server_name",
    "host.name",
)
REDACTED_EXCEPTION_VALUE = "[redacted by recce: may contain SQL or warehouse output]"
SENTRY_REDACT_TAG = "recce.redact_exception_value"


def _is_warehouse_exception(exc_value: dict) -> bool:
    module = exc_value.get("module") or ""
    return any(module == m or module.startswith(m + ".") for m in _WAREHOUSE_EXCEPTION_MODULES)


def _scrub_home(value):
    if isinstance(value, str):
        return value.replace(USER_HOME, "~") if USER_HOME and USER_HOME != "/" else value
    if isinstance(value, dict):
        return {k: _scrub_home(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub_home(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_scrub_home(v) for v in value)
    return value


def _scrub_sentry_event(sentry_event, hint):
    """Strip machine identity, home paths and warehouse text before sending."""
    try:
        sentry_event.pop("server_name", None)
        redact_all = (sentry_event.get("tags") or {}).get(SENTRY_REDACT_TAG) in (True, "true", "True")
        for exc_value in (sentry_event.get("exception") or {}).get("values") or []:
            if redact_all or _is_warehouse_exception(exc_value):
                exc_value["value"] = REDACTED_EXCEPTION_VALUE
        return _scrub_home(sentry_event)
    except Exception:
        # Never send an event we failed to scrub.
        return None


def _scrub_sentry_span(span, hint):
    """Strip argv, machine identity and home paths from a streamed span.

    The SDK cannot drop a span from this hook, so on failure return it
    unchanged rather than None (which the SDK also treats as "keep").
    """
    try:
        attributes = span.get("attributes")
        if isinstance(attributes, dict):
            for key in [k for k in attributes if k in _SPAN_DROPPED_ATTRIBUTES]:
                attributes.pop(key, None)
        return _scrub_home(span)
    except Exception:
        return span


def get_user_id():
    return load_user_profile().get("user_id")


def get_recce_api_token():
    return load_user_profile().get("api_token")


def update_recce_api_token(token):
    return update_user_profile({"api_token": token})


def is_anonymous_tracking():
    """Whether the user allows telemetry. Kept for existing callers; see telemetry_enabled()."""
    return telemetry_enabled()


_TRUTHY_ENV_VALUES = ("1", "true", "yes", "on")


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in _TRUTHY_ENV_VALUES


def is_telemetry_kill_switched() -> bool:
    """RECCE_DISABLE_TELEMETRY or the DO_NOT_TRACK convention turns off every
    telemetry path (Amplitude, Sentry, PostHog, and the browser via the cookie)."""
    return _env_flag("RECCE_DISABLE_TELEMETRY") or _env_flag("DO_NOT_TRACK")


def telemetry_enabled() -> bool:
    """Single source of truth for whether Recce may send telemetry.

    True only when no kill switch is set and profile.yml has
    ``anonymous_tracking: true`` (a real YAML boolean). Anything else, including
    ``no``/``off``/``"false"``, a missing key or a missing/unreadable profile,
    means off. Reads the file without creating it.
    """
    if is_telemetry_kill_switched():
        return False
    try:
        with user_profile_lock:
            with open(RECCE_USER_PROFILE, "r", encoding="utf-8") as f:
                user_profile = pyml.load(f)
    except Exception:
        return False
    if not isinstance(user_profile, dict):
        return False
    return user_profile.get("anonymous_tracking") is True


def _get_sentry_dns():
    dns_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "SENTRY_DNS"))
    with open(dns_file, encoding="utf-8") as f:
        dns = f.read().strip()
        return dns


def _is_development_sentry_enabled():
    """Opt in to Sentry in the development environment."""
    return os.environ.get("RECCE_ENABLE_SENTRY_IN_DEVELOPMENT", "").lower() in ("1", "true", "yes")


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


def _generate_user_profile(existing=None):
    """Write a profile with a fresh user_id, keeping any keys already present.

    A profile that only says ``anonymous_tracking: false`` must stay opted out.
    """
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
    user_profile = dict(existing) if isinstance(existing, dict) else {}
    user_profile["user_id"] = user_id
    user_profile.setdefault("anonymous_tracking", True)
    with open(RECCE_USER_PROFILE, "w+", encoding="utf-8") as f:
        pyml.dump(user_profile, f)
    return user_profile


def load_user_profile():
    with user_profile_lock:
        if not os.path.exists(RECCE_USER_PROFILE):
            user_profile = _generate_user_profile()
        else:
            with open(RECCE_USER_PROFILE, "r", encoding="utf-8") as f:
                user_profile = pyml.load(f)
                if not isinstance(user_profile, dict) or user_profile.get("user_id") is None:
                    user_profile = _generate_user_profile(user_profile)

        return user_profile


def update_user_profile(update_values):
    original = load_user_profile()
    original.update(update_values)
    with open(RECCE_USER_PROFILE, "w+", encoding="utf-8") as f:
        pyml.dump(original, f)
    return original


def flush_events(command=None):
    # Amplitude flush. send_events() never POSTs an empty queue; skip it
    # entirely when telemetry is off.
    if telemetry_enabled():
        _collector.send_events()

    # PostHog flush — mirror recce_cloud shutdown(); primary flush hook for the
    # short-lived CLI (atexit registered in _get_client is the safety net).
    try:
        from recce.event.posthog_telemetry import shutdown as _ph_shutdown

        _ph_shutdown()
    except Exception:
        pass


def should_log_event():
    if not telemetry_enabled():
        return False
    return _collector.is_ready()


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
    # The Amplitude emits below call the collector directly, bypassing
    # log_event's gate, so gate the whole function here.
    if not should_log_event():
        return

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
        _collector.log_event(prop, "codespace_instance", event_triggered_at=created_at, user_properties=user_prop)
        # PostHog mirror — flatten user_prop + event time.
        _ph_codespace(prop, user_prop, created_at)
        update_user_profile({"codespace_created_at": codespace.get("created_at")})

    # Codespace available event, send multiple times as start/stop it
    available_at = get_github_codespace_available_at(codespace)
    if available_at and available_at.isoformat() != load_user_profile().get("codespace_available_at"):
        prop["state"] = "available"
        _collector.log_event(prop, "codespace_instance", event_triggered_at=available_at, user_properties=user_prop)
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
