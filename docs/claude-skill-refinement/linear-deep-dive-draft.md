# Draft: Spacedock integration proposal for `linear-deep-dive`

This is a standalone draft for the captain. It is readable without the entity's Suggestions section — the entity Suggestions section is a captain's-eye summary that points back here.

## TL;DR

Commission a new Spacedock workflow seeded from the `linear-deep-dive` skill — one workflow that handles both issue mode and project mode by treating the project mode as a prioritized seeder for issue-mode entities. Add a `Related skills` link from the existing workflow refinement README so the source skill stays discoverable. Reject `mod`, `workflow-stage-agent`, and `keep-as-is`.

## Recommendation

**Primary:** `commission-seed` — commission a new Spacedock workflow `linear-delivery` whose entity is one Linear issue and whose stages mirror the skill's per-issue lifecycle.

**Complementary:** `reference-doc` — append a `Related skills` row to `docs/claude-skill-refinement/README.md` so the source skill is discoverable from the workflow that catalogued it (matches the convention `address-dependabot` set in cycle 1).

**Rejected:** `mod`, `workflow-stage-agent`, `keep-as-is`. See "Rejected primitives" below.

## Why a commission, not the other primitives

The `linear-deep-dive` skill is unusual in the refinement queue because it already encodes a lifecycle: every Linear issue moves through `Triage → In Progress → In Review → Done`, with mandatory state mutations at each transition (SKILL.md lines 524-571), captain-gated approvals before each transition (lines 204, 467, 499), and a terminal merge gate that depends on `gh pr view --json state` returning `MERGED` (line 561). This is the same shape Spacedock workflows already support: per-entity YAML frontmatter with status, captain-gated approval stages, the `pr-merge` mod for the merge gate, and the ensign agent for stage work.

The skill currently runs that lifecycle inline inside one slash invocation, which means:

- Each issue's lifecycle state lives only in the skill's runtime memory and the Linear API; there is no on-disk record of *what stage we're at* for a given issue.
- The captain-gated pause points (Steps 6, 11, 12) require a single live conversation; you can't put down an issue mid-flight and pick it back up cleanly in a new session.
- Project mode's prioritization is recomputed every invocation — re-fetching project state, rebuilding the execution plan, and re-prompting the captain to pick a starting issue.

Spacedock fixes all three problems by giving the issue a persistent on-disk entity file with status, score, and stage report; that's what the workflow primitive is *for*.

## Workflow shape

This proposal is for the captain to react to in `approval`. The execute stage's deliverable is the launch artifact (the `commission` invocation arguments), not the workflow itself — running `/spacedock:commission` with these inputs creates the directory.

**Mission statement:** "Take Linear issues from triage through to merged code, end-to-end."

**Entity description:** "a Linear issue" → entity_label `issue`, plural `issues`, type `linear_issue` (per `commission` SKILL.md lines 74-85).

**Seed entity source:** the captain points the commissioner at a Linear project URL or a list of issue identifiers; the commissioner uses Linear MCP to populate seed entities (see commission SKILL.md line 110 — "If captain references an external source for seed data … read the referenced files directly using Read/Glob"; for Linear, the equivalent is calling the Linear MCP `list_issues` tool, which the existing skill already does in Step 9).

**Stages:**

| Stage | What happens | Map to skill | Worktree | Gate |
|-------|--------------|--------------|----------|------|
| `triage` | initial holding state for new issues | seed state | no | no |
| `analysis` | ensign performs the issue-flow Steps 2–6 (fetch + classify + explore + propose) | SKILL.md §2–6 | no | no |
| `approval` | captain reviews proposed approach; PASSED → implementation, REJECTED → bounces back to analysis | SKILL.md §6 "Wait for user confirmation" | no | yes (`feedback-to: analysis`) |
| `implementation` | ensign invokes the right downstream skill chain (brainstorming/writing-plans/executing-plans for features, systematic-debugging/TDD for bugs, etc.) on a worktree branch | SKILL.md §7 + workflow tables L219–266 | yes | no |
| `review` | first officer (via `pr-merge` mod) creates the PR and waits; ensign mirrors `pr` field and Linear `In Review` status | `pr-merge` `merge` hook + SKILL.md L546–555 | yes | yes (PR merge is the implicit gate) |
| `done` | terminal — `pr-merge` `startup`/`idle` hook detects MERGED, advances entity, updates Linear to Done | `pr-merge` startup + SKILL.md L558–569 | n/a | n/a (terminal) |

**Mods enabled:**
- `pr-merge` (existing, plugin-shipped at `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md`) — the `merge` hook handles PR creation and the `startup`/`idle` hooks handle merge detection. This already maps cleanly onto SKILL.md's PR-creation + merge-verification logic.
- `linear-status-sync` (new, proposed) — a small mod that owns the Linear MCP `save_issue` calls at stage transitions: `analysis → approval` is observation only, `approval (PASSED) → implementation` calls `save_issue(state="In Progress")`, `pr-merge.merge` calls `save_issue(state="In Review")` after PR creation, `pr-merge.startup` calls `save_issue(state="Done")` after merge detection. This isolates the Linear MCP coupling so the workflow stages remain MCP-agnostic and so the iron rule from `references/linear-issue-lifecycle.md` is enforced at one chokepoint instead of being scattered across stage agents. **The new mod is the only net-new code**; everything else is wiring.

**Dual-mode handling.** The original skill's project-mode lives *outside* the per-issue workflow as a pre-seeder, not as a separate workflow:

- For **issue mode**, captain seeds one entity at commission time (or `bin/seed` later) by passing a Linear issue identifier.
- For **project mode**, captain seeds N entities at commission time by passing a Linear project URL — the commissioner calls Linear MCP `get_project` + `list_issues` (project flow Steps 8–9 in SKILL.md), maps each issue to a seed entity with `score` set from priority, and `source: "linear-project:<slug>"`. Milestone ordering and dependency-graph constraints become entity scores; the first officer's startup procedure picks the highest-score unblocked entity to dispatch first. This collapses the "project mode is a separate flow" duplication in SKILL.md (lines 322–518) into "project mode is just the multi-entity seeding case" — the same abstraction Spacedock already has.

This is the load-bearing dual-mode claim: the project-mode flow's value is **prioritization across many issues**, which is exactly what entity `score` + status sorting already does. We do not need a second workflow.

## Action items (for the execute stage)

Each item below names a target file path and a one-line description. The execute stage operates in a worktree.

1. **Create `/Users/jaredmscott/repos/recce/recce/docs/linear-delivery/README.md`** — the new workflow's plain-text README, generated by `/spacedock:commission` with the mission, entity, stages, gates, and seed protocol described above. The commission skill at `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/skills/commission/SKILL.md` is the authoritative generator; the execute stage runs it in batch mode (commission SKILL.md lines 16–24) using the inputs proposed here.
2. **Create `/Users/jaredmscott/repos/recce/recce/docs/linear-delivery/_mods/pr-merge.md`** — copied from the plugin-shipped mod at `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md` (no changes; matches how this very workflow vendors its `_mods/pr-merge.md` copy already).
3. **Create `/Users/jaredmscott/repos/recce/recce/docs/linear-delivery/_mods/linear-status-sync.md`** — new mod that wires Linear MCP `save_issue` into stage transitions, citing `references/linear-issue-lifecycle.md` as authority. Hooks: `stage-enter:implementation` → set In Progress; `stage-enter:review` → set In Review; `stage-enter:done` → set Done after verifying `gh pr view --json state` returns `MERGED`. The mod's body is the contract; the new file is the only net-new code in this proposal.
4. **Edit `/Users/jaredmscott/repos/recce/recce/docs/claude-skill-refinement/README.md`** — append a row to the existing "Related skills" section (the section was added by `address-dependabot` in cycle 1) listing `linear-deep-dive` with a relative link to `.claude/skills/linear-deep-dive/SKILL.md` and a one-line description ("Analyze a Linear issue or project end-to-end and orchestrate the right delivery skills."). This is the `reference-doc` complement.
5. **Edit `/Users/jaredmscott/repos/recce/recce/.claude/skills/linear-deep-dive/SKILL.md`** — add a "Spacedock integration" subsection at the bottom that points to `docs/linear-delivery/README.md` and says "Prefer the workflow when you want persistent on-disk state across sessions; use this skill directly when you want a one-shot in-conversation flow." Also add a one-line cross-reference at the top of the Project Flow section noting that the multi-issue case can be seeded into the workflow instead.

## Rejected primitives

**`mod` (rejected):** The `linear-deep-dive` skill spans many lifecycle hooks (analysis, approval, implementation, review, merge), not a single sharp moment. A mod is the right shape for the *Linear status mutations* sub-concern (action item 3 above) but not for the skill as a whole. Saying "this skill could be a mod" without naming a single hook would be the bad-pattern the README's `Bad` example calls out: "Vague advice like 'could be a mod' without saying which lifecycle hook." We name a precise hook surface in action item 3 and reject the broader claim.

**`workflow-stage-agent` (rejected):** No existing Spacedock workflow has a stage that this skill naturally plugs into as a stage agent. The skill *spans* an entire workflow lifecycle; making it a single stage agent would either (a) flatten its lifecycle into one stage (loses the captain-gated approval at Step 6 and the implicit merge gate) or (b) make every stage of some hypothetical wrapper run the entire skill (which is the original problem). The skill is the workflow, not a stage in someone else's workflow.

**`keep-as-is` (rejected):** Keeping the skill as-is is the do-nothing option. It is *also* the option the skill currently occupies, and it works. We reject it because the persistent-state, multi-session, batch-prioritization gains from the commissioned workflow are concrete (see "Why a commission, not the other primitives") and the cost is one new workflow directory plus one new mod — not a high price.

## Risks and counterarguments

- **Risk: project mode's interactive captain prompts (Step 11's 4-option menu) don't map cleanly onto entity scores.** Mitigation: in the workflow, the captain still has the same control via the first officer's dispatch decisions; the difference is they steer by adjusting entity scores or skipping ahead, not by answering a 4-option prompt. This is a UX change but not a capability loss.
- **Risk: the `linear-status-sync` mod is net-new code.** Mitigation: it's small (~50 lines, three hooks, three Linear MCP calls), and it isolates a coupling that is currently *spread across* the skill body (lines 524-571 plus the iron rules section). Centralizing it is a code-health win, not just a port.
- **Counterargument: the Spacedock workflow itself becomes a dependency.** True. But the captain has already chosen Spacedock as the orchestration substrate (this whole entity exists in a Spacedock workflow). Adding a second workflow is consistent with that choice.
- **Counterargument: the skill chain (brainstorming/writing-plans/executing-plans/etc.) is implementation-time orchestration the workflow doesn't simplify.** Correct — the workflow does not subsume the downstream skill invocations. The implementation stage's ensign still invokes those skills. The workflow's value is the *outer* lifecycle (analysis → approval → implementation → review → done), not the *inner* implementation chain. The skill's classification table (SKILL.md L78) becomes the implementation stage's per-classification dispatch logic.

## Captain's decision points

When you review at approval, the things to weigh:

1. Do you want one workflow per Linear delivery flow, or do you prefer to keep `/linear-deep-dive` as a single-shot slash command?
2. Is the proposed `linear-status-sync` mod scope acceptable, or would you rather keep Linear MCP calls inline in the implementation-stage ensign prompt?
3. Should the workflow live at `docs/linear-delivery/` (proposed) or somewhere else (e.g., `docs/workflows/linear-delivery/`)?
4. Is the `reference-doc` link in the existing workflow README enough, or do you want a deeper cross-reference (e.g., a top-level `docs/workflows/README.md` index)?

If you reject any of these in approval, the entity bounces back to suggestions for revision per this workflow's `feedback-to: suggestions` gate setting (workflow README L21).
