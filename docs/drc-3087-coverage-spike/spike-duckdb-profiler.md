---
id: aexkfb7he4fwamyrkcb4cjr5
title: Spike — DuckDB profiler / coverage report
status: scoping
source: commission seed
started:
completed:
verdict:
score: 0.8
worktree:
issue: DRC-3087
pr:
---

Explore recovering fine-grained unit-test coverage by running the unit test through **DuckDB and reading its query profiler output**. The idea: execute the model's compiled SQL under the unit test's inputs with profiling enabled (`PRAGMA enable_profiling`, `EXPLAIN ANALYZE`, the JSON profiler output), then infer from the operator tree / cardinalities which query operators and branches were touched — e.g. a filter that passed zero rows, a join that produced no output, a projection never evaluated.

Open questions for scoping: does DuckDB's profiler expose enough operator-level detail to map back to source SQL constructs? Can we attribute touched operators to CASE branches / columns, or only to physical operators? What's the resolution ceiling vs. the query-rewriting approach? Depends on the sample-unit-test corpus track for inputs.

## Acceptance criteria

**AC-1 — A working prototype runs a real dbt-compiled model under DuckDB profiling and extracts a coverage signal from the profiler output.**
Verified by: command transcript + captured profiler output (JSON / EXPLAIN ANALYZE) committed in the worktree, re-runnable by a future reader.

**AC-2 — The findings report answers yes/no/partial on fine-grained coverage, with cited evidence and a recommendation.**
Verified by: the `## Findings` section cites specific profiler output for each scoping success-criterion and compares against the query-rewriting spike.
