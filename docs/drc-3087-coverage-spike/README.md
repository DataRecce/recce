---
commissioned-by: spacedock@0.19.7
entity-type: exploration_track
entity-label: track
entity-label-plural: tracks
id-style: sd-b32
state: $inline
merge: local
stages:
  defaults:
    worktree: false
    concurrency: 2
  states:
    - name: proposed
      initial: true
    - name: scoping
    - name: prototyping
      worktree: true
    - name: findings
      gate: true
      feedback-to: prototyping
    - name: done
      terminal: true
---

# DRC-3087 Spike: Fine-Grained dbt Unit-Test Coverage

This workflow runs the technical spike behind [DRC-3087](https://linear.app/recce/issue/DRC-3087/review-requested-dbt-unit-test-expectations). The product question is *coverage*: not "how many unit tests does this model have," but "which parts of a model's transformation logic does a given unit test actually exercise?" — the SQL analogue of code coverage.

We explore two independent technical approaches and a shared input corpus:

- **Query rewriting** — transform/instrument a model's compiled SQL so that running a unit test reveals which columns, CASE branches, joins, and expressions were exercised by the test's inputs.
- **DuckDB profiler / coverage report** — run the unit test through DuckDB and read its query profiler / `EXPLAIN ANALYZE` output to infer which query operators and branches were touched.
- **Sample unit-test corpus** — a shared, duckdb-runnable set of real dbt unit tests (found in public repos and/or generated) that both spikes measure against, so findings are comparable.

Each track is an *exploration track*: it gets scoped, prototyped in its own worktree, and concludes with a written findings report the captain reviews. This is a spike — the deliverable is **knowledge and a recommendation**, backed by a running prototype and captured evidence, not production code.

## File Naming

Each track lives as either:

- a flat markdown file `{slug}.md` (default), or
- a folder `{slug}/` containing `index.md` as the canonical entity file, when the track produces per-stage artifacts (prototype notes, profiler dumps, sample SQL) that belong alongside the tracker.

Slugs are lowercase, hyphens, no spaces. Example: `spike-query-rewriting.md` or `spike-query-rewriting/index.md`. The status scanner recognizes both forms.

## Schema

Every track file has YAML frontmatter. Fields are documented below; see **Track Template** for a copy-paste starter.

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (sd-b32 stored ID) |
| `title` | string | Human-readable track name |
| `status` | enum | One of: proposed, scoping, prototyping, findings, done |
| `source` | string | Where this track came from |
| `started` | ISO 8601 | When active work began |
| `completed` | ISO 8601 | When the track reached terminal status |
| `verdict` | enum | PASSED or REJECTED — set at the findings gate |
| `score` | number | Priority score, 0.0–1.0 (optional) |
| `worktree` | string | Worktree path while a dispatched agent is active, empty otherwise |
| `issue` | string | GitHub/Linear issue reference. Optional cross-reference. |
| `pr` | string | PR reference, or local-merge sentinel. Set at merge. |

### ID Style

`id-style: sd-b32` — `id` stores the full stable 24-character lowercase SD-B32 value from `status --next-id --id-seed <slug-or-title>`. Status tables show the shortest unique prefix (`MIN_PREFIX: 2`). Use `status --validate` before trusting state and `status --resolve <ref>` to resolve a slug, stored ID, or address prefix.

## Stages

### `proposed`

Holding bucket. A track is created here and sits in `proposed` until the first officer dispatches it. No work happens in this stage — it is the inbox the entity enters on creation.

- **Inputs:** none (entry state).
- **Outputs:** none — dispatch moves the track to `scoping`.
- **Good:** n/a.
- **Bad:** n/a.

### `scoping`

The captain or ensign frames the track before any building. The entity is in `scoping` while we pin down exactly what question this track answers and how we'll know it succeeded.

- **Inputs:** The DRC-3087 issue, the deep-dive notes (`docs/plans/2026-05-27-DRC-3087-deep-dive.md`), the shared corpus track's output (for the two spike tracks), and the recce codebase for where coverage data would eventually plug in.
- **Outputs:** A precise spike question ("can approach X recover per-branch/per-column coverage from a dbt unit test?"); explicit success criteria (what evidence would count as "this works"); the specific sample unit tests this track needs; and the single riskiest assumption to exercise first. Record these in the entity body before leaving this stage.
- **Good:** A falsifiable question with a concrete pass/fail bar. Names the smallest experiment that would invalidate the approach. Identifies which corpus tests it depends on.
- **Bad:** "Explore query rewriting" with no success bar. Skipping straight to building. Inventing UI/product scope — this spike is about the coverage *mechanism*, not the lineage badges already designed elsewhere.

### `prototyping`

The entity is in `prototyping` while a dispatched ensign builds a working prototype in a dedicated worktree and runs it against the corpus. Throwaway-quality code is fine; *running and producing evidence* is the bar.

- **Inputs:** The scoped question and success criteria from the entity body; the sample unit-test corpus; DuckDB and a dbt project that can compile/run the sample models.
- **Outputs:** A prototype that actually runs end-to-end against at least one real sample unit test; captured evidence (coverage output, profiler dumps, rewritten SQL, command transcripts) committed to the worktree or saved into the entity folder; a note on what worked, what broke, and any dead-ends. Exercise the riskiest assumption first and record the result.
- **Good:** Runs against a real compiled dbt model + unit test, not a toy hand-written query. Evidence is reproducible (commands + outputs captured). Honestly records where the approach hit a wall.
- **Bad:** A design doc with no running code. A prototype that only works on a hand-crafted SQL string that never touched dbt's compilation. Claiming success without captured output a reader can re-run.

### `findings`

The entity is in `findings` once prototyping is done and a written verdict is ready for the captain. This is the approval gate.

- **Inputs:** The prototype and all evidence captured during `prototyping`.
- **Outputs:** A findings report in the entity body: does this approach recover fine-grained coverage (yes/no/partial), what it costs (complexity, dbt-version coupling, runtime), how it compares to the sibling spike, and a clear recommendation (pursue / drop / needs-more). Every success-criterion from `scoping` is marked met/unmet with evidence cited.
- **Good:** A recommendation the captain can act on in one read. Cites specific evidence from the prototype. States limitations plainly. Compares against the other approach where relevant.
- **Bad:** "It kind of works." Burying the recommendation. Claiming coverage works without pointing at the run that proves it. Ignoring a success-criterion set during scoping.

### `done`

Terminal. The track's findings are accepted and the spike is concluded. Prototype branch is merged locally (or left for reference); knowledge is captured in the entity body.

## Workflow State

Workflow state is read by the first officer at boot. To view current state, dispatch the first officer or run it directly:

```
spacedock claude
```

## Track Template

```yaml
---
id:
title: Track name here
status: scoping
source:
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Brief description of this track and the question it aims to answer.

## Acceptance criteria

Each AC names a property of the finished track (not a stage action) and how it is verified.

**AC-1 — A working prototype ran against a real dbt-compiled unit test.**
Verified by: command transcript + captured output committed in the worktree / entity folder, re-runnable by a future reader.

**AC-2 — The findings report answers yes/no/partial on fine-grained coverage with cited evidence.**
Verified by: the `## Findings` section in this entity body cites specific prototype output for each success-criterion.
```

## Commit Discipline

- Commit status changes at dispatch and merge boundaries.
- Commit track body updates (scope, evidence, findings) when substantive.
- Prototype code lives on the track's worktree branch; merge is local (this is a spike — no PRs to main).
