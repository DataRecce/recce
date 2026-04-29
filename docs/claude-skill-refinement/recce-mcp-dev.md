---
id: 004
title: recce-mcp-dev
status: suggestions
source: commission seed
started: 2026-04-29T07:38:04Z
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
