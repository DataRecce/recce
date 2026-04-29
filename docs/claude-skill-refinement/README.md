---
commissioned-by: spacedock@0.10.2
entity-type: claude_skill
entity-label: skill
entity-label-plural: skills
id-style: sequential
stages:
  defaults:
    worktree: false
    concurrency: 2
  states:
    - name: queued
      initial: true
    - name: intake
    - name: suggestions
    - name: approval
      gate: true
      feedback-to: suggestions
    - name: execute
      worktree: true
      terminal: true
---

# Claude Skill Spacedock Refinement

This workflow processes Claude skills installed under the repository's `.claude/skills/` directory. Each skill moves through stages of analysis, recommendation, captain-gated review, and concrete execution. The mission is to understand what each skill does, categorize how it could integrate with Spacedock (workflow stage agent, mod, commission seed, or reference doc), and produce documentation or scaffolding that makes the integration real.

## File Naming

Each skill lives as either:

- a flat markdown file `{slug}.md` (default — use this unless the skill produces many artifacts), or
- a folder `{slug}/` containing `index.md` as the canonical entity file, when the skill produces per-stage artifacts (draft documents, scaffolding files, transcripts) that belong alongside the tracker.

Slugs are lowercase, hyphens, no spaces. Example: `address-dependabot.md` or `address-dependabot/index.md`. The status scanner recognizes both forms; `--set` and `--archive` resolve the slug either way, and folder entities archive as a whole folder into `_archive/{slug}/`.

## Schema

Every skill file has YAML frontmatter. Fields are documented below; see **Skill Template** for a copy-paste starter.

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, format determined by id-style in README frontmatter |
| `title` | string | Human-readable skill name |
| `status` | enum | One of: queued, intake, suggestions, approval, execute |
| `source` | string | Where this skill came from |
| `started` | ISO 8601 | When active work began |
| `completed` | ISO 8601 | When the skill reached terminal status |
| `verdict` | enum | PASSED or REJECTED — set at final stage |
| `score` | number | Priority score, 0.0–1.0 (optional) |
| `worktree` | string | Worktree path while a dispatched agent is active, empty otherwise |
| `issue` | string | GitHub issue reference (e.g., `#42` or `owner/repo#42`). Optional cross-reference, set manually. |
| `pr` | string | GitHub PR reference (e.g., `#57` or `owner/repo#57`). Set when a PR is created for this entity's worktree branch. |

## Stages

### `queued`

Holding state for newly-seeded skills awaiting analysis. No worker effort happens here — the entity is in the queue waiting to be picked up for intake. This is a Spacedock convention: the first stage is always a holding state, and the first dispatch advances the entity into the next stage where actual work begins.

- **Inputs:** None — this is the initial state.
- **Outputs:** A seed entity file with title, source, and brief description of the target skill (produced at commission time, not by a worker).
- **Good:** Seed body names the skill clearly and points to its filesystem location.
- **Bad:** Worker work happens here; status stays `queued` after seeding completes.

### `intake`

The worker reads the full skill (SKILL.md frontmatter, body, `references/`, any `bin/` scripts) and produces a categorization summary in the entity body. This is the foundation everything else builds on.

- **Inputs:** The skill directory at `.claude/skills/{skill-name}/` (SKILL.md, references/, bin/), this workflow's README, and the Spacedock plugin docs at `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/`.
- **Outputs:** An "Intake" section in the entity body that names: (1) the skill's primary purpose in one sentence, (2) trigger conditions quoted from the description frontmatter, (3) interaction model (autonomous vs. interactive), (4) scope of effect (read-only / modifies code / external API calls / spawns subagents), (5) dependencies — MCP servers, external tools, env vars, (6) categorization tag — one of: `process`, `domain-implementation`, `release`, `review`, `analysis`, `automation`.
- **Good:** Categorization quotes specific lines from the SKILL.md frontmatter and body; identifies non-obvious dependencies (e.g., a skill that silently requires `gh` CLI); notes when a skill spawns its own subagents.
- **Bad:** Paraphrasing the `description` field as the categorization; missing mention of bin/ scripts or references/ directory contents; treating "this skill is useful" as a category.

### `suggestions`

The worker translates the intake categorization into concrete Spacedock integration recommendations. This stage produces the artifacts that the captain will review at approval.

- **Inputs:** The intake summary in the entity body, this workflow's README, the Spacedock plugin's mods directory and example workflows for reference patterns.
- **Outputs:** A "Suggestions" section in the entity body containing: (1) integration recommendation — pick one or more of `workflow-stage-agent` / `mod` / `commission-seed` / `reference-doc` / `keep-as-is`, (2) rationale tied to the skill's actual trigger conditions, (3) named action items the execute stage will carry out, with target file paths, (4) any draft document content saved as `{slug}-draft.md` next to the entity (or `{slug}/draft.md` if the entity is folder-mode).
- **Good:** Each action item names a target file path and a one-line description of what goes there; recommendations are tied to actual Spacedock primitives (mods at `_mods/`, ensign agent at `spacedock:ensign`, commission via `/spacedock:commission`); draft documents are reviewable on their own without reading the suggestions section.
- **Bad:** Vague advice like "could be a mod" without saying which lifecycle hook; recommending integration mechanisms that don't exist in Spacedock; action items without target file paths.

### `approval`

The captain reviews intake categorization and suggestions together, then either approves (advances to execute) or rejects (bounces back to suggestions for revision). This is a human gate — the worker does not modify the entity body.

- **Inputs:** The completed entity with both Intake and Suggestions sections; any draft documents alongside the entity.
- **Outputs:** Captain's verdict recorded by the first officer's gate handling — PASSED moves the entity to execute, REJECTED moves it back to suggestions. No body changes.
- **Good:** Captain reads both intake and suggestions before deciding; rejection includes a feedback note in the entity body about what to revise.
- **Bad:** Auto-passing without review; modifying intake or suggestions content during the gate (those edits should happen at suggestions on a feedback loop).

### `execute`

The worker carries out the approved action items in an isolated worktree. New documentation files, workflow scaffolding, or skill metadata edits are produced and committed. The pr-merge mod pushes the branch and opens a PR.

- **Inputs:** Approved Suggestions section, any draft documents in the entity folder, target file paths from the action items.
- **Outputs:** Concrete artifacts in the worktree branch — new doc files under `docs/`, new workflow scaffolding under `docs/{new-workflow}/`, edits to skills under `.claude/skills/`, etc. Entity body gains a "Completed actions" section listing each action item with the file path of the resulting artifact and the commit SHA. The `pr` field is populated by the pr-merge mod.
- **Good:** Each action item from suggestions has a 1:1 corresponding artifact in the worktree; the entity's "Completed actions" links every artifact with a relative path; commits use clear messages tied to the entity ID.
- **Bad:** Skipping action items without recording why; producing files outside the approved scope; leaving the entity body without a "Completed actions" section.

## Workflow State

View the workflow overview:

```bash
~/.claude/plugins/cache/spacedock/spacedock/0.10.2/skills/commission/bin/status --workflow-dir docs/claude-skill-refinement
```

Output columns: ID, SLUG, STATUS, TITLE, SCORE, SOURCE.

Include archived skills with `--archived`:

```bash
~/.claude/plugins/cache/spacedock/spacedock/0.10.2/skills/commission/bin/status --workflow-dir docs/claude-skill-refinement --archived
```

Find dispatchable skills ready for their next stage:

```bash
~/.claude/plugins/cache/spacedock/spacedock/0.10.2/skills/commission/bin/status --workflow-dir docs/claude-skill-refinement --next
```

Find skills in a specific stage:

```bash
grep -l "status: suggestions" docs/claude-skill-refinement/*.md
```

## Skill Template

```yaml
---
id:
title: Skill name here
status: queued
source:
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Brief description of this skill and what we hope to learn or produce by analyzing it.

## Acceptance criteria

Each AC names a property of the finished entity (not a stage action) and how it is verified.

**AC-1 — Categorization recorded.**
Verified by: Intake section in the entity body names a category tag from the allowed set.

**AC-2 — Integration recommendation made.**
Verified by: Suggestions section names at least one of `workflow-stage-agent` / `mod` / `commission-seed` / `reference-doc` / `keep-as-is`, with rationale.

**AC-3 — Approved actions executed.**
Verified by: Completed actions section lists each action item with a file path that exists in the worktree branch.
```

## Commit Discipline

- Commit status changes at dispatch and merge boundaries
- Commit skill body updates when substantive

## Related skills

Claude skills under `.claude/skills/` that have been processed by this workflow:

- [`address-dependabot`](../../.claude/skills/address-dependabot/skill.md) — Consolidate open Dependabot PRs into a single tested branch and PR.
- [`linear-deep-dive`](../../.claude/skills/linear-deep-dive/SKILL.md) — Analyze a Linear issue or project end-to-end and orchestrate the right delivery skills.
