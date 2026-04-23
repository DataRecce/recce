"""End-to-end coexistence test: REST + MCP work together in the merged server."""

from contextlib import asynccontextmanager
from unittest.mock import MagicMock

import pytest

pytest.importorskip("mcp")

from fastapi.testclient import TestClient  # noqa: E402
from starlette.responses import JSONResponse  # noqa: E402
from starlette.routing import Route  # noqa: E402

from recce.server import AppState  # noqa: E402


class _FakeSessionManager:
    """Stand-in for StreamableHTTPSessionManager that does nothing on lifespan enter/exit."""

    @asynccontextmanager
    async def run(self):
        yield


@pytest.fixture(autouse=True)
def _restore_app_routes():
    """Restore app.routes to its original snapshot after each test.

    The first test injects a fake /mcp Route at position 0; without cleanup
    that leftover route would shadow the fallback handler in subsequent tests.
    """
    from recce import server as server_module

    # Snapshot the list contents (shallow copy of the list; Route objects are unchanged).
    original_routes = list(server_module.app.routes)
    yield
    # Replace the list contents in-place so the same list object is preserved.
    server_module.app.routes[:] = original_routes


def test_merged_server_rest_and_mcp_coexist(monkeypatch):
    """REST and MCP both respond when MCP is successfully mounted."""
    from recce import server as server_module

    # 1) Patch context loading to avoid needing a real dbt project.
    monkeypatch.setattr(server_module, "_do_lifespan_setup", lambda s: MagicMock())

    # 2) Stub build_mcp_server so we don't need a real MCP server either.
    monkeypatch.setattr("recce.mcp_server.build_mcp_server", lambda *a, **kw: MagicMock())

    # 3) Replace attach_mcp_to_fastapi with a stub that inserts a marker route
    #    at app.routes[0]. This simulates a successful MCP mount and lets us
    #    verify the route shadows the /mcp fallback handler.
    async def _mcp_marker(_request):
        return JSONResponse({"mcp": "ok"})

    def _fake_attach(app, rmcp, prefix="/mcp"):
        # Insert a marker route at position 0 so it shadows the /mcp fallback.
        app.routes.insert(0, Route(prefix, endpoint=_mcp_marker, methods=["POST"]))
        return _FakeSessionManager()

    monkeypatch.setattr("recce.mcp_transport.attach_mcp_to_fastapi", _fake_attach)

    # 4) Configure app state with MCP enabled.
    app_state = AppState(
        command="server",
        state_loader=MagicMock(),
        kwargs={"mcp_enabled": True},
        flag={"single_env_onboarding": False},
        auth_options={},
    )
    server_module.app.state = app_state

    # 5) Run the app through the lifespan and hit both endpoints.
    with TestClient(server_module.app) as client:
        # REST endpoint responds.
        r_rest = client.get("/api/health")
        assert r_rest.status_code == 200

        # MCP mount responds with our marker payload (not the 503 fallback).
        r_mcp = client.post("/mcp")
        assert r_mcp.status_code == 200, f"Expected 200 from mounted MCP, got {r_mcp.status_code}: {r_mcp.text}"
        assert r_mcp.json() == {"mcp": "ok"}

    # 6) After lifespan exit, the session manager should have been populated.
    assert app_state.mcp_session_manager is not None, "MCP did not mount successfully"


def test_merged_server_mcp_failure_does_not_kill_rest(monkeypatch):
    """A thrown error during MCP mount leaves REST fully functional."""
    from recce import server as server_module

    monkeypatch.setattr(server_module, "_do_lifespan_setup", lambda s: MagicMock())

    def _attach_raises(*args, **kwargs):
        raise RuntimeError("simulated attach failure")

    monkeypatch.setattr("recce.mcp_server.build_mcp_server", lambda *a, **kw: MagicMock())
    monkeypatch.setattr("recce.mcp_transport.attach_mcp_to_fastapi", _attach_raises)

    app_state = AppState(
        command="server",
        state_loader=MagicMock(),
        kwargs={"mcp_enabled": True},
        flag={"single_env_onboarding": False},
        auth_options={},
    )
    server_module.app.state = app_state

    with TestClient(server_module.app) as client:
        # REST is unaffected.
        assert client.get("/api/health").status_code == 200
        # MCP returns the 503 envelope from the fallback handler.
        r = client.post("/mcp")
        assert r.status_code == 503
        body = r.json()
        assert body["error"]["code"] == -32603

    # The state loader should have captured the error message.
    assert "simulated attach failure" in (app_state.mcp_startup_error or "")
