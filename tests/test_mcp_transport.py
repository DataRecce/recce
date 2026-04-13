"""Tests for recce.mcp_transport — transport adapters for the MCP server."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytest.importorskip("mcp")


@pytest.mark.asyncio
async def test_run_mcp_stdio_calls_server_run_with_stdio_streams():
    """run_mcp_stdio wires stdio_server() streams into mcp.Server.run()."""
    from recce.mcp_transport import run_mcp_stdio

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.server.run = AsyncMock()
    mock_rmcp.server.create_initialization_options = MagicMock(return_value={"opt": True})
    mock_rmcp.state_loader = None
    mock_rmcp.context = None

    fake_read = MagicMock()
    fake_write = MagicMock()

    class FakeStdioCM:
        async def __aenter__(self):
            return (fake_read, fake_write)

        async def __aexit__(self, *args):
            return False

    with patch("recce.mcp_transport.stdio_server", return_value=FakeStdioCM()):
        await run_mcp_stdio(mock_rmcp)

    mock_rmcp.server.run.assert_awaited_once_with(fake_read, fake_write, {"opt": True})


@pytest.mark.asyncio
async def test_run_mcp_stdio_exports_state_on_shutdown():
    """When state_loader and context are present, state is exported in finally."""
    from recce.mcp_transport import run_mcp_stdio

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.server.run = AsyncMock()
    mock_rmcp.server.create_initialization_options = MagicMock(return_value={})
    mock_state_loader = MagicMock()
    mock_state_loader.export.return_value = None
    mock_state_loader.state_file = None
    mock_context = MagicMock()
    mock_context.export_state.return_value = {"state": "data"}
    mock_rmcp.state_loader = mock_state_loader
    mock_rmcp.context = mock_context

    class FakeStdioCM:
        async def __aenter__(self):
            return (MagicMock(), MagicMock())

        async def __aexit__(self, *args):
            return False

    with patch("recce.mcp_transport.stdio_server", return_value=FakeStdioCM()):
        await run_mcp_stdio(mock_rmcp)

    mock_state_loader.export.assert_called_once_with({"state": "data"})


def test_run_mcp_sse_legacy_starlette_routes_present():
    """The legacy SSE app exposes /sse, /messages/*, and /health."""
    from recce.mcp_transport import _build_legacy_sse_app

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.context = None
    mock_rmcp.state_loader = None
    mock_rmcp.mcp_logger = MagicMock()
    mock_rmcp.mcp_logger.debug = False

    app = _build_legacy_sse_app(mock_rmcp)

    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/sse" in paths
    assert "/health" in paths
    # Starlette normalizes Mount("/messages/", ...) to .path == "/messages"
    mount_paths = {getattr(r, "path", None) for r in app.routes if getattr(r, "name", None) is None}
    assert "/messages" in mount_paths


def test_attach_mcp_to_fastapi_mounts_prefix_and_returns_session_manager():
    """attach_mcp_to_fastapi mounts /mcp and returns the session manager."""
    from fastapi import FastAPI

    from recce.mcp_transport import attach_mcp_to_fastapi

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.context = None
    mock_rmcp.state_loader = None
    mock_rmcp.mcp_logger = MagicMock()
    mock_rmcp.mcp_logger.debug = False

    app = FastAPI()
    session_manager = attach_mcp_to_fastapi(app, mock_rmcp, prefix="/mcp")

    # The session manager comes back so the caller can drive its lifecycle.
    assert session_manager is not None
    assert hasattr(session_manager, "run")  # async context manager method

    # /mcp Mount is wired
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/mcp" in paths


def test_attach_mcp_to_fastapi_inner_routes_present():
    """Inside the /mcp mount, the streamable, sse, and messages routes exist."""
    from fastapi import FastAPI

    from recce.mcp_transport import attach_mcp_to_fastapi

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.context = None
    mock_rmcp.state_loader = None
    mock_rmcp.mcp_logger = MagicMock()
    mock_rmcp.mcp_logger.debug = False

    app = FastAPI()
    attach_mcp_to_fastapi(app, mock_rmcp, prefix="/mcp")

    # Find the /mcp Mount and inspect inner routes
    mcp_mount = next(r for r in app.routes if getattr(r, "path", None) == "/mcp")
    inner_paths = [getattr(r, "path", None) for r in mcp_mount.app.routes]
    # All three transports must be present:
    #   /sse       — legacy SSE stream (Route)
    #   /messages  — legacy SSE message channel (Mount; Starlette strips the trailing slash)
    #   ""         — Streamable HTTP catch-all (Mount("/") normalizes to "")
    assert "/sse" in inner_paths
    assert "/messages" in inner_paths
    assert "" in inner_paths, "Streamable HTTP catch-all Mount('/') is missing"
    # Order matters for first-match routing: specific paths BEFORE the catch-all.
    assert inner_paths.index("/sse") < inner_paths.index("")
    assert inner_paths.index("/messages") < inner_paths.index("")


# ---------------------------------------------------------------------------
# Coverage tests for branches missed by the smoke tests above
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_mcp_stdio_export_msg_not_none_branch():
    """When state_loader.export returns a non-None message, it's printed."""
    from recce.mcp_transport import run_mcp_stdio

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.server.run = AsyncMock()
    mock_rmcp.server.create_initialization_options = MagicMock(return_value={})
    mock_state_loader = MagicMock()
    mock_state_loader.export.return_value = "exported to cloud"
    mock_context = MagicMock()
    mock_context.export_state.return_value = {"data": 1}
    mock_rmcp.state_loader = mock_state_loader
    mock_rmcp.context = mock_context

    class FakeStdioCM:
        async def __aenter__(self):
            return (MagicMock(), MagicMock())

        async def __aexit__(self, *args):
            return False

    with patch("recce.mcp_transport.stdio_server", return_value=FakeStdioCM()):
        await run_mcp_stdio(mock_rmcp)

    mock_state_loader.export.assert_called_once_with({"data": 1})


@pytest.mark.asyncio
async def test_run_mcp_stdio_export_with_state_file_branch():
    """When export returns None and state_file is set, the file path is printed."""
    from recce.mcp_transport import run_mcp_stdio

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.server.run = AsyncMock()
    mock_rmcp.server.create_initialization_options = MagicMock(return_value={})
    mock_state_loader = MagicMock()
    mock_state_loader.export.return_value = None
    mock_state_loader.state_file = "/tmp/recce_state.json"
    mock_context = MagicMock()
    mock_context.export_state.return_value = {}
    mock_rmcp.state_loader = mock_state_loader
    mock_rmcp.context = mock_context

    class FakeStdioCM:
        async def __aenter__(self):
            return (MagicMock(), MagicMock())

        async def __aexit__(self, *args):
            return False

    with patch("recce.mcp_transport.stdio_server", return_value=FakeStdioCM()):
        await run_mcp_stdio(mock_rmcp)

    mock_state_loader.export.assert_called_once()


@pytest.mark.asyncio
async def test_run_mcp_stdio_export_swallows_failures():
    """A state-export failure on shutdown is logged, not propagated."""
    from recce.mcp_transport import run_mcp_stdio

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.server.run = AsyncMock()
    mock_rmcp.server.create_initialization_options = MagicMock(return_value={})
    mock_state_loader = MagicMock()
    mock_state_loader.export.side_effect = RuntimeError("disk full")
    mock_context = MagicMock()
    mock_context.export_state.return_value = {}
    mock_rmcp.state_loader = mock_state_loader
    mock_rmcp.context = mock_context

    class FakeStdioCM:
        async def __aenter__(self):
            return (MagicMock(), MagicMock())

        async def __aexit__(self, *args):
            return False

    # Must not raise — the export failure is caught and logged.
    with patch("recce.mcp_transport.stdio_server", return_value=FakeStdioCM()):
        await run_mcp_stdio(mock_rmcp)


def _legacy_sse_handler(rmcp):
    """Helper: get the /sse Mount's ASGI app from a built legacy SSE app."""
    from recce.mcp_transport import _build_legacy_sse_app

    app = _build_legacy_sse_app(rmcp)
    sse_mount = next(r for r in app.routes if getattr(r, "path", None) == "/sse")
    return sse_mount.app


def _merged_sse_handler(rmcp):
    """Helper: get the /sse Mount's ASGI app from attach_mcp_to_fastapi."""
    from fastapi import FastAPI

    from recce.mcp_transport import attach_mcp_to_fastapi

    app = FastAPI()
    attach_mcp_to_fastapi(app, rmcp, prefix="/mcp")
    mcp_mount = next(r for r in app.routes if getattr(r, "path", None) == "/mcp")
    sse_mount = next(r for r in mcp_mount.app.routes if getattr(r, "path", None) == "/sse")
    return sse_mount.app


def _streamable_handler(rmcp):
    """Helper: get the catch-all Mount's ASGI app (Streamable HTTP forwarder)."""
    from fastapi import FastAPI

    from recce.mcp_transport import attach_mcp_to_fastapi

    app = FastAPI()
    attach_mcp_to_fastapi(app, rmcp, prefix="/mcp")
    mcp_mount = next(r for r in app.routes if getattr(r, "path", None) == "/mcp")
    catchall = next(r for r in mcp_mount.app.routes if getattr(r, "path", None) == "")
    return catchall.app


def _make_sse_rmcp():
    rmcp = MagicMock()
    rmcp.server = MagicMock()
    rmcp.server.run = AsyncMock()
    rmcp.server.create_initialization_options = MagicMock(return_value={})
    rmcp.context = None
    rmcp.state_loader = None
    rmcp.mcp_logger = MagicMock()
    rmcp.mcp_logger.debug = False
    return rmcp


@pytest.mark.asyncio
async def test_legacy_sse_handler_rejects_non_get_with_405():
    """Non-GET requests to /sse get a 405 response."""
    handler = _legacy_sse_handler(_make_sse_rmcp())
    sent = []

    async def receive():
        return {"type": "http.request"}

    async def send(msg):
        sent.append(msg)

    await handler({"type": "http", "method": "POST", "client": None}, receive, send)

    assert sent[0]["type"] == "http.response.start"
    assert sent[0]["status"] == 405
    assert sent[1]["type"] == "http.response.body"
    assert sent[1]["body"] == b""


@pytest.mark.asyncio
async def test_legacy_sse_handler_ignores_non_http_scope():
    """Lifespan/websocket scopes pass through silently — no send calls."""
    handler = _legacy_sse_handler(_make_sse_rmcp())
    sent = []

    async def receive():
        return {}

    async def send(msg):
        sent.append(msg)

    await handler({"type": "lifespan"}, receive, send)
    assert sent == []


@pytest.mark.asyncio
async def test_merged_sse_handler_rejects_non_get_with_405():
    """The merged-server /mcp/sse handler also rejects non-GET methods."""
    handler = _merged_sse_handler(_make_sse_rmcp())
    sent = []

    async def receive():
        return {"type": "http.request"}

    async def send(msg):
        sent.append(msg)

    await handler({"type": "http", "method": "DELETE", "client": ("127.0.0.1", 12345)}, receive, send)

    assert sent[0]["status"] == 405


@pytest.mark.asyncio
async def test_merged_sse_handler_ignores_non_http_scope():
    handler = _merged_sse_handler(_make_sse_rmcp())
    sent = []

    async def receive():
        return {}

    async def send(msg):
        sent.append(msg)

    await handler({"type": "websocket"}, receive, send)
    assert sent == []


@pytest.mark.asyncio
async def test_streamable_handler_forwards_to_session_manager():
    """The Streamable HTTP catch-all Mount forwards to session_manager.handle_request."""
    from fastapi import FastAPI

    from recce.mcp_transport import attach_mcp_to_fastapi

    rmcp = _make_sse_rmcp()
    app = FastAPI()
    session_manager = attach_mcp_to_fastapi(app, rmcp, prefix="/mcp")

    # Replace handle_request with an AsyncMock so we can verify the catch-all
    # Mount calls into it (exercising the tiny forwarder line) without needing
    # a fully initialized session_manager.run() context.
    session_manager.handle_request = AsyncMock()

    mcp_mount = next(r for r in app.routes if getattr(r, "path", None) == "/mcp")
    catchall = next(r for r in mcp_mount.app.routes if getattr(r, "path", None) == "")

    async def receive():
        return {"type": "http.request"}

    async def send(_msg):
        pass

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 12345),
    }
    await catchall.app(scope, receive, send)

    session_manager.handle_request.assert_awaited_once_with(scope, receive, send)


@pytest.mark.asyncio
async def test_legacy_sse_health_check_returns_ok():
    """GET /health on the legacy SSE app returns 200 with {"status":"ok"}."""
    import json as _json

    from starlette.testclient import TestClient

    from recce.mcp_transport import _build_legacy_sse_app

    app = _build_legacy_sse_app(_make_sse_rmcp())
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    assert _json.loads(r.text) == {"status": "ok"}


@pytest.mark.asyncio
async def test_legacy_sse_lifespan_exports_state_on_shutdown():
    """Starlette lifespan teardown triggers the state export branch."""
    from starlette.testclient import TestClient

    from recce.mcp_transport import _build_legacy_sse_app

    rmcp = _make_sse_rmcp()
    mock_state_loader = MagicMock()
    mock_state_loader.export.return_value = "exported"
    mock_context = MagicMock()
    mock_context.export_state.return_value = {"k": "v"}
    rmcp.state_loader = mock_state_loader
    rmcp.context = mock_context

    app = _build_legacy_sse_app(rmcp)
    # Entering and exiting the TestClient context drives the lifespan.
    with TestClient(app) as client:
        client.get("/health")  # smoke

    mock_state_loader.export.assert_called_once_with({"k": "v"})


@pytest.mark.asyncio
async def test_legacy_sse_lifespan_swallows_export_failures():
    """A state-export failure during shutdown is logged, not propagated."""
    from starlette.testclient import TestClient

    from recce.mcp_transport import _build_legacy_sse_app

    rmcp = _make_sse_rmcp()
    mock_state_loader = MagicMock()
    mock_state_loader.export.side_effect = RuntimeError("disk full")
    mock_context = MagicMock()
    mock_context.export_state.return_value = {}
    rmcp.state_loader = mock_state_loader
    rmcp.context = mock_context

    app = _build_legacy_sse_app(rmcp)
    # Must not raise.
    with TestClient(app) as client:
        client.get("/health")


@pytest.mark.asyncio
async def test_run_mcp_sse_legacy_starts_and_serves_uvicorn():
    """run_mcp_sse_legacy wires the built app into uvicorn.Server.serve()."""
    from recce.mcp_transport import run_mcp_sse_legacy

    rmcp = _make_sse_rmcp()

    serve_called = {"value": False}

    async def fake_serve(self):
        serve_called["value"] = True

    with patch("uvicorn.Server.serve", new=fake_serve):
        await run_mcp_sse_legacy(rmcp, host="127.0.0.1", port=18765)

    assert serve_called["value"] is True
