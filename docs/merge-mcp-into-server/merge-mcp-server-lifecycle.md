---
id: 001
title: Merge MCP server lifecycle into `recce server` startup
status: designed
source: commission seed
started: 2026-04-13T06:47:02Z
completed:
verdict:
score: 0.9
worktree:
issue: DRC-3228
pr:
---

Integrate MCP server initialization into the existing `recce server` boot sequence so a single invocation hosts both the HTTP API (for the web UI) and the MCP endpoint (for agents). Today these are served by two separate CLI commands (`recce server` and `recce mcp-server`), forcing developers to choose one transport at a time.

**User-visible outcome:** Running `recce server` starts the web server on its configured port *and* exposes an MCP endpoint on the same process. Agents (including Claude) can connect to MCP while the web UI is also available.

**Acceptance criteria:**
- `recce server` (no flags) starts both HTTP API and MCP endpoint.
- Startup ordering is deterministic and failures in one transport don't leak the other.
- Graceful shutdown tears down both transports cleanly (no orphaned sockets/threads).
- No regressions in existing `recce server` behavior (port binding, state loader, auth).

**Constraints:**
- Preserve the state-loader abstraction (`FileStateLoader` / `CloudStateLoader`).
- Preserve Python 3.10–3.13 compatibility.
- Don't change adapter interfaces.

This is the foundational subtask — everything else in this workflow assumes the merged lifecycle is in place.

## Design Note: MCP Server Lifecycle Merge

### 1. Files That Will Change

| File (repo-relative) | What Changes |
|---|---|
| `recce/server.py` | Mount MCP SSE transport routes on the existing FastAPI app; add MCP init/teardown to the `lifespan` context manager; add `RecceMCPServer` instance to `AppState`. |
| `recce/cli.py` | Pass `--no-mcp` flag wiring (scoped to subtask 002) but no flag logic yet; ensure the `server()` command creates and configures `RecceMCPServer` alongside the existing HTTP setup. |
| `recce/mcp_server.py` | Extract a new method `mount_sse(app, path_prefix)` from `run_sse()` that registers SSE routes on an externally-provided Starlette/FastAPI app instead of creating its own Starlette app + uvicorn instance. Keep `run()` (stdio) and `run_sse()` unchanged for backward compatibility with `recce mcp-server`. |
| `tests/test_server_mcp_lifecycle.py` (new) | Unit tests for the merged lifecycle (startup ordering, teardown, MCP availability on HTTP server). |
| `tests/test_server_lifespan.py` | Add test case(s) confirming lifespan sets up and tears down MCP server alongside HTTP context. |
| `tests/test_cli_mcp_optional.py` | Extend to verify `recce server` still works when `mcp` package is not installed (graceful degradation). |

### 2. Symbol Touchpoints

#### `recce/server.py`

- **`AppState` dataclass** -- Add field `mcp_server: Optional["RecceMCPServer"] = None` and `mcp_sse_transport: Optional[Any] = None`.
- **`lifespan()` async context manager** -- After `_do_lifespan_setup` completes, instantiate `RecceMCPServer` using the same `RecceContext` and `state_loader` from `app_state.startup_ctx`. Register MCP handlers. On teardown, no special MCP teardown is needed (state export is already handled by `teardown_server()`).
- **`app` (FastAPI instance)** -- After the existing `app.include_router(...)` calls and before the `app.mount("/", StaticFiles(...))` catch-all, add MCP SSE routes under `/mcp/` prefix (e.g., `GET /mcp/sse` for SSE connection, `POST /mcp/messages` for message posting).

#### `recce/cli.py`

- **`server()` function (line ~949)** -- After constructing `AppState`, set `app.state.mcp_enabled = True` (controlled by the eventual `--no-mcp` flag from subtask 002; default `True` for this subtask). The MCP server instantiation itself happens inside `lifespan()`, not in the CLI function.
- **`create_state_loader_by_args()`** -- No changes needed; already shared between `server` and `mcp-server` commands.

#### `recce/mcp_server.py`

- **`RecceMCPServer.__init__()`** -- No changes.
- **`RecceMCPServer.mount_sse()` (new method)** -- Accepts a FastAPI/Starlette `app` and a `path_prefix` string. Creates `SseServerTransport(endpoint=f"{path_prefix}/messages")`, registers `GET {path_prefix}/sse` and `POST {path_prefix}/messages` routes on the app, and stores the transport reference. This is extracted from the existing `run_sse()` logic.
- **`RecceMCPServer.handle_sse_connection()` (new method)** -- The SSE connection handler, extracted from the anonymous `handle_sse_request` closure in `run_sse()`.
- **`RecceMCPServer.run()` and `RecceMCPServer.run_sse()`** -- Remain unchanged for `recce mcp-server` backward compatibility.
- **`run_mcp_server()`** -- Remains unchanged for `recce mcp-server` backward compatibility.

### 3. CLI Argument Changes

None for this subtask. The `--no-mcp` opt-out flag is scoped to subtask 002. In this subtask, MCP is always enabled when the `mcp` package is installed, and silently skipped when it is not.

### 4. Startup Lifecycle Ordering

```
recce server
  |
  +--> cli.server() creates AppState, sets app.state, calls uvicorn.run(app)
  |
  +--> uvicorn starts -> FastAPI lifespan() fires
  |      |
  |      +--> background_load() runs in asyncio task:
  |      |      1. _do_lifespan_setup(app_state) -> load_context(), setup_server() -> RecceContext
  |      |      2. If mcp package available AND mcp_enabled:
  |      |         a. Import RecceMCPServer (guarded try/except ImportError)
  |      |         b. Instantiate RecceMCPServer(context, state_loader, mode, single_env, debug)
  |      |         c. Call mcp_server.mount_sse(app, path_prefix="/mcp")
  |      |         d. Store mcp_server in app_state.mcp_server
  |      |         e. Log: "MCP endpoint available at /mcp/sse"
  |      |      3. If mcp import fails: log warning, continue (MCP is optional)
  |      |      4. Schedule lifetime/idle_timeout timers (existing logic)
  |      |      5. ready_event.set()
  |      |
  |      +--> yield (server accepting connections)
  |      |    - HTTP API routes serve requests immediately
  |      |    - /mcp/sse connections wait for ready_event (readiness_gate middleware)
  |      |    - /api/health returns { ready: false } until ready_event is set
  |      |
  |      +--> shutdown (SIGINT/SIGTERM or lifetime expiry)
  |             1. await background_load task completion
  |             2. teardown_server(app_state, ctx) -- exports state (covers both HTTP and MCP)
  |             3. No separate MCP teardown needed (RecceMCPServer has no background tasks)
  |
  +--> uvicorn exits
```

**Key design decisions:**

- **Sequential init, not parallel:** MCP server depends on `RecceContext` from `_do_lifespan_setup()`, so it must be created after context loading completes. This is inside the existing `background_load()` task.
- **Error isolation:** If MCP import fails (`ImportError`), the HTTP server continues normally with a warning log. If MCP initialization raises any other exception, it is logged as a warning but does not set `startup_error` (which would block all API requests). Only context loading failures are fatal.
- **Same process, same event loop:** MCP SSE runs on the same uvicorn event loop as FastAPI. No extra threads or processes.
- **Route mounting happens at startup, not at module level:** Unlike the existing FastAPI routes (defined at module import time), MCP routes are mounted dynamically during `lifespan()` because `RecceMCPServer` needs a live `RecceContext`. FastAPI supports adding routes after app creation.

**Port/transport configuration:**

- MCP SSE shares the same host:port as the HTTP server (default `localhost:8000`).
- MCP endpoint path: `/mcp/sse` (SSE connection), `/mcp/messages` (POST).
- No separate port configuration for MCP in this subtask.

### 5. Shutdown Lifecycle Ordering

```
SIGINT/SIGTERM received
  |
  +--> uvicorn initiates shutdown
  |      +--> Stops accepting new connections
  |      +--> Existing SSE connections (both MCP and WebSocket) are closed by uvicorn
  |
  +--> FastAPI lifespan() resumes after yield
  |      +--> await background_load task (should already be done)
  |      +--> teardown_server(app_state, ctx):
  |             1. state_loader.refresh()
  |             2. ctx.import_state(state_loader.state, merge=True)
  |             3. state_loader.export(ctx.export_state())
  |             4. ctx.stop_monitor_artifacts()
  |             5. ctx.stop_monitor_base_env() (if single_env)
  |
  +--> uvicorn exits process
```

**Notes:**
- MCP SSE connections are managed by `SseServerTransport` which uses SSE event streams over HTTP. When uvicorn shuts down, these connections are closed automatically.
- The existing `teardown_server()` already exports state, covering checks/runs created via both HTTP API and MCP tools.
- No additional signal handlers are needed beyond what uvicorn provides.
- The `RecceMCPServer` instance does not hold open sockets or background threads -- it only holds a reference to `RecceContext` and `SseServerTransport`.

### 6. Rollback Plan

1. **Feature flag approach:** The MCP mounting code is isolated in a single `if` block inside `lifespan()`. To disable, set `app.state.mcp_enabled = False` (the `--no-mcp` flag from subtask 002 provides this permanently).
2. **Git revert:** The changes are confined to `recce/server.py` (lifespan + route mounting), `recce/mcp_server.py` (new `mount_sse` method), and `recce/cli.py` (mcp_enabled flag). A single `git revert` of the implementation commit cleanly removes the integration.
3. **No schema/state migrations:** The change does not alter any persisted state format, database schema, or API response contracts. `recce mcp-server` standalone command remains fully functional and unchanged.
4. **Backward compatibility:** The standalone `recce mcp-server` command is not modified. Users can fall back to running two separate processes if the merged lifecycle misbehaves.

### 7. Test Coverage Strategy

| Test File | Scenarios | Type |
|---|---|---|
| `tests/test_server_mcp_lifecycle.py` (new) | (1) MCP routes are mounted when `mcp` is installed and `mcp_enabled=True`. (2) MCP routes are NOT mounted when `mcp_enabled=False`. (3) MCP routes are NOT mounted when `mcp` package is not installed (mock `ImportError`). (4) `/mcp/sse` endpoint returns 200/SSE stream. (5) `/mcp/messages` endpoint accepts POST. (6) MCP health check at `/mcp/sse` is gated by readiness. | Unit |
| `tests/test_server_lifespan.py` | Add parametrized case for `command="server"` with `mcp_enabled=True` verifying `RecceMCPServer` is instantiated during lifespan. | Unit |
| `tests/test_cli_mcp_optional.py` | Add test: `recce server` with mocked `mcp` import failure still starts HTTP server without error. | Unit |
| `tests/test_mcp_server.py` | Add test for `RecceMCPServer.mount_sse()` method: verify it registers correct routes on a test Starlette app. | Unit |
| `tests/test_mcp_e2e.py` | (stretch) Add test connecting MCP client to the merged FastAPI app via `/mcp/sse` route using the existing `create_mcp_client` pattern, adapted for HTTP. | Integration |

All tests live in `tests/` (unit). No changes to `integration_tests/`.

### 8. State-Loader and Python Compatibility

- **State-loader abstraction preserved:** The design uses the existing `state_loader` from `AppState` (created by `create_state_loader_by_args()`). `RecceMCPServer` receives the same `state_loader` reference. State export on shutdown goes through the existing `teardown_server()` path -- no new state export path is introduced. Both `FileStateLoader` and `CloudStateLoader` work unchanged.
- **Python 3.10-3.13 compatibility:** All new code uses `Optional[X]` type annotations (not `X | None` syntax which requires 3.10+ with `from __future__ import annotations` or 3.12+ natively). The `mcp` package itself requires Python 3.10+ which aligns with the project constraint. `SseServerTransport` from the `mcp` package (v1.23.3) is compatible with Python 3.10+. No `match` statements or other 3.10+-only syntax is introduced.
- **Risk:** The `mcp` package version 1.23.3 uses `X | None` syntax in its type hints, but this is handled internally by the package. Our code only uses the public API which works on 3.10+.

### 9. BaseAdapter Interface

The design does not change the `BaseAdapter` interface. `RecceMCPServer` accesses the adapter only through `RecceContext` (e.g., `context.adapter`) and only reads from it -- the same access pattern as the standalone `recce mcp-server`. No new adapter methods are required.

**Risk:** None. The MCP tools call existing task classes (`RowCountDiffTask`, `QueryDiffTask`, etc.) which use the adapter through the established task/context interface.

## Stage Report: designed

- [x] Enumerate the concrete files that will change (repo-relative paths), with a one-line note on what changes in each.
  See "Files That Will Change" table in Design Note section.
- [x] Identify function/class/symbol touchpoints in `recce/cli.py`, `recce/server.py`, and the MCP server module -- name them explicitly.
  See "Symbol Touchpoints" section: `AppState`, `lifespan()`, `server()`, `RecceMCPServer.mount_sse()` (new), `handle_sse_connection()` (new).
- [x] Specify CLI argument changes for this subtask (or explicitly note "none -- flags are scoped to subtask 002").
  None for this subtask; `--no-mcp` flag is scoped to subtask 002.
- [x] Document startup lifecycle ordering: how the HTTP server and MCP endpoint are brought up.
  See "Startup Lifecycle Ordering" section with ASCII diagram. Sequential init (MCP depends on RecceContext), error isolation, same event loop.
- [x] Document shutdown lifecycle ordering: graceful teardown of both transports, signal handling (SIGINT/SIGTERM), thread/process cleanup.
  See "Shutdown Lifecycle Ordering" section. Uvicorn handles connection closure; `teardown_server()` exports state for both transports.
- [x] Document a rollback plan: how to revert the change safely if a post-release regression is discovered.
  See "Rollback Plan" section. Feature flag, git revert, no schema migrations, standalone command unchanged.
- [x] Define the test coverage strategy: specify which test files will be added or modified, what scenarios they cover (unit + integration), and where they live.
  See "Test Coverage Strategy" table. 1 new test file + 3 modified files, all in `tests/`.
- [x] Verify the design preserves the state-loader abstraction and Python 3.10-3.13 compatibility.
  See "State-Loader and Python Compatibility" section. Same state_loader reference, Optional[] annotations, no 3.12+-only syntax.
- [x] Confirm the design does not change the BaseAdapter interface.
  See "BaseAdapter Interface" section. No adapter changes; MCP tools use existing task/context interface.

### Summary

Produced a concrete design note for merging the MCP server lifecycle into `recce server`. The core approach mounts MCP SSE routes (`/mcp/sse`, `/mcp/messages`) on the existing FastAPI app during `lifespan()`, after `RecceContext` is loaded. MCP is treated as optional: if the `mcp` package is not installed, the HTTP server starts normally with a warning. A new `RecceMCPServer.mount_sse()` method is extracted from the existing `run_sse()` to enable route registration on an external app. No changes to CLI flags, adapter interfaces, state-loader abstraction, or the standalone `recce mcp-server` command.
