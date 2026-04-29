# Address Dependabot — Spacedock Integration Draft

This is the reviewable draft for the `address-dependabot` skill's Spacedock
integration. Two integrations are recommended; both are described in full
below so the captain can approve, narrow, or reject them at the approval
gate.

## Integration A — Commission a `dependabot-batch` workflow

**Mission statement to feed `/spacedock:commission`:**

> Process open Dependabot pull requests by consolidating them into a single
> tested branch, applying the published-package boundary rules from
> `js/packages/ui/DEPENDENCIES.md`, and opening one PR that closes all
> Dependabot PRs.

**Entity description:** "a Dependabot consolidation batch" → entity label
`batch`, plural `batches`, type `dependabot_batch`. Each entity represents
one consolidation run (typically the full set of currently open Dependabot
PRs at the time the captain commissions a batch).

**Proposed stages (mapped from the skill's 9 phases):**

| Stage | Mapped phase(s) | Worker action | Worktree? | Gate? |
|-------|----------------|---------------|-----------|-------|
| `queued` | — | Holding state for a newly seeded batch entity | no | no |
| `inventory` | Phase 1 + Phase 2 (fetch + collect) | Run `gh pr list --author "app/dependabot"`, gather `gh pr diff` per PR, write a manifest into the entity body | no | no |
| `classify` | Phase 2b (classify by zone) | Read `js/packages/ui/package.json` and `DEPENDENCIES.md`; emit the published-vs-root classification table into the entity body; flag any major bumps | no | no |
| `approve-classification` | — | Captain reviews the classification table and explicitly approves before any code changes happen | no | **yes** (`feedback-to: classify`) |
| `apply-and-migrate` | Phases 3, 4, 5 (branch, apply, migrate) | Create `chore/dependabot-{id}` branch in a worktree, apply updates per the approved classification, run package-specific migrations (`pnpm biome migrate --write` for biome bumps) | **yes** | no |
| `test` | Phase 6 (test) | Run lint, type-check, frontend test, frontend build, `make format && make flake8 && make test` | yes (same worktree) | no |
| `push-and-pr` | Phases 7, 8, 9 (commit, push, PR) | **terminal** — pr-merge mod's `merge` hook handles push + PR creation | yes | no |

**Why this shape works:**

- The two pause points the skill already has — "ask on major bumps" and
  "unsure if `@datarecce/ui` floor bump is needed" — collapse into a single
  approval gate at `approve-classification`. The captain sees the
  classification table once, approves, and the rest runs unattended.
- The push/PR tail in Phase 8 is exactly what the **pr-merge** mod
  (`_mods/pr-merge.md`, `merge` hook) already does — branch push + PR
  creation with a body template. Drop the mod into `_mods/`, mark
  `apply-and-migrate` and `test` as `worktree: true`, and the mod handles
  PR creation automatically with no extra code.
- The 9-phase pipeline is already linear and stage-shaped — no transition
  acrobatics needed. README frontmatter is straightforward.

**Files this integration would create:**

- `docs/dependabot-batch/README.md` — workflow scaffolding (commission
  generates this)
- `docs/dependabot-batch/_mods/pr-merge.md` — copied from
  `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md` by
  commission's "Install Mods" step (Phase 2c of the commission skill)
- `docs/dependabot-batch/{slug}.md` — one entity per batch, seeded by the
  captain at commission time (or added later via manual file creation)

**What this integration leaves unchanged:**

- The `.claude/skills/address-dependabot/skill.md` file stays as-is. The
  ensign at each stage executes the relevant phase by following the skill's
  existing instructions; the workflow README's stage `Outputs` bullets cite
  the matching skill section.

## Integration B — Reference-doc tie-in from this workflow's README

Independent of whether the captain commissions Integration A, the
`claude-skill-refinement` README (the README the captain is currently
operating under) should add a one-line reference so future captains can
discover the skill alongside the workflow it inspired. Concretely:

- Append a short "Related skills" subsection at the bottom of
  `docs/claude-skill-refinement/README.md` listing `address-dependabot` and
  pointing at `.claude/skills/address-dependabot/skill.md`. This is a doc
  edit only — no logic change.

This is cheap and makes the skill discoverable; it does not lock the
captain into Integration A.

## What this draft deliberately does NOT recommend

- **Mod integration is rejected.** Mods (`startup`, `idle`, `merge` hooks)
  are designed for sharp lifecycle behaviors, not embedded 9-phase
  pipelines with human pause points. A `dependabot-scan` mod that fires on
  `startup` would either auto-execute the whole consolidation (unsafe) or
  just announce open PRs (low value, redundant with `gh pr list`). The
  pr-merge mod is reused by Integration A's `push-and-pr` terminal stage,
  so the mod surface is already covered.
- **Workflow-stage-agent is rejected.** There's no existing Spacedock
  workflow this skill plugs into as a single stage. Integration A makes
  the skill *the* workflow rather than a stage within another workflow.
- **Keep-as-is is the fallback.** If Integration A is more ceremony than
  the captain wants for what is currently a single `/address-dependabot`
  invocation, Integration B alone (the README reference) is sufficient.
  The skill works today; Spacedock is an optional layer on top.

## Recommended approval path

1. Approve Integration B unconditionally — it's a 5-line README edit.
2. Approve Integration A only if the captain wants per-batch tracking,
   audit trails, and pre-apply gating across multiple consolidation runs
   over time. Otherwise hold and revisit when batch volume justifies it.
