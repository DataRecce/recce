"""Regression tests for DRC-5335 (REC-01): server-mode allowlist, POST /api/import
hardening, and sandboxing of imported dbt manifests.

Written first (reproduce stage): every test below is expected to FAIL until the
fix lands, for the reason stated in its docstring.
"""

import copy
import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from recce.core import default_context
from recce.server import app, enforce_server_mode

# noinspection PyUnresolvedReferences
from tests.adapter.dbt_adapter.conftest import dbt_test_helper  # noqa: F401

CSRF_HEADER = {"X-Recce-Request": "1"}
EVIL_MACRO_ID = "macro.recce_test.evil_canary"


# ---------------------------------------------------------------------------
# 1. enforce_server_mode: import / sync / connect / share / cloud writes
# ---------------------------------------------------------------------------


def _gated_client(flag):
    """Tiny app wearing the real middleware, with stub routes that answer 200."""
    gated = FastAPI()
    gated.state.flag = flag
    gated.middleware("http")(enforce_server_mode)

    for path in (
        "/api/import",
        "/api/sync",
        "/api/connect",
        "/api/share",
        "/api/cloud/upload",
        "/api/cloud/warehouse-setup",
    ):
        gated.add_api_route(path, lambda: {"reached": True}, methods=["POST"])
    gated.add_api_route("/api/sync", lambda: {"status": "idle"}, methods=["GET"])
    return TestClient(gated)


MODES = [
    pytest.param({"read_only": True}, id="read-only"),
    pytest.param({"preview": True}, id="preview"),
]
STATE_CHANGING_POSTS = [
    "/api/import",
    "/api/sync",
    "/api/connect",
    "/api/share",
    "/api/cloud/upload",
    "/api/cloud/warehouse-setup",
]


@pytest.mark.parametrize("flag", MODES)
@pytest.mark.parametrize("path", STATE_CHANGING_POSTS)
def test_mode_blocks_import_sync_connect_share_cloud_writes(flag, path):
    """Fails today with 200: these routes are absent from the deny-list in
    recce/server.py::_mode_block_reason, so the handler is reached."""
    response = _gated_client(flag).post(path, json={})
    assert response.status_code == 403, response.text
    assert "not allowed" in response.json()["detail"]


@pytest.mark.parametrize("flag", MODES)
def test_mode_keeps_sync_status_poll_readable(flag):
    """Control (passes today and must keep passing): GET /api/sync is a status poll."""
    assert _gated_client(flag).get("/api/sync").status_code == 200


@pytest.mark.parametrize("flag", MODES)
def test_mode_denies_unlisted_post_route_by_default(flag):
    """Allowlist semantics. Fails today with 404-not-403 ordering: an unknown
    state-mutating POST passes the middleware (deny-list) instead of being refused."""
    client = _gated_client(flag)
    client.app.add_api_route("/api/future-write", lambda: {"reached": True}, methods=["POST"])
    assert client.post("/api/future-write", json={}).status_code == 403


# ---------------------------------------------------------------------------
# 2. POST /api/import: CSRF header + upload size cap
# ---------------------------------------------------------------------------


def _state_bytes(padding: int = 0) -> bytes:
    from recce.state import RecceState

    raw = RecceState().to_json()
    return raw.encode() + b" " * padding


def _post_import(client, content: bytes, headers=None, checks_only="true"):
    return client.post(
        "/api/import",
        files={"file": ("recce_state.json", content, "application/json")},
        data={"checks_only": checks_only},
        headers=headers or {},
    )


@pytest.fixture
def import_client(dbt_test_helper, monkeypatch):  # noqa: F811
    # checks_only=true schedules context.sync_state("overwrite"); keep it off disk/cloud.
    context = default_context()
    monkeypatch.setattr(context, "sync_state", lambda *a, **k: None)
    monkeypatch.setattr(
        context, "state_loader", SimpleNamespace(cloud_mode=False, state_file="state.json"), raising=False
    )
    app.state.last_activity = None
    app.state.flag = {}
    return TestClient(app)


def test_import_with_csrf_header_is_accepted(import_client):
    """Control (passes today and after the fix): the legitimate UI call shape."""
    response = _post_import(import_client, _state_bytes(), headers=CSRF_HEADER)
    assert response.status_code == 200, response.text


def test_import_without_x_recce_request_is_rejected(import_client):
    """Fails today with 200: a cross-site multipart simple request needs no custom
    header, and import_handler never checks for one (recce/server.py:945)."""
    response = _post_import(import_client, _state_bytes())
    assert response.status_code == 403, response.text


def test_import_over_size_cap_is_rejected(import_client, monkeypatch):
    """Fails today with 200: import_handler does `await file.read()` with no cap.

    The fix is expected to expose the cap as recce.server.MAX_IMPORT_BYTES; the
    attribute is set with raising=False so the failure today is the missing
    enforcement (200), not a missing name."""
    import recce.server as server

    monkeypatch.setattr(server, "MAX_IMPORT_BYTES", 1024, raising=False)
    response = _post_import(import_client, _state_bytes(padding=8 * 1024), headers=CSRF_HEADER)
    assert response.status_code == 413, response.text


def test_state_mutating_routes_require_csrf_header(import_client):
    """Plan item 2 covers all state-mutating POST/PATCH/DELETE routes. Fails today
    with 200: /api/save is reachable without X-Recce-Request."""
    response = import_client.post("/api/save")
    assert response.status_code == 403, response.text


# ---------------------------------------------------------------------------
# 3. Imported manifests must not execute manifest.macros
# ---------------------------------------------------------------------------


@pytest.fixture
def imported_evil_state(dbt_test_helper, monkeypatch):  # noqa: F811
    """Import (via the API) a state whose manifest carries an attacker macro that a
    model's raw_code invokes. Records every dbt macro invocation."""
    helper = dbt_test_helper
    helper.create_model(
        "evil_model",
        curr_sql="select 1 as id",
        base_sql="select 1 as id",
        curr_columns={"id": "integer"},
        base_columns={"id": "integer"},
    )
    context = helper.context
    adapter = context.adapter
    monkeypatch.setattr(context, "sync_state", lambda *a, **k: None)

    artifacts = adapter.export_artifacts()
    # Catalogs from the helper are tz-naive; only manifests matter here.
    artifacts.base["catalog"] = None
    artifacts.current["catalog"] = None
    future = datetime(2099, 1, 1, tzinfo=timezone.utc).isoformat()
    for env in (artifacts.base, artifacts.current):
        manifest = env["manifest"]
        manifest["metadata"]["generated_at"] = future
        template = copy.deepcopy(next(iter(manifest["macros"].values())))
        template.update(
            name="evil_canary",
            package_name="recce_test",
            unique_id=EVIL_MACRO_ID,
            macro_sql="{% macro evil_canary() %}1{% endmacro %}",
        )
        manifest["macros"][EVIL_MACRO_ID] = template
        for node in manifest["nodes"].values():
            if node["name"] == "evil_model":
                node["raw_code"] = "select {{ evil_canary() }} as id"
                node["compiled_code"] = None
                node["columns"] = {"id": {"name": "id", "description": "", "meta": {}, "tags": [], "constraints": []}}
        # Shadow the macro get_columns() dispatches to, so GET /api/models/{id} reaches it.
        shadow = copy.deepcopy(template)
        shadow.update(
            name="get_columns_in_relation",
            unique_id="macro.recce_test.get_columns_in_relation",
            macro_sql="{% macro get_columns_in_relation(relation) %}{{ evil_canary() }}{{ return([]) }}{% endmacro %}",
        )
        manifest["macros"][shadow["unique_id"]] = shadow

    from recce.state import RecceState

    state = RecceState(artifacts=artifacts)

    invoked = []
    from dbt.clients import jinja

    original_call = jinja.MacroGenerator.__call__

    def spy(self, *args, **kwargs):
        invoked.append(getattr(self.macro, "unique_id", None))
        return original_call(self, *args, **kwargs)

    monkeypatch.setattr(jinja.MacroGenerator, "__call__", spy)

    app.state.last_activity = None
    app.state.flag = {"disable_cll_cache": True}
    client = TestClient(app)
    response = _post_import(client, state.to_json().encode(), headers=CSRF_HEADER, checks_only="false")
    assert response.status_code == 200, response.text
    invoked.clear()
    return client, invoked, adapter


def test_imported_manifest_macros_are_not_installed(imported_evil_state):
    """Fails today: import_artifacts replaces self.manifest (incl. macros) with the
    imported one (dbt_adapter/__init__.py:2303), so the attacker macro is live."""
    _, _, adapter = imported_evil_state
    assert EVIL_MACRO_ID not in adapter.manifest.macros


def test_cll_on_imported_state_never_executes_manifest_macros(imported_evil_state):
    """Fails today: get_cll_cached -> generate_sql(safe_template=False) renders raw_code
    against the imported macros (dbt_adapter/__init__.py:1902)."""
    client, invoked, _ = imported_evil_state
    response = client.post(
        "/api/cll",
        json={"node_id": "evil_model", "no_upstream": False, "no_downstream": False},
        headers=CSRF_HEADER,
    )
    assert response.status_code == 200, response.text
    assert EVIL_MACRO_ID not in invoked


def test_get_model_on_imported_state_never_executes_manifest_macros(imported_evil_state):
    """Fails today: GET /api/models/{id} -> get_columns -> adapter.execute_macro
    resolved against imported manifest.macros (dbt_adapter/__init__.py:482-485)."""
    client, invoked, adapter = imported_evil_state
    client.get("/api/models/evil_model")
    assert EVIL_MACRO_ID not in invoked
    assert all(not (m or "").startswith("macro.recce_test.evil") for m in invoked)
    assert json.dumps(list(adapter.manifest.macros)).count("evil_canary") == 0
