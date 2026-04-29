---
id: 003
title: linear-deep-dive
status: suggestions
source: commission seed
started: 2026-04-29T02:30:20Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

Linear issue/project analysis and orchestration skill. Lives at `.claude/skills/linear-deep-dive/` (includes a `references/` directory worth inspecting). Goal of this entity: understand its dual mode (issue analysis vs. project planning), evaluate whether it could seed a commissioned ticket-to-implementation workflow, become a workflow stage agent for an issue-driven workflow, or remain a standalone analysis tool referenced from intake-style workflows.

## Acceptance criteria

**AC-1 — Categorization recorded.**
Verified by: Intake section names a category tag and documents the references/ directory contents.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one Spacedock primitive with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.

## Intake

**Skill location.** `/Users/jaredmscott/repos/recce/recce/.claude/skills/linear-deep-dive/` contains `SKILL.md` (22.0K, conventional uppercase) and a `references/` subdirectory. There is no `bin/` directory — no helper scripts, no executables. The skill surface is one large markdown file plus one reference doc.

**`references/` directory inventory.**
- `references/linear-issue-lifecycle.md` (999 bytes, single file). Defines the canonical Linear status transition table (Triage → In Progress → In Review → Done, plus the PR-closed-without-merge bounce-back), declares the iron rule "NEVER mark a Linear issue as Done until the PR that closes it has been merged to `main`", and explains why (false progress signals, broken trust between issue status and codebase state). The SKILL.md body cites this file twice (lines 571 and 595) as the authority for the Done-after-merge rule. There are no other files in `references/`.

**Primary purpose (one sentence).** Take a Linear issue ID, URL, identifier, or project name/URL, fetch the full Linear entity, classify and explore the relevant code, propose a concrete approach, and orchestrate the right downstream skills (brainstorming, writing-plans, executing-plans, systematic-debugging, TDD) to ship the work — while keeping the Linear issue status accurate at every lifecycle transition.

**Trigger conditions (verbatim from frontmatter).** The `description` field on line 3 of `SKILL.md` reads:

> "Use when given a Linear issue ID, URL, identifier, or project name/URL to analyze and plan work. For issues, fetches the issue, classifies it, explores relevant code, proposes an approach, and orchestrates the right skills. For projects, fetches the project with milestones and issues, builds a prioritized execution plan, and systematically works through issues respecting project structure and dependencies."

The skill body declares an explicit slash invocation (line 12): `/linear-deep-dive <issue ID, identifier, URL, or project name/URL>` with worked examples for both issue identifiers (`DRC-2893`, `https://linear.app/recce/issue/DRC-2893/...`) and project identifiers (`"Mypy Strict Typing"`, `https://linear.app/recce/project/mypy-strict-typing-abc123`).

**Dual-mode characterization.** This skill operates in two distinct modes determined at runtime by an input-pattern table at line 28:

- **Issue mode.**
  - *Trigger conditions:* team-prefix-numbered identifier matching `XXX-NNN` (e.g., `DRC-2893`); URL containing `/issue/`. (line 28-31)
  - *Primary outputs:* a per-issue analysis document at `docs/plans/<date>-<issue-id>-deep-dive.md` containing classification (Feature/Bug/Refactor/Investigation per the table at line 78), key-files table, related-issues table, risks/open-questions, and proposed approach; downstream skill invocation chain selected from `feature` / `bug` / `refactor` / `investigation` workflows (line 219-266); Linear issue status mutations through `Triage → In Progress → In Review → Done`.
- **Project mode.**
  - *Trigger conditions:* URL containing `/project/`; quoted string or slug with no team-prefix `XXX-NNN` pattern (treated as a project name search). (line 28-31)
  - *Primary outputs:* a project map at `docs/plans/<date>-project-<slug>-deep-dive.md` (template at line 391-431) with per-milestone issue tables, dependency graph, and risks/gaps; a prioritized **execution plan** (template at line 447-463) ordered by milestone → dependencies → priority → status → issue type; an interactive top-level prompt asking the captain to start-from-top / pick-issue / focus-milestone / adjust-plan; per-issue execution that recursively re-enters issue mode for each selected issue (line 478) while carrying project context forward.

**Interaction model.** Interactive — explicitly captain-gated at multiple checkpoints, not autonomous. The Iron Rules table (line 588) declares "Always confirm with the user. Never start implementation without presenting the approach and getting approval." Specific pause points: Step 6 ("Wait for user confirmation before proceeding", line 204), classification ambiguity ("If the classification is ambiguous, ask the user", line 84), blocker detection ("This issue is blocked by …", line 295), vague-issue detection (line 302), the project-mode 4-option execution prompt (line 467), and a pause-between-issues progress update with explicit "Wait for user confirmation before starting each new issue" (line 499). The skill never executes downstream skills without an approval gate.

**Scope of effect.** Heavy and multi-surface: read code, write planning docs, mutate external Linear state, orchestrate sub-skills, and spawn subagents.
- **Read-only against the codebase:** uses Read/Grep/Glob and `Agent(subagent_type: Explore)` for codebase discovery (line 90). Does not directly edit source code — that responsibility delegates to the downstream skills it invokes.
- **Writes planning artifacts:** creates `docs/plans/<date>-<issue-id>-deep-dive.md` (issue mode) and `docs/plans/<date>-project-<slug>-deep-dive.md` (project mode); ensures `docs/plans/` exists via `mkdir -p docs/plans`.
- **External API calls (Linear MCP — mutating):** `mcp__claude_ai_Linear_2__save_issue` to transition issue state (`In Progress`, `In Review`, `Done`). Status mutations are **mandatory**: "ALWAYS update issue status at lifecycle transitions … This is mandatory, not optional." (line 593-594).
- **External API calls (Linear MCP — read):** `get_issue`, `list_comments`, `get_project`, `list_milestones`, `list_issues`, `get_status_updates`.
- **External API calls (GitHub):** indirect — `gh pr view <PR-number> --json state` to verify merge before transitioning to Done (line 561).
- **Git mutation:** branch operations only — `git fetch origin`, `git checkout -t origin/<branch>`, `git checkout -b <branch>`. The skill creates the issue's `gitBranchName` branch (or `project/<slug>` for projects) but does not commit; downstream skills do.
- **Spawns subagents:** yes. The skill explicitly invokes `Agent(subagent_type: Explore)` for broad codebase discovery (line 90, line 263) — this is a non-obvious dependency since the skill body uses these as opaque tool calls without enumerating them as requirements.
- **Orchestrates other skills:** invokes `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:executing-plans`, `superpowers:subagent-driven-development`, `superpowers:systematic-debugging`, `superpowers:test-driven-development` — six downstream skill IDs are hard-coded into the workflow tables (lines 219-266). Correctness of the skill chain depends on all six being installed and reachable.

**Dependencies.**
- **MCP servers (hard requirement):** `claude_ai_Linear_2` (the Linear MCP server). The skill names ten distinct MCP tool calls on this server; without it, the skill cannot fetch issues, list comments, fetch projects, list milestones, list issues, fetch status updates, or transition issue state. This is the central dependency — every flow path begins with a Linear MCP call.
- **CLI tools:** `gh` (used in line 561 for PR merge verification — non-obvious dependency, since the skill body doesn't list `gh` as a prerequisite anywhere), `git` (branch fetch/create/checkout in lines 113-115, 280-285).
- **Downstream skills (hard requirement):** the six `superpowers:*` skills listed above. The skill is an orchestrator; its output is an invocation chain into these skills.
- **Agent surface:** the harness must support `Agent(subagent_type: Explore)`. On Claude Code this is the built-in Explore subagent.
- **Repo-specific assumptions:** `docs/plans/` is gitignored or otherwise allowed (the skill writes there freely); the project follows a per-issue-branch convention with branches named from Linear's `gitBranchName` field; `main` is the default integration branch (line 562 verifies merge by checking PR state, implicitly assuming `main` is the merge target).
- **Auth:** Linear MCP must be authenticated for the active workspace; `gh` must be authenticated for the active repo.
- **Env vars:** none declared. Inherits whatever the Claude Code session has configured.
- **Hidden surface check:** no `bin/` scripts, but the references file (`linear-issue-lifecycle.md`) is load-bearing — the iron rule "NEVER mark Done until merged" lives there and is cited from SKILL.md. Removing or moving the references file would break the citation chain in lines 571 and 595.

**Categorization tag.** `process`.

**Comparative rationale (compared against allowed set):**

- vs. `analysis` (close runner-up): the skill *does* perform substantial analysis — codebase exploration, issue classification, project mapping, dependency-graph construction, execution-order prioritization. The deep-dive document at `docs/plans/` is genuinely an analysis artifact. But analysis is the **first half** of what the skill does. The second half — orchestrating brainstorming/writing-plans/executing-plans/systematic-debugging/TDD, mutating Linear status across the lifecycle, branch management, captain-gated approval flow — is squarely process work, not analytical output. A pure `analysis` skill would stop at the deep-dive document; this one keeps going through the full ticket-to-merge lifecycle.
- vs. `automation`: the orchestration *feel* is automation-adjacent, but `automation` implies long-running autonomous batch operations (the `address-dependabot` shape). This skill is interactive at every gate — captain confirms approach (Step 6), captain picks execution order (Step 11's 4-option prompt), captain authorizes each next-issue transition (line 499). It coordinates a workflow rather than automating one.
- vs. `domain-implementation`: this skill implements no Recce product surface. It is meta-tooling about how the team takes Linear work through delivery.
- vs. `release`: no version bump, no tag, no publish, no changelog. The skill ends at PR-merged status update; release ceremony lives elsewhere.
- vs. `review`: no verdict authoring, no review comments, no approve/reject decision on someone else's work. Different surface entirely.
- vs. `process` (selected): the skill encodes the team's **end-to-end process for taking a Linear ticket or project from triage to merged code**. It defines the lifecycle (Triage → In Progress → In Review → Done), the artifacts produced at each stage (deep-dive doc → plan → implementation → PR), the approval gates, the branch convention, the skill-chain mapping per issue type, and the cross-issue dependency rules for projects. Process is the right tag because the artifact the skill produces is *the team's working process*, not a single deliverable.

## Stage Report: intake

- DONE: Categorization tag from the allowed set (`process` | `domain-implementation` | `release` | `review` | `analysis` | `automation`) with comparative rationale against at least one alternative tag.
  Selected `process` with explicit comparative rationale against all five alternatives in the Intake "Comparative rationale" subsection; the closest runner-up `analysis` is contrasted at length (analysis stops at the deep-dive doc; this skill carries through to merged PR via Linear status mutations).
- DONE: Inventory of `.claude/skills/linear-deep-dive/references/`: list each file in the references directory with a one-line summary of what it contains — this is the entity-specific AC-1 requirement.
  References directory contains exactly one file: `linear-issue-lifecycle.md` (999 bytes). Inventory and one-line summary recorded under "`references/` directory inventory" in the Intake section, including the SKILL.md citation lines (571, 595) that depend on it.
- DONE: Dual-mode characterization: explicitly distinguish issue-mode trigger conditions and outputs from project-mode trigger conditions and outputs (the entity body flags this skill operates in two modes).
  "Dual-mode characterization" subsection in the Intake section names trigger conditions and primary outputs separately for issue mode (XXX-NNN identifier or `/issue/` URL → per-issue analysis doc + skill-chain invocation + status mutations) and project mode (`/project/` URL or unprefixed slug → project map + execution plan + recursive per-issue re-entry).

### Summary

Read the full SKILL.md (22.0K, 608 lines) and the single `references/linear-issue-lifecycle.md` (999 bytes); confirmed no `bin/` directory. Categorized as `process` because the skill encodes the team's end-to-end Linear-ticket-to-merged-code lifecycle with mandatory status mutations and captain-gated orchestration of six downstream `superpowers:*` skills, beating the runner-up `analysis` because the skill keeps going past the deep-dive document into Linear status mutations, branch management, and downstream skill orchestration. Dual-mode is real and structurally distinct: issue mode produces a per-issue deep-dive and skill chain while project mode produces a project map plus prioritized execution plan that recursively re-enters issue mode per selected issue. Non-obvious dependencies surfaced: the Linear MCP server is hard-required across every flow path, `gh` CLI is silently used for merge verification (line 561), and the skill spawns `Agent(subagent_type: Explore)` subagents for codebase discovery without listing this as a prerequisite.
