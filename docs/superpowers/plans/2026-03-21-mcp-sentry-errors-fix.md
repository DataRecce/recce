# MCP Sentry Error Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 DRC issues (3051-3054) to eliminate 1,329 Sentry error events from MCP server tools, via error classification extension and a None relation guard.

**Architecture:** Two layered PRs. PR1 extends `SYNTAX_ERROR_INDICATORS` with 3 new patterns and adds verification tests for existing classification. PR2 adds a None guard in `get_columns()` with a `RecceException` whose message flows through the classification path.

**Tech Stack:** Python 3.9+, pytest, MCP SDK

**Spec:** `docs/superpowers/specs/2026-03-20-mcp-sentry-errors-fix-design.md`

---

## PR1 — Error Classification Extension (DRC-3052 + DRC-3053 + DRC-3054)

### Task 1: Add verification tests for DRC-3052 (existing classification)

These tests confirm that Snowflake's combined "does not exist or not authorized" messages are already classified by existing indicators. Classification priority: `permission_denied` wins over `table_not_found` because `_classify_db_error` checks it first.

**Files:**
- Modify: `tests/test_mcp_server.py` — add to `TestErrorClassification` class (after line 1031)

- [ ] **Step 1: Write DRC-3052 verification tests**

Add these tests inside the existing `TestErrorClassification` class in `tests/test_mcp_server.py`, after `test_classify_unknown_error`:

```python
def test_classify_snowflake_table_does_not_exist_or_not_authorized(self, mcp_server):
    """DRC-3052 / RECCE-746: Snowflake 'does not exist or not authorized' matches permission_denied first."""
    server, _ = mcp_server
    # Exact Sentry error messages — permission_denied wins because it's checked first
    assert (
        server._classify_db_error(
            "Database Error: Table 'FCT_GHA_AUCTION_COMBINED_SPEND' does not exist or not authorized."
        )
        == "permission_denied"
    )

def test_classify_snowflake_schema_does_not_exist_or_not_authorized(self, mcp_server):
    """DRC-3052 / RECCE-7A7: Schema variant also matches permission_denied first."""
    server, _ = mcp_server
    assert (
        server._classify_db_error(
            "Database Error: Schema 'PARADIME_TURBO_CI_PR_628_BASE' does not exist or not authorized."
        )
        == "permission_denied"
    )

def test_classify_snowflake_object_does_not_exist_or_not_authorized(self, mcp_server):
    """DRC-3052 / RECCE-73P: Object variant also matches permission_denied first."""
    server, _ = mcp_server
    assert (
        server._classify_db_error(
            "Database Error: Object 'STG_PRODUCT_ANALYTICS_EVENTS' does not exist or not authorized."
        )
        == "permission_denied"
    )
```

- [ ] **Step 2: Run tests to verify they pass (no code changes needed)**

Run: `python -m pytest tests/test_mcp_server.py::TestErrorClassification -v`
Expected: All 3 new tests PASS (existing indicators already cover these patterns).

- [ ] **Step 3: Commit**

```bash
git add tests/test_mcp_server.py
git commit -s -m "test(mcp): add DRC-3052 verification tests for Snowflake error classification

Verify existing indicators classify 'does not exist or not authorized'
as permission_denied (checked before table_not_found). No code changes
needed — confirms DRC-2754 already covers these Sentry errors.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add new SYNTAX_ERROR_INDICATORS (DRC-3053 + DRC-3054)

**Files:**
- Modify: `recce/tasks/rowcount.py:57-60` — extend `SYNTAX_ERROR_INDICATORS`

- [ ] **Step 1: Write failing tests for new indicators**

Add these tests inside `TestErrorClassification` in `tests/test_mcp_server.py`:

```python
def test_classify_snowflake_invalid_query_block(self, mcp_server):
    """DRC-3054 / RECCE-72T: Snowflake 002076 (42601) SQL compilation error."""
    server, _ = mcp_server
    assert (
        server._classify_db_error(
            "SQL compilation error: Invalid query block 'db_staging'"
        )
        == "syntax_error"
    )

def test_classify_snowflake_column_count_mismatch(self, mcp_server):
    """DRC-3054 / RECCE-73R: Snowflake 002057 (42601) view definition mismatch."""
    server, _ = mcp_server
    assert (
        server._classify_db_error(
            "SQL compilation error: View definition column count mismatch in MART_VISITS"
        )
        == "syntax_error"
    )

def test_classify_snowflake_invalid_identifier(self, mcp_server):
    """DRC-3053 / RECCE-8BZ: Snowflake 000904 (42000) invalid column reference."""
    server, _ = mcp_server
    assert (
        server._classify_db_error(
            "SQL compilation error: invalid identifier 'DBT_VALID_FROM'"
        )
        == "syntax_error"
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_mcp_server.py::TestErrorClassification::test_classify_snowflake_invalid_query_block tests/test_mcp_server.py::TestErrorClassification::test_classify_snowflake_column_count_mismatch tests/test_mcp_server.py::TestErrorClassification::test_classify_snowflake_invalid_identifier -v`
Expected: 3 FAIL — these patterns are not in `SYNTAX_ERROR_INDICATORS` yet.

- [ ] **Step 3: Add new indicators to SYNTAX_ERROR_INDICATORS**

In `recce/tasks/rowcount.py`, replace the existing `SYNTAX_ERROR_INDICATORS`:

```python
SYNTAX_ERROR_INDICATORS = [
    "SYNTAX ERROR",
    "PARSER ERROR",
    "INVALID QUERY BLOCK",   # DRC-3054: Snowflake 002076 (42601)
    "COLUMN COUNT MISMATCH",  # DRC-3054: Snowflake 002057 (42601)
    "INVALID IDENTIFIER",    # DRC-3053: Snowflake 000904 (42000)
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_mcp_server.py::TestErrorClassification -v`
Expected: ALL tests in TestErrorClassification PASS (existing + new).

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `python -m pytest tests/test_mcp_server.py -v`
Expected: No regressions. Pre-existing SPA test failures (if any) are unrelated.

- [ ] **Step 6: Commit**

```bash
git add recce/tasks/rowcount.py tests/test_mcp_server.py
git commit -s -m "fix(mcp): extend error classification for Snowflake SQL errors (DRC-3053, DRC-3054)

Add INVALID QUERY BLOCK, COLUMN COUNT MISMATCH, and INVALID IDENTIFIER
to SYNTAX_ERROR_INDICATORS. These Snowflake errors now classify as
syntax_error -> logger.warning instead of logger.error -> Sentry.

MCP protocol still returns isError=true to callers — users see the
error, but Sentry is not spammed with expected SQL compilation failures.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Integration test — classified errors log as warning

Verify the full `call_tool` handler path: DB error -> `_classify_db_error` -> `logger.warning` (not `logger.error`).

**Files:**
- Modify: `tests/test_mcp_server.py` — add to `TestCallToolHandler` class

- [ ] **Step 1: Write integration test for new syntax_error classification**

Add to `TestCallToolHandler` in `tests/test_mcp_server.py`. Must use `_invoke_call_tool` (not direct tool handler call) to route through the `call_tool` classification/logging path:

```python
@pytest.mark.asyncio
async def test_new_syntax_error_logs_warning(self, mcp_server, caplog):
    """DRC-3053/3054: New SYNTAX_ERROR indicators should log warning through call_tool."""
    import logging

    server, mock_context = mcp_server
    mock_context.get_lineage_diff.side_effect = Exception(
        "SQL compilation error: invalid identifier 'DBT_VALID_FROM'"
    )
    with caplog.at_level(logging.WARNING, logger="recce.mcp_server"):
        result = await self._invoke_call_tool(server, "lineage_diff")
    assert result.root.isError is True
    assert "Expected syntax_error error" in caplog.text
```

**Note:** Direct `_tool_*` calls bypass `call_tool` — classification and logging only happen in the `call_tool` handler. Always use `_invoke_call_tool` for integration tests.

- [ ] **Step 2: Run test to verify it passes**

Run: `python -m pytest tests/test_mcp_server.py::TestCallToolHandler::test_new_syntax_error_logs_warning -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_mcp_server.py
git commit -s -m "test(mcp): add integration test for new syntax_error classification path

Verify that new SYNTAX_ERROR_INDICATORS flow through call_tool handler
as logger.warning, not logger.error.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: PR1 final verification and lint

- [ ] **Step 1: Run Python formatting and linting**

Run: `make format && make flake8`
Expected: Clean output, no violations.

- [ ] **Step 2: Run full test suite**

Run: `python -m pytest tests/test_mcp_server.py -v`
Expected: All tests pass.

- [ ] **Step 3: Verify indicator imports are correct**

Run: `python -c "from recce.tasks.rowcount import SYNTAX_ERROR_INDICATORS; print(SYNTAX_ERROR_INDICATORS)"`
Expected: List includes all 5 indicators.

---

## PR2 — None Relation Guard (DRC-3051)

### Task 5: Write failing tests for None relation guard

**Files:**
- Modify: `tests/test_mcp_server.py` — add classification test to `TestErrorClassification`
- Create: `tests/test_get_columns_guard.py` — adapter-level guard tests (follows test locality convention)

- [ ] **Step 1: Write classification test for RecceException message**

Add to `TestErrorClassification` in `tests/test_mcp_server.py`:

```python
def test_classify_recce_exception_model_not_found(self, mcp_server):
    """DRC-3051: RecceException from get_columns None guard should classify as table_not_found."""
    server, _ = mcp_server
    # The RecceException message intentionally contains "does not exist"
    # so _classify_db_error classifies it as table_not_found -> warning
    msg = "Model 'stg_orders' does not exist in base environment. Check that the model is in the manifest and catalog."
    assert server._classify_db_error(msg) == "table_not_found"
```

- [ ] **Step 2: Run test to verify it passes**

This validates the error message wording matches existing `TABLE_NOT_FOUND_INDICATORS`.

Run: `python -m pytest tests/test_mcp_server.py::TestErrorClassification::test_classify_recce_exception_model_not_found -v`
Expected: PASS

- [ ] **Step 3: Write failing adapter-level guard tests**

Create `tests/test_get_columns_guard.py` (separate file — adapter tests belong outside `test_mcp_server.py`):

```python
"""DRC-3051: get_columns should raise RecceException when create_relation returns None."""
from unittest.mock import MagicMock

import pytest

from recce.adapter.dbt_adapter import DbtAdapter
from recce.exceptions import RecceException


class TestGetColumnsNoneGuard:

    def test_get_columns_raises_when_relation_is_none(self):
        """get_columns raises RecceException with 'does not exist' message when model not in manifest."""
        mock_adapter = MagicMock(spec=DbtAdapter)
        mock_adapter.create_relation = MagicMock(return_value=None)
        mock_adapter.get_columns = DbtAdapter.get_columns.__get__(mock_adapter)

        with pytest.raises(RecceException, match="does not exist in base environment"):
            mock_adapter.get_columns("nonexistent_model", base=True)

    def test_get_columns_raises_current_env_message(self):
        """Error message should say 'current' when base=False."""
        mock_adapter = MagicMock(spec=DbtAdapter)
        mock_adapter.create_relation = MagicMock(return_value=None)
        mock_adapter.get_columns = DbtAdapter.get_columns.__get__(mock_adapter)

        with pytest.raises(RecceException, match="does not exist in current environment"):
            mock_adapter.get_columns("nonexistent_model", base=False)
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `python -m pytest tests/test_get_columns_guard.py -v`
Expected: 2 FAIL — `get_columns` does not have the None guard yet.

- [ ] **Step 5: Commit failing tests**

```bash
git add tests/test_mcp_server.py tests/test_get_columns_guard.py
git commit -s -m "test(mcp): add failing tests for get_columns None relation guard (DRC-3051)

Classification test in test_mcp_server.py verifies error message wording.
Adapter-level tests in test_get_columns_guard.py verify the actual guard.
Currently failing — guard not yet implemented.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Implement the None relation guard

**Files:**
- Modify: `recce/adapter/dbt_adapter/__init__.py:401-402` — add None check in `get_columns()`

- [ ] **Step 1: Add the None guard**

In `recce/adapter/dbt_adapter/__init__.py`, modify `get_columns()` at line 401:

```python
def get_columns(self, model: str, base=False) -> List[Column]:
    relation = self.create_relation(model, base)
    if relation is None:
        env = "base" if base else "current"
        raise RecceException(
            f"Model '{model}' does not exist in {env} environment. "
            f"Check that the model is in the manifest and catalog."
        )
    get_columns_macro = "get_columns_in_relation"
```

Also ensure `RecceException` is imported at the top of the file. Check if it's already imported:

Run: `grep -n "from recce.exceptions import" recce/adapter/dbt_adapter/__init__.py`

If not present, add: `from recce.exceptions import RecceException`

- [ ] **Step 2: Run tests to verify they pass**

Run: `python -m pytest tests/test_get_columns_guard.py -v`
Expected: 2 PASS

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `python -m pytest tests/test_mcp_server.py tests/test_get_columns_guard.py -v`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add recce/adapter/dbt_adapter/__init__.py tests/test_get_columns_guard.py
git commit -s -m "fix(mcp): add None relation guard in get_columns (DRC-3051)

Raise RecceException with 'does not exist' message when
create_relation returns None (model not in manifest/catalog).
Prevents jinja CaughtMacroError crash in profile_diff.

Error message classified as table_not_found -> logger.warning,
not Sentry error. Eliminates RECCE-5E6 (326 events) and
RECCE-6TV (289 events).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: PR2 final verification and lint

- [ ] **Step 1: Run Python formatting and linting**

Run: `make format && make flake8`
Expected: Clean output.

- [ ] **Step 2: Run full test suite**

Run: `python -m pytest tests/ -v`
Expected: All tests pass (pre-existing SPA failures excluded).

- [ ] **Step 3: Verify the fix eliminates the original crash**

Run: `python -c "from recce.exceptions import RecceException; from recce.adapter.dbt_adapter import DbtAdapter; print('Import OK')" `
Expected: `Import OK` — no circular import issues.
