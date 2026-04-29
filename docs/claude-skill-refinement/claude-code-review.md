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

## Suggestions

**Recommendation:** `reference-doc` (primary, safe pick) + `mod` (secondary, deliberative pick — captain may reject in favor of `reference-doc` alone, mirroring the `address-dependabot` precedent). The full reviewable draft is at `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/claude-code-review-draft.md` — that draft stands alone; this section is the captain's-eye summary tying picks to specific Spacedock primitives and to the intake's spawn-vs-inline finding.

The intake established the skill is a single-actor `review`-class verdict producer with no subagent dispatch. Both picks below preserve that property: `reference-doc` makes the skill discoverable without changing how it runs, and the proposed `mod` (a `merge`-hook self-review) reuses the existing inline pipeline as the FO's own runtime — no subagent fan-out introduced.

### Pick — `reference-doc` (primary)

Append a "Related skills" entry to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md` (under the existing "Related skills" subsection added by entity 001) listing `claude-code-review` with a relative link back to `.claude/skills/claude-code-review/SKILL.md`. This is the same primitive shape the captain approved for `address-dependabot` (entity 001) — it makes the skill discoverable from the workflow that catalogued it, costs nothing to maintain, and locks the captain into no new orchestration. If the captain rejects pick #2, this pick still delivers the AC-2 requirement on its own.

Tie to Spacedock primitive: this is documentation only — no Spacedock agent, mod, or commission stage is invoked. Tie to the spawn-vs-inline intake finding: a reference doc preserves the skill's inline-pipeline runtime exactly as-is, since it does not wrap or re-host the skill.

### Pick — `mod` (secondary, deliberative)

Install a `claude-code-review` mod at `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/_mods/claude-code-review.md` that fires on the `merge` hook *after* the pr-merge mod has created a PR for an entity with `worktree: true`. The mod's body would invoke the skill's 9-step pipeline against the freshly-created PR, posting a self-review comment marked with the existing `<!-- claude-code-review -->` sentinel. This gives the captain a "the AI reviewed its own work" audit trail on every PR the workflow opens.

Tie to Spacedock primitive: the `merge` lifecycle hook in `mods/pr-merge.md` (lines 27-86) is the canonical site for post-PR-creation work. A second mod can chain after pr-merge by listing both in the workflow's `_mods/` directory — the FO runs them in lexical order. This is a vanilla mod-on-existing-hook pattern, not a new Spacedock primitive.

Tie to the spawn-vs-inline intake finding: the mod runs *inline* as part of the FO's own execution thread (mods are not subagents). The skill's existing inline pipeline is a clean fit — the FO's Bash/Read/gh tool surface is identical to what the skill assumes today. **Honest mismatches the captain should weigh:**

1. **Working-tree side effect (intake-flagged):** the skill's Step 5 runs `git checkout "$HEAD_REF"`. Inside a worktree-stage mod, the worktree is *already* on the entity's branch — re-fetching and re-checking out the same branch is a no-op locally but still costs a `git fetch` round-trip. Recommended adaptation in the draft: have the mod skip Step 5 when the FO can verify the worktree is already on the PR's `head.ref`.
2. **`claude[bot]` identity assumption (intake-flagged):** the prior-comment lookup filters on `user.login == "claude[bot]"`. If the FO posts under a user PAT, the lookup misses prior reviews. The mod must either generalize the filter to `gh api /user --jq '.login'` (run dynamically) or accept that every mod-driven review creates a new comment.
3. **Self-review credibility:** an AI reviewing its own AI-authored PR has obvious limits. The mod produces an *audit signal*, not an independent reviewer. Captain should decide whether that signal is worth the API cost and the noise of a guaranteed self-review on every PR.

If any of these mismatches are deal-breakers in captain's judgement, drop this pick and ship `reference-doc` alone.

### Why no `workflow-stage-agent` recommendation

The only workflow currently in this repository is `claude-skill-refinement` itself (this workflow), and none of its five stages (`queued`, `intake`, `suggestions`, `approval`, `execute`) is a code-review stage. There is no existing review-stage slot for this skill to plug into. If a future Recce workflow needed a "verify a PR" stage between implementation and merge, that stage's ensign dispatch could `Read` the skill body and follow it inline — but that is a hypothetical workflow, not a current one. Per the workflow README's `Bad` examples for suggestions ("recommending integration mechanisms that don't exist in Spacedock"), recommending a stage agent without a target stage would be vacuous.

### Why no `commission-seed` recommendation

Same logic the captain applied to `address-dependabot` (entity 001) at cycle-1 approval: a single-skill workflow whose stages mirror the skill's internal steps adds ceremony without earning its keep. The skill is one slash-command invocation today and produces one PR review per run — wrapping it in a Spacedock workflow with per-PR entity files, status fields, and an approval gate replaces a 30-second invocation with multi-stage state management. Furthermore, the `recce-dev` plugin already exposes a `claude-code-review` skill (note: that plugin variant claims a "structured multi-pass code review with adversarial reading" while the in-repo `.claude/skills/claude-code-review/SKILL.md` is single-pass — the plugin variant is out of scope here). Commissioning a workflow on top of a skill that ships in two places already would compound the surface area, not consolidate it.

### Why no `keep-as-is` recommendation

`keep-as-is` would mean the entity produces no artifact at all — no doc edit, no mod install, no scaffolding. The captain commissioned this workflow specifically to surface integration recommendations; returning `keep-as-is` for a skill the workflow catalogued would be a null result. The `reference-doc` pick is strictly cheaper (one README subsection entry) and delivers the AC-2 requirement, so `keep-as-is` is dominated.

### Action items (for the execute stage)

Each item below names a target file path and a one-line description of what goes there.

1. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a `claude-code-review` entry to the existing "Related skills" subsection (added by entity 001) with a relative link to `.claude/skills/claude-code-review/SKILL.md` and the one-line description "Review a PR for critical issues; post findings as a PR comment and formal GitHub review."

2. **(Conditional on captain approving pick #2) Create `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/_mods/claude-code-review.md`** — a Spacedock mod with a `merge` hook that, after pr-merge has created a PR for an entity with `worktree: true`, invokes the skill's 9-step pipeline against the new PR (with the two intake-flagged adaptations: skip Step 5 when the worktree is already on `head.ref`, and resolve the prior-comment-author filter dynamically via `gh api /user`).

3. **(Conditional on captain approving pick #2) Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — add a "Mods" subsection naming `pr-merge` and the new `claude-code-review` mod, in the order the FO will run them on the `merge` hook, so future readers can see the chain at a glance.

If the captain approves only pick #1, action items #2 and #3 are dropped. The execute stage records dropped action items in its `## Completed actions` section with a "skipped per approval gate" note rather than producing the artifact.

### Draft document

A reviewable standalone draft for the captain is saved at:

- `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/claude-code-review-draft.md`

It contains the proposed README "Related skills" entry verbatim, the proposed `_mods/claude-code-review.md` mod body, the rationale for both picks tied to specific Spacedock primitives, the explicit rejection rationale for `workflow-stage-agent` / `commission-seed` / `keep-as-is`, and the honest mismatch list for pick #2 so the captain can reject pick #2 cleanly without losing the body of the proposal.

## Stage Report: suggestions

- DONE: Pick at least one integration primitive from the allowed set (`workflow-stage-agent` | `mod` | `commission-seed` | `reference-doc` | `keep-as-is`); tie the pick to a specific Spacedock primitive (mod hook lifecycle point, commission stage, ensign agent role) AND to the spawn-vs-inline finding you recorded at intake.
  Picked `reference-doc` (primary, tied to a "Related skills" README subsection — same primitive shape captain approved for entity 001) and `mod` (secondary, tied to the `merge` lifecycle hook documented in `mods/pr-merge.md` lines 27-86, chaining after pr-merge in lexical `_mods/` order). Both picks tie back to the intake's inline-only finding: `reference-doc` does not re-host the skill, and the proposed mod runs inline in the FO thread (mods are not subagents), so the skill's existing single-actor pipeline assumptions still hold.
- DONE: Each action item names a target file path and a one-line description of what goes there. Explicitly justify any rejected primitives (which ones don't fit and why) — the captain can then approve or reject the picks deliberately.
  Three numbered action items with absolute target paths: (1) edit `docs/claude-skill-refinement/README.md` "Related skills"; (2) conditional create `docs/claude-skill-refinement/_mods/claude-code-review.md`; (3) conditional edit of the README to add a "Mods" subsection. Explicit rejection rationale provided for `workflow-stage-agent` (no review-stage slot in any existing workflow), `commission-seed` (compounds surface area; the `recce-dev` plugin already ships a parallel variant), and `keep-as-is` (dominated by the cheaper `reference-doc` pick).
- DONE: Save a reviewable standalone draft to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/claude-code-review-draft.md`. The draft must be readable without the entity's Suggestions section — captain reviews the draft alongside the suggestions.
  Saved to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/claude-code-review-draft.md` — contains the proposed README subsection entry verbatim, the full proposed mod body, rationale for both picks tied to specific Spacedock primitives, the explicit rejection rationale for the three other primitives, and the honest mismatch list for pick #2 so the captain can reject pick #2 alone without invalidating the rest of the proposal.

### Summary

Recommended `reference-doc` (primary) + `mod` (secondary, deliberative) for the `claude-code-review` skill. Pick #1 mirrors the captain-approved `address-dependabot` precedent: a one-entry README subsection edit linking the skill from the workflow it catalogued. Pick #2 proposes a `merge`-hook mod that chains after `pr-merge` to invoke the skill's 9-step pipeline as a self-review on every PR the workflow opens — surfaced with three explicit mismatches (working-tree no-op, `claude[bot]` identity filter, self-review credibility) so the captain can reject it cleanly without disturbing pick #1. Rejected `workflow-stage-agent` (no existing review-stage slot), `commission-seed` (compounds surface; `recce-dev` plugin already ships a parallel variant), and `keep-as-is` (dominated by `reference-doc`). Standalone draft saved to `docs/claude-skill-refinement/claude-code-review-draft.md`.

### Feedback Cycles

**Cycle 1 — 2026-04-29 (approval -> suggestions)**

Captain verdict at approval gate:

- APPROVED Pick #1 (`reference-doc`) — keep as-is.
- ADJUST Pick #2 (`mod`) — captain wants the mod kept, but reshaped:
  - The mod must detect whether the `recce-dev` Claude Code plugin is enabled in the captain's environment.
  - When `recce-dev` IS enabled, invoke the `claude-code-review` skill from THAT plugin. Note: the recce-dev variant is described as "structured multi-pass code review with adversarial reading" while the in-repo variant is single-pass; captain wants the plugin variant when available.
  - When `recce-dev` is NOT enabled, fall back to invoking the in-repo `claude-code-review` skill at `.claude/skills/claude-code-review/SKILL.md`.
- The captain ACCEPTS the "self-review credibility" mismatch — running self-review on a freshly-created PR is already team practice. Downgrade that mismatch in the cycle-2 proposal to a one-liner acknowledging it.
- The intake-flagged "working-tree no-op (Step 5)" and "`claude[bot]` identity filter" mismatches remain in scope; the cycle-2 mod design must address them.

Required revisions for the cycle-2 suggestions pass:

- Specify a plugin-detection mechanism for Pick #2. A targeted filesystem probe at `~/.claude/plugins/cache/recce-dev/recce-dev/*/skills/claude-code-review` returned empty in the captain's current environment; the cycle-2 design must work against whatever the actual recce-dev plugin layout is on disk (or via the installed-plugin manifest if Claude Code provides one). Document the chosen mechanism explicitly so the execute stage has marching orders.
- The mod body is a single file with a plugin-vs-local conditional — not two separate mods.
- Drop the "self-review credibility" mismatch from the deliberative discussion; downgrade to one sentence noting captain acceptance.
- Keep the "working-tree no-op" and "`claude[bot]` identity" mismatches and their resolutions in the cycle-2 design.
- Update `docs/claude-skill-refinement/claude-code-review-draft.md` to reflect all of the above.
