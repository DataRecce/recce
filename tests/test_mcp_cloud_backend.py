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
    assert result.root.content[0].text == '{\n  "ok": true\n}'


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
    assert '"mode": "none"' in info.root.content[0].text


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
