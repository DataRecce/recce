import os
import re
import sys
import threading
import uuid

import sentry_sdk

from recce import is_ci_env, get_version
from recce import yaml as pyml
from recce.event.collector import Collector

USER_HOME = os.path.expanduser('~')
RECCE_USER_HOME = os.path.join(USER_HOME, '.recce')
RECCE_USER_PROFILE = os.path.join(RECCE_USER_HOME, 'profile.yml')
RECCE_USER_EVENT_PATH = os.path.join(RECCE_USER_HOME, '.unsend_events.json')

__version__ = get_version()
_collector = Collector()
user_profile_lock = threading.Lock()


def init():
    api_key = _get_api_key()
    user_profile = load_user_profile()

    # Amplitude init
    _collector.set_api_key(api_key)
    _collector.set_user_id(user_profile.get('user_id'))
    _collector.set_unsend_events_file(RECCE_USER_EVENT_PATH)

    # Sentry init
    sentry_env = _get_sentry_env()
    sentry_dns = _get_sentry_dns()
    release_version = __version__ if sentry_env != 'development' else None
    sentry_sdk.init(
        dsn=sentry_dns,
        environment=sentry_env,
        release=release_version,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0
    )
    sentry_sdk.set_tag('recce.version', __version__)
    sentry_sdk.set_tag('platform', sys.platform)
    sentry_sdk.set_tag('is_ci_env', is_ci_env())


def get_user_id():
    return load_user_profile().get('user_id')


def is_anonymous_tracking():
    return load_user_profile().get('anonymous_tracking', False)


def _get_sentry_dns():
    dns_file = os.path.normpath(os.path.join(os.path.dirname(__file__), 'SENTRY_DNS'))
    with open(dns_file) as f:
        dns = f.read().strip()
        return dns


def _get_sentry_env():
    if '.dev' in __version__:
        return 'development'
    elif re.match(r'^\d+\.\d+\.\d+\.\d{8}[a|b|rc]?.*$', __version__):
        return 'nightly'
    elif 'a' in __version__:
        return 'alpha'
    elif 'b' in __version__:
        return 'beta'
    elif 'rc' in __version__:
        return 'release-candidate'
    return 'production'


def _get_api_key():
    if os.getenv('RECCE_EVENT_API_KEY'):
        # For local testing purpose
        return os.getenv('RECCE_EVENT_API_KEY')

    config_file = os.path.abspath(os.path.join(os.path.dirname(__file__), 'CONFIG'))
    try:
        with open(config_file) as fh:
            config = pyml.load(fh)
            return config.get('event_api_key')
    except Exception:
        return None


def _generate_user_profile():
    try:
        os.makedirs(RECCE_USER_HOME, exist_ok=True)
    except Exception:
        # TODO: should show warning message but not raise exception
        print('Please disable command tracking to continue.')
        exit(1)

    user_id = uuid.uuid4().hex
    with open(RECCE_USER_PROFILE, 'w+') as f:
        pyml.dump({'user_id': user_id, 'anonymous_tracking': True}, f)
    return dict(user_id=user_id, anonymous_tracking=True)


def load_user_profile():
    with user_profile_lock:
        if not os.path.exists(RECCE_USER_PROFILE):
            user_profile = _generate_user_profile()
        else:
            with open(RECCE_USER_PROFILE, 'r') as f:
                user_profile = pyml.load(f)
                if user_profile.get('user_id') is None:
                    user_profile = _generate_user_profile()

        return user_profile


def update_user_profile(update_values):
    original = load_user_profile()
    original.update(update_values)
    with open(RECCE_USER_PROFILE, 'w+') as f:
        pyml.dump(original, f)
    return original


def flush_events(command=None):
    _collector.send_events()


def log_event(prop, event_type, **kwargs):
    with open(RECCE_USER_PROFILE, 'r') as f:
        user_profile = pyml.load(f)
    # TODO: default anonymous_tracking to false if field is not present
    tracking = user_profile.get('anonymous_tracking', False)
    tracking = tracking and isinstance(tracking, bool)
    if not tracking:
        return

    if not _collector.is_ready():
        return

    payload = dict(
        **prop,
    )
    _collector.log_event(payload, event_type)


def capture_exception(e):
    user_id = load_user_profile().get('user_id')
    if is_ci_env() is True:
        user_id = f"{user_id}_CI"

    sentry_sdk.set_tag("user_id", user_id)
    sentry_sdk.capture_exception(e)


def flush_exceptions():
    sentry_sdk.flush()


def set_exception_tag(key, value):
    sentry_sdk.set_tag(key, value)
