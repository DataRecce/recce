---
id: 8fgt2jswrdbz3qbm13qhhghp
title: Sample dbt unit-test corpus
status: scoping
source: commission seed
started: 2026-06-17T23:29:06Z
completed:
verdict:
score: 0.9
worktree:
issue: DRC-3087
pr:
---

Assemble a shared, duckdb-runnable corpus of real dbt unit tests for both spikes to measure against. The corpus must be representative enough that coverage findings are credible — models with CASE branches, joins, aggregations, and multi-column transformations, each with one or more `unit_tests:` definitions. Source from public repos (dbt-labs/jaffle-shop and similar surveyed in the deep-dive) and/or generate our own where coverage of a specific construct is missing. This track runs first; the two spike tracks depend on its output.

This is the prerequisite track. It should land a self-contained dbt project (duckdb target) under a known path with `dbt build`/`dbt test` passing, so each spike can point its instrumentation at compiled models with known unit-test inputs.

## Corpus scope (set at scoping, 2026-06-17)

### What this corpus is *for*

The corpus exists to let the two sibling spikes (`spike-query-rewriting`,
`spike-duckdb-profiler`) measure *fine-grained* coverage — "which parts of a
model's transform did this unit test exercise?" — against the *same* inputs, so
their findings are comparable. The corpus is the independent variable: it is not
trying to be representative of real-world test *density* (the deep-dive already
established that's ~5–25%); it is engineered to contain SQL constructs that have
*internally distinguishable parts* a coverage signal could light up or miss.

The discriminating design rule: **each model must have a unit test whose input
fixtures exercise only SOME of the model's logic, leaving a known, named gap.**
A test that hits every branch proves nothing about whether a spike can detect
partial coverage. Every model below ships at least one test with a deliberate,
documented blind spot, plus (where useful) a second test that closes it — so a
spike can be scored on whether it reports the gap and the closure.

### Constructs to cover, and why each matters for a coverage signal

| # | Construct | Sample model | Why it matters for fine-grained coverage |
|---|-----------|--------------|------------------------------------------|
| C1 | **Multi-branch CASE** (3+ WHEN + ELSE) | `dim_order_status` — maps raw status → bucket via CASE | The canonical coverage unit. A test whose fixtures only produce statuses hitting 2 of 4 branches leaves 2 branches uncovered. Both spikes' core claim is "can we tell which CASE branch was hit?" |
| C2 | **INNER vs LEFT JOIN with unmatched keys** | `fct_orders` joins `stg_orders` → `stg_customers` (LEFT) | A LEFT join with a fixture row that has no match exercises the null-fill path; an INNER join with the same row drops it. Distinguishes "join produced rows" from "join branch with no match". Profiler-spike target (zero-row operator); rewrite-spike target (null-coalesced columns). |
| C3 | **Aggregation with GROUP BY + HAVING / filtered agg** | `agg_customer_orders` — `count`, `sum`, `count(distinct)`, a `HAVING` | A fixture set that never trips the HAVING threshold, or never supplies >1 row per group (so `count(distinct)` is trivially 1), leaves aggregation semantics under-exercised. Tests whether a spike can see "this aggregate was computed but never over a non-trivial group". |
| C4 | **Multi-column transform / derived columns** | `int_order_metrics` — several derived columns: arithmetic (`amount * tax_rate`), `coalesce`, a boolean flag, a string concat | Column-level coverage resolution. A test asserting only `total_amount` while ignoring `is_large_order` and `customer_label` leaves columns computed-but-unasserted. Directly probes the column-granularity ceiling both spikes ask about. |
| C5 | **Nested / combined construct** (CASE *inside* an aggregate, over a join) | `fct_customer_segment` — `sum(case when ... then amount else 0 end)` over the C2 join | Stress case: can a spike attribute coverage when constructs are nested, or does resolution collapse to the outermost operator? This is the construct most likely to *break* one approach and separate the two spikes. |

Coverage of the four constructs named in the AC and checklist:
- **CASE branches** → C1 (and nested in C5).
- **Joins** → C2 (and underlying C5).
- **Aggregations** → C3 (and C5).
- **Multi-column transforms** → C4.

Each model's YAML carries `unit_tests:` with at least one *partial-coverage*
test (named gap) and, for C1/C4, a second test that closes the gap — giving the
spikes a positive and a negative case to score against.

### Sources: generate, don't scavenge

- **Decision: author the corpus ourselves**, in-repo, rather than vendoring a
  public project. Rationale: the deep-dive surveyed dbt-labs/jaffle-shop,
  Velir/dbt-ga4, ccao-data/data-architecture — real coverage is sparse and the
  *existing* tests there are written to pass, not to leave named gaps. We need
  tests engineered with deliberate blind spots (above); scavenged tests don't
  give us that and would couple us to those repos' seeds/macros/deps.
- **Reference, not dependency:** dbt-labs/jaffle-shop's `unit_tests:` block on
  `stg_customers` / `customers` (the 2- and 10-test models from the deep-dive
  survey) is the *syntax* template to mirror — `given` / `format: dict` rows,
  `expect.rows`. We copy the shape, not the project.
- **Target path:** a self-contained project at
  `docs/drc-3087-coverage-spike/corpus/` (a `corpus/` folder beside the track
  files). It contains its own `dbt_project.yml`, `profiles.yml` (duckdb target,
  relative `path:` so no machine-specific config), `models/`, `seeds/`, and the
  `unit_tests:` YAML. A spike worktree points its instrumentation here. Keeping
  it under the workflow dir (not `integration_tests/`) keeps the throwaway spike
  corpus out of the production test surface.
- **No seeds-from-warehouse:** all inputs are either tiny committed `seeds/`
  CSVs or, preferably, unit-test `given` fixtures inline in YAML — so `dbt build`
  needs nothing but duckdb on a fresh checkout.

### Toolchain (verified at scoping, no hidden deps)

- `.venv/bin` already has **dbt-core 1.11.7, dbt-duckdb 1.10.1,
  dbt-adapters 1.22.9** (well above the dbt-core ≥1.8 floor where `unit_tests`
  landed). System duckdb CLI v1.5.3 / python 1.5.1 also present.
- ⚠️ `dbt` is **not on `$PATH`**; invoke via `.venv/bin/dbt` (or `uv run dbt`).
  The prototyping stage must use the venv binary explicitly — do not assume a
  bare `dbt`.
- No existing `unit_tests:` anywhere in the repo today (`grep` clean), so the
  corpus is greenfield — nothing to reconcile or break.

### Riskiest assumption to exercise first

**"dbt unit tests actually compile and run green against a duckdb target with
our installed dbt version (dbt-core 1.11.7 / dbt-duckdb 1.10.1), using inline
`given` fixtures."**

This is riskiest because *everything downstream of it is wasted if it's false* —
both spikes instrument the *compiled* unit-test SQL, so if `dbt test
--select test_type:unit` won't even run here, there's no artifact to measure.
Sub-risks folded in: that dbt-duckdb 1.10.1 supports the `unit_tests` /
`given`/`expect` surface; that inline fixtures avoid needing seeded warehouse
data; that the compiled unit-test node lands in `target/` where a spike can read
it.

**How prototyping checks it first:** before authoring all five models, stand up
the *smallest possible* slice — one model (C1, the CASE model) + one
partial-coverage `unit_test` with inline `given` rows — and run
`.venv/bin/dbt build` then `.venv/bin/dbt test --select test_type:unit`,
capturing the transcript. Green here unblocks the rest; a failure here (adapter
gap, fixture-format mismatch, version skew) is caught on day one with one model,
not five. Then inspect `target/compiled/.../<unit_test>.sql` exists and is
readable — that compiled artifact is the literal handoff to both spikes, so
confirming it materializes is part of de-risking.

## Acceptance criteria

**AC-1 — A duckdb-target dbt project with passing unit tests exists at a known path.**
Verified by: `dbt build` (or `dbt test --select test_type:unit`) transcript committed in the worktree, showing the sample unit tests passing.

**AC-2 — The corpus covers a range of SQL constructs worth measuring coverage on.**
Verified by: the entity body enumerates which constructs (CASE branches, joins, aggregations, multi-column transforms) each sample model + its unit tests exercise.

## Stage Report: scoping

- DONE: Record a precise scope for the corpus: which SQL constructs the sample models + unit tests must cover, and why each matters for measuring fine-grained coverage.
  `## Corpus scope` → "Constructs to cover" table (C1 CASE branches, C2 joins, C3 aggregations, C4 multi-column transforms, C5 nested), each tied to a named model with the coverage-signal rationale and the deliberate-gap design rule.
- DONE: Identify concrete sources (public repos vs. self-generated) plus the target path for a duckdb-target dbt project.
  Decision recorded: author the corpus ourselves (deliberate-gap tests don't exist in scavenged repos), mirroring dbt-labs/jaffle-shop `given`/`expect` syntax only; target path `docs/drc-3087-coverage-spike/corpus/` with self-contained duckdb profile.
- DONE: Name the single riskiest assumption to exercise first in prototyping and how prototyping will check it.
  Riskiest assumption + check recorded: "dbt unit tests compile/run green against duckdb with dbt-core 1.11.7 / dbt-duckdb 1.10.1 via inline `given` fixtures"; checked by standing up one CASE model + one partial test and running `.venv/bin/dbt build` / `dbt test --select test_type:unit` before authoring the rest.

### Summary

Scoped the shared corpus as an *engineered* set (not a representative one): five models covering CASE branches, joins, aggregations, multi-column transforms, and a nested combination, each shipping a unit test with a deliberate, documented coverage gap so the two spikes can be scored on whether they detect partial coverage. Decided to author in-repo at `docs/drc-3087-coverage-spike/corpus/` rather than vendor a public project, since scavenged tests are written to pass-all and don't leave the named gaps the spikes need. Verified the toolchain at scoping time — `.venv/bin` has dbt-core 1.11.7 / dbt-duckdb 1.10.1 (above the 1.8 unit-test floor) and duckdb is present — and flagged that `dbt` is not on `$PATH` (use `.venv/bin/dbt`); riskiest assumption is that unit tests actually run green on the duckdb target, to be de-risked first with a one-model slice.
