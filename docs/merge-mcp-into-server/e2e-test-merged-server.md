---
id: 005
title: E2E test the merged server
status: designed
source: commission seed
started: 2026-04-13T06:52:21Z
completed:
verdict:
score: 0.8
worktree:
issue: DRC-3228
pr:
---

End-to-end verification that `recce server` correctly serves both the HTTP API and the MCP endpoint simultaneously. This subtask is the safety net for the whole refactor — catches integration bugs that unit tests miss.

**User-visible outcome:** Confidence that shipping the merged server won't break real developer or agent workflows.

**Test scenarios (minimum):**
1. **Dual transport, happy path** — start `recce server` against an `integration_tests/` dbt project; confirm web UI loads (hit `/` or a known API endpoint) *and* an MCP client can list tools / call a tool against the same process.
2. **`--no-mcp` isolation** — start with `--no-mcp`; confirm web UI works and no MCP port/endpoint is reachable.
3. **Deprecated command still works** — run `recce mcp-server`; confirm deprecation warning appears and MCP behavior is unchanged.
4. **Graceful shutdown** — send SIGINT; confirm both transports tear down, no orphaned threads or sockets, exit code 0.
5. **Concurrent clients** — web UI open in browser while MCP client holds a session; confirm neither transport starves the other.
6. **State-loader compatibility** — run against both `FileStateLoader` and (if reachable from tests) `CloudStateLoader`; confirm no regression.

**Acceptance criteria:**
- Each scenario is an automated test (pytest under `tests/` or `integration_tests/`) or a documented manual checklist with expected output.
- All scenarios pass on CI.
- Any flakiness is diagnosed, not silenced.
- Output evidence (logs, test reports) captured in the subtask body at `verified` stage.

**Depends on:** `001`, `002`, `003` — needs the full CLI surface in place. Runs concurrently with or after `004 update-docs-and-agent-configs`.

**Note:** This subtask may naturally get worked in parallel with `004` since they both depend on the same foundation but touch different parts of the repo.
