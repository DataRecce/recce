---
id: 002
title: Add `--mcp` / `--no-mcp` CLI flags to `recce server`
status: scoped
source: commission seed
started:
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
