---
id: 002
title: claude-code-review
status: suggestions
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

## Intake

**Skill location.** `/Users/jaredmscott/repos/recce/recce/.claude/skills/claude-code-review/` contains a single file: `SKILL.md` (7.2K, conventional uppercase). Verified via `ls -la` and `find -type f`: there is no `references/` subdirectory and no `bin/` directory — the entire skill surface is the one markdown file. No bundled scripts, helper docs, or auxiliary references; every command the skill runs is inline shell in fenced code blocks.

**Primary purpose (one sentence).** Review a GitHub pull request for critical bugs, security, performance, correctness, and test gaps — running the project's tests/lint/type-check as concrete evidence — then post the findings as both an updateable PR comment (marked with a `<!-- claude-code-review -->` HTML sentinel for idempotent re-runs) and a formal `gh pr review --approve | --request-changes` verdict.

**Trigger conditions (verbatim from frontmatter).** The `description` field on line 3 of `SKILL.md` reads:

> "Use when asked to review a PR, or when /review is invoked with a PR number or URL. Performs a focused code review checking for bugs, security, performance, and test gaps, then posts findings as a PR comment and formal GitHub review."

The skill body also names an explicit slash invocation on line 13: `/claude-code-review <PR number or URL>`. Note that the project also exposes the same slash command via the `recce-dev` plugin (`recce-dev:claude-code-review`), but this entity is scoped to the in-repo `.claude/skills/claude-code-review/` copy.

**Interaction model.** Autonomous, single-pass, with one unconditional human-detectable exit gate. The skill drives the 9-step pipeline (parse -> details -> draft? -> prior-comment lookup -> checkout -> review-diff -> verify -> write -> post -> formal review) end to end without asking the user mid-flow. The only branch on human-facing state is the draft check (Step 3, line 70): "If `IS_DRAFT` is `true`, inform the user and stop. Do not review draft PRs." There are no "ask the user before X" pauses anywhere else — unlike `address-dependabot`, which surfaces classification tables and pauses on major bumps, `claude-code-review` runs straight through to a posted verdict.

**Scope of effect.** Mixed: this skill is a hybrid of read-only local code analysis and write-heavy external API calls.
- **Read-only on the working tree (Iron Rule, line 206):** "**No file modifications.** Do NOT modify, create, or delete any files. This is a review, not a fix. Running tests, lint, and type checks is encouraged — editing code is not." Local source is not edited. Step 8 *does* write the review body to `/tmp/review_body.md` (Iron Rule on line 208: "Always write review body to `/tmp/review_body.md`"), but that is a transient temp file outside the repo.
- **Git state mutation:** non-trivial. Step 5 runs `git fetch origin "$HEAD_REF"` and `git checkout "$HEAD_REF"` — this *moves the local working tree to the PR branch* even though no commits are made. Anyone running this skill loses their currently checked-out branch unless they restore it manually after. This is a non-obvious side effect that the SKILL.md does not flag.
- **External API calls:** `gh api repos/.../pulls/{n}` (Step 2), `gh api repos/.../issues/{n}/comments` (Step 4 prior-comment lookup), `gh pr diff {n}` (Step 6), `gh api .../issues/comments/{id} -X PATCH` or `gh pr comment {n} --body-file` (Step 8), and `gh pr review {n} --approve | --request-changes` (Step 9).
- **Verification command surface (Step 7):** runs `make test`, `make flake8`, `cd js && pnpm test`, `cd js && pnpm lint`, `cd js && pnpm type:check` against the *checked-out PR branch* — meaning a malicious PR could in principle cause arbitrary code execution via test fixtures or build steps. The skill does not gate this behind any auth check on the PR author.
- **Subagents:** none. The skill executes inline via the agent's own Bash, Read, gh, and `jq` calls. No `Task` tool dispatches, no Agent calls, no parallel sub-workers. Evidence: the SKILL.md uses imperative "Run …", "Read …", "Write …" verbs throughout; the only diagrammed nodes (the dot graph on lines 18-46) are sequential steps in one execution thread; the Iron Rules section makes no mention of dispatching helpers; and there is no instruction to spawn a sub-agent for any of the 9 steps. This is a single-actor pipeline.

**Dependencies.**
- **CLI tools (hard requirements):** `gh` (GitHub CLI — used in 5 of the 9 steps; auth is assumed and never checked), `git` (Step 5 fetch/checkout), `jq` (Steps 2 and 4 parse `gh api` JSON), `make` (Python verification), `pnpm` (frontend verification), `cat` (Step 8 heredoc to `/tmp/review_body.md`).
- **Repo-specific assumptions:** a Makefile with `test` and `flake8` targets exists; `js/` is a pnpm-managed workspace with `test`, `lint`, and `type:check` scripts; the repo is a git checkout with `origin` pointing at the PR's GitHub repo (otherwise `gh pr diff` and `git fetch origin "$HEAD_REF"` fail).
- **GitHub identity assumption:** Step 4's `claude[bot]` user filter (line 79) presumes that prior reviews were posted by an account literally named `claude[bot]`. If the local agent posts under a different identity (e.g., a user PAT or a different bot), the prior-comment lookup will silently miss its own previous review and append a duplicate comment instead of updating in place. This is not flagged in the SKILL.md.
- **Auth:** `gh auth status` must be valid with permissions for `repos:read` (PR details, diff, comments), `repos:write` (post/update comment), and `pull_requests:write` (formal review). None of these are checked or set up by the skill.
- **Env vars:** none declared.
- **MCP servers:** none. This is a pure CLI/`gh` workflow.
- **Project-convention dependencies:** the skill explicitly defers to `AGENTS.md` and `CLAUDE.md` for what to flag (Iron Rule, line 210: "Respect AGENTS.md and CLAUDE.md"), and hard-codes one specific false-positive list (line 200: React 19 stable APIs not to flag). Correctness of the review depends on those project docs staying authoritative.

**Categorization tag.** `review`.

Rationale (comparative, against alternatives):
- `review` (chosen): the skill's entire output is a verdict — a posted PR comment and a formal `gh pr review --approve | --request-changes` decision. The 9-step pipeline exists to produce that verdict. The Iron Rules forbid file modifications, which is the canonical signature of a review-class skill: read code + run checks + author findings + sign off.
- `automation` (rejected): superficially similar to `address-dependabot`'s automation tag, but the shapes diverge sharply. `address-dependabot` *changes the repo state* (writes lockfiles, opens a PR with code in it). `claude-code-review` *only authors a verdict on someone else's change* — no commits, no code edits, no branch creation. Tagging this `automation` would erase the read-only-vs-write-heavy distinction the workflow categories are meant to capture.
- `analysis` (rejected): close runner-up. The skill *does* analyze code. But analysis-tagged skills typically produce a report for the human, not a state-changing artifact on a remote system. Posting a `--request-changes` formal review materially affects PR mergeability (branch protection rules can block merge on an unresolved request-changes review). That is a verdict, not an analysis report.
- `process` (rejected): too generic; a review skill is a specific instance of a process, but the `review` tag is more precise.
- `release` (rejected): no version bump, no tag, no publish, no release-note generation.
- `domain-implementation` (rejected): does not implement Recce product features.

## Stage Report: intake

- DONE: Categorization tag from the allowed set (`process` | `domain-implementation` | `release` | `review` | `analysis` | `automation`) with comparative rationale against at least one alternative tag.
  Selected `review` with comparative rationale against `automation`, `analysis`, `process`, `release`, and `domain-implementation`. Key distinguishing rationale: the skill's terminal output is a posted `gh pr review --approve | --request-changes` verdict that materially affects PR mergeability — that is a verdict, not an analysis report or a code-mutating automation.
- DONE: Spawn-vs-inline determination: explicitly state whether the skill dispatches subagents (Task tool / Agent calls) and quote the SKILL.md evidence supporting that determination — this is the entity-specific AC-1 requirement.
  Determined: runs **inline** with no subagent dispatch. Evidence: SKILL.md uses imperative single-actor verbs throughout, the dot graph on lines 18-46 is a sequential 9-node single-thread pipeline (`parse -> details -> draft -> prior -> checkout -> diff -> verify -> write -> post -> approve`), no `Task` tool / Agent invocation appears anywhere, and the Iron Rules section names no helpers. Recorded in the Intake "Subagents" bullet.
- DONE: Trigger conditions quoted verbatim from the SKILL.md `description` frontmatter field.
  Quoted line 3 verbatim in Intake/Trigger conditions: "Use when asked to review a PR, or when /review is invoked with a PR number or URL. Performs a focused code review checking for bugs, security, performance, and test gaps, then posts findings as a PR comment and formal GitHub review."

### Summary

Read the entire `SKILL.md` (a single 7.2K file at `.claude/skills/claude-code-review/SKILL.md` — no `references/`, no `bin/`) and categorized the skill as `review`: its 9-step pipeline produces a posted verdict, not a state-changing artifact, and Iron Rule line 206 forbids file modification. Confirmed inline-only execution (no subagent dispatch) by reading the dot graph and the imperative verbs throughout. Surfaced two non-obvious dependencies the SKILL.md does not flag: Step 5's `git checkout "$HEAD_REF"` silently moves the user's working tree to the PR branch, and Step 4's `claude[bot]` filter in the prior-comment lookup will silently miss its own prior review if the agent posts under a different identity (causing duplicate comments instead of updates).
