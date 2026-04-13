---
id: 004
title: Update docs, examples, and agent configs
status: designed
source: commission seed
started: 2026-04-13T07:06:28Z
completed:
verdict:
score: 0.5
worktree:
issue: DRC-3228
pr:
---

Update all user-facing documentation and agent integration snippets to reflect the unified `recce server` command. Anywhere that currently shows `recce mcp-server` as the canonical way to start Recce for agents should point to `recce server` (optionally with `--no-http` if mentioned in subtask `003`'s design).

**User-visible outcome:**
- README (root and `js/` subtrees) uses `recce server` in quickstart instructions.
- Docs site (recce-landing / docs content, if accessible from this repo) uses `recce server`.
- Agent config snippets (Claude MCP config examples, Cursor config, etc.) use `recce server`.
- AGENTS.md / CLAUDE.md reflect the unified command where relevant.

**Acceptance criteria:**
- No remaining references to `recce mcp-server` in docs *except* in the deprecation section or migration notes.
- Example invocations are verified to actually work against the updated binary.
- Screenshots or terminal captures (if any) still render correctly.
- Changelog entry drafted for the release.

**Depends on:** `001`, `002`, `003` — need the final CLI surface locked before documenting it.

**Scope note:** This subtask stays within the `recce` repo. Updates to `recce-landing`, marketing pages, or the Recce Cloud docs are tracked separately.
