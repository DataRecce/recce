"""Reproductions for DRC-5337 (REC-03). These tests assert the SECURE behavior and
currently FAIL, each pinning one flaw in generate_sql(safe_template=True) / execute() / cli."""

import inspect
from unittest.mock import patch

import pytest
from dbt.contracts.graph.nodes import Macro
from dbt.parser.sql import SqlBlockParser

from recce.exceptions import DuckDBExternalAccessBlocked, RecceException


def _add_macro(helper, name, body, package="recce_test"):
    unique_id = f"macro.{package}.{name}"
    macro = Macro(
        name=name,
        resource_type="macro",
        package_name=package,
        path=f"macros/{name}.sql",
        original_file_path=f"macros/{name}.sql",
        unique_id=unique_id,
        macro_sql=f"{{% macro {name}(a, b=none) %}}{body}{{% endmacro %}}",
    )
    helper.curr_manifest.macros[unique_id] = macro
    return unique_id


def test_safe_template_does_not_invoke_parse_remote(dbt_test_helper):
    """Fails while generate_sql calls parser.parse_remote before the safe_template branch (adapter __init__.py:738)."""
    with patch.object(SqlBlockParser, "parse_remote", autospec=True) as spy:
        try:
            dbt_test_helper.adapter.generate_sql("select {{ var('test_value', 2) }} as x", safe_template=True)
        except Exception:
            pass
    assert spy.call_count == 0, "parse_remote (unsandboxed MacroFuzzEnvironment) ran under safe_template=True"


def test_safe_template_ignores_custom_ref_macro_override(dbt_test_helper):
    """Fails while a project macro named `ref` is executed via dbt's runtime ref (safe_context['ref'])."""
    dbt_test_helper.create_model("customers", "id\n1\n", "id\n1\n")
    _add_macro(dbt_test_helper, "ref", "{{ return('RECCE_REF_CANARY') }}")
    _add_macro(dbt_test_helper, "source", "{{ return('RECCE_SOURCE_CANARY') }}")
    sql = dbt_test_helper.adapter.generate_sql(
        "select * from {{ ref('customers') }}",
        provided_manifest=dbt_test_helper.curr_manifest,
        safe_template=True,
    )
    assert "RECCE_REF_CANARY" not in sql, f"custom macro ref override executed: {sql}"
    assert "customers" in sql


def test_safe_template_missing_var_does_not_leak_project_vars(dbt_test_helper):
    """Fails while RequiredVarNotFoundError message dumps the merged vars dict."""
    cfg = dbt_test_helper.adapter.runtime_config
    secret = "RECCE_SECRET_VAR_VALUE"
    with patch.object(type(cfg), "vars", create=True, new=cfg.vars):
        cfg.vars.vars = {**getattr(cfg.vars, "vars", {}), "secret_token": secret}
        try:
            dbt_test_helper.adapter.generate_sql("select {{ var('missing_var') }}", safe_template=True)
        except Exception as e:
            assert secret not in str(e), f"project vars leaked in error: {e}"
            assert "secret_token" not in str(e)
        else:
            pytest.fail("missing var without default should raise")


def test_non_duckdb_error_with_duckdb_substring_stays_unredacted_marker_free(dbt_test_helper):
    """Fails while execute() wraps ANY adapter's error containing a DuckDB phrase into DuckDBExternalAccessBlocked
    (public_run_error returns that unredacted). Simulates a non-duckdb adapter."""
    adapter = dbt_test_helper.adapter
    err = Exception("Snowflake: file system operations are disabled by configuration for user=admin host=secret")
    with patch.object(adapter.adapter, "execute", side_effect=err), patch.object(
        type(adapter.adapter), "type", return_value="snowflake"
    ):
        with pytest.raises(Exception) as ei:
            adapter.execute("select 1")
    assert not isinstance(ei.value, DuckDBExternalAccessBlocked), "non-duckdb error promoted to DuckDBExternalAccessBlocked"


def test_duckdb_external_access_message_is_static(dbt_test_helper):
    """Fails while raw str(e) is embedded in DuckDBExternalAccessBlocked (even for duckdb)."""
    adapter = dbt_test_helper.adapter
    err = Exception("file system operations are disabled by configuration: /etc/secret/path.csv")
    with patch.object(adapter.adapter, "execute", side_effect=err):
        with pytest.raises(DuckDBExternalAccessBlocked) as ei:
            adapter.execute("select 1")
    assert "/etc/secret/path.csv" not in str(ei.value)


def test_cli_execute_sql_uses_safe_template():
    """Fails while recce/cli.py _execute_sql calls generate_sql without safe_template=True."""
    from contextlib import nullcontext
    from unittest.mock import MagicMock

    from recce import cli

    adapter = MagicMock()
    adapter.connection_named.return_value = nullcontext()
    adapter.execute.return_value = (None, MagicMock(rows=[], column_names=[]))
    context = MagicMock(adapter=adapter)
    cli._execute_sql(context, "select 1")
    assert adapter.generate_sql.call_args.kwargs.get("safe_template") is True
