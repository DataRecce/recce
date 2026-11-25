"""Live SQLMesh cursor initialization and sharing regressions.

Requires the optional SQLMesh dependency, as in the SQLMesh integration job.
"""

from concurrent.futures import ThreadPoolExecutor
from threading import Event, current_thread
from types import SimpleNamespace

import pytest

from recce.adapter.duckdb_security import lock_down_duckdb

try:
    from sqlmesh.core.config import Config, DuckDBConnectionConfig, ModelDefaultsConfig
    from sqlmesh.core.context import Context

    import recce.adapter.sqlmesh_adapter as adapter_module
    from recce.adapter.sqlmesh_adapter import SqlmeshAdapter
except ModuleNotFoundError as exc:
    if exc.name != "sqlmesh":
        raise
    pytest.skip("Live connection tests require the optional SQLMesh dependency", allow_module_level=True)


def _load_project(tmp_path, monkeypatch, duckdb_external_access=False, **connection_options):
    import duckdb

    database = tmp_path / "models.duckdb"
    with duckdb.connect(str(database)) as connection:
        connection.execute("CREATE TABLE orders AS SELECT 42 AS id")
    config = Config(
        default_connection=DuckDBConnectionConfig(database=str(database), **connection_options),
        model_defaults=ModelDefaultsConfig(dialect="duckdb"),
    )
    state_reader = SimpleNamespace(get_environment=lambda name: SimpleNamespace(name=name))
    monkeypatch.setattr(Context, "state_reader", property(lambda self: state_reader))
    monkeypatch.chdir(tmp_path)
    return SqlmeshAdapter.load(
        sqlmesh_envs="prod:prod", sqlmesh_config=config, duckdb_external_access=duckdb_external_access
    )


@pytest.mark.parametrize(
    "settings", [{"enable_external_access": "false"}, {"temp_directory": "", "enable_external_access": "false"}]
)
def test_pre_restricted_connection_can_read_model(tmp_path, settings, monkeypatch):
    adapter = _load_project(tmp_path, monkeypatch, connector_config=settings)
    engine = adapter.context.engine_adapter
    try:
        frame, _ = adapter.fetchdf_with_limit(
            "SELECT id, current_setting('enable_external_access'), current_setting('lock_configuration') FROM orders"
        )
        assert list(frame.itertuples(index=False, name=None)) == [(42, False, True)]
        assert engine.cursor.execute("SELECT current_setting('allowed_directories')").fetchone() == ([],)
    finally:
        engine.close()


@pytest.mark.parametrize("threads", [2, "2"])
def test_initialized_worker_can_read_model(tmp_path, threads, monkeypatch):
    adapter = _load_project(tmp_path, monkeypatch, concurrent_tasks=2, connector_config={"threads": threads})
    engine = adapter.context.engine_adapter
    try:
        frame, _ = adapter.fetchdf_with_limit("SELECT id FROM orders", limit=1)
        assert frame["id"].tolist() == [42]
        with ThreadPoolExecutor(max_workers=1) as executor:
            frame, _ = executor.submit(adapter.fetchdf_with_limit, "SELECT id FROM orders", limit=1).result(timeout=20)
        assert frame["id"].tolist() == [42]
    finally:
        engine.close()


@pytest.mark.parametrize("shared_adapter", [False, True], ids=["same-adapter", "shared-pool-opt-in"])
def test_parallel_selects_can_both_verify_the_sandbox(tmp_path, monkeypatch, shared_adapter):
    adapter = _load_project(tmp_path, monkeypatch)
    engine = adapter.context.engine_adapter
    other = (
        type(adapter)(adapter.context, adapter.base_env, adapter.curr_env, duckdb_external_access=True)
        if shared_adapter
        else adapter
    )
    verification_pending = Event()
    other_finished = Event()
    first_worker = {}

    class PauseBeforeFetch:
        def __init__(self, cursor):
            self.cursor = cursor

        def execute(self, sql):
            result = self.cursor.execute(sql)
            if sql.startswith("SELECT current_setting("):
                verification_pending.set()
                other_finished.wait(timeout=1)
            return result

        def __getattr__(self, name):
            return getattr(self.cursor, name)

    def first_read():
        first_worker["thread"] = current_thread()
        return adapter.fetchdf_with_limit("SELECT id FROM orders", limit=1)

    def inspect(cursor):
        if current_thread() is first_worker.get("thread"):
            cursor = PauseBeforeFetch(cursor)
        return lock_down_duckdb(cursor)

    try:
        monkeypatch.setattr(adapter_module, "lock_down_duckdb", inspect)
        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(first_read)
            assert verification_pending.wait(timeout=5)
            second = executor.submit(other.fetchdf_with_limit, "SELECT id FROM orders", limit=1)
            second.add_done_callback(lambda completed: other_finished.set())
            assert second.result(timeout=20)[0]["id"].tolist() == [42]
            assert first.result(timeout=20)[0]["id"].tolist() == [42]
    finally:
        engine.close()


@pytest.mark.parametrize("external_access", [False, True], ids=["sandbox", "opt-in"])
def test_user_queries_execute_read_only_even_through_a_model(tmp_path, monkeypatch, external_access):
    adapter = _load_project(tmp_path, monkeypatch, duckdb_external_access=True)
    engine = adapter.context.engine_adapter
    try:
        engine.execute("CREATE SEQUENCE model_sequence START 1")
        engine.execute("CREATE VIEW sequence_model AS SELECT nextval('model_sequence') AS id")
        adapter.duckdb_external_access = external_access
        # This looks like an ordinary model read at the AST boundary. DuckDB
        # must enforce read-only execution even for routines hidden in views.
        with pytest.raises(Exception, match="read-only"):
            adapter.fetchdf_with_limit("SELECT id FROM sequence_model")
        # A failed query must leave the cursor usable and the sequence untouched.
        assert adapter.fetchdf_with_limit("SELECT id FROM orders")[0]["id"].tolist() == [42]
        assert engine.cursor.execute("SELECT nextval('model_sequence')").fetchone() == (1,)
    finally:
        engine.close()
