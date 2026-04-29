---
id: 001
title: address-dependabot
status: suggestions
source: commission seed
started: 2026-04-29T01:06:20Z
completed:
verdict:
score:
worktree:
issue:
pr:
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

**Recommendation:** `commission-seed` + `reference-doc` (combined). The full reviewable draft is at `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/address-dependabot-draft.md` — read the draft for the complete proposal; this section is the captain's-eye summary.

**Primary pick — `commission-seed` (Integration A in the draft):** Commission a `dependabot-batch` workflow via `/spacedock:commission`. The skill's 9 phases map cleanly onto a 7-stage Spacedock workflow (`queued` -> `inventory` -> `classify` -> `approve-classification` (gate) -> `apply-and-migrate` (worktree) -> `test` (worktree) -> `push-and-pr` (terminal)). The skill's two existing human pause points — "ask on major bumps" and "unsure if `@datarecce/ui` floor bump is needed" — collapse into a single approval gate at `approve-classification`, after which the rest runs unattended. The skill body itself stays at `.claude/skills/address-dependabot/skill.md` and is referenced from the workflow README's per-stage `Outputs` bullets — the workflow orchestrates, the skill remains the source of truth for *how* each phase actually executes.

**Secondary pick — `reference-doc` (Integration B in the draft):** Independent of Integration A, add a "Related skills" reference to `docs/claude-skill-refinement/README.md` so future captains discover the skill from the workflow it inspired. Cheap, no logic change.

**Why no `mod` recommendation:** Mods are designed for sharp lifecycle behaviors at `startup` / `idle` / `merge` hooks (see `_mods/pr-merge.md` for the canonical example). A 9-phase pipeline with mid-pipeline human pause points is the wrong shape for a single hook function. Notably, the `push-and-pr` terminal stage of Integration A *reuses* the pr-merge mod's `merge` hook — that is the appropriate mod surface for this skill, not a new dedicated mod.

**Why no `workflow-stage-agent` recommendation:** No existing Spacedock workflow has a stage this skill naturally plugs into. The skill IS the workflow — Integration A reflects that.

### Action items (for the execute stage)

Each item below names a target file path and a one-line description of what goes there.

1. **Run `/spacedock:commission`** with the mission statement quoted in the draft (Integration A section). Commission emits the following files automatically:
   - `/Users/jaredmscott/repos/recce/recce/docs/dependabot-batch/README.md` — workflow scaffolding with the 7 stages, schema reference, and entity template (commission's Phase 2a).
   - `/Users/jaredmscott/repos/recce/recce/docs/dependabot-batch/_mods/pr-merge.md` — copied from the Spacedock plugin to handle the terminal `push-and-pr` stage (commission's Phase 2c, conditional on a worktree stage existing — `apply-and-migrate` and `test` are worktree stages, so this triggers).
   - `/Users/jaredmscott/repos/recce/recce/docs/dependabot-batch/{slug}.md` — one initial seed entity per batch the captain wants to track. Seed slug example: `2026-04-batch.md`.
2. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a "Related skills" subsection at the bottom listing `address-dependabot` with a relative link to `.claude/skills/address-dependabot/skill.md`. This is the `reference-doc` half of the recommendation and is independent of whether commission runs.
3. **Leave `/Users/jaredmscott/repos/recce/recce/.claude/skills/address-dependabot/skill.md` unchanged.** The skill remains the source of truth for per-phase execution; the new workflow orchestrates around it. (Filename lowercase-vs-uppercase is a separate concern not in scope here — flagged in Intake for the captain's awareness.)

### Draft document

A reviewable standalone draft for the captain is saved at:

- `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/address-dependabot-draft.md`

It contains the full mission statement to feed `/spacedock:commission`, the 7-stage table with worktree/gate annotations, the file list, the rationale for rejecting `mod` and `workflow-stage-agent`, and a recommended approval path (approve B unconditionally; approve A only if per-batch audit trails are wanted).

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
