---
id: 002
title: Add `--mcp` / `--no-mcp` CLI flags to `recce server`
status: designed
source: commission seed
started: 2026-04-13T06:58:28Z
completed:
verdict:
score: 0.7
worktree:
issue: DRC-3228
pr:
---

Expose a Click flag pair on the unified `recce server` command so users can opt out of the MCP endpoint when they only want the HTTP API (e.g., running Recce purely for the web UI or in constrained environments).

**User-visible outcome:**
- `recce server` (default) → HTTP API + MCP
- `recce server --no-mcp` → HTTP API only, MCP endpoint not started
- `recce server --mcp` → explicit opt-in (same as default; present for symmetry and forward-compat if the default ever changes)

**Acceptance criteria:**
- `recce server --help` documents both flags with clear descriptions.
- `--no-mcp` fully disables MCP: no port binding, no background threads, no log output about MCP.
- Flag collision with existing CLI args is avoided (check current `server` options first).
- Defaults documented in `AGENTS.md` / `CLAUDE.md` if agent workflows depend on the flag.

**Depends on:** `001 merge-mcp-server-lifecycle` (the lifecycle must exist before flags can toggle it).

## Design Note: `--mcp` / `--no-mcp` CLI Flags

### 1. Files That Change

| File (repo-relative) | What Changes |
|---|---|
| `recce/cli.py` | Add `@click.option("--mcp/--no-mcp", ...)` decorator to the `server()` command; pass the resolved boolean into `AppState`; propagate it to `app.state.mcp_enabled`. |
| `recce/server.py` | Add `mcp_enabled: bool = True` field to `AppState` dataclass. The `lifespan()` function already reads `app.state.mcp_enabled` (per subtask 001 design) -- no additional changes needed beyond the field definition. |
| `tests/test_cli_mcp_flags.py` (new) | Click `CliRunner` tests for `--mcp`, `--no-mcp`, default behavior, and `--help` output. |

### 2. Click Decorator and Option Definition

```python
@click.option(
    "--mcp/--no-mcp",
    default=True,
    show_default=True,
    help="Enable or disable the MCP endpoint. "
         "When enabled, the server exposes an MCP endpoint alongside the HTTP API. "
         "Use --no-mcp to run the HTTP API only.",
    envvar="RECCE_MCP_ENABLED",
)
```

This uses Click's boolean flag pair syntax (`--flag/--no-flag`), which:
- Produces a single Python parameter named `mcp` (type `bool`).
- `--mcp` sets `mcp=True`, `--no-mcp` sets `mcp=False`.
- Default is `True` (MCP enabled by default).
- Supports override via `RECCE_MCP_ENABLED` environment variable (values `true`/`1`/`yes` -> `True`; `false`/`0`/`no` -> `False`).

**Justification for `--mcp/--no-mcp` over two separate flags:** Click's `/` syntax is idiomatic for boolean pairs, generates clean `--help` output (`--mcp / --no-mcp`), and avoids ambiguity about what happens when both flags are passed (Click takes the last one, consistent with other CLI tools). The codebase does not currently use this pattern, but it is the recommended Click approach for opt-in/opt-out pairs and is well-documented.

**Placement among decorators:** The new decorator is placed immediately after `--new-cll-experience` and before `@add_options(dbt_related_options)`, keeping it grouped with the other server-specific feature flags.

### 3. Flag Propagation Path

```
CLI invocation
  |
  +--> Click resolves --mcp/--no-mcp -> `mcp` parameter (bool)
  |
  +--> server(host, port, lifetime, idle_timeout, state_file, mcp, **kwargs)
  |      |
  |      +--> AppState(..., mcp_enabled=mcp)
  |      |      # mcp_enabled is a new field on AppState dataclass
  |      |
  |      +--> app.state = state
  |             # app.state.mcp_enabled is now available to lifespan()
  |
  +--> lifespan() reads app.state.mcp_enabled (subtask 001 logic):
         if mcp_enabled:
             # import RecceMCPServer, mount SSE routes, etc.
         else:
             # skip MCP entirely, no import, no routes, no log
```

The `mcp` parameter is an explicit keyword arg on `server()` (not buried in `**kwargs`) because it is consumed directly by the CLI function to set `AppState.mcp_enabled`. It does not need to flow through `kwargs` to dbt/adapter logic.

### 4. `--mcp` vs `--no-mcp` Semantics

- **Default:** `--mcp` (MCP enabled). Running `recce server` with no flags starts both HTTP and MCP.
- **`--no-mcp`:** Fully disables MCP. Sets `app.state.mcp_enabled = False`. The `lifespan()` function in subtask 001 skips the entire MCP initialization block: no `RecceMCPServer` import, no route mounting, no port binding, no background threads, no MCP-related log output.
- **`--mcp`:** Explicit opt-in. Equivalent to the default. Present for symmetry, forward-compatibility (if the default ever changes), and explicitness in scripts/CI configs.
- **Environment variable:** `RECCE_MCP_ENABLED=false` is equivalent to `--no-mcp`. CLI flag takes precedence over envvar per Click conventions.
- **Interaction with `recce read-only` and `recce preview`:** These hidden commands invoke `server()` via `ctx.invoke()`. They do not pass `mcp`, so they inherit the default (`True`). If MCP should be disabled for read-only/preview modes, that is a separate decision outside this subtask.

### 5. `--no-http` Decision

A symmetric `--no-http` flag (for MCP-only mode without the HTTP API/web UI) is **deferred to subtask 003**. Subtask 003's entity body explicitly mentions: "If the team wants to support MCP-only mode in the unified command, consider adding `--no-http`." The decision will be made during subtask 003's `designed` stage.

Rationale for deferral: `--no-http` has different lifecycle implications (skip StaticFiles mount, skip web-socket routes, potentially change uvicorn config) and interacts with the deprecation of `recce mcp-server`. It is not needed for the `--mcp`/`--no-mcp` opt-out use case.

### 6. Test Coverage

| Test Case | What It Validates |
|---|---|
| `test_server_default_mcp_enabled` | Invoke `recce server --help` via `CliRunner`, verify `--mcp / --no-mcp` appears in output. Then invoke `server` with mock (to prevent actual uvicorn.run) and verify `app.state.mcp_enabled is True` by default. |
| `test_server_no_mcp_flag` | Invoke `server --no-mcp` with mock, verify `app.state.mcp_enabled is False`. |
| `test_server_explicit_mcp_flag` | Invoke `server --mcp` with mock, verify `app.state.mcp_enabled is True`. |
| `test_server_help_shows_mcp_flag` | Parse `recce server --help` output; assert both `--mcp` and `--no-mcp` are documented with the expected help text. |
| `test_server_mcp_envvar_override` | Set `RECCE_MCP_ENABLED=false` in `CliRunner.env`, invoke `server` with no flags, verify `app.state.mcp_enabled is False`. |
| `test_server_mcp_flag_no_collision` | Verify that `--mcp` does not conflict with any existing server option (compile-time check via Click introspection). |

All tests use `click.testing.CliRunner` to invoke the CLI command in-process. `uvicorn.run` is mocked (`unittest.mock.patch`) to prevent actual server startup -- the test inspects `app.state` after `server()` sets it up.

### 7. CLI Help Text (Exact)

When running `recce server --help`, the `--mcp/--no-mcp` option will appear as:

```
  --mcp / --no-mcp  Enable or disable the MCP endpoint. When enabled, the
                    server exposes an MCP endpoint alongside the HTTP API. Use
                    --no-mcp to run the HTTP API only.  [default: mcp]
```

Note: Click renders `[default: mcp]` for `True` on a boolean flag pair, showing the flag name rather than `True`.

### 8. Rollback Plan

1. **Minimal surface:** The change touches only `recce/cli.py` (one decorator + one arg + one line in `AppState` construction) and `recce/server.py` (one field on `AppState`). A single `git revert` of the implementation commit cleanly removes the flag.
2. **No behavioral change to default:** Since `--mcp` is default-True, existing users and CI scripts that run `recce server` without flags see identical behavior before and after this change.
3. **No persistent state impact:** The flag does not alter any stored state, config file, or database schema. It only controls runtime behavior.
4. **Subtask 001 compatibility:** If this subtask's flag is reverted but subtask 001 is already merged, the `mcp_enabled` field on `AppState` can be hardcoded to `True` in `server.py` (or the field default handles it). The MCP lifecycle in `lifespan()` does not break without the CLI flag -- it simply always enables MCP.

### 9. No Flag Collisions

Verified against all existing `server()` options (direct + option groups):

- **Direct:** `state_file`, `--host`, `--port`, `--lifetime`, `--idle-timeout`, `--review`, `--single-env`, `--enable-cll-cache`, `--impact-at-startup`, `--new-cll-experience`
- **`dbt_related_options`:** `--target`, `--profile`, `--project-dir`, `--profiles-dir`
- **`sqlmesh_related_options`:** `--sqlmesh`, `--sqlmesh-envs`, `--sqlmesh-config`
- **`recce_options`:** `--config`, `--error-log`, `--debug`
- **`recce_dbt_artifact_dir_options`:** `--target-path`, `--target-base-path`
- **`recce_cloud_options`:** `--cloud`, `--cloud-token`, `--state-file-host`, `--password`
- **`recce_cloud_auth_options`:** `--api-token`
- **`recce_hidden_options`:** `--mode`, `--share-url`, `--session-id`

No existing option uses `--mcp` or `--no-mcp`. The envvar `RECCE_MCP_ENABLED` is also unused.

## Stage Report: designed

- [x] Enumerate files that change (repo-relative paths), with one-line notes.
  See "Files That Change" table: `recce/cli.py`, `recce/server.py`, `tests/test_cli_mcp_flags.py` (new).
- [x] Specify the exact Click decorators and option definitions to add to the `server()` command.
  See section 2: `@click.option("--mcp/--no-mcp", default=True, show_default=True, help="...", envvar="RECCE_MCP_ENABLED")`.
- [x] Specify how the flag propagates: where it's read, how it reaches `app.state.mcp_enabled`.
  See section 3: CLI parameter -> `server(mcp=...)` -> `AppState(mcp_enabled=mcp)` -> `app.state` -> `lifespan()`.
- [x] Clarify `--mcp` vs `--no-mcp` semantics: default-True, Click `/` syntax, envvar override.
  See section 4: default True, Click boolean pair, `RECCE_MCP_ENABLED` envvar, no ambiguity.
- [x] Decide whether `--no-http` is in scope here or deferred to subtask 003.
  Deferred to subtask 003. See section 5 for rationale.
- [x] Test coverage: list specific test cases.
  See section 6: 6 test cases covering default, `--no-mcp`, `--mcp`, help output, envvar override, collision check.
- [x] Document CLI help text exactly as it will appear.
  See section 7: exact `--help` rendering with `[default: mcp]`.
- [x] Document rollback plan.
  See section 8: single `git revert`, no behavioral change to default, no persistent state impact.
- [x] Verify no collision with existing `server` command flags.
  See section 9: exhaustive listing of all 25+ existing options, no collision found.

### Summary

Designed the `--mcp/--no-mcp` flag pair for `recce server` using Click's idiomatic boolean flag syntax. The flag defaults to True (MCP enabled), propagates through `server()` into `AppState.mcp_enabled`, and is read by the `lifespan()` function from subtask 001. The `--no-http` symmetric flag is deferred to subtask 003. Six specific test cases are defined using Click's CliRunner. No collisions with existing server flags or environment variables.
