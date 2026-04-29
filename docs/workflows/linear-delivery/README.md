---
commissioned-by: spacedock@0.10.2
entity-type: linear_issue
entity-label: issue
entity-label-plural: issues
id-style: sequential
stages:
  defaults:
    worktree: false
    concurrency: 2
  states:
    - name: triage
      initial: true
    - name: analysis
    - name: approval
      gate: true
      feedback-to: analysis
    - name: implementation
      worktree: true
    - name: review
      worktree: true
      gate: true
    - name: done
      terminal: true
---

# Linear Delivery

Take Linear issues from triage through to merged code, end-to-end. Each entity is a Linear issue. The workflow encodes the team's lifecycle — `Triage → In Progress → In Review → Done` — as Spacedock stages with captain-gated approval before implementation, a worktree-isolated implementation stage, and a PR merge gate before the issue is marked Done.

This workflow seeds from the `linear-deep-dive` skill at `.claude/skills/linear-deep-dive/SKILL.md`. The skill's interactive single-conversation flow remains usable for one-shot work; this workflow is the persistent multi-session counterpart. See **Mode handling** below for the issue-mode vs. project-mode distinction.

## File Naming

Each issue lives as either:

- a flat markdown file `{slug}.md` (default — use this unless the issue produces many artifacts), or
- a folder `{slug}/` containing `index.md` as the canonical entity file, when the issue produces per-stage artifacts (deep-dive notes, plan documents, transcripts) that belong alongside the tracker.

Slugs are lowercase, hyphens, no spaces, derived from the Linear `gitBranchName` field where available (e.g., `drc-2893-add-row-count-tooltip.md`). The status scanner recognizes both forms; folder entities archive as a whole folder into `_archive/{slug}/`.

## Schema

Every issue file has YAML frontmatter. Fields are documented below; see **Issue Template** for a copy-paste starter.

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, format determined by id-style in README frontmatter |
| `title` | string | Human-readable issue title (mirrors Linear issue title) |
| `status` | enum | One of: triage, analysis, approval, implementation, review, done |
| `source` | string | Where this issue came from — typically `linear-issue:<DRC-XXXX>` or `linear-project:<slug>` |
| `linear-id` | string | Linear identifier (e.g., `DRC-2893`) — required for `linear-status-sync` to call `save_issue` |
| `linear-url` | string | Full Linear URL — for captain reference |
| `linear-branch` | string | The `gitBranchName` from Linear — used as the worktree branch name |
| `linear-state` | enum | Last-synced Linear state, one of: `Triage`, `In Progress`, `In Review`, `Done`, or empty (never synced). Updated by the `linear-status-sync` mod after each successful Linear `save_issue` call; the mod compares this against the entity's `status` to detect when a sync is needed. |
| `started` | ISO 8601 | When active work began |
| `completed` | ISO 8601 | When the entity reached terminal status |
| `verdict` | enum | PASSED or REJECTED — set at final stage |
| `score` | number | Priority score, 0.0–1.0 (typically derived from Linear priority + milestone order) |
| `worktree` | string | Worktree path while a dispatched agent is active, empty otherwise |
| `issue` | string | GitHub issue reference (e.g., `#42` or `owner/repo#42`). Optional cross-reference, set manually. |
| `pr` | string | GitHub PR reference (e.g., `#57` or `owner/repo#57`). Set when a PR is created for this entity's worktree branch. |

## Stages

### `triage`

Holding state for newly-seeded issues awaiting analysis. No worker effort happens here — the entity is in the queue waiting to be picked up. This is a Spacedock convention: the first stage is always a holding state, and the first dispatch advances the entity into the next stage where actual work begins.

- **Inputs:** None — this is the initial state.
- **Outputs:** A seed entity file with title, source, and `linear-id` populated (produced at commission time or by `bin/seed`, not by a worker).
- **Good:** Seed body names the issue clearly, includes the Linear identifier and URL, and preserves Linear priority/milestone information for scoring.
- **Bad:** Worker work happens here; status stays `triage` after seeding completes; missing `linear-id` (breaks `linear-status-sync`).

### `analysis`

The worker fetches the full Linear issue, classifies it (Feature / Bug / Refactor / Investigation), explores the relevant codebase, and proposes a concrete approach. This mirrors the `linear-deep-dive` skill's Steps 2–6 (SKILL.md §Issue Flow).

- **Inputs:** The seed entity's `linear-id`, this workflow's README, the `linear-deep-dive` skill at `.claude/skills/linear-deep-dive/SKILL.md` for classification rubric and skill-chain mapping.
- **Outputs:** A "Deep Dive" section in the entity body (or a sibling `{slug}-deep-dive.md` when folder-mode) that names: (1) issue summary, (2) classification with rationale, (3) current state, (4) key files, (5) related issues, (6) risks and open questions, (7) proposed approach with named downstream skill chain.
- **Good:** Classification quotes specific code or Linear context; key-files table cites file paths and line numbers; proposed approach names the downstream skills (brainstorming, writing-plans, executing-plans, systematic-debugging, TDD) the implementation stage will invoke.
- **Bad:** Paraphrasing the Linear title as the analysis; missing the proposed-approach section; treating "this issue is hard" as a classification.

### `approval`

The captain reviews the analysis and proposed approach, then either approves (advances to implementation) or rejects (bounces back to analysis). This is a human gate — the worker does not modify the entity body.

- **Inputs:** The completed entity with the Deep Dive section.
- **Outputs:** Captain's verdict recorded by the first officer's gate handling — PASSED moves the entity to implementation, REJECTED moves it back to analysis. No body changes.
- **Good:** Captain reads the deep dive in full before deciding; rejection includes a feedback note in the entity body about what to revise.
- **Bad:** Auto-passing without review; modifying analysis content during the gate.

### `implementation`

The worker runs the proposed downstream skill chain in an isolated worktree on the issue's `linear-branch`. On the next `idle` tick after this stage is entered, the `linear-status-sync` mod reconciles the entity's `linear-state` field, calling Linear `save_issue` to set **In Progress**.

- **Inputs:** Approved Deep Dive section, target file paths from the proposed approach.
- **Outputs:** Concrete code changes in the worktree branch — committed at meaningful units, ready for PR creation. The entity body gains an "Implementation" section with stage-report `[x]` DONE items mapped to commits.
- **Good:** Each DONE item has a corresponding commit on the worktree branch; commits use clear messages tied to the entity ID; the chosen skill chain matches the analysis classification (brainstorming + writing-plans + executing-plans for features; systematic-debugging + TDD for bugs).
- **Bad:** Skipping the named skill chain; landing changes outside the proposed scope without raising it; failing to commit before signaling completion.

### `review`

The entity stays at `review` with its worktree branch ready to push, awaiting captain approval at the gate. When the captain approves, the first officer tries to advance `review → done` (terminal); the merge-hook mechanism intercepts and runs `pr-merge.merge`, which presents a draft PR summary for a second captain approval (PR APPROVAL GUARDRAIL) and, on approval, pushes the branch and creates the PR (setting the entity's `pr` field). The entity stays at `review` with `pr` and `mod-block` set until the `pr-merge.startup` or `pr-merge.idle` hook detects the PR is `MERGED`, at which point it advances directly to `done`.

The two captain prompts at this transition (review-gate ack and PR APPROVAL GUARDRAIL) cover the same logical "ready to push" decision and are normally answered consecutively. On the next `idle` tick after the entity reaches `review`, the `linear-status-sync` mod reconciles Linear to **In Review**.

- **Inputs:** Implementation stage's worktree branch and Implementation section.
- **Outputs:** A GitHub PR referenced in the entity's `pr` field; the entity stays at `review` with `pr` and `mod-block` set until the PR merges.
- **Good:** PR body follows the `pr-merge` mod's template; `linear-status-sync` reconciles to In Review on the first idle tick after the stage is entered; the entity does not advance to `done` before merge confirmation.
- **Bad:** Marking the entity `done` before `gh pr view` returns MERGED; pushing without captain approval at the PR APPROVAL GUARDRAIL.

### `done`

Terminal stage. The `pr-merge.startup`/`idle` hook detected the PR was merged, advanced the entity to `done`, and archived it. On the next `idle` tick after archival, the `linear-status-sync` mod re-verifies merge state via `gh pr view --json state` (the iron-rule guardrail from `.claude/skills/linear-deep-dive/references/linear-issue-lifecycle.md`) and, if `MERGED`, calls Linear `save_issue` to set **Done**, then updates the archived entity's `linear-state` field to match. If `gh pr view` returns anything other than `MERGED`, the mod refuses to mark Linear Done — the iron rule is enforced regardless of whether `pr-merge` already archived. The Linear sync therefore lags `pr-merge`'s archival by exactly one idle tick (see `_mods/linear-status-sync.md` "Ordering relative to `pr-merge`").

- **Inputs:** The entity at `review` with `pr` set and the corresponding PR in MERGED state.
- **Outputs:** Entity archived to `_archive/{slug}.md` with `status: done`, `verdict: PASSED`, `completed` set to ISO 8601 now, `worktree` cleared. Linear issue moves to **Done** on the idle tick after archival.
- **Good:** `linear-status-sync` re-runs `gh pr view --json state` against the archived entity's `pr` field before calling Linear `save_issue`; the entity file is archived; the worktree is removed via `git worktree remove`.
- **Bad:** Linear marked Done before `gh pr view` returns MERGED; the `linear-status-sync` re-verification skipped on archived entities; worktree leaks on disk after archival.

## Mode handling

The seeding `linear-deep-dive` skill operates in two modes: **issue mode** (one Linear issue) and **project mode** (a Linear project containing many issues). This workflow handles both via the seed protocol — there is no second workflow.

- **Issue mode.** Captain seeds one entity at commission time (or via `bin/seed` later) by passing a Linear issue identifier. The entity's `source` is `linear-issue:<DRC-XXXX>`.
- **Project mode.** Captain seeds N entities at commission time by passing a Linear project URL. The commissioner calls Linear MCP `get_project` + `list_issues` (matching the skill's project-flow Steps 8–9), and maps each issue to a seed entity with `source: linear-project:<slug>`. Linear priority and milestone order map to the `score` field, so the first officer's startup procedure picks the highest-score unblocked entity to dispatch first. Cross-issue dependency rules from the skill (block on prior milestone work) are encoded as `score` ordering.

The original skill's interactive 4-option execution prompt (SKILL.md §11) becomes the first officer's normal dispatch decision: the captain steers by adjusting entity scores or skipping ahead, not by answering an in-conversation menu.

## Mods

This workflow ships with two mods under `_mods/`. The first officer auto-discovers mods by filesystem scan at startup; there is no explicit mod registration in this README's frontmatter.

- **`pr-merge`** (vendored from the plugin) — owns PR creation (`merge` hook), merge detection (`startup`/`idle` hooks), and entity advancement on merge. Located at `_mods/pr-merge.md`.
- **`linear-status-sync`** (workflow-specific) — owns Linear MCP `save_issue` calls. Hooks `startup` and `idle` to reconcile Linear state against the entity's workflow `status` via the `linear-state` frontmatter field; uses no `merge` hook (that point is owned by `pr-merge`). Mapping: `triage`/`analysis`/`approval` → Triage; `implementation` → In Progress; `review` → In Review; `done` → Done (only after `gh pr view --json state` returns MERGED). On the first reconciliation for a seeded entity (when `linear-state` is empty), the mod bootstraps from Linear via `get_issue` rather than pushing — this avoids regressing the Linear state for issues seeded mid-flight. Subsequent reconciliations apply a forward-only direction check (canonical order `Triage < In Progress < In Review < Done`) and skip backward pushes with a captain warning. Located at `_mods/linear-status-sync.md`. Cites `.claude/skills/linear-deep-dive/references/linear-issue-lifecycle.md` as the authority for the iron rule.

Mods run in lexical filename order; `linear-status-sync` (l) runs before `pr-merge` (p) on every shared hook tick. The Linear `Done` sync therefore lags `pr-merge`'s archival by exactly one idle tick — by design, since the Done sync re-runs `gh pr view` against the archived entity to re-verify the merge before mutating Linear.

## Workflow State

The captain-runnable bash blocks below pin `spacedock/0.10.2` to match this workflow's `commissioned-by` frontmatter. When the spacedock plugin updates, resolve the latest installed version dynamically with:

```bash
SPACEDOCK_BIN="$(ls -d ~/.claude/plugins/cache/spacedock/spacedock/*/skills/commission/bin/status 2>/dev/null | sort -V | tail -1)"
```

and substitute `$SPACEDOCK_BIN` for the pinned path. The first officer's runtime resolves the plugin path itself and is unaffected by the pinning here.

View the workflow overview:

```bash
~/.claude/plugins/cache/spacedock/spacedock/0.10.2/skills/commission/bin/status --workflow-dir docs/workflows/linear-delivery
```

Output columns: ID, SLUG, STATUS, TITLE, SCORE, SOURCE.

Include archived issues with `--archived`:

```bash
~/.claude/plugins/cache/spacedock/spacedock/0.10.2/skills/commission/bin/status --workflow-dir docs/workflows/linear-delivery --archived
```

Find dispatchable issues ready for their next stage:

```bash
~/.claude/plugins/cache/spacedock/spacedock/0.10.2/skills/commission/bin/status --workflow-dir docs/workflows/linear-delivery --next
```

Find issues in a specific stage:

```bash
grep -l "status: implementation" docs/workflows/linear-delivery/*.md
```

## Issue Template

```yaml
---
id:
title: Linear issue title here
status: triage
source: linear-issue:DRC-XXXX
linear-id: DRC-XXXX
linear-url: https://linear.app/recce/issue/DRC-XXXX/...
linear-branch:
linear-state:
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Brief description of this issue and the desired outcome (mirrors the Linear description for orientation).

## Acceptance criteria

Each AC names a property of the finished entity (not a stage action) and how it is verified.

**AC-1 — Deep dive recorded.**
Verified by: Deep Dive section in the entity body names a classification tag from the allowed set and a proposed downstream skill chain.

**AC-2 — Linear status synchronized.**
Verified by: For each forward stage transition, the entity's `linear-state` field reaches the implied Linear state for its current `status` (per the mapping in `_mods/linear-status-sync.md`) by the next `idle` tick after the transition. The first reconciliation for a freshly-seeded entity bootstraps `linear-state` from Linear via `get_issue` (not by pushing); subsequent ticks push forward only. Backward transitions (workflow status moving to a stage with a lower implied Linear state) skip the push with a captain warning to avoid regressing externally-set state. Done is only set after `gh pr view --json state` returns `MERGED`.

**AC-3 — PR linked.**
Verified by: The entity's `pr` field is populated and the PR body cross-references the entity via the audit link template from `_mods/pr-merge.md`.
```

## Commit Discipline

- Commit status changes at dispatch and merge boundaries
- Commit code changes during implementation at meaningful units, signed off
- Never amend commits on a published worktree branch (the `pr-merge` mod's rebase logic depends on a clean linear history)

## Related skills

The Claude skill that seeded this workflow:

- [`linear-deep-dive`](../../../.claude/skills/linear-deep-dive/SKILL.md) — Analyze a Linear issue or project end-to-end and orchestrate the right delivery skills. The single-conversation flow that this workflow generalizes for persistent multi-session use.
