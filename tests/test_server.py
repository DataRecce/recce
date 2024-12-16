import os

import pytest
from fastapi.testclient import TestClient

from recce.core import default_context
from recce.server import app
# noinspection PyUnresolvedReferences
from tests.adapter.dbt_adapter.conftest import dbt_test_helper


@pytest.fixture
def temp_folder():
    import tempfile
    temp_dir = tempfile.mkdtemp()
    yield temp_dir

    import shutil
    shutil.rmtree(temp_dir)


def test_health():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_stateless(dbt_test_helper):
    context = default_context()
    from recce.state import RecceStateLoader
    context.state_loader = RecceStateLoader()
    client = TestClient(app)
    response = client.get("/api/info")
    assert response.status_code == 200
    info = response.json()
    assert info['file_mode'] is False
    assert info['cloud_mode'] is False


def test_file_mode(dbt_test_helper):
    context = default_context()
    from recce.state import RecceStateLoader
    context.state_loader = RecceStateLoader(state_file='/tmp/recce_state.json')
    client = TestClient(app)
    response = client.get("/api/info")
    assert response.status_code == 200
    info = response.json()
    assert info['file_mode'] is True
    assert info['filename'] == 'recce_state.json'
    assert info['cloud_mode'] is False


def test_saveas_and_rename(dbt_test_helper, temp_folder):
    context = default_context()
    state_file = os.path.join(temp_folder, 'recce_state.json')
    state_file2 = os.path.join(temp_folder, 'recce_state2.json')
    state_file3 = os.path.join(temp_folder, 'recce_state3.json')
    os.makedirs(os.path.join(temp_folder, 'dir.json'))

    from recce.state import RecceStateLoader
    context.state_loader = RecceStateLoader(state_file=state_file)
    client = TestClient(app)

    response = client.post("/api/save", json={"filename": "recce_state2.json"})
    assert response.status_code == 200
    assert os.path.exists(state_file)

    response = client.post("/api/save-as", json={"filename": "recce_state2.json"})
    assert response.status_code == 200
    assert os.path.exists(state_file2)
    assert context.state_loader.state_file == os.path.join(temp_folder, 'recce_state2.json')

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
    assert context.state_loader.state_file == os.path.join(temp_folder, 'recce_state3.json')

    # Conflict
    response = client.post("/api/save-as", json={"filename": "recce_state.json"})
    assert response.status_code == 409
    response = client.post("/api/rename", json={"filename": "recce_state.json"})
    assert response.status_code == 409

    # Overwrite
    response = client.post("/api/save-as", json={"filename": "recce_state.json", "overwrite": True})
    assert response.status_code == 200
    assert context.state_loader.state_file == os.path.join(temp_folder, 'recce_state.json')
