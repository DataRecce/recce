---
id: 003
title: Deprecate `recce mcp-server` command with warning
status: designed
source: commission seed
started: 2026-04-13T07:01:57Z
completed:
verdict:
score: 0.6
worktree:
issue: DRC-3228
pr:
---

Keep the `recce mcp-server` command functional for one release cycle but print a clear deprecation notice at startup pointing users to `recce server`. This gives existing agent configs, CI integrations, and documentation a grace period to migrate without breaking.

**User-visible outcome:**
- `recce mcp-server` still starts an MCP-only server (same behavior as today).
- On startup, prints a warning like: `⚠️  'recce mcp-server' is deprecated and will be removed in a future release. Use 'recce server' (serves both HTTP API and MCP) or 'recce server --no-http' if you need MCP-only.`
- Warning is prominent (stderr, colored if TTY) but doesn't break machine-readable output.

**Acceptance criteria:**
- Deprecation message includes the target removal version or release.
- Message is emitted once at startup, not per-request.
- Does not interfere with MCP stdio protocol framing (warnings go to stderr, not the protocol stream).
- README / docs list the deprecation with migration instructions.

**Depends on:** `001 merge-mcp-server-lifecycle` (need the unified `server` command to actually redirect users to).

**Note:** If the team wants to support MCP-only mode in the unified command, consider adding `--no-http` (symmetric with `--no-mcp` from subtask `002`). Decide during the `designed` stage.

## Design Note: Deprecate `recce mcp-server` Command

### 1. Files That Change

| File (repo-relative) | What Changes |
|---|---|
| `recce/cli.py` | Mark `mcp_server` command as `deprecated=True` in the `@cli.command` decorator; add a custom deprecation warning emitted to stderr before protocol startup. |
| `tests/test_cli_mcp_deprecation.py` (new) | Tests that verify the deprecation warning is emitted to stderr, does not appear on stdout, and does not affect exit code or protocol framing. |

No changes to `recce/mcp_server.py`, `recce/server.py`, `pyproject.toml`, or `recce/track.py`.

### 2. Deprecation Warning: Exact Message and Delivery

**Message text** (two lines for readability):

```
DeprecationWarning: 'recce mcp-server' is deprecated and will be removed in v1.46.0.
Use 'recce server' instead. For MCP-only mode, use 'recce server --no-mcp' (HTTP disabled, MCP only).
```

**Delivery mechanism:**

The warning is emitted in two layers:

1. **Click built-in (`deprecated=True`):** Setting `deprecated=True` on the `@cli.command` decorator causes Click to emit `DeprecationWarning: The command 'mcp-server' is deprecated.` to stderr via `click.echo(click.style(..., fg="red"), err=True)` before the callback runs. This is a one-shot per invocation (Click calls it once in `Command.invoke` before dispatching to the callback). The `snapshot` command at line 2236 of `cli.py` already uses this pattern as precedent.

2. **Custom migration hint:** Inside the `mcp_server()` function body, immediately after the `console = Console(stderr=True) if not sse else Console()` line (which already routes output to stderr in stdio mode), add a `console.print(...)` call with the migration-specific message. This gives users the actionable migration path that Click's generic message lacks.

**Stream (stderr):** The existing `mcp_server` function already creates `console = Console(stderr=True)` for stdio mode (line 2335). The custom warning uses this same console, so it goes to stderr. Click's built-in deprecation warning also uses `err=True`. In SSE mode, the console writes to stdout, which is acceptable since SSE does not use stdio framing.

**Color/TTY handling:** Rich's `Console` auto-detects TTY and strips markup when piping. Click's `style()` also respects TTY detection. No additional handling needed.

**One-shot guarantee:** Both mechanisms fire once per process invocation. Click emits the deprecation warning once in `Command.invoke` before calling the callback. The custom `console.print` executes once at the top of the `mcp_server()` function, before the `asyncio.run(run_mcp_server(...))` blocking call.

### 3. Symbol Touchpoint in `recce/cli.py`

**Decorator change** (line 2265):

```python
# Before:
@cli.command(cls=TrackCommand)

# After:
@cli.command(cls=TrackCommand, deprecated=True)
```

**Custom warning insertion point** (inside `mcp_server()`, after the `console` is created at current line 2335, before the `try:` block at current line 2336):

```python
    console = Console(stderr=True) if not sse else Console()

    # Deprecation warning with migration instructions
    console.print(
        "[yellow]DeprecationWarning:[/yellow] 'recce mcp-server' is deprecated "
        "and will be removed in v1.46.0.\n"
        "Use 'recce server' instead. For MCP-only mode, use "
        "'recce server --no-mcp' (HTTP disabled, MCP only)."
    )

    try:
```

The warning is emitted:
- After Click parses args (the function is already called with resolved parameters).
- After the `console` is created (so stderr routing is established).
- Before the `try:` block that imports `run_mcp_server` and starts the protocol.

### 4. Deprecation Timeline

**Current version:** `1.44.0.dev0` (from `recce/VERSION`).

**Deprecation introduced:** v1.44.0 (the release containing this work).

**Target removal version:** **v1.46.0** (two minor releases later, following the "one release cycle" grace period stated in the entity description). This gives users at least two release windows to migrate their agent configs and CI scripts.

The version `v1.46.0` appears in the warning text so users know the exact deadline.

### 5. `--no-http` Recommendation

**Recommendation: YES -- add `--no-http` to `recce server` as part of the MCP flag work (subtask 002 scope expansion or a small addition in this subtask's implementation).**

**Rationale:**

- The deprecation warning tells users to migrate from `recce mcp-server` to `recce server`. But `recce mcp-server` runs MCP-only (no HTTP API, no web UI). Users who specifically want MCP-only mode (common for AI agent configurations that use stdio transport) need an equivalent: `recce server --no-http`.
- Without `--no-http`, the deprecation warning would be dishonest -- it tells users to migrate but offers no equivalent functionality for the MCP-only use case.
- `--no-http` is the symmetric counterpart to `--no-mcp` from subtask 002. The flag pair gives full control: `recce server` (both), `recce server --no-mcp` (HTTP only), `recce server --no-http` (MCP only).
- Implementation is straightforward: skip `StaticFiles` mount, skip uvicorn web routes, run only the MCP stdio/SSE transport. The `lifespan()` function from subtask 001 can check `app.state.http_enabled` just like it checks `app.state.mcp_enabled`.
- Guard rail: `recce server --no-http --no-mcp` should error with a clear message ("At least one of HTTP or MCP must be enabled").

**During the grace period:** Users running `recce mcp-server` can keep using it -- it still works, just with a warning. They can migrate to `recce server --no-http` at their convenience before v1.46.0.

### 6. Test Coverage

| Test Case | File | What It Validates |
|---|---|---|
| `test_mcp_server_shows_deprecation_warning` | `tests/test_cli_mcp_deprecation.py` | Invoke `mcp_server` via `CliRunner` (with mocked `run_mcp_server`), capture stderr, assert the custom deprecation message substring is present. |
| `test_mcp_server_deprecation_on_stderr_not_stdout` | `tests/test_cli_mcp_deprecation.py` | Invoke `mcp_server` via `CliRunner` with `mix_stderr=False`, verify the deprecation message appears in `result.stderr` but NOT in `result.output` (stdout). This ensures stdio protocol framing is not corrupted. |
| `test_mcp_server_exits_zero_despite_deprecation` | `tests/test_cli_mcp_deprecation.py` | Invoke `mcp_server` with mocked server, verify `result.exit_code == 0`. Confirms the warning does not change the exit code. |
| `test_mcp_server_help_shows_deprecated` | `tests/test_cli_mcp_deprecation.py` | Invoke `mcp-server --help`, verify "(Deprecated)" appears in the help text (from Click's built-in behavior). |
| `test_mcp_server_deprecation_includes_version` | `tests/test_cli_mcp_deprecation.py` | Assert the warning text includes "v1.46.0" so the removal target is always present. |

All tests use `click.testing.CliRunner`. The `run_mcp_server` async function is mocked via `unittest.mock.patch` to prevent actual server startup. The mock returns immediately (simulating a clean shutdown) so the test can inspect stderr output.

**Protocol framing safety:** The `mix_stderr=False` test is the critical one. Click's `CliRunner` supports `mix_stderr=False` to separate stdout and stderr streams. The test asserts the deprecation text is only in stderr, proving it cannot corrupt the JSON-RPC/MCP protocol on stdout.

### 7. Rollback Plan

1. **Remove `deprecated=True`** from the `@cli.command(cls=TrackCommand, deprecated=True)` decorator (revert to `@cli.command(cls=TrackCommand)`).
2. **Remove the custom `console.print(...)` deprecation warning** from the `mcp_server()` function body.
3. **Delete `tests/test_cli_mcp_deprecation.py`**.

This is a single `git revert` of the implementation commit. The `mcp_server` command continues to work identically -- only the warning is removed. No behavioral changes, no persistent state impact, no configuration changes.

### 8. Docs and Changelog Touchpoints

| Artifact | Action |
|---|---|
| **GitHub Release Notes** | Add a "Deprecations" section in the v1.44.0 release notes: "`recce mcp-server` is deprecated. Use `recce server` (or `recce server --no-http` for MCP-only). Will be removed in v1.46.0." |
| **README.md** | No changes needed -- README does not currently mention `mcp-server`. |
| **AGENTS.md / CLAUDE.md** | Subtask 005 (`update-docs-and-agent-configs`) handles documentation updates. No changes in this subtask. |
| **CHANGELOG** | No project-level CHANGELOG file exists in this repo. Release notes are managed via GitHub Releases. |
| **MCP setup docs** (external: docs.reccehq.com) | Subtask 005 scope. Flag for update: the MCP server setup guide at `https://docs.reccehq.com/setup-guides/mcp-server/` should add a migration notice. |

### 9. Programmatic Invocation Safety

**Exit code:** The deprecation warning does not affect the exit code. Click's `deprecated=True` emits a warning but does not alter the return value. The custom `console.print()` is purely informational. Exit code remains 0 on success, 1 on error -- identical to pre-deprecation behavior.

**Protocol integrity:** In stdio mode, the `console` is created with `stderr=True` (line 2335). All deprecation output goes to stderr. The MCP JSON-RPC protocol on stdout is unaffected. In SSE mode, the warning goes to stdout before the HTTP server starts listening, which is acceptable since SSE transport uses HTTP, not stdio.

**Agent MCP configs:** Agent configurations (e.g., Claude Code `.mcp.json`, Cursor MCP settings) that invoke `recce mcp-server` via `command` will see the warning on stderr but the MCP server will start and function normally. Most MCP clients ignore stderr from the server process. The warning will not cause connection failures or protocol errors.

**CI scripts:** Scripts that run `recce mcp-server` and check exit codes will continue to work. The stderr warning may appear in CI logs, which serves as a helpful migration reminder.

## Stage Report: designed

- [x] Enumerate files that change (repo-relative paths), with one-line notes.
  See section 1: `recce/cli.py` (decorator + warning), `tests/test_cli_mcp_deprecation.py` (new).
- [x] Specify the exact deprecation warning: message text, stream, color/TTY handling, one-shot guarantee.
  See section 2: two-layer approach (Click built-in + custom Rich console), stderr-routed, TTY-auto-detected, one-shot per process.
- [x] Identify the symbol touchpoint in `recce/cli.py`.
  See section 3: `@cli.command(cls=TrackCommand, deprecated=True)` at line 2265; custom `console.print()` after line 2335, before the `try:` block.
- [x] Decide on the deprecation timeline with target removal version.
  See section 4: introduced v1.44.0, removed v1.46.0 (two minor releases). Version appears in warning text.
- [x] Resolve the `--no-http` question from subtask 002.
  See section 5: recommend YES -- add `--no-http` so the deprecation warning can offer a true migration path for MCP-only users.
- [x] Specify how tests verify the deprecation warning without breaking stdio protocol framing.
  See section 6: five test cases using `CliRunner` with `mix_stderr=False` to verify stderr-only output.
- [x] Document rollback plan.
  See section 7: single `git revert` removes decorator flag + warning + test file.
- [x] Document docs/changelog touchpoints.
  See section 8: GitHub Release Notes deprecation section; external docs update deferred to subtask 005.
- [x] Verify the warning does not break programmatic invocations.
  See section 9: exit code 0 preserved, stderr-only in stdio mode, agent configs and CI scripts unaffected.

### Summary

Designed a two-layer deprecation mechanism for `recce mcp-server`: Click's built-in `deprecated=True` (already precedented by the `snapshot` command) plus a custom Rich console warning with migration instructions and the v1.46.0 removal target. The warning is stderr-only in stdio mode, preserving MCP protocol framing. Recommended adding `--no-http` to `recce server` so the deprecation can offer a true equivalent for MCP-only users. Five targeted test cases validate stderr isolation and exit code preservation.
