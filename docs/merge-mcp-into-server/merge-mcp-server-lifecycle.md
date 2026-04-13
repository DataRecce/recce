---
id: 001
title: Merge MCP server lifecycle into `recce server` startup
status: scoped
source: commission seed
started:
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
