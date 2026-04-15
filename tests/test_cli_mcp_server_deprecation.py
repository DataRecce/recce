"""Tests for the deprecated `recce mcp-server` thin shim."""

import inspect
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

pytest.importorskip("mcp")

# Click 8.2+ removed the `mix_stderr` parameter and always separates stderr.
# Older Click defaults to mixing — pass `mix_stderr=False` only where supported
# so these tests run under both `dbt1.6`-`dbt1.9` (Click 8.1) and `dbtlatest`
# (Click 8.2+) tox environments.
_SUPPORTS_MIX_STDERR = "mix_stderr" in inspect.signature(CliRunner).parameters


def _runner() -> CliRunner:
    if _SUPPORTS_MIX_STDERR:
        return CliRunner(mix_stderr=False)
    return CliRunner()


def test_mcp_server_prints_deprecation_warning():
    from recce.cli import cli

    with (
        patch("recce.cli.create_state_loader_by_args") as mock_loader,
        patch("asyncio.run"),
        patch("recce.mcp_server.build_mcp_server"),
    ):
        mock_loader.return_value = MagicMock(verify=lambda: True)
        runner = _runner()
        result = runner.invoke(cli, ["mcp-server"], catch_exceptions=False)

    assert "DeprecationWarning" in (result.stderr or "")
    assert "recce server" in (result.stderr or "")


def test_mcp_server_stdio_dispatches_to_run_mcp_stdio():
    from recce.cli import cli

    with (
        patch("recce.cli.create_state_loader_by_args") as mock_loader,
        patch("recce.mcp_server.build_mcp_server") as mock_build,
        patch("recce.core.load_context") as mock_load_ctx,
        patch("recce.mcp_transport.run_mcp_stdio") as mock_stdio,
        patch("recce.mcp_transport.run_mcp_sse_legacy") as mock_sse,
        patch("asyncio.run") as mock_asyncio_run,
    ):
        mock_loader.return_value = MagicMock(verify=lambda: True)
        mock_build.return_value = MagicMock()
        mock_load_ctx.return_value = MagicMock()
        mock_stdio.return_value = MagicMock()  # the coroutine object
        runner = _runner()
        runner.invoke(cli, ["mcp-server"], catch_exceptions=False)

    # The stdio path was chosen, not SSE.
    mock_stdio.assert_called_once()
    mock_sse.assert_not_called()
    assert mock_asyncio_run.called


def test_mcp_server_sse_dispatches_to_run_mcp_sse_legacy():
    from recce.cli import cli

    with (
        patch("recce.cli.create_state_loader_by_args") as mock_loader,
        patch("recce.mcp_server.build_mcp_server") as mock_build,
        patch("recce.core.load_context") as mock_load_ctx,
        patch("recce.mcp_transport.run_mcp_stdio") as mock_stdio,
        patch("recce.mcp_transport.run_mcp_sse_legacy") as mock_sse,
        patch("asyncio.run") as mock_asyncio_run,
    ):
        mock_loader.return_value = MagicMock(verify=lambda: True)
        mock_build.return_value = MagicMock()
        mock_load_ctx.return_value = MagicMock()
        mock_sse.return_value = MagicMock()
        runner = _runner()
        runner.invoke(cli, ["mcp-server", "--sse", "--port", "9001"], catch_exceptions=False)

    mock_sse.assert_called_once()
    # Verify host/port were forwarded
    _, kwargs = mock_sse.call_args
    assert kwargs.get("port") == 9001
    mock_stdio.assert_not_called()
    assert mock_asyncio_run.called
