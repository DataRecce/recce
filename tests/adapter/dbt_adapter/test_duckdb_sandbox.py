import os
import subprocess
import sys
import textwrap

import pytest

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_DIR = os.path.join(_CURRENT_DIR, "test_proj")


def _run_sandbox_script(script: str) -> None:
    """Run a Python script in a subprocess and assert it exits cleanly.

    All sandbox tests are run in isolated subprocesses because the DuckDB
    `enable_external_access` setting is irreversible in a running process
    (it cannot be re-enabled once disabled) and dbt-duckdb uses a class-level
    singleton connection that is shared across test instances within the same
    pytest session.
    """
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"Subprocess failed (rc={result.returncode}):\n" f"stdout: {result.stdout}\n" f"stderr: {result.stderr}"
    )


def test_dbt_adapter_unsafe_sql_default_false():
    """DbtAdapter must default to unsafe_sql=False so sandbox is on by default.

    Runs in a subprocess to avoid applying enable_external_access=false to the
    shared dbt-duckdb singleton connection, which would break subsequent tests
    that rely on Python DataFrame scanning (python_scan_all_frames).
    """
    script = textwrap.dedent(
        f"""
        from unittest.mock import patch
        from recce.adapter.dbt_adapter import DbtAdapter

        project_dir = {_PROJECT_DIR!r}

        with patch("recce.adapter.dbt_adapter.log_performance"):
            adapter = DbtAdapter.load(
                no_artifacts=True,
                project_dir=project_dir,
                profiles_dir=project_dir,
            )
        assert adapter.unsafe_sql is False, f"Expected False, got {{adapter.unsafe_sql}}"
        print("OK")
    """
    )
    _run_sandbox_script(script)


@pytest.mark.parametrize(
    "sql,label",
    [
        ("COPY (SELECT 1 AS x) TO '/tmp/recce_sandbox_test.csv'", "COPY TO"),
        ("SELECT * FROM read_csv('/etc/hosts')", "read_csv"),
        ("ATTACH '/tmp/should_not_attach.duckdb' AS evil", "ATTACH"),
    ],
)
def test_duckdb_sandbox_blocks_dangerous_sql(sql, label):
    """With sandbox on (unsafe_sql=False), dangerous SQL must raise."""
    script = textwrap.dedent(
        f"""
        from unittest.mock import patch
        from dbt.exceptions import DbtRuntimeError
        from recce.adapter.dbt_adapter import DbtAdapter

        project_dir = {_PROJECT_DIR!r}

        with patch("recce.adapter.dbt_adapter.log_performance"):
            adapter = DbtAdapter.load(
                no_artifacts=True,
                project_dir=project_dir,
                profiles_dir=project_dir,
                unsafe_sql=False,  # sandbox ON
            )

        raised = False
        try:
            adapter.execute({sql!r})
        except DbtRuntimeError as e:
            msg = str(e).lower()
            assert "external" in msg or "disabled" in msg, f"Unexpected error: {{e}}"
            raised = True
        except Exception as e:
            raise AssertionError(f"Wrong exception type: {{type(e).__name__}}: {{e}}")
        assert raised, {label!r} + " should have been blocked by sandbox but was not"
        print("OK")
    """
    )
    _run_sandbox_script(script)


def test_duckdb_sandbox_allows_ordinary_select():
    """Sandbox must not interfere with ordinary SELECT queries."""
    script = textwrap.dedent(
        f"""
        from unittest.mock import patch
        from recce.adapter.dbt_adapter import DbtAdapter

        project_dir = {_PROJECT_DIR!r}

        with patch("recce.adapter.dbt_adapter.log_performance"):
            adapter = DbtAdapter.load(
                no_artifacts=True,
                project_dir=project_dir,
                profiles_dir=project_dir,
                unsafe_sql=False,  # sandbox ON
            )

        _, table = adapter.execute("SELECT 1 AS x, 'a' AS y", fetch=True)
        assert len(table.rows) == 1, f"Expected 1 row, got {{len(table.rows)}}"
        print("OK")
    """
    )
    _run_sandbox_script(script)


def test_duckdb_sandbox_disabled_when_unsafe_sql_true():
    """With unsafe_sql=True, dangerous SQL must succeed (opt-out preserves old behavior)."""
    script = textwrap.dedent(
        f"""
        import os, tempfile
        from unittest.mock import patch
        from recce.adapter.dbt_adapter import DbtAdapter

        project_dir = {_PROJECT_DIR!r}

        with patch("recce.adapter.dbt_adapter.log_performance"):
            adapter = DbtAdapter.load(
                no_artifacts=True,
                project_dir=project_dir,
                profiles_dir=project_dir,
                unsafe_sql=True,
            )

        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            out_path = f.name
        try:
            adapter.execute(f"COPY (SELECT 1 AS x) TO '{{out_path}}'")
            assert os.path.exists(out_path) and os.path.getsize(out_path) > 0, (
                "COPY TO produced no output"
            )
        finally:
            if os.path.exists(out_path):
                os.unlink(out_path)
        print("OK")
    """
    )
    _run_sandbox_script(script)
