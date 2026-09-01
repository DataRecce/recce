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

    # The adapter imports `sqlglot.Expression`, which only the sqlglot pin that
    # sqlmesh brings re-exports at the top level. Alias the real class rather
    # than stubbing sqlglot wholesale.
    import sqlglot
    import sqlglot.expressions

    monkeypatch.setattr(sqlglot, "Expression", sqlglot.expressions.Expression, raising=False)


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
    # Called unbound: SqlmeshAdapter still leaves BaseAdapter.select_nodes
    # abstract, so the class cannot be instantiated. get_lineage only reads
    # `context`, `base_env` and `curr_env`, so a stand-in exercises the real
    # method body.
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
