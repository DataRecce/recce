---
id: 002
title: claude-code-review
status: intake
source: commission seed
started: 2026-04-29T02:30:19Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

PR review skill triggered by `/review` and PR URLs. Lives at `.claude/skills/claude-code-review/`. Goal of this entity: understand its review methodology (multi-pass, adversarial, severity-based) and decide if it should be wrapped as a Spacedock workflow stage agent (e.g., review stage in a PR pipeline), a commissioned PR-review workflow seed, or stay as a directly-invokable skill referenced from a release workflow.

## Acceptance criteria

**AC-1 — Categorization recorded.**
Verified by: Intake section names a category tag and identifies whether the skill spawns subagents or runs inline.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one Spacedock primitive with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.
