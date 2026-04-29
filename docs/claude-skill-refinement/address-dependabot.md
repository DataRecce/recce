---
id: 001
title: address-dependabot
status: intake
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
