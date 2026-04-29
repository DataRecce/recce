---
id: 004
title: recce-mcp-dev
status: execute
source: commission seed
started: 2026-04-29T07:38:04Z
completed: 2026-04-29T08:46:01Z
verdict: PASSED
score:
worktree:
issue:
pr:
mod-block:
---

Recce-specific MCP development skill — auto-triggers when modifying `recce/mcp_server.py`, MCP tool handlers, error classification, or MCP tests. Lives at `.claude/skills/recce-mcp-dev/`. Goal of this entity: understand its trigger conditions and TDD posture, categorize it (domain-implementation), and evaluate whether it could be a workflow stage agent for an MCP-feature workflow, integrate as a guard mod that fires on dispatch when MCP files are touched, or stay as a passive auto-triggered companion.

## Acceptance criteria

**AC-1 — Categorization recorded.**
Verified by: Intake section names a category tag and documents the auto-trigger file patterns.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one Spacedock primitive with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.

## Intake

**Skill location:** `.claude/skills/recce-mcp-dev/SKILL.md` — single-file skill (no `references/` dir, no `bin/` scripts).

### 1. Primary purpose

In-repo domain reference companion for the Recce MCP server: documents the architecture of `RecceMCPServer`, the error-classification priority order, MCP SDK quirks, the three test layers (unit / integration / smoke E2E), and a hard E2E verification gate that fires after each round of MCP changes.

### 2. Trigger conditions (quoted from frontmatter)

From `SKILL.md` frontmatter `description`:

> "Use when modifying `recce/mcp_server.py`, MCP tool handlers, error classification, or MCP-related tests. Also use when adding new MCP tools or changing tool response formats."

Auto-triggered file patterns / surfaces enumerated in the description and body (per AC-1):

- `recce/mcp_server.py` — server class and all `_tool_*` handlers (quoted: "`RecceMCPServer` registers `list_tools`/`call_tool` handlers via MCP SDK `Server`. `call_tool` dispatches to `_tool_*` methods, classifies errors, logs/emits metrics, re-raises").
- MCP tool handlers — any new or modified `_tool_*` method.
- Error classification logic — `_classify_db_error()` in `mcp_server.py` and `_query_row_count()` in `recce/tasks/rowcount.py` (quoted priority: "`PERMISSION_DENIED` > `TABLE_NOT_FOUND` > `SYNTAX_ERROR`").
- MCP tests — `tests/test_mcp_server.py` (unit) and `tests/test_mcp_e2e.py` (integration).
- Tool response format changes — adding new MCP tools or modifying response shape (frontmatter: "adding new MCP tools or changing tool response formats").

Body-listed adjacent file map (`## File Map`): `recce/mcp_server.py`, `recce/tasks/rowcount.py`, `recce/run.py`, `recce/summary.py`, `recce/event/__init__.py`. Touching any of these can implicate MCP behavior.

Explicit non-trigger surfaces (skill body excludes these from the E2E gate and coverage scan): "test-only changes, comment/doc edits, import reordering."

### 3. Interaction model

**Interactive — gated.** The skill mandates a hard user-prompt gate after each "round" of MCP changes:

> "After each meaningful round of MCP changes, you MUST ask the user: `MCP changes complete for this round. Run /recce-mcp-e2e to verify?`"

It also instructs proactive reporting of test-coverage gaps to the user *before* the E2E gate prompt. Not autonomous — the skill explicitly hands control back to the captain at multiple checkpoints.

### 4. Scope of effect

- **Read-only as a reference document** — SKILL.md is pure prose guidance; no `bin/` scripts, no automation surface of its own.
- **Modifies code indirectly** — by guiding the agent to write tests across three layers and to follow specific patterns (e.g., `is None` guards in `summary.py`, `# pragma: no cover` on sentry imports, additive `_meta` only).
- **External hand-off** — invokes `/recce-mcp-e2e` (a sibling Claude skill, entity 005 in this workflow) when the user approves the E2E gate. Reuses dbt project path from earlier in the session if present.
- **No external API calls** initiated by this skill itself; the downstream `/recce-mcp-e2e` skill is what actually exercises real databases.
- **Does not spawn its own subagents.** It chains to another skill via slash-command invocation, but that is captain-mediated, not a programmatic subagent dispatch.

### 5. Dependencies

- **Sibling skill (hard dependency):** `/recce-mcp-e2e` — referenced by name in the E2E Verification Gate; without it, the gate prompt has no follow-through.
- **Test runners:** `pytest` (unit + integration layers run in CI).
- **Project files at the paths listed in File Map** must exist for the guidance to be load-bearing — `recce/mcp_server.py`, `recce/tasks/rowcount.py`, `recce/run.py`, `recce/summary.py`, `recce/event/__init__.py`.
- **Optional runtime:** `sentry_sdk` — guarded by `# pragma: no cover` per the skill ("CI always has it").
- **Project CLAUDE.md** — explicitly delegates response-contract details to the repo CLAUDE.md ("**Response contracts** — See CLAUDE.md"). Reading SKILL.md without CLAUDE.md leaves a gap.
- **Python 3.9 syntax constraint** — skill warns against `X | Y` union syntax (compat floor implied; AGENTS.md states 3.10+, but the skill is more conservative).
- **No `gh` CLI, MCP servers, or env vars required** by this skill itself.

### 6. Categorization tag

**`domain-implementation`**

Rationale comparing against alternatives:

- vs. **`process`** — process skills describe sequenced workflow steps (commit → push → PR). This skill is dominated by domain knowledge (MCP SDK quirks, error-classification priority order, three-layer test taxonomy, response-contract invariants), not a procedural recipe. The E2E gate is a single procedural element embedded in a domain reference, not a multi-step process.
- vs. **`review`** — review skills evaluate existing artifacts (PRs, code). This skill guides authoring, not evaluation; the coverage-gap scan is forward-looking ("about to commit changes"), not retrospective.
- vs. **`analysis`** — analysis would imply producing reports or findings. The skill produces nothing; it shapes how the agent writes MCP code.
- vs. **`automation`** / **`release`** — no automation surface (no `bin/`, no scripts), no release lifecycle.

`domain-implementation` is the only tag that captures "embedded reference for writing/modifying a specific subsystem (MCP server) correctly."

### 7. TDD posture

**Test-aware, not strict-TDD.** The skill does NOT mandate a red-green-refactor cycle.

Evidence — what it DOES require:

- A three-layer testing taxonomy ("Unit | Integration | Smoke (E2E)") with the explicit instruction: "Each new MCP feature or behavior change should be covered at all three layers."
- A proactive coverage-gap scan after a round of changes: "verify coverage exists at each layer ... happy path + error path."
- A user-facing E2E gate prompt after each round.

Evidence — what it does NOT require:

- No instruction to write failing tests first.
- No red-green-refactor framing; the language is "covered" / "exercise" / "fill these gaps before running E2E," all of which fit a test-after or test-alongside posture.
- Coverage-gap scan is described as a post-change audit, not a pre-implementation gate.

This places the skill firmly in "test discipline" territory rather than "TDD." For comparison, the `tdd-from-spec` skill in this repo enforces strict all-tests-first TDD; `recce-mcp-dev` does not invoke it or require its discipline.

### Notable observations

- **Single-file skill.** No `references/` directory and no `bin/` scripts to enumerate — the body of SKILL.md is the entire surface.
- **Cross-skill coupling.** The E2E gate creates a hard runtime link to `/recce-mcp-e2e` (entity 005 in this workflow). Any integration recommendation in the suggestions stage should treat the two skills as a pair.
- **Hidden CLAUDE.md dependency.** The "MCP Tool Response Contracts" section of project CLAUDE.md is treated as authoritative for response-contract rules; SKILL.md only references it by name. This means the skill's effective contract is split across two files — a non-obvious dependency for any future commission seed.

## Stage Report: intake

- DONE: Categorization tag from the allowed set (`process` | `domain-implementation` | `release` | `review` | `analysis` | `automation`) with comparative rationale against at least one alternative tag.
  Tag = `domain-implementation`; intake §6 contrasts against `process`, `review`, `analysis`, `automation`, `release`.
- DONE: Auto-trigger file patterns documented: enumerate the SKILL.md-declared trigger patterns/paths that auto-invoke this skill — this is the entity-specific AC-1 requirement. Quote the SKILL.md description and any explicit pattern lists.
  Intake §2 quotes the frontmatter `description` verbatim and enumerates `recce/mcp_server.py`, `_tool_*` handlers, `_classify_db_error()`, `recce/tasks/rowcount.py`, `tests/test_mcp_server.py`, `tests/test_mcp_e2e.py`, plus the body's File Map.
- DONE: TDD posture characterization: explicitly state whether the skill mandates TDD (red-green-refactor cycle, test-first discipline) and quote the SKILL.md evidence.
  Intake §7 states the skill does NOT mandate TDD; cites the three-layer table, the "covered at all three layers" sentence, and the post-change coverage-gap scan as evidence of test-after / test-alongside posture, not red-green-refactor.

### Summary

`recce-mcp-dev` is a single-file domain-implementation reference for the Recce MCP server: no `references/` dir, no `bin/` scripts. Its triggers are quoted directly from the frontmatter and span `mcp_server.py`, tool handlers, error classification, MCP tests, and tool-response format changes. The skill enforces test-coverage discipline across three layers and a captain-gated E2E prompt, but it does NOT mandate strict TDD — it is test-aware, not test-first. Notable non-obvious dependency: a hard runtime link to sibling skill `/recce-mcp-e2e` and a split contract with the project CLAUDE.md "MCP Tool Response Contracts" section.

## Suggestions

This is a captain's-eye summary of the integration recommendation. The reviewable standalone draft is at `docs/claude-skill-refinement/recce-mcp-dev-draft.md` — captain reviews both at approval.

### Picks

**Primary:** `reference-doc` — append a Related skills row to `docs/claude-skill-refinement/README.md` so the source skill is discoverable from the workflow that catalogued it. Mirrors the precedent set by entity 001 (`address-dependabot`) and continued by entities 002 and 003.

**Complementary:** `keep-as-is` (implicit) — the skill body itself stays unchanged at `.claude/skills/recce-mcp-dev/SKILL.md`. The only edit to the skill's own directory is a two-line "Spacedock integration" footer that points at the sibling skill `recce-mcp-e2e`, since the E2E Verification Gate already names that skill by slash command but does not name a discoverable file path.

### Rationale tied to triggers and TDD posture

Intake recorded auto-trigger file patterns (`recce/mcp_server.py`, `_tool_*` handlers, `_classify_db_error`, `recce/tasks/rowcount.py`, `tests/test_mcp_server.py`, `tests/test_mcp_e2e.py`, "adding new MCP tools or changing tool response formats") and a test-aware (not strict-TDD) posture. The skill's value comes from firing exactly when those files are touched, via Claude Code's built-in skill auto-loader. No Spacedock primitive can subscribe to file-edit events:

- **`mod` rejected:** Spacedock supports three lifecycle hooks — `startup`, `idle`, `merge`. None corresponds to "the agent is touching `recce/mcp_server.py` right now." Saying "this could be a mod" without naming a hook is exactly the bad-pattern the workflow README flags.
- **`workflow-stage-agent` rejected:** No MCP-feature workflow exists in `docs/`. Commissioning one purely to host this skill as a stage agent would orphan the auto-trigger contract.
- **`commission-seed` rejected:** Per-MCP-change unit of work has no persistent on-disk identity, no captain-gated stages between work, and no merge gate beyond the project's general PR workflow. Captain rejected `commission-seed` for entity 001 (`address-dependabot`, single-skill / no multi-stage lifecycle); same calculus applies here. Captain approved it for entity 003 (`linear-deep-dive`) only because that skill encoded a `Triage → In Progress → In Review → Done` lifecycle — `recce-mcp-dev` encodes nothing comparable.

`reference-doc` is the only Spacedock primitive that adds value (workflow discoverability) without breaking the auto-trigger contract that makes the skill work today.

### Action items (for the execute stage)

1. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a row to the existing `Related skills` section listing `recce-mcp-dev` with a relative link to `.claude/skills/recce-mcp-dev/SKILL.md` and a one-line description: "Recce-specific MCP development guidance — auto-triggers when modifying `recce/mcp_server.py`, MCP tool handlers, error classification, or MCP tests."

2. **Edit `/Users/jaredmscott/repos/recce/recce/.claude/skills/recce-mcp-dev/SKILL.md`** — append a "Spacedock integration" subsection at the bottom (after `## File Map`) with two lines: a pointer to the workflow refinement entity at `docs/claude-skill-refinement/recce-mcp-dev.md` for the categorization record, and a pointer to the sibling skill at `.claude/skills/recce-mcp-e2e/SKILL.md` so the `/recce-mcp-e2e` invocation in the E2E Verification Gate has a discoverable file-path reference. No changes to existing body content.

3. **Coordinate with entity 005 (`recce-mcp-e2e`) at execute (no file produced).** The two skills are intentionally a pair; if entity 005 lands first, this entity's action item 2 should pick up the path it landed on. Verified at intake: `.claude/skills/recce-mcp-e2e/SKILL.md` exists today and entity 005's likely `reference-doc`-shaped action items do not relocate it.

### Draft document

The reviewable standalone draft (readable without this Suggestions section) is at:

`/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/recce-mcp-dev-draft.md`

It contains the full TL;DR, primitive-by-primitive recommendation, why-this-is-not-entity-003 contrast, action items, rejection rationale for `mod` / `workflow-stage-agent` / `commission-seed`, risks/counterarguments, and captain's decision points.

## Stage Report: suggestions

- DONE: Pick at least one integration primitive from the allowed set (`workflow-stage-agent` | `mod` | `commission-seed` | `reference-doc` | `keep-as-is`); tie the pick to a specific Spacedock primitive AND to the auto-trigger file patterns + TDD posture you recorded at intake.
  Picked `reference-doc` (primary) + implicit `keep-as-is` (complementary). Tied to the auto-trigger contract — Claude Code's built-in skill auto-loader is the trigger surface; no Spacedock hook (`startup`/`idle`/`merge`) corresponds to file-edit events. TDD posture (test-aware, not strict-TDD) reinforces that the skill's value is passive guidance, not a multi-stage process worth commissioning.
- DONE: Each action item names a target file path and a one-line description. Explicitly justify any rejected primitives — captain has rejected `commission-seed` for single-skill workflows previously (entity 001) but approved it for multi-stage process skills (entity 003); use that precedent in your rationale.
  Three action items with absolute target file paths and one-line descriptions. Rejection rationale for `mod`, `workflow-stage-agent`, `commission-seed` provided in Suggestions §Rationale and expanded in the draft, citing entity 001 (rejected) and entity 003 (approved) precedent explicitly.
- DONE: Save a reviewable standalone draft to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/recce-mcp-dev-draft.md`. The draft must be readable without the entity's Suggestions section.
  Draft created at the requested path. Self-contained — opens with TL;DR, restates picks, includes full rationale, action items, rejected-primitives section with hook-by-hook analysis, risks, and captain decision points. Does not require reading the Suggestions section first.

### Summary

Recommend `reference-doc` (primary) plus implicit `keep-as-is` (complementary): one row appended to the workflow README's Related skills section, plus a two-line "Spacedock integration" footer in the skill's own `SKILL.md` cross-linking sibling `recce-mcp-e2e`. Rejected `mod`, `workflow-stage-agent`, and `commission-seed` with hook-level (`startup`/`idle`/`merge` don't subscribe to file-edits) and precedent-level (entity 001 rejected, entity 003 approved) rationale. Standalone draft at `docs/claude-skill-refinement/recce-mcp-dev-draft.md` is reviewable on its own.

## Completed actions

1. **Action item 1 — README Related skills row.** Appended a `recce-mcp-dev` entry to the `## Related skills` subsection of [`docs/claude-skill-refinement/README.md`](README.md) linking to [`../../.claude/skills/recce-mcp-dev/SKILL.md`](../../.claude/skills/recce-mcp-dev/SKILL.md) with the one-line description from Suggestions §Action items. Commit: `d35b4673`.

2. **Action item 2 — Spacedock integration footer in SKILL.md.** Appended a `## Spacedock integration` subsection to the bottom of [`../../.claude/skills/recce-mcp-dev/SKILL.md`](../../.claude/skills/recce-mcp-dev/SKILL.md) (after the existing `## File Map`) with two pointers: one to this categorization record at [`recce-mcp-dev.md`](recce-mcp-dev.md) and one to the sibling skill at [`../../.claude/skills/recce-mcp-e2e/SKILL.md`](../../.claude/skills/recce-mcp-e2e/SKILL.md). Commit: `d35b4673`.

3. **Action item 3 — Cross-entity coordination with entity 005 (`recce-mcp-e2e`).** No file produced — coordination note only. Verified at execute time that `.claude/skills/recce-mcp-e2e/SKILL.md` exists in the worktree at the expected path; the relative link in action item 2 resolves correctly. The two skills remain a pair; if entity 005 relocates the file, that entity's worktree branch will update the cross-link before the FO merges both branches into the feature branch.

## Stage Report: execute

- DONE: Action item 1 artifact: append a `recce-mcp-dev` row to the existing 'Related skills' subsection of `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md` with a relative link to `.claude/skills/recce-mcp-dev/SKILL.md` and the one-line description from the entity's Suggestions section.
  Row appended in commit `d35b4673`; relative link `../../.claude/skills/recce-mcp-dev/SKILL.md` matches the existing rows' link style.
- DONE: Action item 2 artifact: append a 'Spacedock integration' subsection to the bottom of `/Users/jaredmscott/repos/recce/recce/.claude/skills/recce-mcp-dev/SKILL.md` (after the existing `## File Map`) with two pointers — one to the workflow refinement entity at `docs/claude-skill-refinement/_archive/recce-mcp-dev.md` (or current location if not yet archived), and one to the sibling skill at `.claude/skills/recce-mcp-e2e/SKILL.md`.
  Subsection appended in commit `d35b4673`. Pointed at the current (non-archived) location `docs/claude-skill-refinement/recce-mcp-dev.md` — entity is still live in the workflow, not yet archived.
- DONE: The entity body's `## Completed actions` section accounts for ALL THREE Suggestions action items including action item 3 (cross-entity coordination note, no file produced) — mark it explicitly with text like 'No file produced — coordination note only' so the captain sees the SKIPPED-by-design state at the gate.
  Completed actions section added above this report with all three items; action item 3 is marked "No file produced — coordination note only" verbatim.

### Summary

Executed two file edits and one coordination check. Edited `docs/claude-skill-refinement/README.md` to add a `recce-mcp-dev` row to the Related skills list, and appended a `## Spacedock integration` subsection to `.claude/skills/recce-mcp-dev/SKILL.md` cross-linking entity 004 and sibling skill `recce-mcp-e2e`. Verified the sibling skill's SKILL.md exists at the expected relative path. All three Suggestions action items recorded under `## Completed actions`; commit `d35b4673` carries both artifact edits.
