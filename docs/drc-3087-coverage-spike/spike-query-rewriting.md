---
id: g76413gnj562nwy6qay7byya
title: Spike — query rewriting for coverage
status: proposed
source: commission seed
started:
completed:
verdict:
score: 0.8
worktree:
issue: DRC-3087
pr:
---

Explore recovering fine-grained unit-test coverage by **rewriting / instrumenting the model's compiled SQL**. The idea: transform a model's SQL so that running it under a unit test's fixed inputs reveals which parts of the transformation logic were actually exercised — which CASE branches were hit, which columns were computed from non-default inputs, which join paths produced rows. Compare the test's input fixtures against the model's logic to derive a coverage map.

Open questions for scoping: what granularity is achievable (column / expression / CASE-branch)? Do we instrument the compiled SQL, parse it (sqlglot), or wrap it in measurement queries? How much is dbt-version / dialect coupled? Depends on the sample-unit-test corpus track for inputs.

## Acceptance criteria

**AC-1 — A working prototype rewrites a real dbt-compiled model and reports coverage against a real unit test.**
Verified by: command transcript + captured coverage output committed in the worktree, re-runnable by a future reader.

**AC-2 — The findings report answers yes/no/partial on fine-grained coverage, with cited evidence and a recommendation.**
Verified by: the `## Findings` section cites specific prototype output for each scoping success-criterion and compares against the duckdb-profiler spike.
