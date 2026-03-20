# Design Spec: MCP Sentry Error Fixes (DRC-3051, DRC-3052, DRC-3053, DRC-3054)

**Date:** 2026-03-20
**Status:** Draft
**Linear Issues:** DRC-3051 (High), DRC-3052 (High), DRC-3053 (Medium), DRC-3054 (Low)
**Cycle:** 26-8 (2026-03-31 to 2026-04-14)

## Problem

Sentry scan via `/kc-sentry-insight mcp` found 8 production issues (1,329 total events) in the MCP server, grouped into 4 root causes:

| DRC | Root Cause | Events | Sentry IDs |
|-----|-----------|--------|------------|
| 3051 | `profile_diff` crashes when `create_relation` returns None — jinja macro calls `.render()` on None | 615 | RECCE-5E6, RECCE-6TV |
| 3052 | Snowflake "does not exist or not authorized" errors not classified as warnings | 436 | RECCE-746, RECCE-7A7, RECCE-73P |
| 3053 | `query` tool fails on `DBT_VALID_FROM` — snapshot column referenced on non-snapshot table | 51 | RECCE-8BZ |
| 3054 | SQL compilation and view column mismatch errors unclassified | 227 | RECCE-72T, RECCE-73R |

## Approach: Layered Fix in 2 PRs

**PR1 first** (error classification) then **PR2** (bug fix). PR1 reduces Sentry noise immediately with low risk. PR2 addresses the root cause of the most impactful bug.

### PR1 — Error Classification Extension (DRC-3052 + DRC-3053 + DRC-3054)

#### DRC-3052: Verification Task

Existing indicators already cover Snowflake's combined error messages. However, classification priority matters: `_classify_db_error` checks `PERMISSION_DENIED_INDICATORS` before `TABLE_NOT_FOUND_INDICATORS`. Snowflake's "does not exist or not authorized" contains both `"DOES NOT EXIST"` and `"NOT AUTHORIZED"` — so it classifies as `permission_denied` (not `table_not_found`). This is acceptable: both classifications log as `logger.warning`, achieving the goal of suppressing Sentry noise.

**Action:** Write unit tests with exact Sentry error messages (verbatim from RECCE-746, RECCE-7A7, RECCE-73P) to verify classification. Tests should assert `permission_denied` (not `table_not_found`) for these combined messages. If tests pass, DRC-3052 requires no code changes — only test coverage confirmation.

#### DRC-3053 + DRC-3054: New Indicators

Add to `SYNTAX_ERROR_INDICATORS` in `recce/tasks/rowcount.py`:

```python
SYNTAX_ERROR_INDICATORS = [
    "SYNTAX ERROR",
    "PARSER ERROR",
    "INVALID QUERY BLOCK",     # DRC-3054: Snowflake 002076 (42601)
    "COLUMN COUNT MISMATCH",   # DRC-3054: Snowflake 002057 (42601)
    "INVALID IDENTIFIER",      # DRC-3053: Snowflake 000904 (42000)
]
```

No changes needed in `mcp_server.py` — `_classify_db_error` already imports and uses these indicators. Classified errors log as `logger.warning` (no Sentry event) instead of `logger.error`.

**Breadth tradeoff for `INVALID IDENTIFIER`:** This indicator is broad — it would also classify legitimate column-name typos in other tools (row_count_diff, schema_diff) as `syntax_error` warnings rather than errors. This is acceptable because: (1) the MCP protocol still returns `isError: true` to the caller, so the user sees the error; (2) these are expected user/LLM-generated SQL errors, not server bugs; (3) if a specific tool needs stricter behavior, it can be overridden at the tool handler level.

#### Files Changed

| File | Change |
|------|--------|
| `recce/tasks/rowcount.py` | Add 3 entries to `SYNTAX_ERROR_INDICATORS` |
| `tests/test_mcp_error_classification.py` | New parametrized tests for all Sentry error patterns |

### PR2 — None Relation Guard (DRC-3051)

#### Root Cause

```
ProfileDiffTask.execute()
  -> dbt_adapter.get_columns(model, base=True)
    -> create_relation(model, base)         # returns None
    -> execute_macro("get_columns_in_relation", kwargs={"relation": None})
    -> jinja .render() on None              # CaughtMacroError
```

`create_relation()` returns None when `find_node_by_name` returns None (model not in manifest). `get_columns()` passes None directly to the jinja macro.

#### Fix

Add a None guard in `get_columns()` in `recce/adapter/dbt_adapter/__init__.py`:

```python
def get_columns(self, model: str, base=False) -> List[Column]:
    relation = self.create_relation(model, base)
    if relation is None:
        env = "base" if base else "current"
        raise RecceException(
            f"Model '{model}' does not exist in {env} environment. "
            f"Check that the model is in the manifest and catalog."
        )
    # ... existing code unchanged ...
```

**Why `get_columns()` not `ProfileDiffTask`:** All callers benefit from the guard — including `profile_diff`, `value_diff`, and `get_model()`. `RecceException` is already handled by MCP's `call_tool` handler. The `get_model()` caller uses `get_columns()` inside a `connection_named()` context manager, which handles cleanup correctly on exception.

**Why "does not exist" in the message:** The error message intentionally contains "does not exist" so `_classify_db_error` classifies it as `table_not_found` -> `logger.warning` -> no Sentry error event. Note: `str(RecceException(...))` produces the message directly (no wrapper prefix), so indicator matching works. This is verified by the test plan.

#### Chain Effect

- RECCE-5E6 (exception-level crash) eliminated — replaced by clean RecceException
- RECCE-6TV (MCP-level log) eliminated — same root cause, same fix
- Error classified as `table_not_found` -> warning, not error

#### Files Changed

| File | Change |
|------|--------|
| `recce/adapter/dbt_adapter/__init__.py` | None guard in `get_columns()` |
| `tests/test_dbt_adapter.py` or `tests/test_profile.py` | Test None relation raises RecceException |
| `tests/test_mcp_error_classification.py` | Test RecceException message is classified as `table_not_found` |

## Regression Prevention

### Test Coverage Matrix

| Layer | What | Covers |
|-------|------|--------|
| Unit: `_classify_db_error` | Parametrized tests with exact Sentry error messages | DRC-3052, 3053, 3054 |
| Unit: `get_columns` None guard | Mock `create_relation` -> None, verify RecceException | DRC-3051 |
| Unit: error message classification | RecceException message classified as `table_not_found` | DRC-3051 |
| Integration: MCP `call_tool` | Simulated DB error -> verify `logger.warning` not `logger.error` | All |

### Test Naming Convention

Each indicator test uses `test_classify_<source>_<error_pattern>` with Sentry ID in docstring. New unclassified errors from future scans map directly to new test cases.

### Sentry Monitoring Closed Loop

After deployment, next `/kc-sentry-insight mcp` scan checks:
- DRC-3052 issues: if `last_seen` is after deployment -> classification not working, investigate
- DRC-3051 issues: if still appearing -> guard not reached, investigate
- Profile's `known_issue_ids` tracks all 8 Sentry issues for diff detection

### Design Decisions: What We Don't Do

- **No catch-all classifier.** Unknown errors must still reach `logger.error` and Sentry. The monitoring value comes from surfacing genuinely unexpected errors.
- **No change to `create_relation` semantics.** Returning None for missing nodes is correct behavior; changing it would affect all callers.
- **No special `RecceException` handling in MCP handler.** It flows through the generic error classification path, maintaining consistency.
