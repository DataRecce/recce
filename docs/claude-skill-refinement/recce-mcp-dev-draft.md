# Draft: Spacedock integration proposal for `recce-mcp-dev`

This is a standalone draft for the captain. It is readable without the entity's Suggestions section — the entity Suggestions section is a captain's-eye summary that points back here.

## TL;DR

Keep the skill as-is and add a `reference-doc` tie-in. Append a row to the workflow's "Related skills" section, and add a one-line "Spacedock integration" pointer at the bottom of `SKILL.md` cross-linking the sibling skill `recce-mcp-e2e` so the E2E gate prompt has a discoverable home. Reject `mod`, `workflow-stage-agent`, and `commission-seed` for the reasons enumerated below.

## Recommendation

**Primary:** `reference-doc` — append a Related skills entry to `docs/claude-skill-refinement/README.md` so the source skill is discoverable from the workflow that catalogued it. This matches the precedent set by `address-dependabot` (cycle 1) and extended by `claude-code-review` and `linear-deep-dive`.

**Complementary:** `keep-as-is` (implicit) — the skill body itself stays unchanged at `.claude/skills/recce-mcp-dev/SKILL.md`. The only edit to the skill's own directory is a cross-reference line tying it to its sibling `recce-mcp-e2e`, since the E2E Verification Gate already names that skill by slash command but does not name a discoverable file path.

**Rejected:** `mod`, `workflow-stage-agent`, `commission-seed`. See "Rejected primitives" below.

## Why a reference-doc tie-in is the right shape

The skill's value is *passive auto-trigger discipline*, not procedural orchestration. It fires today via Claude Code's built-in skill auto-loader: any time the agent reads or edits one of the trigger paths recorded at intake — `recce/mcp_server.py`, `_tool_*` handlers, `_classify_db_error`, `recce/tasks/rowcount.py`, `tests/test_mcp_server.py`, `tests/test_mcp_e2e.py`, or anything matching "adding new MCP tools or changing tool response formats" — Claude Code surfaces the SKILL.md description and the body's three-layer test taxonomy enters the agent's working set. No Spacedock primitive improves on that.

What Spacedock CAN add is *discoverability* — a captain who comes to `docs/claude-skill-refinement/` looking for "how MCP gets refined" should find the skill listed there, not have to hunt under `.claude/skills/`. That is exactly the purpose of the `Related skills` section the workflow README already maintains for the prior three approved entities.

What Spacedock canNOT add usefully is a workflow lifecycle wrapper around this skill. The skill has no multi-stage flow to commission, no sharp lifecycle moment to mod into, and no existing MCP-feature workflow to slot into as a stage agent.

## Why this is not analogous to entity 003 (commission-seed approved)

Captain approved `commission-seed` for `linear-deep-dive` because that skill *already encodes* a multi-stage lifecycle: every Linear issue moves through `Triage → In Progress → In Review → Done`, with mandatory state mutations at each transition, captain-gated approvals between stages, and a terminal merge gate. Spacedock workflow primitives map onto that lifecycle 1:1 — that is what the workflow primitive is *for*.

The `recce-mcp-dev` skill encodes nothing of the sort. It is a domain reference: a paragraph of architecture, a paragraph of error-classification rules, a three-row table of test layers, a checklist of pitfalls, and a single E2E gate prompt at the end. There is no per-MCP-change entity that needs persistent on-disk state, no captain-gated approvals between stages of that change, no merge gate beyond "did the PR review pass." Wrapping this skill in a Spacedock workflow would be ceremony without substance — the precedent the captain set when rejecting `commission-seed` for `address-dependabot` (entity 001).

## Why this matches entity 001 (reference-doc only)

Like `address-dependabot`, `recce-mcp-dev` is a passive companion that already works. The skill itself stays unchanged. The minimum edit that preserves discoverability and the maximum edit that doesn't risk breaking the existing auto-trigger contract is the same edit: append a row to the workflow's `Related skills` section.

The one departure from the entity-001 pattern is the cross-reference between sibling skills. `address-dependabot` had no sibling. `recce-mcp-dev` does — `recce-mcp-e2e` (entity 005) is referenced by name in the E2E Verification Gate but the skill body does not say where to find it on disk. A one-line "Spacedock integration" footer on `SKILL.md` that points at `.claude/skills/recce-mcp-e2e/SKILL.md` and at the Related skills row in the workflow README closes that loop without changing skill behavior.

## Action items (for the execute stage)

Each item below names a target file path and a one-line description. The execute stage operates in a worktree.

1. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a row to the existing `Related skills` section (the section was added by `address-dependabot` in cycle 1 and extended by `claude-code-review` and `linear-deep-dive`) listing `recce-mcp-dev` with a relative link to `.claude/skills/recce-mcp-dev/SKILL.md` and a one-line description: "Recce-specific MCP development guidance — auto-triggers when modifying `recce/mcp_server.py`, MCP tool handlers, error classification, or MCP tests."

2. **Edit `/Users/jaredmscott/repos/recce/recce/.claude/skills/recce-mcp-dev/SKILL.md`** — append a "Spacedock integration" subsection at the bottom (after `## File Map`) with two lines: a pointer to the workflow refinement entity at `docs/claude-skill-refinement/recce-mcp-dev.md` for the categorization record, and a pointer to the sibling skill at `.claude/skills/recce-mcp-e2e/SKILL.md` so the `/recce-mcp-e2e` invocation in the E2E Verification Gate has a discoverable file-path reference. No changes to existing body content.

3. **Coordinate with entity 005 (`recce-mcp-e2e`) at execute.** The two skills are intentionally a pair; if entity 005 reaches execute first, this entity's action item 2 should pick up the path it landed on. If this entity reaches execute first, the cross-reference in `SKILL.md` should still resolve because `.claude/skills/recce-mcp-e2e/SKILL.md` already exists today (verified at intake) and is not being moved by entity 005's likely path. **No file is created by this action item — it is a coordination note for the execute-stage ensign.**

## Rejected primitives

**`mod` (rejected).** Spacedock supports three mod lifecycle hooks: `startup`, `idle`, `merge` (verified against `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/` and the FO references). None fits this skill's trigger contract. The skill's value is "fires when MCP files are edited," which is orthogonal to workflow lifecycle hooks — workflow `merge` runs once per entity transition, `startup`/`idle` run once per FO loop iteration, neither corresponds to "the agent is touching `recce/mcp_server.py` right now." A mod cannot subscribe to file-edit events; that surface is what Claude Code's skill auto-loader already provides via the `description` field. Saying "this skill could be a mod" without naming a hook would be the bad-pattern the README's `Bad` example calls out: "Vague advice like 'could be a mod' without saying which lifecycle hook." There is no hook to name.

**`workflow-stage-agent` (rejected).** No existing Spacedock workflow has a stage that this skill plugs into. There is no MCP-feature workflow in `docs/` (verified — `ls docs/` returns no MCP-related workflow directories). Commissioning one purely to host this skill as a stage agent would resurrect the same ceremony-vs-substance problem the `commission-seed` rejection covers below, and it would orphan the auto-trigger contract: the skill's job is to fire whenever MCP files are touched, not whenever a workflow advances.

**`commission-seed` (rejected).** The skill does not encode a multi-stage lifecycle. It is a domain reference plus a single E2E gate prompt — closer in shape to `address-dependabot` (which the captain accepted as `reference-doc` only at cycle 1) than to `linear-deep-dive` (which the captain accepted as `commission-seed` at cycle 1 because it encoded a `Triage → In Progress → In Review → Done` lifecycle). Specifically:

- **No persistent per-entity state.** A "round of MCP changes" is not an entity that lives on disk; it is a session-local concept. No state would survive the conversation.
- **No captain-gated stages between work.** The E2E gate is a single prompt at the end, not a stage transition. There is one decision point ("Run `/recce-mcp-e2e` to verify?") and the skill hands control to the captain. Wrapping this in a workflow would manufacture stages where none exist.
- **No merge gate.** The skill has no PR creation surface; it does not own a branch, does not create commits, does not push. Wrapping it in a workflow with the `pr-merge` mod would fire that mod with nothing to merge.

The captain rejected `commission-seed` for entity 001 because the ceremony outweighed the benefit at current run volume. The same calculus applies here, with even less material to wrap — `address-dependabot` at least had a 9-phase pipeline that *could* have been mapped onto stages; `recce-mcp-dev` has no pipeline at all.

**`keep-as-is` alone (rejected as primary).** The skill body itself stays unchanged, but pure keep-as-is would leave no trail from the workflow that catalogued it — a captain searching `docs/claude-skill-refinement/` for "MCP" would find nothing. The `reference-doc` row is the minimum surface that preserves discoverability, matching the entity-001 precedent exactly.

## Risks and counterarguments

- **Risk: the cross-reference in action item 2 hard-codes a sibling path that could move.** Mitigation: `.claude/skills/recce-mcp-e2e/SKILL.md` exists today and entity 005's likely `reference-doc`-shaped action items do not move it. If entity 005's execute stage relocates the sibling, this entity's execute ensign should update the cross-reference at the same time. The action item's coordination note (item 3) calls this out explicitly.

- **Counterargument: the skill is fine without any edit.** Partly true — the auto-trigger works today regardless of the workflow README. But the workflow's whole purpose is to leave a trail for future captains; not adding the row would mean a future captain searching the workflow can't find this analysis. The cost (one row + a two-line footer) is minimal.

- **Counterargument: a small `recce-mcp` workflow could be commissioned to host BOTH skills as stage agents (intake → dev → e2e → merge).** This is the most plausible "should we commission?" framing. It is rejected for two reasons: (1) the per-MCP-change unit of work is not a persistent on-disk artifact — there is no Linear issue, no GitHub issue, no canonical seed source for entities, so the workflow would have nothing to seed on; (2) the actual outer lifecycle for MCP changes is *already covered* by the project's general PR workflow (feature branch → PR → review → merge), not by a custom Spacedock loop. The two skills work as a pair *inside* whatever conversation is touching MCP code; that pair does not need a wrapper.

## Captain's decision points

When you review at approval, the things to weigh:

1. Do you want the cross-reference footer in `SKILL.md` (action item 2) or just the workflow-README row (action item 1)? The footer adds two lines to the skill body but closes the dangling-`/recce-mcp-e2e` reference. If you'd rather keep `SKILL.md` strictly unchanged, drop action item 2 and the entity's complementary `keep-as-is` becomes the explicit primary.
2. Is the `reference-doc` row's one-line description (proposed in action item 1) the right shape, or would you prefer a longer paragraph similar to `linear-deep-dive`'s entry? The proposal mirrors the existing terse format the workflow README uses today.

If you reject either of these in approval, the entity bounces back to suggestions for revision per this workflow's `feedback-to: suggestions` gate setting (workflow README L21).
