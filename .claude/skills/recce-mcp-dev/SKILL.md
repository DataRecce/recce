---
name: recce-mcp-dev
description: Use when modifying recce/mcp_server.py, MCP tool handlers, error classification, or MCP-related tests. Also use when adding new MCP tools or changing tool response formats, or when adding a CheckDAO/RunDAO write in recce/apis/*_api.py (cloud-mode exceptions bypass `except RecceException`).
---

# Recce MCP Server Development

## Architecture

`RecceMCPServer` registers `list_tools`/`call_tool` handlers via MCP SDK `Server`. `call_tool` dispatches to `_tool_*` methods, classifies errors, logs/emits metrics, re-raises.

Entry point `run_mcp_server()` pops `single_env` before passing kwargs to `load_context()`.

**Two SDK majors are supported** (`mcp>=1.23,<3`), and `_build_server()` picks the
registration path from the `MCP_V2` flag: decorators on 1.x, `on_list_tools` /
`on_call_tool` constructor kwargs on 2.0. The handler bodies keep their 1.x shapes
(`List[Tool]` / `List[TextContent]`, errors raised); `_handle_list_tools` /
`_handle_call_tool` adapt them for 2.0. Tests drive the `_handle_*` adapters on both
majors via `tests/mcp_compat.py` — never `server.server.request_handlers[...]`, which
does not exist on 2.0.

## Key Patterns

**Error classification** — Shared indicator lists defined in `recce/tasks/rowcount.py`. Priority order (`PERMISSION_DENIED` > `TABLE_NOT_FOUND` > `SYNTAX_ERROR`) enforced by `_classify_db_error()` in `mcp_server.py` and `_query_row_count()` in `rowcount.py`. Classified → `logger.warning()` + `sentry_metrics.count()` (when sentry_sdk available). Unclassified → `logger.error()` + traceback.

**MCP SDK quirk — version-dependent, do not generalise.** On mcp 1.x the handler must
**raise** for the SDK to set `isError=True`. On 2.0 a raised exception becomes a JSON-RPC
*protocol* error instead, which an agent reads as a transport failure rather than a tool
failure — `_handle_call_tool` catches and returns `CallToolResult(isError=True)` so the
response is the same on both. Inner handlers still raise; only the adapter converts.

**Input validation is not free on 2.0.** mcp 1.x validated `tools/call` arguments against
the tool's `inputSchema` inside `Server.call_tool(validate_input=True)`; 2.0's low-level
server dropped that entirely (`jsonschema` survives only client-side, for output schemas).
`_handle_call_tool` validates explicitly, with 1.x's `Input validation error: ...` wording.
This matters because the failure is silent: `"false"` is a truthy string, so a boolean skip
flag arrives flipped and the work it guards is quietly not done. Any new tool gets this for
free — but only as far as its declared schema goes, so `"type"` and `"required"` in
`inputSchema` are load-bearing, not documentation.

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

**Which mcp version each layer runs against is itself a coverage question.** The tox envs
resolve one mcp release, so on their own they leave the other major untested — that is how
a module failing 5/60 on mcp 2.0 once shipped CI-green. The `mcp-smoke-test` job in
`.github/workflows/integration-tests.yaml` installs each major in turn and runs both the
shell smoke check and the three MCP pytest modules. Anything that touches the `MCP_V2`
branches, the `_handle_*` adapters, or `tests/mcp_compat.py` has to be checked there, not
only in the default pytest run.

**Tool count — mode-dependent, verify per mode.** `list_tools` registers **at
most 20** tools, and how many it actually returns depends on the server mode:

| Gate | Count | Tools |
|------|-------|-------|
| always | 7 | `lineage_diff`, `schema_diff`, `get_model`, `get_cll`, `get_server_info`, `set_backend`, `select_nodes` |
| `self.backend is None` (local only) | 1 | `analyze_model` |
| `self.mode == RecceServerMode.server` | 12 | `row_count_diff`, `query`, `query_diff`, `profile_diff`, `value_diff`, `value_diff_detail`, `top_k_diff`, `histogram_diff`, `list_checks`, `run_check`, `create_check`, `impact_analysis` |

So preview and read-only mode expose 8; cloud mode never exceeds 19. `grep -c
'Tool(' recce/mcp_server.py` counts **code sites**, not any single session's
surface — read the `if` guards around the `analyze_model` and server-mode blocks
before quoting a number.

The `/recce-mcp-e2e` harness exercises 8 tools (2 always-on + 6 server-mode diff
tools), so a green E2E run is **not** full-surface coverage. Not covered by that
harness: `analyze_model`, `create_check`, `get_cll`, `get_model`,
`get_server_info`, `histogram_diff`, `impact_analysis`, `select_nodes`,
`set_backend`, `top_k_diff`, `value_diff`, `value_diff_detail`.

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

**This is separate from `tests/test_mcp_e2e.py`** — that file tests with DbtTestHelper + DuckDB in CI. `/recce-mcp-e2e` verifies the 8 tools that harness covers (see the tool-count note above) against a real dbt project with a real database.

## Pitfalls

- `sentry_sdk` import: `# pragma: no cover` on except (CI always has it)
- Typing: `pyproject.toml` sets `requires-python = ">=3.10"` (classifiers 3.10–3.13),
  so `X | Y` unions are fine. A previous version of this pitfall claimed a Python
  3.9 floor requiring `Union[X, Y]`; that is obsolete.
- Pre-commit: black/isort may reformat — re-stage and commit
- `run.py` `schema_diff_should_be_approved()` try/except is intentional (ensures check creation)

## File Map

`recce/mcp_server.py` (server + handlers), `recce/tasks/rowcount.py` (error indicators, RowCountStatus), `recce/run.py` (CLI preset), `recce/summary.py` (display logic), `recce/event/__init__.py` (Sentry)
