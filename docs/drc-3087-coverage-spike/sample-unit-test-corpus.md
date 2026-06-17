---
id: 8fgt2jswrdbz3qbm13qhhghp
title: Sample dbt unit-test corpus
status: proposed
source: commission seed
started:
completed:
verdict:
score: 0.9
worktree:
issue: DRC-3087
pr:
---

Assemble a shared, duckdb-runnable corpus of real dbt unit tests for both spikes to measure against. The corpus must be representative enough that coverage findings are credible — models with CASE branches, joins, aggregations, and multi-column transformations, each with one or more `unit_tests:` definitions. Source from public repos (dbt-labs/jaffle-shop and similar surveyed in the deep-dive) and/or generate our own where coverage of a specific construct is missing. This track runs first; the two spike tracks depend on its output.

This is the prerequisite track. It should land a self-contained dbt project (duckdb target) under a known path with `dbt build`/`dbt test` passing, so each spike can point its instrumentation at compiled models with known unit-test inputs.

## Acceptance criteria

**AC-1 — A duckdb-target dbt project with passing unit tests exists at a known path.**
Verified by: `dbt build` (or `dbt test --select test_type:unit`) transcript committed in the worktree, showing the sample unit tests passing.

**AC-2 — The corpus covers a range of SQL constructs worth measuring coverage on.**
Verified by: the entity body enumerates which constructs (CASE branches, joins, aggregations, multi-column transforms) each sample model + its unit tests exercise.
