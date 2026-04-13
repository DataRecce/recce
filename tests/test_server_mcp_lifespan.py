"""Integration of MCP transport into the FastAPI lifespan."""

from unittest.mock import MagicMock

import pytest

pytest.importorskip("mcp")

from fastapi.testclient import TestClient  # noqa: E402

from recce.server import AppState  # noqa: E402


def test_app_state_has_mcp_fields():
    """AppState exposes mcp_server, mcp_session_manager, mcp_startup_error."""
    state = AppState()
    assert hasattr(state, "mcp_server")
    assert hasattr(state, "mcp_session_manager")
    assert hasattr(state, "mcp_startup_error")
    assert state.mcp_server is None
    assert state.mcp_session_manager is None
    assert state.mcp_startup_error is None


def test_mcp_disabled_returns_404(monkeypatch):
    """When --no-mcp is set (mcp_enabled=False), /mcp returns 404."""
    from recce import server as server_module

    app_state = AppState(
        command="server",
        state_loader=MagicMock(),
        kwargs={"mcp_enabled": False},
        flag={"single_env_onboarding": False},
        auth_options={},
    )
    fake_ctx = MagicMock()
    monkeypatch.setattr(server_module, "_do_lifespan_setup", lambda s: fake_ctx)
    server_module.app.state = app_state

    with TestClient(server_module.app) as client:
        r = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        assert r.status_code == 404
        body = r.json()
        assert "MCP disabled" in str(body)


def test_mcp_falls_back_to_503_when_startup_fails(monkeypatch):
    """If build_mcp_server raises during lifespan, /mcp returns 503; REST works."""
    from recce import server as server_module

    app_state = AppState(
        command="server",
        state_loader=MagicMock(),
        kwargs={"mcp_enabled": True},
        flag={"single_env_onboarding": False},
        auth_options={},
    )
    fake_ctx = MagicMock()
    monkeypatch.setattr(server_module, "_do_lifespan_setup", lambda s: fake_ctx)

    def boom(*args, **kwargs):
        raise RuntimeError("simulated MCP build failure")

    monkeypatch.setattr("recce.mcp_server.build_mcp_server", boom)
    server_module.app.state = app_state

    with TestClient(server_module.app) as client:
        # REST endpoint still works
        r = client.get("/api/health")
        assert r.status_code == 200
        # /mcp returns 503 with a JSON-RPC error envelope
        r = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        assert r.status_code == 503
        body = r.json()
        assert body.get("error", {}).get("code") == -32603
        assert "MCP" in body.get("error", {}).get("message", "")
