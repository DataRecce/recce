"""Tests for log_mcp_startup telemetry helper."""

from unittest.mock import patch


def test_log_mcp_startup_emits_event_with_payload():
    from recce import event

    with patch.object(event, "log_event") as mock_log:
        event.log_mcp_startup(enabled=True, transports="streamable_http+sse", command="server")

    args, kwargs = mock_log.call_args
    payload = args[0]
    event_type = args[1]
    assert event_type == "mcp_startup"
    assert payload["enabled"] is True
    assert payload["transports"] == "streamable_http+sse"
    assert payload["command"] == "server"
