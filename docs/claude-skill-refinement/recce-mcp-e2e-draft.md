# recce-mcp-e2e — Cycle-1 Suggestions Draft

This is the standalone proposal for the captain to review at the approval gate. It is readable end-to-end without the entity's Suggestions section.

## Pick — `reference-doc` (sole pick)

Append a `recce-mcp-e2e` entry to the existing "Related skills" subsection of `docs/claude-skill-refinement/README.md`. The entry mirrors the format the captain approved for entities 001 (`address-dependabot`), 002 (`claude-code-review`), and 003 (`linear-deep-dive`).

### Proposed README entry (verbatim)

The "Related skills" subsection currently reads:

```markdown
## Related skills

Claude skills under `.claude/skills/` that have been processed by this workflow:

- [`address-dependabot`](../../.claude/skills/address-dependabot/skill.md) — Consolidate open Dependabot PRs into a single tested branch and PR.
- [`claude-code-review`](../../.claude/skills/claude-code-review/SKILL.md) — Review a PR for critical issues; post findings as a PR comment and formal GitHub review.
- [`linear-deep-dive`](../../.claude/skills/linear-deep-dive/SKILL.md) — Analyze a Linear issue or project end-to-end and orchestrate the right delivery skills.
```

The execute stage will append one bullet beneath those three:

```markdown
- [`recce-mcp-e2e`](../../.claude/skills/recce-mcp-e2e/SKILL.md) — Run end-to-end verification of all 8 MCP tools against a real dbt project before merging MCP PRs.
```

That is the entire artifact. No `_mods/` change. No new workflow scaffolding. No mod-chain reordering.

### Why this is the right pick

The intake recorded two load-bearing properties of the skill:

1. **`review`-class.** The skill's terminal output is a 13-check PASS/FAIL verdict (8 full-mode tool checks plus 3 single-env _warning checks plus 2 single-env no-warning checks). It writes no production code, opens no PR, and ships no release artifact.

2. **Advisory pre-merge gating posture.** The SKILL.md instruction "Before merging any MCP-related PR" is a captain instruction, not a CI step. The script exits 1 on failure, but Step 7 deletes the temporary test file (`test_mcp_e2e.py`) before any CI could consume the exit code. There is no GitHub Actions workflow, no pre-commit hook, and no PR check that invokes this skill. The captain owns the merge decision based on the printed PASS/FAIL report.

A `reference-doc` entry preserves both properties exactly. The skill stays invocable on demand under its existing trigger conditions. The captain still owns the merge decision. The entry's only effect is making the skill discoverable from the workflow that catalogued it.

This is the same primitive shape the captain already approved three times in this workflow.

## Why no `mod` recommendation

A `merge`-hook mod is exactly the pattern entity 002 used for `claude-code-review`. The parallel is tempting at first glance: both skills are `review`-class, both produce verdicts, both are pre-merge concerns. But the parallel breaks down on four counts:

1. **Trigger mismatch with this workflow's own PRs.** The `claude-skill-refinement` workflow opens PRs that touch documentation under `docs/claude-skill-refinement/` and skill metadata under `.claude/skills/` — it does not modify `recce/mcp_server.py` or any MCP tool handlers. The skill's negative trigger (SKILL.md line 15) explicitly excludes this: *"Not for: unit test changes only, frontend-only changes, **docs-only changes**"*. Wiring an E2E mod to fire on every workflow PR would invoke a 13-tool verification suite for changes the skill itself disqualifies. Cost paid every time; value zero by construction.

2. **Required input not available in the mod context.** The skill's Step 1 is "Resolve project path from argument or user input" — without a captain-supplied dbt project path the skill cannot run at all. A `merge` hook fires after PR creation in a non-interactive code path; there is no captain-supplied path. Hard-coding a path in the mod body would make the workflow non-portable across captains' machines and dependent on a specific dbt project being available at a known absolute location. Reading a path from a settings file is plausible but adds configuration surface for a benefit (covering doc-only PRs) the skill itself rejects.

3. **Cost asymmetry vs. `claude-code-review`.** The `claude-code-review` mod is cheap to fire on every PR — a few `gh` API calls plus the project's existing test/lint/type-check commands, all required-anyway artifacts. The `recce-mcp-e2e` skill issues real warehouse queries (`SELECT count(*) FROM {{ ref(...) }}` per tool), spins up a `RecceMCPServer`, loads dbt context twice (full mode plus simulated single-env), and templates and deletes a test file in the captain's filesystem. That is a heavyweight per-PR action with documented cosmetic noise (the `portalocker` thread error, SKILL.md line 67) that any CI gate would have to allowlist.

4. **No `merge`-hook chaining benefit.** A `recce-mcp-e2e.md` slotted into `_mods/` would land at `r` — last on the chain in lexical order. But it has no PR-creation work to do (`pr-merge` already pushed and made the PR), no review verdict to chain with `claude-code-review` (which already posted), and no E2E surface to verify (the workflow does not touch MCP code). All chain neighbors do something with the entity's `pr` field; an E2E mod here would have no meaningful work to do on entity 005's own PR.

If the project ever commissions a separate workflow whose entities DO modify `recce/mcp_server.py` (an "MCP feature" workflow), THAT workflow's `_mods/` directory could host a `recce-mcp-e2e.md` mod tied to a verification stage. That is a different entity in a different workflow, not a deliverable of this entity in this workflow.

## Why no `workflow-stage-agent` recommendation

The only workflow currently in this repository is `claude-skill-refinement` itself, whose stages are `queued`, `intake`, `suggestions`, `approval`, `execute`. None of those is a verification stage for MCP code; none has any expectation of MCP-tool surface. There is no existing slot for a `recce-mcp-e2e` stage agent to plug into. Recommending a stage agent without a target stage would be vacuous (one of the workflow README's `Bad` examples for suggestions). An ensign-dispatched verification stage on a future MCP-feature workflow is the right home for stage-agent integration; that future workflow does not yet exist.

## Why no `commission-seed` recommendation

Entity 001 (`address-dependabot`) had a near-identical posture (one-shot CLI invocation, no per-run audit trail required at current volume) and the captain rejected commission-seed at the approval gate because the additional ceremony was more overhead than the current single slash-command invocation warranted.

The same precedent applies here, and arguably more strongly: this skill runs even less frequently than `address-dependabot` (only when MCP server code changes — typically a small number of PRs per release window) and produces a single PASS/FAIL verdict with no inter-run state worth tracking. Wrapping it in a Spacedock workflow with per-invocation entity files, status fields, and an approval gate would replace a 60-second invocation with multi-stage state management.

If verification volume grows or per-run audit trails become valuable (e.g., a regression-tracking dashboard across MCP releases), the captain can revisit this in a new entity. Today, commission-seed is dominated by `reference-doc`.

## Why no `keep-as-is` recommendation

`keep-as-is` would mean the entity produces no artifact at all — no doc edit, no mod install, no scaffolding. The captain commissioned this workflow specifically to surface integration recommendations and produce documentation linking the skills back from the workflow that catalogued them. Returning `keep-as-is` for a skill the workflow catalogued would be a null result. The `reference-doc` pick is strictly cheaper (one README subsection entry, three sibling entries already present) and delivers the AC-2 requirement, so `keep-as-is` is dominated.

## Action items the execute stage will carry out

Each item names a target file path and a one-line description.

1. **Edit `docs/claude-skill-refinement/README.md`** — append a `recce-mcp-e2e` entry to the existing "Related skills" subsection with a relative link to `.claude/skills/recce-mcp-e2e/SKILL.md` and the one-line description above.

That is the entire scope. No second action item, no conditional artifacts.

## Captain decision shape

If the captain APPROVES, the execute stage performs action item #1 and the entity moves to terminal status with verdict PASSED.

If the captain REJECTS this draft (e.g., wants pick #2 a `mod` reconsidered with a different shape, or wants to commission a future MCP-feature workflow now and seed `recce-mcp-e2e` into it), the entity bounces back to suggestions with feedback for cycle 2.

If the captain APPROVES with notes (e.g., wants the one-line description rephrased), the execute stage carries out the approved action with the noted adjustments.
