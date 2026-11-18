"""SQLMesh lineage must declare its own schema coverage.

SQLMesh has no `catalog.json`: a snapshot's `columns_to_types` *is* the
authoritative schema. The canonical classifier treats a node with no
`catalog_status` as legacy evidence and fails closed, so an adapter that stays
silent leaves every SQLMesh comparison permanently "unchecked" — schema diffs
suppressed, and remediation copy telling a SQLMesh user to run
`dbt docs generate`.

`sqlmesh` is an integration-only dependency (see
.github/workflows/integration-tests-sqlmesh.yaml), so the module graph is
stubbed here to keep this regression pinned in the normal unit-test run.
"""

import sys
from types import ModuleType
from unittest.mock import MagicMock

import pytest

from recce.artifact_health import classify_schema_coverage


def _install_sqlmesh_stubs(monkeypatch):
    for name in (
        "sqlmesh",
        "sqlmesh.core",
        "sqlmesh.core.context",
        "sqlmesh.core.environment",
        "sqlmesh.core.state_sync",
    ):
        monkeypatch.setitem(sys.modules, name, ModuleType(name))
    sys.modules["sqlmesh.core.context"].Context = type("Context", (), {})
    sys.modules["sqlmesh.core.environment"].Environment = type("Environment", (), {})
    sys.modules["sqlmesh.core.state_sync"].StateReader = type("StateReader", (), {})


def _snapshot(name, columns):
    snapshot = MagicMock()
    snapshot.node_type = "MODEL"
    snapshot.name = name
    snapshot.fingerprint.data_hash = "hash"
    snapshot.parents = []
    snapshot.model.name = name
    snapshot.model.columns_to_types = {column: "INT" for column in columns}
    return snapshot


@pytest.fixture
def sqlmesh_adapter(monkeypatch):
    _install_sqlmesh_stubs(monkeypatch)
    monkeypatch.delitem(sys.modules, "recce.adapter.sqlmesh_adapter", raising=False)
    from recce.adapter.sqlmesh_adapter import SqlmeshAdapter

    return SqlmeshAdapter


def _lineage(adapter_cls, snapshots):
    # Exercise lineage independently of connection setup and environment loading.
    adapter = MagicMock()
    adapter.context.state_reader.get_snapshots.return_value = {s.name: s for s in snapshots}
    return adapter_cls.get_lineage(adapter, base=False)


def test_sqlmesh_models_are_comparable_without_a_dbt_catalog(sqlmesh_adapter):
    """A SQLMesh model whose columns are known is covered evidence."""
    lineage = _lineage(sqlmesh_adapter, [_snapshot("db.orders", ["id", "amount"])])

    assert lineage["nodes"]["db.orders"]["catalog_status"] == "covered"


def test_sqlmesh_schema_comparison_is_complete_not_partial(sqlmesh_adapter):
    """AC9: a healthy SQLMesh project must not report a coverage gap, and its
    real column removals must survive to the consumer."""
    base = _lineage(sqlmesh_adapter, [_snapshot("db.orders", ["id", "gone"])])
    current = _lineage(sqlmesh_adapter, [_snapshot("db.orders", ["id"])])

    coverage = classify_schema_coverage(base["nodes"], current["nodes"], ["db.orders"])

    assert coverage.status == "complete"
    assert coverage.unchecked_node_ids == frozenset()
    assert coverage.checked_node_ids == frozenset({"db.orders"})


def test_sqlmesh_model_with_unknown_columns_fails_closed(sqlmesh_adapter):
    """Honesty in the other direction: if SQLMesh resolved no columns, the
    adapter must not claim coverage it does not have."""
    lineage = _lineage(sqlmesh_adapter, [_snapshot("db.opaque", [])])

    assert lineage["nodes"]["db.opaque"]["catalog_status"] == "unchecked"


@pytest.fixture
def concrete_sqlmesh_adapter(sqlmesh_adapter):
    # Keep the sandbox regressions independent of the pre-existing abstract-method
    # blocker, which has its own regression below.
    class ConcreteSqlmeshAdapter(sqlmesh_adapter):
        def select_nodes(self, *args, **kwargs):
            return super().select_nodes(*args, **kwargs)

    return ConcreteSqlmeshAdapter


def _load(adapter_cls, monkeypatch, context, **kwargs):
    monkeypatch.setattr(sys.modules["recce.adapter.sqlmesh_adapter"], "SqlmeshContext", lambda **kw: context)
    context.state_reader.get_environment.side_effect = lambda name: type("Env", (), {"name": name})()
    return adapter_cls.load(sqlmesh_envs="prod:dev", **kwargs)


@pytest.fixture
def duckdb_context(tmp_path):
    from contextlib import nullcontext

    import duckdb

    connection = duckdb.connect(str(tmp_path / "models.duckdb"))
    connection.execute("CREATE TABLE orders AS SELECT 1 AS id UNION ALL SELECT 2")
    context = MagicMock()
    context.default_dialect = "duckdb"
    context.engine_adapter.dialect = "duckdb"
    context.engine_adapter.cursor = connection
    context.engine_adapter.transaction.side_effect = nullcontext
    context.fetchdf.side_effect = lambda expression: context.engine_adapter.cursor.execute(
        expression.sql(dialect="duckdb")
    ).fetchdf()
    yield context
    connection.close()


def _settings(cursor):
    return cursor.execute(
        "SELECT current_setting('autoinstall_known_extensions'), "
        "current_setting('autoload_known_extensions'), "
        "current_setting('enable_external_access'), current_setting('lock_configuration')"
    ).fetchone()


def test_load_returns_concrete_sqlmesh_adapter(sqlmesh_adapter, monkeypatch, duckdb_context):
    from recce.exceptions import RecceException

    adapter = _load(sqlmesh_adapter, monkeypatch, duckdb_context)
    assert isinstance(adapter, sqlmesh_adapter)
    with pytest.raises(RecceException, match="SQLMesh.*selectors"):
        adapter.select_nodes(select="state:modified")


def test_load_locks_down_duckdb_query_engine_by_default(concrete_sqlmesh_adapter, monkeypatch, duckdb_context):
    # Engine dialect must govern the guard even if the model dialect differs.
    duckdb_context.default_dialect = "postgres"
    _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context)
    assert _settings(duckdb_context.engine_adapter.cursor) == (False, False, False, True)


def test_sqlmesh_worker_uses_locked_duckdb_connection(concrete_sqlmesh_adapter, monkeypatch, duckdb_context):
    from concurrent.futures import ThreadPoolExecutor

    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context)

    def worker():
        # A reopened connection must be guarded too, not just the load cursor.
        import duckdb

        connection = duckdb.connect()
        try:
            duckdb_context.engine_adapter.cursor = connection
            frame, more = adapter.fetchdf_with_limit("SELECT 42 AS answer", limit=1)
            assert frame.iloc[0, 0] == 42
            assert more is False
            assert _settings(connection) == (False, False, False, True)
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as executor:
        executor.submit(worker).result(timeout=20)


def test_sqlmesh_lockdown_failure_prevents_query_execution(concrete_sqlmesh_adapter, monkeypatch, duckdb_context):
    from recce.exceptions import RecceConfigException

    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context, duckdb_external_access=True)
    # A conflicting trusted config that is already locked must fail closed.
    duckdb_context.engine_adapter.cursor.execute("SET lock_configuration = true")
    adapter.duckdb_external_access = False
    with pytest.raises(RecceConfigException, match="DuckDB.*sandbox"):
        adapter.fetchdf_with_limit("SELECT * FROM orders")
    duckdb_context.fetchdf.assert_not_called()
    with pytest.raises(RecceConfigException, match="DuckDB.*sandbox"):
        _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context)


def test_sqlmesh_denies_external_io_and_preserves_local_models(
    concrete_sqlmesh_adapter, monkeypatch, duckdb_context, tmp_path
):
    from recce.exceptions import DuckDBExternalAccessBlocked

    csv = tmp_path / "input.csv"
    csv.write_text("id\n7\n")
    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context)
    frame, more = adapter.fetchdf_with_limit("SELECT * FROM orders ORDER BY id", limit=1)
    assert frame.iloc[:, 0].tolist() == [1]
    assert more is True
    # A closed loopback port avoids outbound traffic; DuckDB must deny before I/O.
    for source in (csv.as_posix(), "http://127.0.0.1:1/blocked.csv"):
        with pytest.raises(DuckDBExternalAccessBlocked, match="--duckdb-external-access"):
            adapter.fetchdf_with_limit(f"SELECT * FROM read_csv('{source}')")
    # The underlying engine must also block writes/extensions and configuration changes.
    cursor = duckdb_context.engine_adapter.cursor
    for sql in (
        f"COPY orders TO '{(tmp_path / 'output.csv').as_posix()}'",
        "LOAD httpfs",
        "SET enable_external_access = true",
    ):
        with pytest.raises(Exception):
            cursor.execute(sql)
    assert not (tmp_path / "output.csv").exists()


@pytest.mark.parametrize("as_ast", [False, True], ids=["text", "ast"])
def test_sqlmesh_rejects_non_query_statements_before_fetch(
    concrete_sqlmesh_adapter, monkeypatch, duckdb_context, as_ast
):
    from sqlglot import exp, parse_one

    from recce.exceptions import RecceException

    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context, duckdb_external_access=True)
    # Reject writes even when external access is intentionally enabled.
    for sql in (
        "DELETE FROM orders",
        "CREATE TABLE x AS SELECT 1",
        "COPY orders TO 'output.csv'",
        "PRAGMA version",
        "INSTALL httpfs",
        "LOAD httpfs",
        "SET enable_external_access = true",
        "WITH x AS (DELETE FROM orders RETURNING *) SELECT * FROM x",
        "SELECT * INTO x FROM orders",
        "SELECT * FROM orders FOR UPDATE",
    ):
        value = parse_one(sql, read="duckdb") if as_ast else sql
        with pytest.raises(RecceException, match="^SQLMesh requires a single read-only query\\.$"):
            adapter.fetchdf_with_limit(value)
    duckdb_context.fetchdf.assert_not_called()
    # Ordinary SELECT, CTE, UNION and query-diff-shaped ASTs remain accepted.
    for sql in (
        "SELECT 1",
        "WITH x AS (SELECT 1) SELECT * FROM x",
        "SELECT 1 UNION SELECT 2",
        "WITH base AS (SELECT 1 AS id), curr AS (SELECT 2 AS id) SELECT * FROM base FULL JOIN curr USING (id)",
    ):
        value = parse_one(sql, read="duckdb") if as_ast else sql
        assert isinstance(adapter.replace_virtual_tables(value), exp.Query)
    duckdb_context.models = {"orders": type("Model", (), {"name": "db.orders"})()}
    rewritten = adapter.replace_virtual_tables("SELECT * FROM db.orders", base=False)
    assert "db__dev.orders" in rewritten.sql()


@pytest.mark.parametrize("as_ast", [False, True], ids=["text", "ast"])
def test_sqlmesh_rejects_multiple_statements_before_fetch(
    concrete_sqlmesh_adapter, monkeypatch, duckdb_context, as_ast
):
    from sqlglot import exp, parse_one

    from recce.exceptions import RecceException

    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context, duckdb_external_access=True)
    for sql in ("SELECT 1; SELECT 2", "SELECT 1; DELETE FROM orders"):
        value = parse_one(sql, read="duckdb") if as_ast else sql
        with pytest.raises(RecceException, match="^SQLMesh requires a single read-only query\\.$"):
            adapter.fetchdf_with_limit(value)
    duckdb_context.fetchdf.assert_not_called()
    assert isinstance(adapter.replace_virtual_tables("SELECT 1; -- trailing comment"), exp.Query)


def test_sqlmesh_rejects_invalid_sql_without_echoing_input(concrete_sqlmesh_adapter, monkeypatch, duckdb_context):
    from recce.exceptions import RecceException

    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context)
    for sql in ("", "-- only a comment", "SELECT FROM", None):
        with pytest.raises(RecceException, match="^SQLMesh requires a single read-only query\\.$"):
            adapter.fetchdf_with_limit(sql)
    duckdb_context.fetchdf.assert_not_called()


def test_sqlmesh_opt_in_skips_only_duckdb_policy(concrete_sqlmesh_adapter, monkeypatch, duckdb_context, tmp_path):
    from recce.exceptions import RecceException

    csv = tmp_path / "input.csv"
    csv.write_text("id\n7\n")
    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context, duckdb_external_access=True)
    frame, _ = adapter.fetchdf_with_limit(f"SELECT * FROM read_csv('{csv.as_posix()}')")
    assert frame.iloc[0, 0] == 7
    assert _settings(duckdb_context.engine_adapter.cursor) == (True, True, True, False)
    with pytest.raises(RecceException, match="single read-only query"):
        adapter.fetchdf_with_limit("DELETE FROM orders")
    # Non-DuckDB engines must not receive DuckDB SET/current_setting statements.
    duckdb_context.engine_adapter.dialect = "postgres"
    duckdb_context.engine_adapter.cursor = MagicMock()
    duckdb_context.fetchdf.return_value = frame
    duckdb_context.fetchdf.side_effect = None
    adapter = _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context)
    adapter.fetchdf_with_limit("SELECT 1")
    duckdb_context.engine_adapter.cursor.execute.assert_not_called()


def test_sqlmesh_query_passes_sql_template_to_adapter(sqlmesh_adapter, monkeypatch):
    import pandas as pd

    from recce.tasks import QueryTask
    from recce.tasks.query import QUERY_LIMIT

    context = MagicMock(adapter_type="sqlmesh")
    context.adapter.fetchdf_with_limit.return_value = (pd.DataFrame({"answer": [42]}), False)
    monkeypatch.setattr("recce.tasks.query.default_context", lambda: context)
    result = QueryTask({"sql_template": "SELECT 42 AS answer"}).execute()
    context.adapter.fetchdf_with_limit.assert_called_once_with("SELECT 42 AS answer", base=False, limit=QUERY_LIMIT)
    assert result.data == [(42,)]


def test_sqlmesh_lockdown_removes_external_path_exemptions(
    concrete_sqlmesh_adapter, monkeypatch, duckdb_context, tmp_path
):
    csv = tmp_path / "allowed.csv"
    csv.write_text("id\n7\n")
    duckdb_context.engine_adapter.cursor.execute("SET allowed_directories = [?]", [str(tmp_path)])
    duckdb_context.engine_adapter.cursor.execute("SET allowed_paths = [?]", [str(csv)])
    _load(concrete_sqlmesh_adapter, monkeypatch, duckdb_context)
    paths, directories = duckdb_context.engine_adapter.cursor.execute(
        "SELECT current_setting('allowed_paths'), current_setting('allowed_directories')"
    ).fetchone()
    # DuckDB retains exemptions for its own open database/WAL files, but no
    # configured external source or directory may survive the lockdown.
    assert str(csv) not in paths
    assert directories == []
