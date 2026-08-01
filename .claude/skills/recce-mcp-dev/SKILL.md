---
name: recce-mcp-dev
description: Use when modifying recce/mcp_server.py, MCP tool handlers, error classification, or MCP-related tests. Also use when adding new MCP tools or changing tool response formats, or when adding a CheckDAO/RunDAO write in recce/apis/*_api.py (cloud-mode exceptions bypass `except RecceException`).
---

# Recce MCP Server Development

## Architecture

`RecceMCPServer` registers `list_tools`/`call_tool` handlers via MCP SDK `Server`. `call_tool` dispatches to `_tool_*` methods, classifies errors, logs/emits metrics, re-raises.

Entry point `run_mcp_server()` pops `single_env` before passing kwargs to `load_context()`.

## Key Patterns

**Error classification** — Shared indicator lists defined in `recce/tasks/rowcount.py`. Priority order (`PERMISSION_DENIED` > `TABLE_NOT_FOUND` > `SYNTAX_ERROR`) enforced by `_classify_db_error()` in `mcp_server.py` and `_query_row_count()` in `rowcount.py`. Classified → `logger.warning()` + `sentry_metrics.count()` (when sentry_sdk available). Unclassified → `logger.error()` + traceback.

**MCP SDK quirk** — Handler must **raise** for SDK to set `isError=True`.

**Single-env** — `_maybe_add_single_env_warning()` adds `_warning` to diff results. Descriptions get conditional note.

## Response Contracts

An MCP tool description **is** the agent contract; it MUST match the actual
response format.

- Prefer additive changes (`_meta` fields) over modifying existing field types.
- Row count consumers: frontend (int), `run.py` (int comparison), `summary.py`
  (int arithmetic), `RowCountDiffResultDiffer` (3-format compat), MCP agents
  (description-guided).
- `summary.py` row count gotcha: `base`/`curr` can be `None`
  (TABLE_NOT_FOUND, PERMISSION_DENIED). Guard with an `is None` check before
  arithmetic — `dict.get(key, 0)` does NOT protect when the key exists with a
  `None` value. N/A display includes the reason: `"N/A (table_not_found)"`.
- Format changes require both deterministic tests AND BQ/LLM eval to prove agent
  behaviour unchanged.

### Shared tool descriptions cover both backends

`list_tools` is a single shared registry: the same `Tool(description=...)` is served in
local and cloud mode, and `call_tool` routes to `CloudBackend.call_tool` whenever
`self.backend` is set — before any local `_tool_*` branch is reached. Widening a tool's
description therefore obliges **both** implementations — `RecceMCPServer._tool_*` and
`CloudBackend._tool_*` — or the description must state what the other backend returns
instead. A description promising a field that only one backend emits is a broken agent
contract even when both implementations are individually correct.

**Worked example**: `schema_diff`'s description promises a `schema_coverage` block.
`CloudBackend._tool_schema_diff` satisfies it by emitting `_schema_coverage(None)` —
status `unknown`, "coverage unassessed" — rather than omitting the key.

Origin: PR #1484 review (DRC-3997). Same local/cloud divergence trap as the
exception-type note below, in a different guise.

## Cloud vs Local Mode Exception Types

`CheckDAO` / `RunDAO` operations have cloud-mode and local-mode branches that
raise DIFFERENT exception classes. `RecceCloudException` (defined in
`recce/util/recce_cloud.py`) inherits from `Exception`, NOT from
`RecceException`. When wrapping a DAO operation in `try / except RecceException`,
cloud-mode failures escape the wrapper and break the consistent error contract.

**Rule**: For DAO operations that may run in cloud mode, either:
- Use `except (RecceException, RecceCloudException)` to catch both, OR
- Move the DAO call OUTSIDE the typed-exception wrapper (mirrors
  `_tool_create_check`'s structure, which keeps `update_check_by_id`
  unguarded so cloud failures propagate as expected).

**Where this matters**: any new code in `mcp_server.py` or `*_api.py` that
adds a DAO write inside an existing `try / except RecceException` block.
Origin: PR #1342 review (DRC-3307).

## Testing (Three Layers)

| Layer | File | Data Source | Runs In | Purpose |
|-------|------|-------------|---------|---------|
| Unit | `tests/test_mcp_server.py` | Mock `RecceContext` | CI (`pytest`) | Logic correctness — tool handlers, error classification, response format |
| Integration | `tests/test_mcp_e2e.py` | `DbtTestHelper` + DuckDB (fixed data) | CI (`pytest`) | MCP protocol works end-to-end via anyio memory streams |
| Smoke (E2E) | `/recce-mcp-e2e` skill | User's real dbt project + real database | Manual | The 8 tools that harness covers return valid results against real data |

**Tool count — verify, don't assume.** `list_tools` registers **20** tools as of
2026-08-01 (`grep -c 'Tool(' recce/mcp_server.py`). The `/recce-mcp-e2e` harness
exercises 8 of them, so a green E2E run is **not** full-surface coverage. Not
covered by that harness: `analyze_model`, `create_check`, `get_cll`, `get_model`,
`get_server_info`, `histogram_diff`, `impact_analysis`, `select_nodes`,
`set_backend`, `top_k_diff`, `value_diff`, `value_diff_detail`. Re-derive the
count rather than trusting this line.

Each new MCP feature or behavior change should be covered at all three layers.

## Test Coverage Gap Analysis

After completing a round of MCP changes (see E2E Gate below for definition), proactively scan for missing test coverage across the three layers before asking about E2E verification.

**How to check:**
1. Identify what changed — new tool handler? new error path? new response field?
2. For each change, verify coverage exists at each layer:
   - **Unit**: Does `tests/test_mcp_server.py` have a test case for the new behavior? (happy path + error path)
   - **Integration**: Does `tests/test_mcp_e2e.py` exercise the new tool/feature via MCP protocol?
   - **Smoke**: Will `/recce-mcp-e2e` template cover the new tool? (If a new tool was added, the template may need updating)

**If gaps are found**, report them to the user before the E2E gate prompt:

> Test coverage gaps found:
> - Unit: missing test for `_tool_foo` error path when table not found
> - Integration: `test_mcp_e2e.py` does not exercise `foo` tool
> - Smoke: `/recce-mcp-e2e` template does not include `foo` tool
>
> Want to fill these gaps before running E2E?

**Do NOT scan** after: test-only changes, comment/doc edits, import reordering.

## E2E Verification Gate

After each meaningful round of MCP changes, you MUST ask the user:

> MCP changes complete for this round. Run `/recce-mcp-e2e` to verify?

If the user says yes, invoke `/recce-mcp-e2e`. If a dbt project path was used earlier in this session, reuse it automatically; otherwise ask.

**What counts as "a round":**
- A tool handler added or modified + its unit tests pass
- Error classification logic changed + tests pass
- Single-env or response format changed + tests pass

**Do NOT ask** after: test-only changes, comment/doc edits, import reordering.

**This is separate from `tests/test_mcp_e2e.py`** — that file tests with DbtTestHelper + DuckDB in CI. `/recce-mcp-e2e` verifies all 8 tools against a real dbt project with a real database.

## Pitfalls

- `sentry_sdk` import: `# pragma: no cover` on except (CI always has it)
- Typing: `pyproject.toml` sets `requires-python = ">=3.10"` (classifiers 3.10–3.13),
  so `X | Y` unions are fine. A previous version of this pitfall claimed a Python
  3.9 floor requiring `Union[X, Y]`; that is obsolete.
- Pre-commit: black/isort may reformat — re-stage and commit
- `run.py` `schema_diff_should_be_approved()` try/except is intentional (ensures check creation)

## File Map

`recce/mcp_server.py` (server + handlers), `recce/tasks/rowcount.py` (error indicators, RowCountStatus), `recce/run.py` (CLI preset), `recce/summary.py` (display logic), `recce/event/__init__.py` (Sentry)
