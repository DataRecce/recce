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
