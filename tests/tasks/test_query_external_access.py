"""Integration tests for the QueryTask + HTTP path with DuckDB external access disabled.

Every test runs in an isolated subprocess. The DuckDB `enable_external_access`
setting is irreversible once applied in a process, and dbt-duckdb uses a
class-level singleton connection, so running these tests in the same pytest
session would permanently disable external access for all subsequent tests.

Pattern mirrors tests/adapter/dbt_adapter/test_duckdb_external_access.py.
"""

import os
import subprocess
import sys

_ADAPTER_PROJ_DIR = os.path.normpath(
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "adapter",
        "dbt_adapter",
        "test_proj",
    )
)


def _run_subprocess(script: str) -> None:
    """Run a Python script in a subprocess and assert it exits cleanly."""
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"Subprocess failed (rc={result.returncode}):\n" f"stdout: {result.stdout}\n" f"stderr: {result.stderr}"
    )


def _make_setup_script(project_dir: str) -> str:
    """Return a Python script fragment that initialises adapter + RecceContext.

    Adapter is loaded with duckdb_external_access=False (external access disabled)
    and the test project manifests are installed so generate_sql() works for plain SQL.
    """
    return f"""
import os
from datetime import datetime
from unittest.mock import patch

from dbt.contracts.results import CatalogArtifact

from recce.adapter.dbt_adapter import DbtAdapter, as_manifest, load_manifest
from recce.core import RecceContext, set_default_context

_project_dir = {project_dir!r}
_manifest_path = os.path.join(_project_dir, "manifest.json")

with patch("recce.adapter.dbt_adapter.log_performance"):
    adapter = DbtAdapter.load(
        no_artifacts=True,
        project_dir=_project_dir,
        profiles_dir=_project_dir,
        duckdb_external_access=False,
    )

_writable_manifest = load_manifest(_manifest_path)
_manifest = as_manifest(_writable_manifest)
_now = datetime.now()
_empty_catalog = CatalogArtifact.from_results(
    generated_at=_now,
    nodes={{}},
    sources={{}},
    compile_results=None,
    errors=None,
)
adapter.set_artifacts(
    _writable_manifest,
    _writable_manifest,
    _manifest,
    _manifest,
    _empty_catalog,
    _empty_catalog,
)

context = RecceContext()
context.adapter_type = "dbt"
context.adapter = adapter
context.review_mode = False
set_default_context(context)
"""


# ---------------------------------------------------------------------------
# Test 1 — QueryTask blocks COPY TO
# ---------------------------------------------------------------------------


def test_query_task_blocks_copy_to():
    """QueryTask with a COPY TO statement must raise DuckDBExternalAccessBlocked."""
    setup = _make_setup_script(_ADAPTER_PROJ_DIR)
    script = (
        setup
        + """
import tempfile
from recce.tasks import QueryTask
from recce.exceptions import DuckDBExternalAccessBlocked

with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
    out_path = f.name

try:
    task = QueryTask({"sql_template": f"COPY (SELECT 1 AS x) TO '{out_path}'"})
    raised = False
    try:
        task.execute()
    except DuckDBExternalAccessBlocked as e:
        msg = str(e)
        assert "--duckdb-external-access" in msg, f"Opt-out hint missing: {msg}"
        raised = True
    except Exception as e:
        raise AssertionError(f"Wrong exception type: {type(e).__name__}: {e}")
    assert raised, "COPY TO should have been blocked when external access is disabled"
finally:
    if os.path.exists(out_path):
        os.unlink(out_path)
print("OK")
"""
    )
    _run_subprocess(script)


# ---------------------------------------------------------------------------
# Test 2 — QueryTask blocks read_csv
# ---------------------------------------------------------------------------


def test_query_task_blocks_read_csv():
    """QueryTask with read_csv('/etc/hosts') must raise DuckDBExternalAccessBlocked."""
    setup = _make_setup_script(_ADAPTER_PROJ_DIR)
    script = (
        setup
        + """
from recce.tasks import QueryTask
from recce.exceptions import DuckDBExternalAccessBlocked

task = QueryTask({"sql_template": "SELECT * FROM read_csv('/etc/hosts')"})
raised = False
try:
    task.execute()
except DuckDBExternalAccessBlocked as e:
    msg = str(e)
    assert "--duckdb-external-access" in msg, f"Opt-out hint missing: {msg}"
    raised = True
except Exception as e:
    raise AssertionError(f"Wrong exception type: {type(e).__name__}: {e}")
assert raised, "read_csv should have been blocked when external access is disabled"
print("OK")
"""
    )
    _run_subprocess(script)


# ---------------------------------------------------------------------------
# Test 3 — QueryTask allows ordinary SELECT
# ---------------------------------------------------------------------------


def test_query_task_allows_legit_select():
    """External-access restriction must not block a plain SELECT."""
    setup = _make_setup_script(_ADAPTER_PROJ_DIR)
    script = (
        setup
        + """
from recce.tasks import QueryTask

task = QueryTask({"sql_template": "SELECT 1 AS x"})
result = task.execute()
assert result is not None, "Expected a result, got None"
assert len(result.data) == 1, f"Expected 1 row, got {len(result.data)}"
print("OK")
"""
    )
    _run_subprocess(script)


# ---------------------------------------------------------------------------
# Test 4 — HTTP /api/runs returns 400 for SQL blocked by external-access restriction
# ---------------------------------------------------------------------------


def test_create_run_returns_400_for_blocked_sql():
    """POST /api/runs with restricted SQL must return HTTP 400 with hint."""
    setup = _make_setup_script(_ADAPTER_PROJ_DIR)
    script = (
        setup
        + """
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from recce.apis.run_api import run_router

app = FastAPI()
app.include_router(run_router)

with TestClient(app) as client:
    response = client.post(
        "/runs",
        json={
            "type": "query",
            "params": {"sql_template": "COPY (SELECT 1 AS x) TO '/tmp/recce_external_access_http_test.csv'"},
        },
    )
    assert response.status_code == 400, (
        f"Expected 400, got {response.status_code}. Body: {response.text}"
    )
    body = response.json()
    detail = body.get("detail", "")
    assert "--duckdb-external-access" in detail, f"Opt-out hint missing in detail: {detail}"
    assert "external access" in detail.lower(), f"external-access mention missing in detail: {detail}"
print("OK")
"""
    )
    _run_subprocess(script)


# ---------------------------------------------------------------------------
# Test 5 — POST /checks/{id}/run returns HTTP 400 for SQL blocked by external-access restriction
# ---------------------------------------------------------------------------


def test_rerun_check_returns_400_for_blocked_sql():
    """POST /api/checks/{id}/run with restricted SQL must return HTTP 400 with hint.

    Regression: check_api.py:182 previously awaited the future with no
    DuckDBExternalAccessBlocked guard, returning HTTP 500 instead of 400.
    """
    setup = _make_setup_script(_ADAPTER_PROJ_DIR)
    script = (
        setup
        + """
from fastapi import FastAPI
from fastapi.testclient import TestClient
from recce.apis.check_api import check_router
from recce.models import Check, CheckDAO, RunType

app = FastAPI()
app.include_router(check_router)

# Persist a query check whose SQL will be rejected when external access is disabled.
check = Check(
    name="external-access-rerun-regression",
    description="",
    type=RunType.QUERY,
    params={"sql_template": "COPY (SELECT 1 AS x) TO '/tmp/recce_external_access_check_test.csv'"},
)
CheckDAO().create(check)

with TestClient(app) as client:
    response = client.post(f"/checks/{check.check_id}/run", json={})
    assert response.status_code == 400, (
        f"Expected 400, got {response.status_code}. Body: {response.text}"
    )
    body = response.json()
    detail = body.get("detail", "")
    assert "--duckdb-external-access" in detail, f"Opt-out hint missing in detail: {detail}"
    assert "external access" in detail.lower(), f"external-access mention missing in detail: {detail}"
print("OK")
"""
    )
    _run_subprocess(script)
