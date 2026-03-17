import asyncio
import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from recce.server import AppState, app


@pytest.fixture
def mock_app_state():
    """Create a minimal AppState for testing instance-info."""
    state = AppState()
    state.command = "server"
    state.flag = {}
    state.lifetime = None
    state.idle_timeout = None
    state.lifetime_expired_at = None
    state.share_url = None
    state.state_loader = MagicMock()
    state.state_loader.session_id = "test-session"
    state.organization_name = None
    state.web_url = None
    # Pre-set the ready_event so the readiness_gate middleware passes through
    ready_event = asyncio.Event()
    ready_event.set()
    state.ready_event = ready_event
    state.startup_error = None
    state.startup_ctx = None
    return state


@pytest.fixture
def client(mock_app_state):
    """Create a test client with mocked app state and external deps mocked."""
    original_state = getattr(app, "state", None)
    app.state = mock_app_state
    with (
        patch("recce.server.get_recce_api_token", return_value=None),
        patch("recce.server.is_recce_cloud_instance", return_value=False),
        patch("recce.server._do_lifespan_setup", return_value=None),
        TestClient(app) as c,
    ):
        yield c
    app.state = original_state


def test_instance_info_returns_python_version(client):
    """The /api/instance-info endpoint should return the Python version."""
    response = client.get("/api/instance-info")
    assert response.status_code == 200
    data = response.json()
    assert "python_version" in data
    expected = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    assert data["python_version"] == expected
