import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from recce.core import default_context
from recce.server import app

# noinspection PyUnresolvedReferences
from tests.adapter.dbt_adapter.conftest import dbt_test_helper  # noqa: F401


@pytest.fixture
def temp_folder():
    import tempfile

    temp_dir = tempfile.mkdtemp()
    yield temp_dir

    import shutil

    shutil.rmtree(temp_dir)


@pytest.fixture(autouse=True)
def init_app_state():
    """Initialize app.state.last_activity for all tests to prevent middleware errors."""
    app.state.last_activity = None
    yield
    # Cleanup after test
    app.state.last_activity = None


def test_health():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_stateless(dbt_test_helper):
    context = default_context()
    from recce.state import FileStateLoader

    context.state_loader = FileStateLoader()
    client = TestClient(app)
    response = client.get("/api/info")
    assert response.status_code == 200
    info = response.json()
    assert info["file_mode"] is False
    assert info["cloud_mode"] is False


def test_file_mode(dbt_test_helper):
    context = default_context()
    from recce.state import FileStateLoader

    context.state_loader = FileStateLoader(state_file="/tmp/recce_state.json")
    client = TestClient(app)
    response = client.get("/api/info")
    assert response.status_code == 200
    info = response.json()
    assert info["file_mode"] is True
    assert info["filename"] == "recce_state.json"
    assert info["cloud_mode"] is False


def test_saveas_and_rename(dbt_test_helper, temp_folder):
    context = default_context()
    state_file = os.path.join(temp_folder, "recce_state.json")
    state_file2 = os.path.join(temp_folder, "recce_state2.json")
    state_file3 = os.path.join(temp_folder, "recce_state3.json")
    os.makedirs(os.path.join(temp_folder, "dir.json"))

    from recce.state import FileStateLoader

    context.state_loader = FileStateLoader(state_file=state_file)
    client = TestClient(app)

    response = client.post("/api/save", json={"filename": "recce_state2.json"})
    assert response.status_code == 200
    assert os.path.exists(state_file)

    response = client.post("/api/save-as", json={"filename": "recce_state2.json"})
    assert response.status_code == 200
    assert os.path.exists(state_file2)
    assert context.state_loader.state_file == os.path.join(temp_folder, "recce_state2.json")

    # Same file
    response = client.post("/api/save-as", json={"filename": "recce_state2.json"})
    assert response.status_code == 400

    # folder
    response = client.post("/api/save-as", json={"filename": "dir.json"})
    assert response.status_code == 400

    # Rename
    response = client.post("/api/rename", json={"filename": "recce_state3.json"})
    assert response.status_code == 200
    assert not os.path.exists(state_file2)
    assert os.path.exists(state_file3)
    assert context.state_loader.state_file == os.path.join(temp_folder, "recce_state3.json")

    # Conflict
    response = client.post("/api/save-as", json={"filename": "recce_state.json"})
    assert response.status_code == 409
    response = client.post("/api/rename", json={"filename": "recce_state.json"})
    assert response.status_code == 409

    # Overwrite
    response = client.post("/api/save-as", json={"filename": "recce_state.json", "overwrite": True})
    assert response.status_code == 200
    assert context.state_loader.state_file == os.path.join(temp_folder, "recce_state.json")


def test_keep_alive_without_idle_timeout():
    """Test keep-alive endpoint when idle timeout is not configured"""
    client = TestClient(app)

    # Ensure last_activity is None (idle timeout not configured)
    app.state.last_activity = None

    response = client.post("/api/keep-alive")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["idle_timeout_enabled"] is False


def test_keep_alive_with_idle_timeout():
    """Test keep-alive endpoint resets idle timer when idle timeout is configured"""
    client = TestClient(app)

    # Set up idle timeout state
    initial_time = datetime.now(timezone.utc)
    app.state.last_activity = {"time": initial_time}

    # Call keep-alive
    response = client.post("/api/keep-alive")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["idle_timeout_enabled"] is True

    # Verify timer was reset (should be newer than initial time)
    assert app.state.last_activity["time"] >= initial_time

    # Cleanup
    app.state.last_activity = None


def test_spa_fallback_checks_route():
    """Test that /checks route serves checks.html correctly"""
    client = TestClient(app)
    response = client.get("/checks")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    # Verify it's actually the checks.html content
    assert b"<!DOCTYPE html>" in response.content


def test_spa_fallback_lineage_route():
    """Test that /lineage route serves lineage.html correctly"""
    client = TestClient(app)
    response = client.get("/lineage")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert b"<!DOCTYPE html>" in response.content


def test_spa_fallback_query_route():
    """Test that /query route serves query.html correctly"""
    client = TestClient(app)
    response = client.get("/query")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert b"<!DOCTYPE html>" in response.content


def test_spa_fallback_auth_callback_route():
    """Test that /auth_callback route serves auth_callback.html correctly"""
    client = TestClient(app)
    response = client.get("/auth_callback")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert b"<!DOCTYPE html>" in response.content


def test_spa_fallback_preserves_query_parameters():
    """Test that query parameters are preserved when serving HTML files"""
    client = TestClient(app)
    # The SPA routes should serve the HTML file regardless of query params
    # The actual routing happens client-side in the SPA
    response = client.get("/checks?id=abc-123")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert b"<!DOCTYPE html>" in response.content

    response = client.get("/lineage?node=model.my_model")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert b"<!DOCTYPE html>" in response.content


def test_spa_fallback_nonexistent_route():
    """Test that non-existent routes return 404.html with 404 status code"""
    client = TestClient(app)
    response = client.get("/nonexistent-page")
    assert response.status_code == 404
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert b"<!DOCTYPE html>" in response.content
