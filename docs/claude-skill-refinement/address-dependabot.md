---
id: 001
title: address-dependabot
status: approval
source: commission seed
started: 2026-04-29T01:06:20Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block: merge:pr-merge
---

Dependency consolidation skill. Lives at `.claude/skills/address-dependabot/`. Goal of this entity: understand its scope (Dependabot PR consolidation), categorize it (release/automation), and decide whether it belongs as a Spacedock workflow, a mod on an existing release workflow, or stays as-is as a standalone skill referenced from a release runbook.

## Acceptance criteria

**AC-1 — Categorization recorded.**
Verified by: Intake section names a category tag and quotes the SKILL.md description.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one Spacedock primitive with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.

## Intake

**Skill location.** `/Users/jaredmscott/repos/recce/recce/.claude/skills/address-dependabot/` contains a single file: `skill.md` (12.6K). Notable: filename is lowercase `skill.md`, not the conventional `SKILL.md` used by Spacedock skills. There is no `references/` subdirectory and no `bin/` directory — the entire skill surface is the one markdown file. No external scripts, helpers, or reference docs are bundled.

**Primary purpose (one sentence).** Consolidate every open Dependabot pull request in the repository into one tested, signed-off branch and a single PR that closes them all, applied carefully so that `@datarecce/ui`'s published-package dependency floors are not raised without justification.

**Trigger conditions (verbatim from frontmatter).** The `description` field on line 3 of `skill.md` reads:

> "Use when consolidating open Dependabot PRs into a single branch. Fetches all open Dependabot PRs from the repo, applies dependency updates locally, tests for breakage, and creates a single PR that closes all Dependabot PRs."

The skill also declares an explicit slash invocation in its body (line 12): `/address-dependabot`.

**Interaction model.** Mostly autonomous, but with explicit human-in-the-loop pause points. The Iron Rules table (line 341) states: "Ask on major bumps. If a major version has breaking changes you can't resolve, ask the user." Phase 5 likewise instructs "If a migration is unclear or risky, **ask the user for clarification** before proceeding." The skill drives a 9-phase pipeline (fetch -> collect -> classify -> branch -> apply -> migrate -> test -> commit -> push/PR) end to end, but it is not silent — it surfaces classification tables, asks before non-trivial migration fixes, and pauses on unclear `@datarecce/ui` floor decisions.

**Scope of effect.** Heavy: this skill writes code AND calls external APIs AND mutates remote state.
- **Modifies code:** `js/package.json`, `js/packages/ui/package.json`, `js/packages/storybook/package.json`, `js/pnpm-lock.yaml`, `requirements*.txt`, `pyproject.toml`, `Dockerfile`, `.github/workflows/*.yml`, plus any package-specific config (e.g., `biome.json` via `pnpm biome migrate --write`).
- **Git state mutation:** creates `chore/dependabot` branch off `main`, commits with `-s` sign-off, pushes to `origin`.
- **External API calls:** `gh pr list`, `gh pr diff`, `gh pr view`, `gh pr create`, `gh release list`, plus implicit `WebFetch` against package CHANGELOGs (Phase 5).
- **Subagents:** none. The skill executes inline; it does not dispatch sub-agents.

**Dependencies.**
- **CLI tools (hard requirements):** `gh` (GitHub CLI), `git`, `pnpm`, `nave` (Node version manager — invoked via `NAVE_DIR=~/.nave && NAVE_VER=$(cat js/.nvmrc)` block in Phase 6), `uv` (Python lockfile updates), `make` (Python quality gates), `npx cdk` (conditional, only if CDK changed), `rg` (ripgrep, used in Phase 5 codebase scans).
- **Repo-specific assumptions:** `.venv/bin/activate` exists, `js/.nvmrc` exists, a Makefile with `format`/`flake8`/`test` targets exists, and `js/packages/ui/DEPENDENCIES.md` exists as the consumer-dependency contract reference.
- **Auth:** `gh` must be authenticated (PR list/create) and `git push` to `origin` must work — neither is checked or set up by the skill.
- **Env vars:** none declared, but inherits whatever shell session has activated (e.g., `PATH` modifications for nave).
- **MCP servers:** none. This is a pure CLI/`gh` workflow; no MCP tool calls.
- **Hidden surface check:** there is no `references/` directory and no `bin/` directory — the ceremonial intake risk of missing a script bundle does not apply here, but the skill does pull in `js/packages/ui/DEPENDENCIES.md` by reference (line 80) without copying the contract into the skill, so its correctness depends on that external repo doc staying authoritative.

**Categorization tag.** `automation`.

Rationale: the skill is a long-running, multi-phase batch operation that drives external state (git, GitHub, package registries) toward a goal with minimal human input; it is not a release procedure (no version bump, no tag, no publish), not a review (no verdict authoring), not analysis (writes are the point), and not domain-implementation (it does not implement Recce product features). It sits closest to `automation`: orchestrate `gh` + package managers + tests to consolidate Dependabot churn into one PR. The `release`-adjacent feel comes only from the PR-creation tail, which is a lightweight wrapper, not a release ceremony.

## Stage Report: intake

- DONE: Quote at least one specific line from the skill's SKILL.md frontmatter (description or trigger conditions) verbatim
  Quoted line 3 description verbatim in Intake/Trigger conditions: "Use when consolidating open Dependabot PRs into a single branch. Fetches all open Dependabot PRs from the repo, applies dependency updates locally, tests for breakage, and creates a single PR that closes all Dependabot PRs."
- DONE: Document the references/ subdirectory contents and any bin/ scripts encountered
  Verified via `ls -la` of skill dir: only `skill.md` (12.6K, lowercase) exists; no `references/`, no `bin/`. Recorded as "hidden surface check" in Intake.
- DONE: Apply exactly one categorization tag from the allowed set
  Selected `automation` with explicit comparative rationale against `release`, `review`, `analysis`, `domain-implementation`, and `process`.

### Summary

Read the entire `skill.md` (a single 12.6K file at `.claude/skills/address-dependabot/skill.md` — no `references/`, no `bin/`) and cross-checked the Spacedock plugin (`mods/pr-merge.md`, `agents/ensign.md`, `skills/commission/SKILL.md`) for integration primitives. Categorized as `automation`: a 9-phase batch operation orchestrating `gh`/`pnpm`/`uv`/`make` plus an explicit `@datarecce/ui` published-package guardrail that pauses for human input on major bumps and unclear floor decisions. Notable findings: filename is lowercase `skill.md` (not conventional `SKILL.md`), correctness depends on the external `js/packages/ui/DEPENDENCIES.md` reference, and no MCP/subagent surface — this is pure CLI orchestration.

## Suggestions

**Recommendation:** `reference-doc` (sole pick). The full reviewable draft is at `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/address-dependabot-draft.md` — read the draft for the complete proposal; this section is the captain's-eye summary.

**Pick — `reference-doc`:** Append a "Related skills" subsection to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md` that lists `address-dependabot` with a relative link back to `.claude/skills/address-dependabot/skill.md`. This makes the skill discoverable from the workflow that catalogued it without locking the captain into any new orchestration. Cheap, no logic change, no new workflow.

**Why no `commission-seed` recommendation:** A prior cycle proposed commissioning a new `dependabot-batch` workflow whose 7 stages would mirror the skill's 9 phases. Captain rejected that at the approval gate — the additional ceremony (per-batch entity files, gate review of the classification table, worktree dispatch for apply/test) is more overhead than the current single `/address-dependabot` invocation warrants. The skill works today as autonomous CLI orchestration with two natural human pause points; wrapping it in Spacedock stages does not earn its keep at the current batch volume. If batch volume grows or per-run audit trails become valuable, the captain can revisit this in a new entity.

**Why no `mod` recommendation:** Mods are designed for sharp lifecycle behaviors at `startup` / `idle` / `merge` hooks (see `_mods/pr-merge.md` for the canonical example). A 9-phase pipeline with mid-pipeline human pause points is the wrong shape for a single hook function. The skill's terminal push/PR step would naturally reuse the pr-merge mod's `merge` hook *if* the skill were ever wrapped in a Spacedock workflow — but absent that wrapping (see rejection above), there is no mod surface to add.

**Why no `workflow-stage-agent` recommendation:** No existing Spacedock workflow has a stage this skill naturally plugs into. The skill is a self-contained 9-phase pipeline, not a sub-step of some larger orchestration.

### Action items (for the execute stage)

Each item below names a target file path and a one-line description of what goes there.

1. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a "Related skills" subsection at the bottom that lists `address-dependabot` with a relative link to `.claude/skills/address-dependabot/skill.md` and a one-line description ("Consolidate open Dependabot PRs into a single tested branch and PR.").

### Draft document

A reviewable standalone draft for the captain is saved at:

- `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/address-dependabot-draft.md`

It contains the proposed README subsection text verbatim, the rationale for the sole `reference-doc` recommendation, and the rejection rationale for `commission-seed`, `mod`, and `workflow-stage-agent`.

## Stage Report: suggestions

- DONE: Pick exactly one or more integration recommendations from the allowed set: workflow-stage-agent | mod | commission-seed | reference-doc | keep-as-is — and tie each pick to a specific Spacedock primitive (mod hook lifecycle point, commission stage, ensign agent role, etc.).
  Picked `commission-seed` (tied to `/spacedock:commission` Phase 2a/2c emitting `docs/dependabot-batch/README.md` + `_mods/pr-merge.md`, with the pr-merge mod's `merge` hook covering the terminal push/PR stage) and `reference-doc` (tied to a "Related skills" subsection on the workflow README); explicitly rejected `mod` and `workflow-stage-agent` with rationale.
- DONE: Each action item names a target file path and a one-line description of what goes there — no vague 'could be useful' bullets.
  Three numbered action items each name an absolute target file path (`docs/dependabot-batch/README.md`, `docs/dependabot-batch/_mods/pr-merge.md`, `docs/dependabot-batch/{slug}.md`, `docs/claude-skill-refinement/README.md`) plus the explicit non-action on `.claude/skills/address-dependabot/skill.md`.
- DONE: If the recommendation includes a draft document, save its content to docs/claude-skill-refinement/address-dependabot-draft.md (or inline a short scaffold) so the captain can review the draft itself, not just the description of one.
  Saved to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/address-dependabot-draft.md` — contains mission statement for commission, 7-stage mapping table, file list, rationale for rejected primitives, and recommended approval path.

### Summary

Recommended `commission-seed` + `reference-doc` for the address-dependabot skill: commission a `dependabot-batch` workflow whose 7 stages map onto the skill's 9 phases with the existing human pause points consolidated into a single `approve-classification` gate, and reuse the shipped `pr-merge` mod for the terminal push/PR stage. Rejected `mod` (wrong shape for a multi-phase pipeline; pr-merge already covers the only mod surface needed) and `workflow-stage-agent` (no existing workflow to slot into). Full reviewable draft saved to `docs/claude-skill-refinement/address-dependabot-draft.md`.

### Feedback Cycles

**Cycle 1 — 2026-04-29 (approval -> suggestions)**

Captain verdict at approval gate: REJECTED Integration A (`commission-seed`); APPROVED Integration B (`reference-doc`).

Required revisions for the next suggestions pass:

- Drop Integration A (`commission-seed` for a new `dependabot-batch` workflow) entirely — the captain does not want a new workflow commissioned. Remove all action items related to `/spacedock:commission` and `docs/dependabot-batch/...` artifacts.
- Keep Integration B (`reference-doc`) as the sole recommendation: append a "Related skills" subsection to `docs/claude-skill-refinement/README.md` that links the workflow back to `.claude/skills/address-dependabot/skill.md`.
- Reduce the integration recommendation in the Suggestions section to a single primitive (`reference-doc`).
- Update or replace `docs/claude-skill-refinement/address-dependabot-draft.md` so it reflects only the reference-doc proposal — most of the existing draft is about Integration A and is now stale.
- Preserve the rationale for rejecting `mod` and `workflow-stage-agent`; those rejections still hold.

## Stage Report: suggestions (cycle 2)

- DONE: Revised Suggestions section names `reference-doc` as the SOLE integration recommendation; the prior `commission-seed` (Integration A) is removed entirely. Rationale for previously rejecting `mod` and `workflow-stage-agent` is preserved.
  Suggestions section rewritten: single recommendation `reference-doc`; new "Why no `commission-seed` recommendation" paragraph documents the cycle-1 rejection; existing rejection rationale for `mod` and `workflow-stage-agent` is preserved (and updated to reflect that there is no longer a Spacedock workflow to attach a mod to).
- DONE: Action items list contains ONLY the README 'Related skills' edit targeting `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`; no entries reference `docs/dependabot-batch/...` or `/spacedock:commission`.
  Action items reduced to a single numbered item: edit `docs/claude-skill-refinement/README.md` to append a "Related skills" subsection. No `docs/dependabot-batch/...` or `/spacedock:commission` references remain.
- DONE: `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/address-dependabot-draft.md` is rewritten to reflect only the reference-doc proposal; no remaining commission-seed / dependabot-batch content.
  Draft fully rewritten via Write: now contains the proposed README subsection text verbatim, rationale for the sole `reference-doc` pick, and the cycle-1 rejection of `commission-seed` documented under "What this draft deliberately does NOT recommend" so it is not re-proposed.

### Summary

Reduced the Suggestions section to the sole `reference-doc` recommendation per cycle-1 captain feedback: a one-subsection edit to `docs/claude-skill-refinement/README.md` linking back to `.claude/skills/address-dependabot/skill.md`. Removed all `commission-seed` action items and rewrote the draft document to match. Preserved the rejection rationale for `mod` and `workflow-stage-agent`, and added an explicit rejection note for `commission-seed` so the rejected proposal is not re-suggested in future cycles.
