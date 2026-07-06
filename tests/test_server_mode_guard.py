"""Server-side enforcement of read-only / preview modes on the REST API.

Mirrors the blocked-tool logic in mcp_server.py. See DRC-3828.
"""

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from recce.server import _mode_block_reason, enforce_server_mode


def _blocked(method, path, run_type=None, *, read_only=False, preview=False):
    return _mode_block_reason(method, path, run_type, read_only, preview) is not None


def test_server_mode_allows_everything():
    # Full server mode: nothing is gated.
    assert not _blocked("POST", "/api/runs", "query")
    assert not _blocked("POST", "/api/save")
    assert not _blocked("DELETE", "/api/checks/abc")


def test_preview_blocks_query_execution_only():
    assert _blocked("POST", "/api/runs", "query", preview=True)
    assert _blocked("POST", "/api/runs", "value_diff", preview=True)
    assert _blocked("POST", "/api/checks/abc/run", preview=True)
    # Metadata runs stay allowed in preview (matches MCP keeping lineage/schema).
    assert not _blocked("POST", "/api/runs", "lineage_diff", preview=True)
    assert not _blocked("POST", "/api/runs", "schema_diff", preview=True)
    # Preview still permits checklist edits and state writes.
    assert not _blocked("POST", "/api/checks", preview=True)
    assert not _blocked("POST", "/api/save", preview=True)


def test_read_only_blocks_queries_and_writes():
    assert _blocked("POST", "/api/runs", "query", read_only=True)
    assert _blocked("POST", "/api/checks/abc/run", read_only=True)
    assert _blocked("POST", "/api/checks", read_only=True)
    assert _blocked("PATCH", "/api/checks/abc", read_only=True)
    assert _blocked("DELETE", "/api/checks/abc", read_only=True)
    assert _blocked("POST", "/api/checks/reorder", read_only=True)
    assert _blocked("POST", "/api/save", read_only=True)
    assert _blocked("POST", "/api/save-as", read_only=True)
    assert _blocked("POST", "/api/rename", read_only=True)
    assert _blocked("POST", "/api/export", read_only=True)
    # Metadata runs and reads remain allowed even in read-only.
    assert not _blocked("POST", "/api/runs", "lineage_diff", read_only=True)
    assert not _blocked("GET", "/api/runs", read_only=True)
    assert not _blocked("GET", "/api/checks", read_only=True)
    assert not _blocked("POST", "/api/runs/search", read_only=True)


def _client(flag):
    """Tiny app wearing the real middleware, with an echo route for /api/runs."""
    app = FastAPI()
    app.state.flag = flag
    app.middleware("http")(enforce_server_mode)

    @app.post("/api/runs")
    async def runs(request: Request):
        body = await request.json()  # proves the replayed body survived the gate
        return {"echoed_type": body.get("type")}

    return TestClient(app)


def test_middleware_blocks_query_run_in_read_only():
    resp = _client({"read_only": True}).post("/api/runs", json={"type": "query"})
    assert resp.status_code == 403
    assert "read-only" in resp.json()["detail"]


def test_middleware_allows_metadata_run_and_preserves_body():
    # Allowed request must pass the gate AND still reach the handler with an
    # intact body — this is what verifies the body-replay works.
    resp = _client({"read_only": True}).post("/api/runs", json={"type": "lineage_diff"})
    assert resp.status_code == 200
    assert resp.json() == {"echoed_type": "lineage_diff"}
