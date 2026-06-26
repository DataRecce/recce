import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytest.importorskip("mcp")

from mcp.types import CallToolRequest, CallToolRequestParams  # noqa: E402

from recce.mcp_server import (  # noqa: E402
    CloudBackend,
    InstanceSpawningError,
    RecceMCPServer,
    run_mcp_server,
)
from recce.util.recce_cloud import RecceCloudException  # noqa: E402


class MockResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text if text else (json.dumps(self._payload) if payload is not None else "")

    def json(self):
        return self._payload


@pytest.fixture
def cloud_requests():
    with patch("recce.mcp_server.requests.request") as mock_request:
        yield mock_request


@pytest.mark.asyncio
async def test_cloud_backend_spawns_instance_without_inner_api_path(cloud_requests):
    cloud_requests.return_value = MockResponse(204)

    await CloudBackend.create(session_id="sess-123", api_token="token-abc")

    method, url = cloud_requests.call_args.args[:2]
    assert method == "POST"
    assert url == "https://cloud.reccehq.com/api/v2/sessions/sess-123/instance"
    assert cloud_requests.call_args.kwargs["json"] == {}
    assert "/sessions/sess-123/api/" not in url


@pytest.mark.asyncio
async def test_cloud_backend_uses_session_proxy_paths_without_inner_api_segment(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, {"adapter_type": "dbt", "review_mode": True, "support_tasks": {}}),
        MockResponse(200, {"nodes": ["model.pkg.orders"]}),
        MockResponse(200, {"model": {"current": {"columns": {}}}}),
        MockResponse(200, {"current": {"nodes": {}}}),
        MockResponse(200, {"run_id": "run-1", "result": {"ok": True}}),
        MockResponse(200, [{"check_id": "check-1", "name": "check", "type": "query", "is_checked": False}]),
        MockResponse(200, {"run_id": "run-2", "status": "finished", "result": {"ok": True}}),
        MockResponse(200, {"check_id": "check-1", "is_checked": True}),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="token-abc")

    await backend.call_tool("get_server_info", {})
    await backend.call_tool("select_nodes", {"select": "state:modified+"})
    await backend.call_tool("get_model", {"node_id": "model.pkg.orders"})
    await backend.call_tool("get_cll", {"node_id": "model.pkg.orders"})
    await backend.call_tool("query", {"sql_template": "select 1"})
    await backend.call_tool("list_checks", {})
    await backend.call_tool("run_check", {"check_id": "check-1"})

    urls = [call.args[1] for call in cloud_requests.call_args_list]
    assert urls == [
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/instance",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/info",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/select",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/models/model.pkg.orders",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/cll",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/runs",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/checks",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/checks/check-1/run",
        "https://cloud.reccehq.com/api/v2/sessions/sess-123/checks/check-1",
    ]
    assert all("/sessions/sess-123/api/" not in url for url in urls)


@pytest.mark.asyncio
async def test_cloud_backend_raises_instance_spawning_error_on_405(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(405, {"detail": "spawning"}, "spawning"),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="token-abc")

    with pytest.raises(InstanceSpawningError, match="instance is still spawning"):
        await backend.call_tool("query", {"sql_template": "select 1"})


@pytest.mark.asyncio
async def test_cloud_backend_raises_cloud_exception_for_non_2xx(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(401, {"detail": "invalid token"}, '{"detail":"invalid token"}'),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="token-abc")

    with pytest.raises(RecceCloudException) as exc:
        await backend.call_tool("get_server_info", {})

    assert exc.value.status_code == 401
    assert "invalid token" in str(exc.value)


@pytest.mark.asyncio
async def test_run_check_auto_approve_failure_does_not_mask_run_result(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, {"run_id": "run-1", "status": "finished", "result": {"ok": True}}),
        MockResponse(500, {"detail": "approve failed"}, '{"detail":"approve failed"}'),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="token-abc")

    result = await backend.call_tool("run_check", {"check_id": "check-1"})

    assert result["status"] == "finished"
    assert result["result"] == {"ok": True}


@pytest.mark.asyncio
async def test_create_check_runs_lineage_diff_via_checks_run_endpoint(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, {"check_id": "check-1"}),
        MockResponse(200, {"run_id": "run-1", "status": "finished", "result": {"nodes": []}}),
        MockResponse(200, {"check_id": "check-1", "is_checked": True}),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="token-abc")

    result = await backend.call_tool(
        "create_check",
        {"name": "lineage", "type": "lineage_diff", "params": {}},
    )

    urls = [call.args[1] for call in cloud_requests.call_args_list]
    assert urls[2] == "https://cloud.reccehq.com/api/v2/sessions/sess-123/checks/check-1/run"
    assert urls[3] == "https://cloud.reccehq.com/api/v2/sessions/sess-123/checks/check-1"
    assert result["run_executed"] is True


@pytest.mark.asyncio
async def test_cloud_backend_lineage_diff_view_all_truncates(monkeypatch):
    """DRC-3758: CloudBackend caps view_mode='all', keeping changed + impacted first."""
    from recce.mcp_server import CloudBackend

    monkeypatch.setattr("recce.mcp_server.VIEW_ALL_MAX_NODES", 2)

    nodes = {
        "a": {"name": "a", "resource_type": "model", "change_status": "modified"},
        "b": {"name": "b", "resource_type": "model"},
        "c": {"name": "c", "resource_type": "model"},
    }

    async def fake_request(method, path, **kwargs):
        if path == "info":
            return {"lineage": {"nodes": nodes, "edges": []}}
        return {"nodes": ["b"]}  # path == "select": impacted set

    async def fake_selected(arguments, _nodes):
        return set(nodes.keys())  # view_mode="all" selects everything

    backend = CloudBackend.__new__(CloudBackend)
    backend._request = fake_request
    backend._selected_nodes = fake_selected

    result = await backend._tool_lineage_diff({"view_mode": "all"})

    assert result["truncated"] is True
    assert result["total_nodes"] == 3
    assert result["returned_nodes"] == 2
    kept = {row[1] for row in result["nodes"]["data"]}
    assert kept == {"a", "b"}  # changed (a) + impacted (b) kept; unrelated (c) dropped


@pytest.mark.asyncio
async def test_recce_mcp_server_delegates_tool_calls_to_backend():
    backend = AsyncMock()
    backend.call_tool.return_value = {"ok": True}
    server = RecceMCPServer(backend=backend)

    handler = server.server.request_handlers[CallToolRequest]
    request = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(name="get_server_info", arguments={}),
    )

    result = await handler(request)

    backend.call_tool.assert_awaited_once_with("get_server_info", {})
    # DRC-3758: tool results are now serialized compactly (no indent).
    assert result.root.content[0].text == '{"ok":true}'


@pytest.mark.asyncio
async def test_run_mcp_server_cloud_mode_skips_load_context_and_uses_cloud_backend():
    backend = AsyncMock()
    backend.call_tool.return_value = {"ok": True}

    with (
        patch("recce.mcp_server.load_context") as mock_load_context,
        patch("recce.mcp_server.CloudBackend.create", return_value=backend) as mock_create,
        patch.object(RecceMCPServer, "run") as mock_run,
    ):
        await run_mcp_server(cloud=True, session="sess-123", api_token="token-abc")

    mock_load_context.assert_not_called()
    mock_create.assert_awaited_once_with(session_id="sess-123", api_token="token-abc")
    mock_run.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_mcp_server_cloud_mode_requires_session_and_token():
    with pytest.raises(ValueError, match="--session is required"):
        await run_mcp_server(cloud=True, api_token="token-abc")

    with patch("recce.event.get_recce_api_token", return_value=None):
        with pytest.raises(ValueError, match="recce connect-to-cloud"):
            await run_mcp_server(cloud=True, session="sess-123", api_token=None)

    with pytest.raises(ValueError, match="--cloud is required"):
        await run_mcp_server(session="sess-123", api_token="token-abc")


@pytest.mark.asyncio
async def test_run_mcp_server_starts_unconfigured_when_load_context_fails():
    """No CLI flags + no dbt project → server boots with no backend; agent flips it later."""
    captured = {}

    def capture_init(self_obj, *args, **kwargs):
        captured["context"] = kwargs.get("context", args[0] if args else None)
        captured["backend"] = kwargs.get("backend")

    with (
        patch("recce.mcp_server.load_context", side_effect=RuntimeError("no dbt project")),
        patch("recce.event.get_recce_api_token", return_value=None),
        patch.object(RecceMCPServer, "__init__", side_effect=capture_init, return_value=None) as mock_init,
        patch.object(RecceMCPServer, "run") as mock_run,
    ):
        await run_mcp_server()

    mock_init.assert_called_once()
    init_kwargs = mock_init.call_args.kwargs
    assert init_kwargs.get("context") is None or mock_init.call_args.args[0] is None
    assert "backend" not in init_kwargs or init_kwargs["backend"] is None
    mock_run.assert_awaited_once()


@pytest.mark.asyncio
async def test_set_backend_swaps_to_cloud_at_runtime():
    """A set_backend(mode='cloud', session_id=...) call swaps the backend in place."""
    cloud_backend = AsyncMock()
    cloud_backend.instance_status = "ready"

    server = RecceMCPServer(api_token="token-abc")
    assert server.context is None and server.backend is None

    with patch("recce.mcp_server.CloudBackend.create", return_value=cloud_backend) as mock_create:
        result = await server._tool_set_backend({"mode": "cloud", "session_id": "sess-123"})

    mock_create.assert_awaited_once_with(session_id="sess-123", api_token="token-abc")
    assert server.backend is cloud_backend
    assert result == {"mode": "cloud", "session_id": "sess-123", "instance_status": "ready"}


@pytest.mark.asyncio
async def test_set_backend_accepts_explicit_api_token_arg():
    """Explicit api_token in set_backend overrides any token loaded at startup."""
    cloud_backend = AsyncMock()
    cloud_backend.instance_status = "ready"

    server = RecceMCPServer(api_token="startup-token")

    with patch("recce.mcp_server.CloudBackend.create", return_value=cloud_backend) as mock_create:
        await server._tool_set_backend({"mode": "cloud", "session_id": "sess-123", "api_token": "rotated-token"})

    mock_create.assert_awaited_once_with(session_id="sess-123", api_token="rotated-token")
    # Subsequent swaps should reuse the rotated token without needing it again.
    assert server.api_token == "rotated-token"


@pytest.mark.asyncio
async def test_set_backend_explicit_token_works_without_startup_token():
    """Server launched bare can authenticate cloud entirely via set_backend args."""
    cloud_backend = AsyncMock()
    cloud_backend.instance_status = "ready"

    server = RecceMCPServer(api_token=None)

    with (
        patch("recce.mcp_server.CloudBackend.create", return_value=cloud_backend) as mock_create,
        patch("recce.event.get_recce_api_token") as mock_profile_token,
    ):
        await server._tool_set_backend({"mode": "cloud", "session_id": "sess-123", "api_token": "explicit-token"})

    mock_create.assert_awaited_once_with(session_id="sess-123", api_token="explicit-token")
    mock_profile_token.assert_not_called()


@pytest.mark.asyncio
async def test_set_backend_cloud_requires_session_and_token():
    server = RecceMCPServer(api_token=None)

    with pytest.raises(ValueError, match="session_id is required"):
        await server._tool_set_backend({"mode": "cloud"})

    with patch("recce.event.get_recce_api_token", return_value=None):
        with pytest.raises(ValueError, match="recce connect-to-cloud"):
            await server._tool_set_backend({"mode": "cloud", "session_id": "sess-123"})


@pytest.mark.asyncio
async def test_set_backend_local_exports_state_when_swapping_away():
    """local → cloud swap exports pending local state so it isn't lost."""
    cloud_backend = AsyncMock()
    cloud_backend.instance_status = "ready"

    state_loader = MagicMock()
    state_loader.export.return_value = None

    fake_context = type("Ctx", (), {})()
    fake_context.export_state = lambda: {"snapshot": True}

    server = RecceMCPServer(api_token="token-abc")
    server.context = fake_context
    server.state_loader = state_loader
    server._local_cache_key = ("/proj", "target", "target-base")

    with patch("recce.mcp_server.CloudBackend.create", return_value=cloud_backend):
        await server._tool_set_backend({"mode": "cloud", "session_id": "sess-123"})

    state_loader.export.assert_called_once_with({"snapshot": True})


@pytest.mark.asyncio
async def test_set_backend_invalid_mode_raises():
    server = RecceMCPServer()
    with pytest.raises(ValueError, match="Invalid mode"):
        await server._tool_set_backend({"mode": "bogus"})


@pytest.mark.asyncio
async def test_unconfigured_server_blocks_normal_tools_but_allows_set_backend():
    """Tools other than set_backend / get_server_info are gated when unconfigured."""
    server = RecceMCPServer()
    handler = server.server.request_handlers[CallToolRequest]

    # Normal tool blocked
    blocked = await handler(
        CallToolRequest(
            method="tools/call",
            params=CallToolRequestParams(name="lineage_diff", arguments={}),
        )
    )
    assert blocked.root.isError is True
    assert "No backend configured" in blocked.root.content[0].text

    # get_server_info returns mode='none'
    info = await handler(
        CallToolRequest(
            method="tools/call",
            params=CallToolRequestParams(name="get_server_info", arguments={}),
        )
    )
    assert '"mode":"none"' in info.root.content[0].text


@pytest.mark.asyncio
async def test_cloud_lineage_diff_filters_nodes_and_marks_impacted(cloud_requests):
    info_payload = {
        "lineage": {
            "nodes": {
                "model.pkg.a": {
                    "name": "a",
                    "resource_type": "model",
                    "materialized": "table",
                    "change_status": "modified",
                },
                "model.pkg.b": {
                    "name": "b",
                    "resource_type": "model",
                    "materialized": "view",
                    "change_status": None,
                },
                "model.pkg.c": {
                    "name": "c",
                    "resource_type": "model",
                    "materialized": "table",
                    "change_status": None,
                },
            },
            "edges": [
                {"source": "model.pkg.a", "target": "model.pkg.b"},
                {"source": "model.pkg.b", "target": "model.pkg.c"},
                {"source": "model.pkg.x", "target": "model.pkg.a"},  # source not in selected
            ],
        }
    }
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, info_payload),
        MockResponse(200, {"nodes": ["model.pkg.a", "model.pkg.b"]}),  # selected via select arg
        MockResponse(200, {"nodes": ["model.pkg.a", "model.pkg.b"]}),  # impacted (state:modified+)
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend.call_tool("lineage_diff", {"select": "state:modified+"})

    nodes_rows = result["nodes"]["data"]
    edges_rows = result["edges"]["data"]
    # Two selected nodes, both impacted
    assert len(nodes_rows) == 2
    names = {row[2] for row in nodes_rows}
    assert names == {"a", "b"}
    impacted_flags = {row[1]: row[6] for row in nodes_rows}  # id -> impacted
    assert impacted_flags["model.pkg.a"] is True
    assert impacted_flags["model.pkg.b"] is True
    # Only the a→b edge survives (both endpoints in selected set)
    assert edges_rows == [(0, 1)] or edges_rows == [[0, 1]]


@pytest.mark.asyncio
async def test_cloud_lineage_diff_defaults_to_all_nodes_when_no_filter(cloud_requests):
    info_payload = {
        "lineage": {
            "nodes": {"model.pkg.a": {"name": "a", "resource_type": "model"}},
            "edges": [],
        }
    }
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, info_payload),
        MockResponse(200, {"nodes": []}),  # impacted query
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend.call_tool("lineage_diff", {})

    # No select/exclude passed → only 2 cloud calls after instance spawn (info + impacted)
    methods_paths = [(c.args[0], c.args[1]) for c in cloud_requests.call_args_list[1:]]
    assert methods_paths[0][1].endswith("/info")
    assert methods_paths[1][1].endswith("/select")
    assert len(result["nodes"]["data"]) == 1


@pytest.mark.asyncio
async def test_cloud_schema_diff_returns_column_changes(cloud_requests):
    info_payload = {
        "lineage": {
            "nodes": {
                "model.pkg.a": {
                    "change": {"columns": {"col1": "added", "col2": "removed"}},
                },
                "model.pkg.b": {
                    "change": {"columns": {"colx": "modified"}},
                },
            }
        }
    }
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, info_payload),
        MockResponse(200, {"nodes": ["model.pkg.a"]}),  # select filters to a only
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend.call_tool("schema_diff", {"select": "state:modified"})

    rows = result["data"]
    assert len(rows) == 2
    cols = {row[1] for row in rows}
    assert cols == {"col1", "col2"}


@pytest.mark.asyncio
async def test_cloud_schema_diff_no_filter_includes_all_nodes(cloud_requests):
    info_payload = {
        "lineage": {
            "nodes": {
                "model.pkg.a": {"change": {"columns": {"c1": "added"}}},
                "model.pkg.b": {"change": None},
            }
        }
    }
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, info_payload),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend.call_tool("schema_diff", {})

    rows = result["data"]
    assert len(rows) == 1
    assert rows[0][1] == "c1"


@pytest.mark.asyncio
async def test_cloud_impact_analysis_classifies_models(cloud_requests):
    info_payload = {
        "lineage": {
            "nodes": {
                "model.pkg.a": {
                    "name": "a",
                    "materialized": "table",
                    "change_status": "modified",
                    "change": {"columns": {"c1": "added"}},
                },
                "model.pkg.b": {
                    "name": "b",
                    "materialized": "view",
                    "change_status": None,
                },
                "source.pkg.s": {"name": "s"},  # non-model, skipped
            }
        }
    }
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, info_payload),
        MockResponse(200, {"nodes": ["model.pkg.a", "model.pkg.b"]}),  # impacted
        MockResponse(200, {"nodes": ["model.pkg.a"]}),  # modified
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend.call_tool("impact_analysis", {})

    assert result["classification_source"] == "lineage_dag"
    impacted_names = {m["name"] for m in result["confirmed_impacted_models"]}
    assert impacted_names == {"a", "b"}
    a_entry = next(m for m in result["confirmed_impacted_models"] if m["name"] == "a")
    assert a_entry["change_status"] == "modified"
    assert a_entry["next_action"]["priority"] == "high"
    assert a_entry["schema_changes"] == [{"column": "c1", "change_status": "added"}]
    b_entry = next(m for m in result["confirmed_impacted_models"] if m["name"] == "b")
    assert b_entry["change_status"] is None
    assert b_entry["next_action"]["priority"] == "medium"
    assert result["confirmed_not_impacted_models"] == []


@pytest.mark.asyncio
async def test_cloud_impact_analysis_uses_explicit_select(cloud_requests):
    info_payload = {"lineage": {"nodes": {"model.pkg.a": {"name": "a"}}}}
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, info_payload),
        MockResponse(200, {"nodes": []}),
        MockResponse(200, {"nodes": []}),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    await backend.call_tool("impact_analysis", {"select": "tag:critical+"})

    select_payload = cloud_requests.call_args_list[2].kwargs["json"]
    assert select_payload == {"select": "tag:critical+"}
    # Default select should NOT have been used
    assert "state:modified.body+" not in str(select_payload)


@pytest.mark.asyncio
async def test_cloud_selected_nodes_passes_only_set_filters(cloud_requests):
    """_selected_nodes should forward exclude/packages/view_mode but skip None values."""
    info_payload = {"lineage": {"nodes": {"model.pkg.a": {}}}}
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, info_payload),
        MockResponse(200, {"nodes": ["model.pkg.a"]}),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    await backend.call_tool(
        "schema_diff",
        {"exclude": "tag:internal", "packages": ["pkg"], "view_mode": "all"},
    )

    select_payload = cloud_requests.call_args_list[2].kwargs["json"]
    assert select_payload == {
        "exclude": "tag:internal",
        "packages": ["pkg"],
        "view_mode": "all",
    }
    assert "select" not in select_payload


@pytest.mark.asyncio
async def test_cloud_get_server_info_includes_mode_field(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, {"adapter_type": "dbt", "review_mode": False, "support_tasks": {}}),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="token-abc")

    info = await backend.call_tool("get_server_info", {})

    assert info["mode"] == "cloud"
    assert info["cloud_mode"] is True
    assert info["session_id"] == "sess-123"


@pytest.mark.asyncio
async def test_cloud_backend_request_returns_text_payload_for_non_json(cloud_requests):
    """Non-JSON 200 response falls back to {'text': <body>} instead of raising."""

    class NonJsonResponse(MockResponse):
        def json(self):
            raise ValueError("not json")

    cloud_requests.side_effect = [
        MockResponse(204),
        NonJsonResponse(200, payload=None, text="hello"),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend._request("GET", "info")
    assert result == {"text": "hello"}


@pytest.mark.asyncio
async def test_cloud_backend_call_tool_unknown_name_raises(cloud_requests):
    cloud_requests.return_value = MockResponse(204)
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    with pytest.raises(ValueError, match="Unknown tool"):
        await backend.call_tool("not_a_tool", {})


@pytest.mark.asyncio
async def test_cloud_get_server_info_includes_optional_fields(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(200, {"status": "ready"}),  # spawn returns status
        MockResponse(
            200,
            {
                "adapter_type": "dbt",
                "review_mode": True,
                "support_tasks": {},
                "git": {"branch": "feature/x"},
                "pull_request": {"number": 42},
            },
        ),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    info = await backend.call_tool("get_server_info", {})

    assert info["instance_status"] == "ready"
    assert info["git"] == {"branch": "feature/x"}
    assert info["pull_request"] == {"number": 42}


@pytest.mark.asyncio
async def test_cloud_get_model_requires_model_id(cloud_requests):
    cloud_requests.return_value = MockResponse(204)
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    with pytest.raises(ValueError, match="model_id is required"):
        await backend.call_tool("get_model", {})


@pytest.mark.asyncio
async def test_cloud_run_check_requires_check_id(cloud_requests):
    cloud_requests.return_value = MockResponse(204)
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    with pytest.raises(ValueError, match="check_id is required"):
        await backend.call_tool("run_check", {})


@pytest.mark.asyncio
async def test_cloud_create_check_propagates_run_error(cloud_requests):
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, {"check_id": "check-1"}),
        MockResponse(200, {"run_id": "run-1", "status": "failed", "error": "boom"}),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend.call_tool(
        "create_check",
        {"name": "q", "type": "query", "params": {"sql_template": "select 1"}},
    )

    assert result["run_executed"] is True
    assert result["run_error"] == "boom"


@pytest.mark.asyncio
async def test_set_backend_cloud_swallows_state_export_exception():
    """Best-effort export must not block the cloud swap."""
    cloud_backend = AsyncMock()
    cloud_backend.instance_status = "ready"

    state_loader = MagicMock()
    state_loader.export.side_effect = RuntimeError("export failed")

    fake_context = type("Ctx", (), {})()
    fake_context.export_state = lambda: {"snapshot": True}

    server = RecceMCPServer(api_token="token-abc")
    server.context = fake_context
    server.state_loader = state_loader

    with patch("recce.mcp_server.CloudBackend.create", return_value=cloud_backend):
        result = await server._tool_set_backend({"mode": "cloud", "session_id": "sess-123"})

    assert result["mode"] == "cloud"
    state_loader.export.assert_called_once()


@pytest.mark.asyncio
async def test_set_backend_local_loads_context_and_returns_metadata():
    """mode='local' invokes load_context and returns adapter_type / single_env."""
    fake_context = MagicMock()
    fake_context.adapter_type = "dbt"

    server = RecceMCPServer()

    with (
        patch("recce.mcp_server.load_context", return_value=fake_context) as mock_load,
        patch("recce.mcp_server.Path") as mock_path,
    ):
        # target/ exists, target-base/ doesn't → single-env fallback engages.
        target_dir = MagicMock()
        target_dir.is_dir.return_value = True
        base_dir = MagicMock()
        base_dir.is_dir.return_value = False
        # First Path() call computes base_path, second computes target_dir.
        mock_path.return_value.joinpath.side_effect = [base_dir, target_dir]

        result = await server._tool_set_backend(
            {"mode": "local", "project_dir": "/proj", "target_path": "target", "target_base_path": "target-base"}
        )

    assert result == {"mode": "local", "adapter_type": "dbt", "single_env": True}
    # effective_base swapped to target_path because target-base/ missing
    load_kwargs = mock_load.call_args.kwargs
    assert load_kwargs["target_base_path"] == "target"
    assert server.context is fake_context
    assert server.backend is None


@pytest.mark.asyncio
async def test_set_backend_local_keeps_dual_env_when_base_dir_present():
    """Both target/ and target-base/ exist → single_env stays False."""
    fake_context = MagicMock()
    fake_context.adapter_type = "dbt"

    server = RecceMCPServer()

    with (
        patch("recce.mcp_server.load_context", return_value=fake_context) as mock_load,
        patch("recce.mcp_server.Path") as mock_path,
    ):
        base_dir = MagicMock()
        base_dir.is_dir.return_value = True
        target_dir = MagicMock()
        target_dir.is_dir.return_value = True
        mock_path.return_value.joinpath.side_effect = [base_dir, target_dir]

        result = await server._tool_set_backend({"mode": "local"})

    assert result["single_env"] is False
    # target_base_path preserved (no fallback to target_path)
    assert mock_load.call_args.kwargs["target_base_path"] == "target-base"


@pytest.mark.asyncio
async def test_cloud_backend_routes_run_tool_types_through_run_backed(cloud_requests):
    """RUN_TOOL_TYPES tools (e.g., row_count_diff) dispatch via _tool_run_backed."""
    cloud_requests.side_effect = [
        MockResponse(204),
        MockResponse(200, {"run_id": "run-1", "result": {"customers": {"base": 1, "curr": 2}}}),
    ]
    backend = await CloudBackend.create(session_id="sess-123", api_token="t")

    result = await backend.call_tool("row_count_diff", {"node_names": ["customers"]})

    assert result == {"customers": {"base": 1, "curr": 2}}
    runs_call = cloud_requests.call_args_list[1]
    assert runs_call.args[1].endswith("/runs")
    assert runs_call.kwargs["json"]["type"] == "row_count_diff"


@pytest.mark.asyncio
async def test_run_mcp_server_warns_and_continues_on_invalid_mode_str():
    """An unknown --mode value logs a warning but doesn't abort startup."""
    with (
        patch("recce.mcp_server.load_context", side_effect=RuntimeError("no project")),
        patch("recce.event.get_recce_api_token", return_value=None),
        patch.object(RecceMCPServer, "run") as mock_run,
    ):
        await run_mcp_server(mode="bogus-mode")

    mock_run.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_mcp_server_sse_mode_dispatches_to_run_sse():
    """sse=True routes to run_sse() instead of run()."""
    with (
        patch("recce.mcp_server.load_context", side_effect=RuntimeError("no project")),
        patch("recce.event.get_recce_api_token", return_value=None),
        patch.object(RecceMCPServer, "run_sse") as mock_run_sse,
        patch.object(RecceMCPServer, "run") as mock_run,
    ):
        await run_mcp_server(sse=True, host="0.0.0.0", port=9000)

    mock_run_sse.assert_awaited_once_with(host="0.0.0.0", port=9000)
    mock_run.assert_not_called()


@pytest.mark.asyncio
async def test_set_backend_api_token_redacted_in_logs(caplog):
    """api_token passed to set_backend must NOT appear in stderr or persistent log file."""
    import logging

    backend = AsyncMock()
    backend.call_tool.return_value = {"ok": True}
    server = RecceMCPServer(api_token=None)

    handler = server.server.request_handlers[CallToolRequest]
    request = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="set_backend",
            arguments={"mode": "cloud", "session_id": "sess-123", "api_token": "sk-real-secret"},
        ),
    )

    with (
        caplog.at_level(logging.INFO, logger="recce.mcp_server"),
        patch("recce.mcp_server.CloudBackend.create", return_value=backend),
        patch.object(server.mcp_logger, "log_tool_call") as mock_log_tool_call,
    ):
        await handler(request)

    # Stderr/console logs must not contain the raw token
    assert "sk-real-secret" not in caplog.text
    assert "***" in caplog.text

    # Persistent debug log file (mcp_logger.log_tool_call) must receive redacted args
    assert mock_log_tool_call.called
    logged_args = mock_log_tool_call.call_args.args[1]
    assert logged_args["api_token"] == "***"
    assert logged_args["session_id"] == "sess-123"
