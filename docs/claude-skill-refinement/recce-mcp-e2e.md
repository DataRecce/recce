---
id: 005
title: recce-mcp-e2e
status: intake
source: commission seed
started: 2026-04-29T07:38:05Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

End-to-end MCP verification skill — runs full E2E checks against a real dbt project before merging MCP PRs. Lives at `.claude/skills/recce-mcp-e2e/`. Goal of this entity: understand its verification scope and pre-merge gating role, categorize it (release/verification), and evaluate whether it should become a Spacedock pre-merge mod, a workflow stage agent on an MCP-feature workflow's verification stage, or stay invocable on demand.

## Acceptance criteria

**AC-1 — Categorization recorded.**
Verified by: Intake section names a category tag and documents the verification scope.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one Spacedock primitive with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.
