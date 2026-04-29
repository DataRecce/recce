# Address Dependabot — Spacedock Integration Draft

This is the reviewable draft for the `address-dependabot` skill's Spacedock
integration. One integration is recommended: a reference-doc tie-in. A
prior cycle also proposed commissioning a new `dependabot-batch` workflow;
the captain rejected that at the approval gate, and this draft documents
that decision so it is not re-proposed.

## Recommended integration — Reference-doc tie-in

Append a short "Related skills" subsection at the bottom of
`docs/claude-skill-refinement/README.md` that lists `address-dependabot`
and links it to `.claude/skills/address-dependabot/skill.md`. This is a
documentation edit only — no logic change, no new workflow, no mod, no
commission.

**Proposed README subsection text (verbatim):**

```markdown
## Related skills

Skills catalogued by this workflow but kept as standalone skills
(see Suggestions/`reference-doc`) are linked here so future captains can
discover them without re-running the workflow.

- [`address-dependabot`](../../.claude/skills/address-dependabot/skill.md) —
  Consolidate open Dependabot PRs into a single tested branch and PR.
  Invoked manually via `/address-dependabot`. Categorized as `automation`.
```

**Why this is the right shape:**

- The skill works today as autonomous CLI orchestration, with two
  human pause points it already handles inline: "ask on major bumps" and
  "unsure if `@datarecce/ui` floor bump is needed."
- The workflow that catalogued the skill (`claude-skill-refinement`)
  should leave a discoverable trail — without it, a future captain
  searching for "dependabot" finds the skill but not the analysis that
  decided to keep it standalone.
- The edit is local to the workflow README, not the skill itself. The
  skill body at `.claude/skills/address-dependabot/skill.md` stays
  unchanged.

## What this draft deliberately does NOT recommend

- **Commission a new `dependabot-batch` workflow — REJECTED at approval
  gate (cycle 1).** A prior cycle proposed mapping the skill's 9 phases
  onto a 7-stage Spacedock workflow with a classification approval gate
  and worktree-backed apply/test stages. The captain rejected this: the
  ceremony (per-batch entity files, manual gate review, worktree
  dispatch) outweighs the benefit at current batch volume. The skill's
  inline pause points are sufficient for the workflow as it runs today.
  If batch volume grows or per-run audit trails become valuable, the
  captain can revisit by seeding a new entity in this workflow.
- **Mod integration is rejected.** Mods (`startup`, `idle`, `merge` hooks)
  are designed for sharp lifecycle behaviors, not embedded 9-phase
  pipelines with human pause points. A `dependabot-scan` mod that fires
  on `startup` would either auto-execute the whole consolidation (unsafe)
  or just announce open PRs (low value, redundant with `gh pr list`).
  With the `commission-seed` proposal rejected, there is no Spacedock
  workflow around this skill for a mod to attach to.
- **Workflow-stage-agent is rejected.** There's no existing Spacedock
  workflow this skill plugs into as a single stage; the skill is a
  self-contained 9-phase pipeline.
- **Keep-as-is alone is too quiet.** The skill itself stays unchanged,
  but pure keep-as-is would leave no trail from the workflow that
  catalogued it. The reference-doc edit is the minimum surface that
  preserves discoverability.

## Recommended approval path

Approve the reference-doc edit unconditionally — it is a single
subsection appended to one file. No worktree, no mod, no commission.
