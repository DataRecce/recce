---
id: 004
title: recce-mcp-dev
status: queued
source: commission seed
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Recce-specific MCP development skill — auto-triggers when modifying `recce/mcp_server.py`, MCP tool handlers, error classification, or MCP tests. Lives at `.claude/skills/recce-mcp-dev/`. Goal of this entity: understand its trigger conditions and TDD posture, categorize it (domain-implementation), and evaluate whether it could be a workflow stage agent for an MCP-feature workflow, integrate as a guard mod that fires on dispatch when MCP files are touched, or stay as a passive auto-triggered companion.

## Acceptance criteria

**AC-1 — Categorization recorded.**
Verified by: Intake section names a category tag and documents the auto-trigger file patterns.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one Spacedock primitive with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.
