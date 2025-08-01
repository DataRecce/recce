import json
import os
import platform
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from json import JSONDecodeError

import portalocker
import requests

from recce import __version__, is_ci_env
from recce.github import is_github_codespace


class Collector:
    def __init__(self):
        self._api_endpoint = "https://api.amplitude.com/2/httpapi"
        self._api_key = None
        self._user_id = None

        self._unsend_events_file = None
        self._delete_threshold = 1000
        self._upload_threshold = 10
        self._is_ci: bool = is_ci_env()
        self._is_github_codespace: bool = is_github_codespace()
        self._flush_timer = None

    def schedule_flush(self):
        def _callback():
            self._flush_timer = None
            self.send_events()

        # send async thread
        import threading

        if self._flush_timer:
            try:
                self._flush_timer.cancel()
            except Exception:
                # do nothing
                pass
        self._flush_timer = threading.Timer(1, _callback)
        self._flush_timer.start()

    def is_ready(self):
        if self._api_key is None or self._user_id is None:
            return False
        return True

    def set_api_key(self, api_key):
        self._api_key = api_key

    def set_user_id(self, user_id):
        self._user_id = user_id

    def set_unsend_events_file(self, unsend_events_file):
        self._unsend_events_file = unsend_events_file
        self._check_required_files()

    def _log_event(
        self,
        user_id,
        event_type,
        created_at,
        user_properties,
        event_properties,
    ):
        event = dict(
            user_id=user_id,
            event_type=event_type,
            ip="$remote",
            time=int(time.mktime(created_at.timetuple())),
            user_properties=user_properties,
            event_properties=event_properties,
            platform=sys.platform,
            os_version=platform.platform(),
            app_version=__version__,
        )
        self._store_to_file(event)
        if self._is_full():
            self.send_events()
        self._cleanup_unsend_events()

    def _get_user_id(self):
        # when the recce is running in automation use cases
        # replace the user id with project_id to avoid so many unique user id
        user_id = self._user_id
        if self._is_ci is True:
            user_id = f"{self._user_id}_CI"
        return user_id

    def log_event(self, event_prop, event_type, event_triggered_at: datetime = None, user_properties=None):
        # Use local timezone
        if event_triggered_at is None:
            created_at = datetime.now()
        else:
            # Convert to UTC timezone
            created_at = event_triggered_at.astimezone(timezone.utc)
        python_version = f"{sys.version_info.major}.{sys.version_info.minor}"

        # when the recce is running in automation use cases
        # replace the user id with project_id to avoid so many unique user id
        user_id = self._get_user_id()

        default_user_properties = dict(
            version=__version__,
            python_version=python_version,
            is_ci=self._is_ci,
            is_github_codespace=self._is_github_codespace,
        )

        if user_properties is not None:
            default_user_properties.update(user_properties)

        self._log_event(
            user_id=user_id,
            event_type=event_type,
            created_at=created_at,
            user_properties=default_user_properties,
            event_properties=event_prop,
        )

    def _check_required_files(self):
        user_home = os.path.dirname(self._unsend_events_file)
        if not os.path.exists(user_home):
            os.makedirs(user_home, exist_ok=True)
        if not os.path.exists(self._unsend_events_file):
            with portalocker.Lock(self._unsend_events_file, "w+", timeout=5) as f:
                f.write(json.dumps({"unsend_events": []}))

    def _is_full(self):
        with portalocker.Lock(self._unsend_events_file, "r+", timeout=5) as f:
            o = json.loads(f.read())
            return len(o.get("unsend_events", [])) >= self._upload_threshold

    @contextmanager
    def load_json(self):
        with portalocker.Lock(self._unsend_events_file, "r+", timeout=5) as f:
            o = None
            try:
                o = json.loads(f.read())
                yield o
            except JSONDecodeError:
                o = dict(unsend_events=[])
                yield o
            finally:
                f.seek(0)
                f.truncate()
                if o is not None:
                    f.write(json.dumps(o))

    def send_events(self):
        with self.load_json() as o:
            payload = dict(
                api_key=self._api_key,
                events=o["unsend_events"],
            )
            o["unsend_events"] = []
        try:
            requests.post(self._api_endpoint, json=payload)
        except Exception:
            # TODO: handle exception when sending events
            pass

    def _store_to_file(self, event):
        with self.load_json() as o:
            events = o.get("unsend_events", None)
            if events is None:
                o["unsend_events"] = []

            o["unsend_events"].append(event)

    def _cleanup_unsend_events(self):
        with self.load_json() as o:
            events = o.get("unsend_events", None)
            if events is None:
                o["unsend_events"] = []

            while len(o["unsend_events"]) > self._delete_threshold:
                o["unsend_events"].pop(0)
