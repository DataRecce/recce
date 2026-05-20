"""
Compare two distribution result JSONs for chart-shape accuracy.

Usage:
    python compare_accuracy.py BASELINE.json CANDIDATE.json

Metrics per column:
  - topk_overlap     : Jaccard overlap on top-K value sets (1.0 = identical set)
  - prop_l1          : L1 distance between proportional counts (0 = identical)
  - paired_delta_l1  : L1 distance between abs(base_prop - curr_prop) vectors
                       (the per-bin divergence — what the chart actually shows)

The third metric is the load-bearing one. A sampled run can shift individual
counts but still show the same "where do base and current differ" pattern.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, List, Optional


def _safe_props(counts: List[int], total: int) -> List[float]:
    if not total:
        return [0.0] * len(counts)
    return [c / total for c in counts]


def _topk_metrics(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, float]:
    a_vals = list(a.get("values") or [])
    b_vals = list(b.get("values") or [])
    set_a, set_b = set(a_vals), set(b_vals)
    if not set_a and not set_b:
        overlap = 1.0
    elif not set_a or not set_b:
        overlap = 0.0
    else:
        overlap = len(set_a & set_b) / len(set_a | set_b)

    # Align both onto the union of values for L1 comparison.
    union = list(set_a | set_b)
    a_lookup = {v: a["base_counts"][i] for i, v in enumerate(a_vals)}
    a_lookup_c = {v: a["current_counts"][i] for i, v in enumerate(a_vals)}
    b_lookup = {v: b["base_counts"][i] for i, v in enumerate(b_vals)}
    b_lookup_c = {v: b["current_counts"][i] for i, v in enumerate(b_vals)}

    a_bt = a.get("base_total") or 1
    a_ct = a.get("current_total") or 1
    b_bt = b.get("base_total") or 1
    b_ct = b.get("current_total") or 1

    a_b_prop = [a_lookup.get(v, 0) / a_bt for v in union]
    a_c_prop = [a_lookup_c.get(v, 0) / a_ct for v in union]
    b_b_prop = [b_lookup.get(v, 0) / b_bt for v in union]
    b_c_prop = [b_lookup_c.get(v, 0) / b_ct for v in union]

    # Per-bin divergence under each run (what the paired chart shows).
    a_delta = [abs(x - y) for x, y in zip(a_b_prop, a_c_prop)]
    b_delta = [abs(x - y) for x, y in zip(b_b_prop, b_c_prop)]
    paired_delta_l1 = sum(abs(x - y) for x, y in zip(a_delta, b_delta))

    # Proportion-only L1 (without pairing).
    prop_l1 = (
        sum(abs(x - y) for x, y in zip(a_b_prop, b_b_prop))
        + sum(abs(x - y) for x, y in zip(a_c_prop, b_c_prop))
    ) / 2.0

    return {
        "topk_overlap": overlap,
        "prop_l1": prop_l1,
        "paired_delta_l1": paired_delta_l1,
        "kind": "topk",
    }


def _histogram_metrics(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, float]:
    # Bin edges may not align between sampled / full runs because min/max can
    # drift. We compare bin-index-aligned proportions — the chart shows the
    # same number of bins side-by-side.
    a_bc = a["base_counts"]
    a_cc = a["current_counts"]
    b_bc = b["base_counts"]
    b_cc = b["current_counts"]
    n = min(len(a_bc), len(b_bc))
    a_bt = a.get("base_total") or 1
    a_ct = a.get("current_total") or 1
    b_bt = b.get("base_total") or 1
    b_ct = b.get("current_total") or 1
    a_b_prop = [a_bc[i] / a_bt for i in range(n)]
    a_c_prop = [a_cc[i] / a_ct for i in range(n)]
    b_b_prop = [b_bc[i] / b_bt for i in range(n)]
    b_c_prop = [b_cc[i] / b_ct for i in range(n)]
    a_delta = [abs(x - y) for x, y in zip(a_b_prop, a_c_prop)]
    b_delta = [abs(x - y) for x, y in zip(b_b_prop, b_c_prop)]
    paired_delta_l1 = sum(abs(x - y) for x, y in zip(a_delta, b_delta))
    prop_l1 = (
        sum(abs(x - y) for x, y in zip(a_b_prop, b_b_prop))
        + sum(abs(x - y) for x, y in zip(a_c_prop, b_c_prop))
    ) / 2.0
    return {
        "prop_l1": prop_l1,
        "paired_delta_l1": paired_delta_l1,
        "kind": "histogram",
    }


def compare(baseline_path: str, candidate_path: str) -> None:
    with open(baseline_path) as fh:
        a = json.load(fh)
    with open(candidate_path) as fh:
        b = json.load(fh)

    a_cols = a["columns"]
    b_cols = b["columns"]
    common = sorted(set(a_cols) & set(b_cols))

    rows = []
    for c in common:
        av, bv = a_cols[c], b_cols[c]
        if av is None or bv is None:
            rows.append({"column": c, "kind": "skipped"})
            continue
        if av.get("kind") != bv.get("kind"):
            rows.append({"column": c, "kind": "kind_mismatch",
                         "a": av.get("kind"), "b": bv.get("kind")})
            continue
        if av["kind"] == "topk":
            m = _topk_metrics(av, bv)
        else:
            m = _histogram_metrics(av, bv)
        m["column"] = c
        rows.append(m)

    # Bucket by kind, print summary.
    for kind in ("topk", "histogram"):
        cols = [r for r in rows if r.get("kind") == kind]
        if not cols:
            continue
        prop_avg = sum(r["prop_l1"] for r in cols) / len(cols)
        paired_avg = sum(r["paired_delta_l1"] for r in cols) / len(cols)
        prop_max = max(r["prop_l1"] for r in cols)
        paired_max = max(r["paired_delta_l1"] for r in cols)
        print(f"[{kind}] n={len(cols)}")
        print(f"  prop_l1:         avg={prop_avg:.4f}  max={prop_max:.4f}")
        print(f"  paired_delta_l1: avg={paired_avg:.4f}  max={paired_max:.4f}")
        if kind == "topk":
            overlap_avg = sum(r["topk_overlap"] for r in cols) / len(cols)
            overlap_min = min(r["topk_overlap"] for r in cols)
            print(f"  topk_overlap:    avg={overlap_avg:.4f}  min={overlap_min:.4f}")

    # Worst columns by paired_delta_l1 (the load-bearing metric for chart shape).
    worst = sorted(
        (r for r in rows if "paired_delta_l1" in r),
        key=lambda x: -x["paired_delta_l1"],
    )[:10]
    print("\nWorst 10 columns by paired_delta_l1:")
    for r in worst:
        extra = f" overlap={r.get('topk_overlap', 0):.2f}" if r["kind"] == "topk" else ""
        print(f"  {r['column']:25} kind={r['kind']:10} paired_l1={r['paired_delta_l1']:.4f}  prop_l1={r['prop_l1']:.4f}{extra}")

    skipped = [r["column"] for r in rows if r["kind"] == "skipped"]
    if skipped:
        print(f"\nSkipped (one side was null): {len(skipped)} cols")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("baseline")
    ap.add_argument("candidate")
    args = ap.parse_args()
    compare(args.baseline, args.candidate)


if __name__ == "__main__":
    main()
