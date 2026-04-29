---
id: 005
title: recce-mcp-e2e
status: intake
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
