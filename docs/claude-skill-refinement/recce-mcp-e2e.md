---
id: 005
title: recce-mcp-e2e
status: approval
source: commission seed
started: 2026-04-29T07:38:05Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

End-to-end MCP verification skill — runs full E2E checks against a real dbt project before merging MCP PRs. Lives at `.claude/skills/recce-mcp-e2e/`. Goal of this entity: understand its verification scope and pre-merge gating role, categorize it (release/verification), and evaluate whether it should become a Spacedock pre-merge mod, a workflow stage agent on an MCP-feature workflow's verification stage, or stay invocable on demand.

## Acceptance criteria

**AC-1 — Categorization recorded.**
Verified by: Intake section names a category tag and documents the verification scope.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one Spacedock primitive with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.

## Intake

**Skill location.** `/Users/jaredmscott/repos/recce/recce/.claude/skills/recce-mcp-e2e/` contains exactly two files: `SKILL.md` (3.1K, conventional uppercase name) and `test_mcp_e2e_template.py` (4.5K). No `references/` subdirectory; no `bin/` directory; no helper scripts beyond the test template. The skill's full surface is one markdown procedure plus one Python test scaffold that gets copied into the target dbt project at runtime.

**Primary purpose (one sentence).** Run an end-to-end smoke test of all 8 MCP tools (full mode plus single-env mode) against a real dbt project — copying a parameterized Python test harness into the project, executing it with the in-development recce repo source on `PYTHONPATH`, and asserting that 13 named checks all PASS — to prove that MCP server changes have not broken the agent-facing tool contracts.

**Trigger conditions (verbatim from frontmatter).** The `description` field on line 3 of `SKILL.md` reads:

> "Use when MCP server code is modified and needs full E2E verification against a real dbt project. Triggers after changes to recce/mcp_server.py, MCP tool handlers, single-env logic, or error classification. Also use before merging MCP PRs."

The body's "When to Use" block (lines 11–15) extends this with explicit positive triggers ("After modifying `recce/mcp_server.py` or `_tool_*` handlers", "After changing single-env logic or error classification", "Before merging any MCP-related PR") and explicit negative triggers ("**Not for**: unit test changes only, frontend-only changes, docs-only changes"). Slash invocation declared on line 19: `/recce-mcp-e2e` or `/recce-mcp-e2e <project_path>`.

**Interaction model.** Mostly autonomous, with one synchronous pause for project-path resolution. SKILL.md "Usage" (lines 19–22) states: "**With argument**: use the given path as the dbt project directory. **Without argument**: ask the user for the dbt project path." Once the path is supplied, the 7-step Process (lines 27–43) runs straight through — validate, detect recce source, generate test, execute, report, clean up — without further captain prompts. There is no built-in approval gate before execution and no rerun loop on failure; results are simply reported with PASS/FAIL.

**Scope of effect.** Targeted but writes to disk: this skill creates and deletes a temporary test file in the user's dbt project, mutates `PYTHONPATH` for the test process, and reads dbt artifacts. Specifically:
- **Modifies code:** writes `test_mcp_e2e.py` into the target dbt project directory (Step 4) by templating `test_mcp_e2e_template.py` with `PROJECT_DIR_PLACEHOLDER` replaced; deletes that file after Step 7. No edits to recce repo code; no edits to the dbt project's tracked files.
- **Reads:** `target/manifest.json` and `target-base/manifest.json` from the dbt project (the template's `discover_model` walks the manifest to pick a representative model); the project's `recce.yml` if present (loaded via `RecceConfig` to source preset checks).
- **Process state:** sets `PYTHONPATH=<RECCE_REPO_ROOT>:$PYTHONPATH` when both `recce` and `recce-nightly` are installed (Step 3), to ensure the in-development source is imported instead of the published nightly. The test harness `os.chdir(PROJECT_DIR)` at module load.
- **External calls:** none — the test runs adapters against whatever warehouse is wired up via the dbt project's profiles, so it can issue real warehouse queries (`SELECT count(*) FROM {{ ref(...) }}`) but does not call GitHub, package registries, or other network services on its own behalf.
- **Subagents:** none. The skill runs inline; no Agent dispatch, no parallel workers.
- **Git state:** none — no branches, no commits, no pushes. This is a verification-only skill.

**Dependencies.**
- **Recce repo source (hard requirement):** `recce/mcp_server.py` exporting `RecceMCPServer` and `SINGLE_ENV_WARNING`; `recce/core.load_context`; `recce/config.RecceConfig`; `recce/run.load_preset_checks`. The template imports all five symbols verbatim (lines 60, 64–65, 68, 98, 124).
- **Internal tool method names (hard requirement):** `_tool_lineage_diff`, `_tool_schema_diff`, `_tool_row_count_diff`, `_tool_query`, `_tool_query_diff`, `_tool_profile_diff`, `_tool_list_checks`, `_tool_run_check` — the `TOOL_METHODS` dict (template lines 11–20) calls these as private attributes via `getattr`. Renaming any handler breaks the suite silently with `AttributeError`.
- **dbt project artifacts:** `target/manifest.json` and `target-base/manifest.json` must both exist (SKILL.md line 24, validation step 2). The skill is hard-wired to two-environment artifacts — a single-environment dbt project that lacks `target-base/` cannot be verified by full mode at all (the comment "Single-env test uses target-base | By design — `load_context` needs both, `single_env=True` flag simulates the mode" on line 68 confirms the single-env mode is *simulated* over a two-env context, not run against a real single-env project).
- **CLI / tooling:** `pip show` (Step 3 conflict detection); a Python interpreter with the recce dev install on the path; a working dbt warehouse adapter for the project (queries like `SELECT count(*) FROM {{ ref(...) }}` execute for real).
- **Optional:** `recce-nightly` may or may not be installed alongside `recce`; if both are present, `PYTHONPATH` injection is mandatory to avoid the documented `ImportError: cannot import name 'SINGLE_ENV_WARNING'` (Common Mistakes table line 64).
- **Env vars:** `PYTHONPATH` (set conditionally by the skill itself); inherits the captain's shell env otherwise. No env vars are required from the captain.
- **MCP servers:** none — ironically for a skill that verifies MCP tools, the skill itself uses no MCP. It calls the tools as Python coroutines on `RecceMCPServer` directly, bypassing the MCP transport.
- **Hidden surface check:** there is no `references/` directory (no extra docs to read); the `bin/`-equivalent surface is `test_mcp_e2e_template.py`, which IS load-bearing — its `TOOL_METHODS` dict, `WARNING_TOOLS` set, `NO_WARNING_TOOLS` set, and the inline assertion on `result["_warning"] == SINGLE_ENV_WARNING` (template line 106) are the actual contract being verified. SKILL.md's prose reduces a Python test to a check table; the truth lives in the template.

**Verification scope (entity-specific AC-1 detail).** The Quick Reference table (SKILL.md lines 47–51) plus the template enumerate exactly 13 PASS checks across two suites:

- **Full mode — 8 checks (one per tool):** `lineage_diff` (with `view_mode="all"` per the gotcha note on line 65), `schema_diff`, `row_count_diff`, `query`, `query_diff`, `profile_diff`, `list_checks`, `run_check`. Each is asserted to return non-`None` of type `dict` or `list` (template line 76); `run_check` is parameterized off the first check returned by `list_checks`. If `recce.yml` has no preset checks, `run_check` is *skipped* (template line 92) — but the SKILL.md success criterion still says "all 13 checks must show PASS", which means a project with zero preset checks cannot achieve "ALL PASS" by the prose contract. This is an internal inconsistency between SKILL.md and the template.
- **Single-env _warning suite — 3 checks:** `row_count_diff`, `query_diff`, `profile_diff` are each verified to include a `_warning` key whose value equals the imported `SINGLE_ENV_WARNING` constant (template line 106). Tests the fan-out of the new single-env warning contract.
- **Single-env no-warning suite — 2 checks:** `lineage_diff`, `schema_diff` must NOT include a `_warning` key. Tests that warning insertion is targeted, not blanket.
- **Manual checks called out but NOT executed by the script:** `recce mcp-server --help` shows a Prerequisites section; non-server-mode `list_tools` returns only `lineage_diff` + `schema_diff` (SKILL.md "Additional manual checks" table, lines 53–58). These two are documented as captain-driven manual verifications, not asserted automatically.
- **Adapter coverage:** the test harness is warehouse-agnostic — it does whatever the dbt project's profile wires up. There is no enumerated multi-adapter matrix (no Snowflake/BigQuery/Postgres/DuckDB sweep), no error-path coverage (TABLE_NOT_FOUND, PERMISSION_DENIED, the kinds of paths that `summary.py` and the cloud-vs-local exception rules in CLAUDE.md guard against), and no concurrency or rate-limit coverage. A single project, a single warehouse, a single representative model — that is the floor. Coverage of error classification is implicit: if the tool handlers raise on a real warehouse, the harness records `f"ERROR: {e}"` (template lines 83, 90, 109, 117), but there is no negative test that *asserts* a specific error path returns the expected classified error.

**Pre-merge gating posture (entity-specific AC-1 detail).** The skill is positioned as advisory, captain-driven verification — not an automated blocking gate. Evidence:

- SKILL.md line 14: "Before merging any MCP-related PR" — phrased as a captain instruction, not a CI step. There is no GitHub Actions workflow, no `pre-commit` hook, no PR check that invokes this skill.
- Step 6 (line 33): "**Report** results — all 13 checks must show PASS." The reporting is a printed table with per-check PASS/FAIL lines and a final `ALL PASS` or `SOME FAILED` summary (template lines 137–138).
- Exit code (template line 139): `return 0 if all_pass else 1`. The script returns a proper non-zero exit code on any failure, so it COULD be wired into CI — but nothing in SKILL.md or the recce repo wires it. The exit code is consumed only by `sys.exit(asyncio.run(main()))` in the temporary `test_mcp_e2e.py`, and that file is deleted after the run (Step 7), making CI integration impossible without modifying the skill.
- Cleanup (Step 7, line 43): "**Clean up** — delete `test_mcp_e2e.py`." Confirms the skill treats each invocation as a one-shot manual verification, not a persistent CI fixture.
- "Common Mistakes" table (lines 62–69) lists known cosmetic noise (`portalocker` FileNotFoundError, "cosmetic thread error in event collector — does not affect results") that a captain reading the output is expected to recognize and ignore — a CI gate would either fail on stderr noise or need explicit allowlisting, neither of which the skill provides.

Net: the skill produces a clear pass/fail report and leaves it to the captain to decide whether to merge. The advisory framing is consistent with captain-gated approval workflows, NOT with automated merge blocking.

**Categorization tag.** `review`.

Rationale: this skill's defining behavior is *verifying* that an existing system still meets a contract, with a clear pass/fail verdict per tool. It writes no production code, opens no PR, ships no release artifact, and does not implement product features — those rule out `automation`, `release`, and `domain-implementation`. It is closer to `review` than to `analysis` because (a) the output is a verdict (PASS/FAIL on 13 named checks plus an overall `ALL PASS` line), not a synthesis or recommendation; (b) the trigger ("Before merging any MCP-related PR") and the negative trigger ("Not for: unit test changes only, frontend-only changes, docs-only changes") position it as a pre-merge sign-off step against the agent contract, the same role `claude-code-review` plays for code style/correctness. `analysis` would fit a skill whose output is a write-up of findings; this skill's output is a binary gate report. `process` would fit a skill that drives a multi-step lifecycle through state transitions — recce-mcp-e2e is a single verification pass, not a state machine.

Comparative against the strongest alternative `analysis`: the difference is the *shape of the artifact*. `analysis` skills produce reports that explain trade-offs and surface options for the captain to weigh. `review` skills produce verdicts. The 13-check ALL PASS / SOME FAILED summary is a verdict. The skill does not enumerate considerations, propose follow-ups, or summarize MCP behavior — it asserts.

## Stage Report: intake

- DONE: Categorization tag from the allowed set (`process` | `domain-implementation` | `release` | `review` | `analysis` | `automation`) with comparative rationale against at least one alternative tag.
  Selected `review` with explicit comparative rationale against `analysis` (closest alternative — distinguished by verdict-shape vs. write-up-shape) and brief eliminations of `automation`, `release`, `domain-implementation`, and `process`.
- DONE: Verification scope documented: enumerate what the E2E suite actually runs — test commands, dbt project setup expectations, target adapters covered, what is and is NOT covered (single-env vs multi-env, error paths, etc.) — this is the entity-specific AC-1 requirement.
  Verification scope subsection enumerates the 13 PASS checks across full mode (8 tools), single-env _warning (3 tools), and single-env no-warning (2 tools); calls out the 2 manual checks documented but NOT executed by the script; flags the SKILL.md/template inconsistency around `run_check` skip vs. "all 13 must PASS"; documents adapter agnosticism (no multi-warehouse matrix), no enumerated error-path coverage, no negative tests for classified errors, and the hard requirement of two-environment dbt artifacts.
- DONE: Pre-merge gating posture: explicitly state how the skill is meant to be used relative to PR merge (blocking gate vs advisory? what does success/failure look like? exit codes? captain prompts?). Quote SKILL.md evidence.
  Pre-merge gating posture subsection quotes SKILL.md line 14 ("Before merging any MCP-related PR") as the captain instruction, notes the lack of CI/hook wiring, documents the exit-code-1-on-failure that the cleanup step deletes before any CI could consume it, and concludes the skill is advisory captain-gated verification rather than an automated blocking gate.

### Summary

Read the full `recce-mcp-e2e` skill (SKILL.md plus the load-bearing `test_mcp_e2e_template.py`; no `references/`, no `bin/`) and categorized it as `review`: a captain-driven pre-merge verification skill that runs 13 named checks across full-mode (8 tools) and single-env-mode (3 _warning + 2 no-warning) suites against a real two-environment dbt project. Its scope is one project, one warehouse, one representative model auto-discovered from `target/manifest.json`; no multi-adapter matrix, no enumerated error-path coverage, no CI wiring. Pre-merge gating is advisory — the script exits 1 on failure but is deleted by Step 7 cleanup, leaving the merge decision to the captain. Notable findings: SKILL.md vs. template inconsistency around `run_check` skip-when-no-preset-checks vs. "all 13 must PASS"; the warehouse-agnostic harness silently relies on the dbt project's profile; `PYTHONPATH` injection is mandatory when `recce-nightly` is co-installed.

## Suggestions

**Recommendation:** `reference-doc` only. The full reviewable draft is at `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/recce-mcp-e2e-draft.md` — the draft stands alone; this section is the captain's-eye summary tying the pick to a Spacedock primitive and the intake's pre-merge gating posture, plus the four explicitly-rejected primitives.

The intake established two load-bearing properties: (a) the skill is `review`-class, producing a 13-check PASS/FAIL verdict; (b) its pre-merge gating posture is advisory captain-driven verification, not an automated blocking gate — the script exits 1 on failure but is deleted by Step 7 cleanup, leaving the merge decision to the captain. The pick below preserves both: a README "Related skills" entry surfaces the skill from the workflow that catalogued it without changing how the skill runs, and without re-hosting it as a mod or workflow stage that would impose ceremony the skill is not shaped for.

### Pick — `reference-doc` (sole pick)

Append a `recce-mcp-e2e` entry to the existing "Related skills" subsection of `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md` (the subsection added by entity 001 and extended by entities 002 and 003). The entry links to `.claude/skills/recce-mcp-e2e/SKILL.md` with a one-line description: "Run end-to-end verification of all 8 MCP tools against a real dbt project before merging MCP PRs." This is the same primitive shape the captain approved for entities 001, 002, and 003 — discoverability without orchestration.

**Tie to Spacedock primitive:** documentation only. No mod hook, no commission stage, no ensign agent role. The pick does not touch any Spacedock primitive other than the workflow README itself.

**Tie to the intake's verification scope and pre-merge gating posture:** the intake recorded that the skill produces a 13-check PASS/FAIL verdict in advisory mode (the captain decides whether to merge based on the report; there is no CI wiring, and Step 7 deletes the test file before any CI could consume the exit code). A `reference-doc` entry preserves that advisory shape — the skill stays invocable on demand under its existing trigger conditions ("After modifying `recce/mcp_server.py` or `_tool_*` handlers", "Before merging any MCP-related PR" — SKILL.md lines 12–14), and the captain still owns the merge decision.

### Why no `mod` recommendation

A `merge`-hook mod is exactly the pattern entity 002 used for `claude-code-review` — and at first glance the parallel is tempting: both skills are `review`-class, both produce verdicts, both are pre-merge concerns. The parallel breaks down on the actual trigger surface:

1. **Trigger mismatch with this workflow's PRs.** The `claude-skill-refinement` workflow opens PRs that touch documentation under `docs/claude-skill-refinement/` and skill metadata under `.claude/skills/` — it does not modify `recce/mcp_server.py` or any MCP tool handlers. The skill's negative trigger (SKILL.md line 15) explicitly excludes this: "**Not for**: unit test changes only, frontend-only changes, **docs-only changes**" (emphasis added). Wiring an E2E mod to fire on every workflow PR would invoke a 13-tool verification suite for changes that the skill itself disqualifies. That is the wrong shape: the cost (a real dbt warehouse query against a real project) is paid every time, the value (catching MCP regressions) is zero by construction because no MCP code was touched.

2. **Required input not available in the mod context.** The skill's Step 1 (SKILL.md line 28) is "**Resolve project path** from argument or user input" — without a captain-supplied dbt project path the skill cannot run at all. A `merge` hook fires after PR creation in a non-interactive code path; there is no captain-supplied path, and `_mods/pr-merge.md` does not surface a slot for one. Hard-coding a path in the mod body would make the workflow non-portable across captains' machines and dependent on a specific dbt project being available at a known absolute path. Reading a path from settings is plausible but adds configuration surface for a benefit (covering doc-only PRs) the skill itself rejects.

3. **Cost asymmetry vs. claude-code-review.** The `claude-code-review` mod is cheap to fire on every PR — it makes a few `gh` API calls and at most runs the project's existing test/lint/type-check commands, all of which are required-anyway artifacts. The `recce-mcp-e2e` skill issues real warehouse queries (`SELECT count(*) FROM {{ ref(...) }}` per tool), spins up a `RecceMCPServer`, loads dbt context twice (full mode + simulated single-env), and templates and deletes a test file in the captain's filesystem. That is a heavyweight per-PR action with documented cosmetic noise (the `portalocker` thread error, SKILL.md line 67) that any CI gate would have to allowlist.

4. **No `merge`-hook chaining benefit.** The `_mods/` directory currently runs in lexical order: `claude-code-review` (`c`) before `pr-merge` (`p`) — but per cycle-2 entity 002's mod body, the `claude-code-review` mod itself fires *after* `pr-merge` has set the entity's `pr` field, by reading that field in its own logic rather than by lexical position. A `recce-mcp-e2e.md` slotted into `_mods/` would land at `r` — last on the chain — but it has no PR-creation work to do (`pr-merge` already pushed and made the PR), no review verdict to chain with `claude-code-review` (which already posted), and no E2E surface to verify (the workflow does not touch MCP code). All chain neighbors do something with the entity's `pr` field; an E2E mod here would have no meaningful work to do on entity 005's own PR.

If the project ever commissions a separate workflow whose entities DO modify `recce/mcp_server.py` (an "MCP feature" workflow), THAT workflow's `_mods/` directory could host a `recce-mcp-e2e.md` mod tied to a verification stage. That is a different entity in a different workflow, not a deliverable of this entity in this workflow.

### Why no `workflow-stage-agent` recommendation

The same logic, restated for this primitive: the only workflow currently in this repository is `claude-skill-refinement` itself, whose stages are `queued`, `intake`, `suggestions`, `approval`, `execute`. None of those is a verification stage for MCP code; none has any expectation of MCP-tool surface. There is no existing slot for a `recce-mcp-e2e` stage agent to plug into. Per the workflow README's `Bad` examples for suggestions ("recommending integration mechanisms that don't exist in Spacedock"), recommending a stage agent without a target stage would be vacuous. An ensign-dispatched verification stage on a future MCP-feature workflow is the right home for stage-agent integration; that future workflow does not yet exist.

### Why no `commission-seed` recommendation

Entity 001 (`address-dependabot`) had a near-identical posture (one-shot CLI invocation, no per-run audit trail required at current volume) and the captain rejected commission-seed at the approval gate because the additional ceremony was more overhead than the current single slash-command invocation warranted. The same precedent applies here, and arguably more strongly: this skill runs even less frequently than `address-dependabot` (only when MCP server code changes — typically a small number of PRs per release window) and produces a single PASS/FAIL verdict with no inter-run state worth tracking. Wrapping it in a Spacedock workflow with per-invocation entity files, status fields, and an approval gate would replace a 60-second invocation with multi-stage state management.

If verification volume grows or per-run audit trails become valuable (e.g., a regression-tracking dashboard across MCP releases), the captain can revisit this in a new entity. Today, commission-seed is dominated by `reference-doc`.

### Why no `keep-as-is` recommendation

`keep-as-is` would mean the entity produces no artifact at all — no doc edit, no mod install, no scaffolding. The captain commissioned this workflow specifically to surface integration recommendations and produce documentation linking the skills back from the workflow that catalogued them. Returning `keep-as-is` for a skill the workflow catalogued would be a null result. The `reference-doc` pick is strictly cheaper (one README subsection entry, three sibling entries already present) and delivers the AC-2 requirement, so `keep-as-is` is dominated.

### Action items (for the execute stage)

Each item below names a target file path and a one-line description of what goes there.

1. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a `recce-mcp-e2e` entry to the existing "Related skills" subsection (currently listing `address-dependabot`, `claude-code-review`, `linear-deep-dive`) with a relative link to `.claude/skills/recce-mcp-e2e/SKILL.md` and the one-line description "Run end-to-end verification of all 8 MCP tools against a real dbt project before merging MCP PRs."

No `_mods/` change. No new workflow scaffolding. No mod chain re-ordering needed (the existing `pr-merge` and `claude-code-review` mods are unchanged).

### Draft document

A reviewable standalone draft for the captain is saved at:

- `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/recce-mcp-e2e-draft.md`

It contains the proposed README "Related skills" entry verbatim, the rationale for the sole `reference-doc` pick tied to the intake's advisory pre-merge gating posture, and the explicit rejection rationale for `mod`, `workflow-stage-agent`, `commission-seed`, and `keep-as-is` so the captain can deliberate each pick without needing to read the entity's Suggestions section.

## Stage Report: suggestions

- DONE: Pick at least one integration primitive from the allowed set (`workflow-stage-agent` | `mod` | `commission-seed` | `reference-doc` | `keep-as-is`); tie the pick to a specific Spacedock primitive (mod hook lifecycle point, commission stage, ensign agent role) AND to the verification scope + pre-merge gating posture you recorded at intake. The pre-merge gating angle matters: a `merge`-hook mod that blocks on E2E failure has very different cost/value than a passive reference doc.
  Picked `reference-doc` as the sole pick — tied to a "Related skills" README subsection (same primitive shape captain approved for entities 001, 002, 003) and tied to the intake's advisory pre-merge gating posture (the skill produces a 13-check verdict but the captain owns the merge decision; no CI wiring; Step 7 deletes the test file before any CI could consume exit code 1). Explicitly addressed why a `merge`-hook mod (the alternative the checklist flags) is the wrong shape here despite the entity-002 precedent: the workflow's own PRs do not touch MCP code (the skill's negative trigger explicitly excludes docs-only changes); the skill requires a captain-supplied project path the mod context cannot supply; the per-PR cost of warehouse queries is asymmetric with `claude-code-review`'s cheap `gh`+test calls; and an E2E mod on this workflow would have no work to do on its own entity PRs.
- DONE: Each action item names a target file path and a one-line description. Explicitly justify any rejected primitives. If recommending a mod with `merge` hook, name the chaining order with respect to the existing pr-merge mod and (potentially) the claude-code-review mod entity 002 added.
  One numbered action item with absolute target path: edit `docs/claude-skill-refinement/README.md` "Related skills". Explicit four-point rejection rationale provided for `mod` (trigger mismatch with workflow PRs, missing required project-path input, cost asymmetry vs. claude-code-review, no chaining benefit on entity 005's own PR). Explicit rejection rationale provided for `workflow-stage-agent` (no MCP-feature workflow exists to slot into), `commission-seed` (entity-001 precedent dominates), and `keep-as-is` (dominated by `reference-doc`). The mod chain ordering with respect to `pr-merge` and `claude-code-review` is documented in the `mod` rejection rationale (point 4) rather than recommended, since the recommendation is no mod.
- DONE: Save a reviewable standalone draft to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/recce-mcp-e2e-draft.md`. The draft must be readable without the entity's Suggestions section — captain reviews the draft alongside the suggestions.
  Saved to `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/recce-mcp-e2e-draft.md` — contains the proposed README subsection entry verbatim, the rationale for the sole `reference-doc` pick tied to the intake's advisory pre-merge gating posture, and the explicit four-point rejection rationale for `mod` plus single-paragraph rejections of `workflow-stage-agent`, `commission-seed`, and `keep-as-is`. Readable end-to-end without the entity's Suggestions section.

### Summary

Recommended `reference-doc` only for `recce-mcp-e2e`. The pick mirrors the captain-approved precedent across entities 001, 002, and 003: a one-entry README subsection edit linking the skill from the workflow that catalogued it. Explicitly rejected `mod` (despite the entity-002 `claude-code-review` precedent) because the workflow's own PRs are doc-only and the skill's own negative trigger excludes that case, the skill needs a captain-supplied project path the mod context cannot supply, the per-PR cost of warehouse queries is asymmetric with `claude-code-review`'s cheap calls, and an E2E mod here would have no work to do on entity 005's own PR. Rejected `workflow-stage-agent` (no MCP-feature workflow exists), `commission-seed` (entity-001 precedent), and `keep-as-is` (dominated). Standalone draft saved to `docs/claude-skill-refinement/recce-mcp-e2e-draft.md`.
