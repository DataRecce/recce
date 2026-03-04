---
name: recce-mcp-dev
description: Use when modifying recce/mcp_server.py, MCP tool handlers, error classification, or MCP-related tests. Also use when adding new MCP tools or changing tool response formats.
---

# Recce MCP Server Development

## Architecture

`RecceMCPServer` registers `list_tools`/`call_tool` handlers via MCP SDK `Server`. `call_tool` dispatches to `_tool_*` methods, classifies errors, logs/emits metrics, re-raises.

Entry point `run_mcp_server()` pops `single_env` before passing kwargs to `load_context()`.

## Key Patterns

**Error classification** — Shared indicators in `recce/tasks/rowcount.py`: `PERMISSION_DENIED` > `TABLE_NOT_FOUND` > `SYNTAX_ERROR` (priority). Classified → `logger.warning()` + `sentry_metrics.count()`. Unclassified → `logger.error()` + traceback.

**MCP SDK quirk** — Handler must **raise** for SDK to set `isError=True`.

**Response contracts** — See CLAUDE.md. Additive `_meta` only. `summary.py`: guard with `is None`, not `dict.get(key, 0)`.

**Single-env** — `_maybe_add_warning()` adds `_warning` to diff results. Descriptions get conditional note.

## Testing

| Layer | File | How |
|-------|------|-----|
| Unit | `tests/test_mcp_server.py` | Mock `RecceContext`, call `_tool_*` directly |
| Handler | same | `server.server.request_handlers[CallToolRequest]` |
| E2E | `tests/test_mcp_e2e.py` | `DbtTestHelper` + DuckDB, direct + anyio streams |
| Errors | `tests/test_mcp_server.py` | Mock `dbt_adapter.execute()` with indicator strings |

## Pitfalls

- `sentry_sdk` import: `# pragma: no cover` on except (CI always has it)
- Python 3.9: `Union[X, Y]` not `X | Y`
- Pre-commit: black/isort may reformat — re-stage and commit
- `run.py` `schema_diff_should_be_approved()` try/except is intentional (ensures check creation)

## File Map

`recce/mcp_server.py` (server + handlers), `recce/tasks/rowcount.py` (error indicators, RowCountStatus), `recce/run.py` (CLI preset), `recce/summary.py` (display logic), `recce/event/__init__.py` (Sentry)
