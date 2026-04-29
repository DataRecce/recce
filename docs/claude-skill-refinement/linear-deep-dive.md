---
id: 003
title: linear-deep-dive
status: execute
source: commission seed
started: 2026-04-29T02:30:20Z
completed: 2026-04-29T07:34:02Z
verdict: PASSED
score:
worktree:
issue:
pr:
mod-block:
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

## Suggestions

**Recommendation:** `commission-seed` (primary) + `reference-doc` (complementary). The full reviewable draft is at `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/linear-deep-dive-draft.md` — read the draft for the complete proposal; this section is the captain's-eye summary.

**Pick — `commission-seed` (primary):** Commission a new workflow `docs/workflows/linear-delivery/` whose entity is a Linear issue and whose stages mirror the skill's per-issue lifecycle: `triage → analysis → approval → implementation → review → done`. Use the plugin-shipped `pr-merge` mod for PR creation/merge detection. Author one new mod (`linear-status-sync`) that owns Linear MCP `save_issue` calls at stage-enter hooks for `implementation` (set In Progress), `review` (set In Review), and `done` (set Done after verifying merge). Tied to the dual-mode characterization from intake: **issue-mode** maps to one seed entity per issue; **project-mode** maps to N seed entities at commission time, where Linear's milestone/priority become entity score and the first officer's dispatch ordering subsumes Step 11's 4-option execution prompt. We do not need a second workflow — project-mode is just the multi-entity seeding case.

**Pick — `reference-doc` (complementary):** Append a "Related skills" row to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md` listing `linear-deep-dive`, matching the convention `address-dependabot` set in cycle 1. Discoverability fix only; no behavior change.

**Why no `mod` (rejected):** A mod is the right shape for one sharp lifecycle moment, not for a skill spanning analysis through merge. Naming the skill "a mod" without naming a hook would be the workflow README's `Bad` example ("Vague advice like 'could be a mod' without saying which lifecycle hook"). The Linear-status-mutation sub-concern *does* deserve a mod (`linear-status-sync`, action item 3) — that pick is captured under `commission-seed`'s mod inventory, not as a standalone primitive.

**Why no `workflow-stage-agent` (rejected):** No existing Spacedock workflow has a stage that this skill plugs into as a stage agent. The skill *spans* a full workflow lifecycle; flattening it into one stage loses the captain-gated approval and merge gate, and putting it inside every stage of a wrapper workflow recreates the original single-conversation problem. The skill is *the* workflow.

**Why no `keep-as-is` (rejected):** Keep-as-is is the status quo. The persistent on-disk per-issue state, multi-session resumability, and batch prioritization gains from the workflow are concrete; the cost is one new workflow dir plus one new mod. Worth the trade.

### Action items (for the execute stage)

Each item below names a target file path and a one-line description. The execute stage operates in a worktree.

1. **Create `/Users/jaredmscott/repos/recce/recce/docs/workflows/linear-delivery/README.md`** — the new workflow's plain-text README, generated by running `/spacedock:commission` in batch mode (commission SKILL.md L16-24) with mission "Take Linear issues from triage through to merged code, end-to-end", entity description "a Linear issue", and the six-stage state machine documented in the draft.
2. **Create `/Users/jaredmscott/repos/recce/recce/docs/workflows/linear-delivery/_mods/pr-merge.md`** — copy of the plugin-shipped mod from `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md` (no changes; matches the vendoring pattern this very workflow uses for its own `_mods/pr-merge.md`).
3. **Create `/Users/jaredmscott/repos/recce/recce/docs/workflows/linear-delivery/_mods/linear-status-sync.md`** — net-new mod with three `stage-enter` hooks (`implementation` → save_issue In Progress; `review` → save_issue In Review; `done` → save_issue Done after `gh pr view` MERGED check). Cites `.claude/skills/linear-deep-dive/references/linear-issue-lifecycle.md` as authority for the iron rule.
4. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a "Related skills" row for `linear-deep-dive` with relative link to `.claude/skills/linear-deep-dive/SKILL.md` and one-line description ("Analyze a Linear issue or project end-to-end and orchestrate the right delivery skills.").
5. **Edit `/Users/jaredmscott/repos/recce/recce/.claude/skills/linear-deep-dive/SKILL.md`** — add a "Spacedock integration" subsection (new) pointing to `docs/workflows/linear-delivery/README.md` with a one-line decision rule ("Prefer the workflow for persistent multi-session state; use this skill for one-shot conversation flow") plus a cross-reference at the top of the Project Flow section noting the workflow as the seeding alternative.
6. **Create `/Users/jaredmscott/repos/recce/recce/docs/workflows/README.md`** — net-new workflows index page (the directory does not exist yet — verified). Contents: (a) one-paragraph description of what `docs/workflows/` is for (the canonical home for plain-text Spacedock workflows in this repo); (b) entry for `linear-delivery/` with a one-line description ("Take a Linear issue from triage through to merged code, end-to-end") and relative link `./linear-delivery/`; (c) cross-reference entry for the existing `docs/claude-skill-refinement/` workflow (one-line description: "Refine and integrate Claude skills under `.claude/skills/` into Spacedock primitives") with relative link `../claude-skill-refinement/`. Captain's note: the existing `claude-skill-refinement` workflow is NOT being relocated — only cross-referenced from the index.

### Draft document

A reviewable standalone draft for the captain is saved at:

- `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/linear-deep-dive-draft.md`

It contains the full proposal: TL;DR, recommendation, why-commission rationale, the proposed workflow's mission/entity/stages/mods table, dual-mode handling argument, all six action items with target paths (cycle 2 path prefix `docs/workflows/linear-delivery/` plus the new workflows-index action item), rejected primitives with reasoning, risks/counterarguments, and the captain's decision points to weigh at approval.

## Stage Report: intake

- DONE: Categorization tag from the allowed set (`process` | `domain-implementation` | `release` | `review` | `analysis` | `automation`) with comparative rationale against at least one alternative tag.
  Selected `process` with explicit comparative rationale against all five alternatives in the Intake "Comparative rationale" subsection; the closest runner-up `analysis` is contrasted at length (analysis stops at the deep-dive doc; this skill carries through to merged PR via Linear status mutations).
- DONE: Inventory of `.claude/skills/linear-deep-dive/references/`: list each file in the references directory with a one-line summary of what it contains — this is the entity-specific AC-1 requirement.
  References directory contains exactly one file: `linear-issue-lifecycle.md` (999 bytes). Inventory and one-line summary recorded under "`references/` directory inventory" in the Intake section, including the SKILL.md citation lines (571, 595) that depend on it.
- DONE: Dual-mode characterization: explicitly distinguish issue-mode trigger conditions and outputs from project-mode trigger conditions and outputs (the entity body flags this skill operates in two modes).
  "Dual-mode characterization" subsection in the Intake section names trigger conditions and primary outputs separately for issue mode (XXX-NNN identifier or `/issue/` URL → per-issue analysis doc + skill-chain invocation + status mutations) and project mode (`/project/` URL or unprefixed slug → project map + execution plan + recursive per-issue re-entry).

### Summary

Read the full SKILL.md (22.0K, 608 lines) and the single `references/linear-issue-lifecycle.md` (999 bytes); confirmed no `bin/` directory. Categorized as `process` because the skill encodes the team's end-to-end Linear-ticket-to-merged-code lifecycle with mandatory status mutations and captain-gated orchestration of six downstream `superpowers:*` skills, beating the runner-up `analysis` because the skill keeps going past the deep-dive document into Linear status mutations, branch management, and downstream skill orchestration. Dual-mode is real and structurally distinct: issue mode produces a per-issue deep-dive and skill chain while project mode produces a project map plus prioritized execution plan that recursively re-enters issue mode per selected issue. Non-obvious dependencies surfaced: the Linear MCP server is hard-required across every flow path, `gh` CLI is silently used for merge verification (line 561), and the skill spawns `Agent(subagent_type: Explore)` subagents for codebase discovery without listing this as a prerequisite.

## Stage Report: suggestions

- DONE: Pick at least one integration primitive from the allowed set (`workflow-stage-agent` | `mod` | `commission-seed` | `reference-doc` | `keep-as-is`); tie the pick to a specific Spacedock primitive (mod hook lifecycle point, commission stage, ensign agent role) AND to the dual-mode characterization you recorded at intake (issue-mode vs project-mode integration may differ).
  Picked `commission-seed` (primary) + `reference-doc` (complementary). Tied to specific primitives: `/spacedock:commission` batch mode (commission SKILL.md L16-24); plugin-shipped `pr-merge` mod's `merge` + `startup`/`idle` hooks; new `linear-status-sync` mod with `stage-enter:implementation`, `stage-enter:review`, `stage-enter:done` hooks calling Linear MCP `save_issue`; the ensign agent runs the per-stage analysis and implementation. Dual-mode is collapsed by design — issue-mode = one seed entity, project-mode = N seed entities scored from Linear priority/milestone, so first-officer dispatch ordering subsumes Step 11's interactive prompt rather than requiring a second workflow.
- DONE: Each action item names a target file path and a one-line description of what goes there. Explicitly justify any rejected primitives. If a single primitive can't cover both modes, propose mode-specific picks rather than a vague catch-all.
  Five action items recorded in Suggestions, each with absolute target file path and one-line description (new `docs/linear-delivery/README.md`, copied `_mods/pr-merge.md`, new `_mods/linear-status-sync.md`, edits to workflow `README.md` and source `SKILL.md`). Single primitive does cover both modes via score-based seeding — argued in detail under "Dual-mode handling" in the draft. Rejections justified inline for `mod` (no single hook covers a multi-stage skill), `workflow-stage-agent` (skill spans an entire workflow, not a stage), and `keep-as-is` (status-quo loses persistent state and multi-session resumability).
- DONE: Save a reviewable standalone draft to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/linear-deep-dive-draft.md`. The draft must be readable without the entity's Suggestions section — captain reviews the draft alongside the suggestions.
  Draft saved at the required path. Self-contained: opens with TL;DR + recommendation, includes the workflow shape table (mission/entity/stages/mods), dual-mode handling argument, action items with target file paths, rejected primitives with reasoning, risks/counterarguments, and captain's decision points. The Suggestions section above is a captain's-eye summary that points back to the draft, not a substitute for it.

### Summary

Recommended `commission-seed` (primary) + `reference-doc` (complementary). The `linear-deep-dive` skill already encodes a per-entity lifecycle that maps cleanly onto a Spacedock workflow (`triage → analysis → approval → implementation → review → done`); the `pr-merge` mod handles the merge gate and a small new `linear-status-sync` mod centralizes the iron rule from `references/linear-issue-lifecycle.md` at three `stage-enter` hooks. The dual-mode design collapses by treating project-mode as the multi-entity seeding case (issue priority → entity score → first-officer dispatch ordering) rather than a parallel workflow. Five concrete action items with target paths and explicit rejections of `mod` / `workflow-stage-agent` / `keep-as-is` are recorded. Standalone draft at `linear-deep-dive-draft.md` for captain review at the approval gate.

### Feedback Cycles

**Cycle 1 — 2026-04-29 (approval -> suggestions)**

Captain verdict at approval gate: APPROVED with conditions.

Confirmed picks (no change required):

- `commission-seed` for one new workflow per Linear delivery flow — accepted.
- `linear-status-sync` mod with `stage-enter:implementation/review/done` hooks — accepted.
- `reference-doc` complementary tie-back — accepted.

Required revisions for the cycle-2 suggestions pass:

- **PATH CHANGE.** The new workflow must live at `/Users/jaredmscott/repos/recce/recce/docs/workflows/linear-delivery/` (NOT `docs/linear-delivery/` as currently proposed). Update action items 1, 2, and 3 to use the new prefix:
  - `docs/workflows/linear-delivery/README.md` (workflow scaffolding)
  - `docs/workflows/linear-delivery/_mods/pr-merge.md` (vendored)
  - `docs/workflows/linear-delivery/_mods/linear-status-sync.md` (new)
- **NEW: deeper cross-reference at `docs/workflows/README.md`.** Currently `docs/workflows/` does not exist. The cycle-2 action items must include creating `docs/workflows/README.md` as an index page that lists workflows (starting with `linear-delivery/` and presumably `claude-skill-refinement/` as well — captain's call whether to also relocate that, but the index entry should at minimum reference the existing `docs/claude-skill-refinement/` location). The `docs/claude-skill-refinement/README.md` "Related skills" entry from action item 4 stays as-is — it's a separate primitive (skill-back-to-workflow link), not a substitute for the workflows index.
- Update `docs/claude-skill-refinement/linear-deep-dive-draft.md` to reflect the path change and the new workflows-index action item.

Out of scope per captain (preserved as-is):

- Action item 5 (edit `.claude/skills/linear-deep-dive/SKILL.md` to add a "Spacedock integration" subsection) — captain did not flag this; keep as proposed.

## Stage Report: suggestions (cycle 2)

- DONE: Update action items 1, 2, 3 to use the new path prefix `/Users/jaredmscott/repos/recce/recce/docs/workflows/linear-delivery/` (instead of `docs/linear-delivery/`). Specifically: `docs/workflows/linear-delivery/README.md`, `docs/workflows/linear-delivery/_mods/pr-merge.md`, `docs/workflows/linear-delivery/_mods/linear-status-sync.md`. Action items 4 (workflow `README.md` "Related skills" entry) and 5 (skill `SKILL.md` Spacedock integration subsection) carry forward unchanged. The dual-mode argument and rejection rationale also carry forward.
  Action items 1, 2, 3 in the Suggestions section now use the `docs/workflows/linear-delivery/` prefix; the `commission-seed` pick paragraph and action item 5's pointer were updated to match. Action items 4 and 5 carried forward unchanged. Dual-mode handling, rejection rationale (`mod`, `workflow-stage-agent`, `keep-as-is`), and the broader workflow shape were not touched.
- DONE: Add a new action item: create `/Users/jaredmscott/repos/recce/recce/docs/workflows/README.md` as a workflows index page. This file does not currently exist (verified: `ls docs/workflows/` returns "No such file or directory"). The index should at minimum (a) explain what `docs/workflows/` is for, (b) list `linear-delivery/` with a one-line description and link, and (c) reference the existing `docs/claude-skill-refinement/` workflow at its current location with a one-line description. Captain has not asked to relocate `claude-skill-refinement` — leave that out of scope; just cross-reference it from the index.
  Re-verified `docs/workflows/` does not exist (`ls` returned "No such file or directory"). Added action item 6 to the Suggestions section spelling out the three required pieces: (a) one-paragraph purpose statement, (b) `linear-delivery/` entry with one-line description and `./linear-delivery/` link, (c) cross-reference for the existing `docs/claude-skill-refinement/` workflow at its current location with `../claude-skill-refinement/` link and an explicit captain's-note that it is not being relocated.
- DONE: Update the Suggestions section in the entity body AND the draft at `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/linear-deep-dive-draft.md` so they reflect the path change and the new workflows-index action item. The Stage Report you append should be titled `Stage Report: suggestions (cycle 2)` and account for every checklist item with `- DONE:` / `- SKIPPED:` / `- FAILED:`.
  Suggestions section updated in the entity body (paths in the `commission-seed` pick paragraph, action items 1–3 and 5, plus the Draft document blurb summarizing the cycle-2 changes). Draft at `linear-deep-dive-draft.md` updated for path prefix in TL;DR, "Workflow shape" section, all action items, captain's decision points, and added the new workflows-index action item (now item 4 in the draft, with original 4 and 5 renumbered to 5 and 6). This Stage Report is appended at the end of the entity file with the required `(cycle 2)` suffix.

### Summary

Cycle-1 picks (`commission-seed` + `linear-status-sync` mod + `reference-doc`) are unchanged. Path prefix moved from `docs/linear-delivery/` to `docs/workflows/linear-delivery/` across action items 1, 2, 3, and the cross-reference target in action item 5. Added new action item 6 to create `docs/workflows/README.md` as a workflows index that explains the directory's purpose, lists `linear-delivery/`, and cross-references the existing `docs/claude-skill-refinement/` workflow without relocating it. Both the entity Suggestions section and the standalone draft were updated to match.

## Completed actions

Each row maps an approved action item from Suggestions to the artifact produced in this worktree branch and the commit SHA where it landed. All paths are relative to the repo root.

| Action item | Artifact (relative path) | Commit |
|-------------|--------------------------|--------|
| 1. Workflow README at `docs/workflows/linear-delivery/README.md` | [`docs/workflows/linear-delivery/README.md`](../workflows/linear-delivery/README.md) | `6c8190b1` |
| 2. Vendored `pr-merge` mod | [`docs/workflows/linear-delivery/_mods/pr-merge.md`](../workflows/linear-delivery/_mods/pr-merge.md) | `6c8190b1` |
| 3. New `linear-status-sync` mod | [`docs/workflows/linear-delivery/_mods/linear-status-sync.md`](../workflows/linear-delivery/_mods/linear-status-sync.md) | `6c8190b1` |
| 4. Workflows index page | [`docs/workflows/README.md`](../workflows/README.md) | `6c8190b1` |
| 5. `Related skills` row appended for `linear-deep-dive` | [`docs/claude-skill-refinement/README.md`](README.md) | `6c8190b1` |
| 6. `Spacedock integration` subsection + Project Flow cross-reference | [`.claude/skills/linear-deep-dive/SKILL.md`](../../.claude/skills/linear-deep-dive/SKILL.md) | `6c8190b1` |

Notes:

- Action item 2's vendored mod is byte-identical to the plugin source at `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md` (verified via `diff -q`).
- Action item 6 produces two edits in the same SKILL.md file — the bottom "Spacedock integration" subsection and a one-line cross-reference at the top of "Project Flow" — both bundled in the single commit.
- The new workflow's commission was authored by hand (modeled after `docs/claude-skill-refinement/README.md`) rather than by invoking `/spacedock:commission` interactively; the resulting README conforms to the commission frontmatter shape (id-style, stages, mods).

## Stage Report: execute

- DONE: New workflow scaffolding under `/Users/jaredmscott/repos/recce/recce/docs/workflows/linear-delivery/`: README.md (with the 6-stage state machine `triage → analysis → approval → implementation → review → done` and entity = a Linear issue), `_mods/pr-merge.md` (vendored verbatim from `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md`), `_mods/linear-status-sync.md` (net-new, three stage-enter hooks calling Linear MCP `save_issue`: implementation→In Progress, review→In Review, done→Done after `gh pr view` MERGED check). Invoke `/spacedock:commission` if helpful, but the artifacts must end up under `docs/workflows/linear-delivery/`.
  All three files written; `pr-merge.md` byte-identical to plugin source (verified via `diff -q`); `linear-status-sync.md` cites `references/linear-issue-lifecycle.md` for the iron rule and includes the `gh pr view` MERGED guardrail at the `done` hook. Authored README directly rather than invoking `/spacedock:commission` interactively — the resulting frontmatter (id-style, stages list, mods list) conforms to the commission shape. Commit `6c8190b1`.
- DONE: Workflows index: create `/Users/jaredmscott/repos/recce/recce/docs/workflows/README.md` containing (a) one-paragraph purpose statement, (b) `linear-delivery/` entry with one-line description and `./linear-delivery/` link, (c) cross-reference for the existing `docs/claude-skill-refinement/` workflow at its current location with `../claude-skill-refinement/` link and an explicit note that it is NOT being relocated.
  Created with all three pieces. The cross-references section explicitly notes "lives outside `docs/workflows/` for historical reasons and is not being relocated". Commit `6c8190b1`.
- DONE: Cross-cutting edits: append a 'Related skills' row for `linear-deep-dive` to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md` AND add a 'Spacedock integration' subsection to `/Users/jaredmscott/repos/recce/recce/.claude/skills/linear-deep-dive/SKILL.md` pointing to `docs/workflows/linear-delivery/README.md` with the decision rule from the entity's action item 5.
  Both edits applied. The "Related skills" row uses the same format as the cycle-1 `address-dependabot` row (uppercase `SKILL.md` filename matches this skill's actual on-disk casing). The SKILL.md edit added both the bottom "Spacedock integration" subsection (decision rule: "Prefer the workflow for persistent multi-session state; use this skill for one-shot conversation flow") and the top-of-Project-Flow cross-reference noting the workflow as the multi-session seeding alternative. Commit `6c8190b1`.

### Summary

Wrote five new files (workflow README, two mods, workflows index, plus the entity-body Completed actions / Stage Report — see commit 2) and edited two existing files (`claude-skill-refinement/README.md` and `linear-deep-dive/SKILL.md`). All six action items from the cycle-2 suggestions landed in commit `6c8190b1`. The vendored `pr-merge.md` is byte-identical to the plugin source; the net-new `linear-status-sync.md` codifies the iron rule from `references/linear-issue-lifecycle.md` at the `done` hook with a `gh pr view` MERGED guardrail. The captain's path-prefix change (`docs/workflows/linear-delivery/` rather than `docs/linear-delivery/`) and the new workflows-index requirement are both honored. Note: a second ensign is concurrently editing `docs/claude-skill-refinement/README.md` for entity 002 (claude-code-review); merge resolution into the feature branch is the FO's responsibility.
