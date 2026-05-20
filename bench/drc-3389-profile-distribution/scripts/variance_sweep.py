"""
Sample-variance sweep — runs a sampling strategy N times and reports how much
the chart shapes move between identical reruns.

Each run gets a fresh random sample (both materialized and inline regenerate
per run), so this captures the noise the user would see on a real "refresh
the page" interaction.

Usage:
    python variance_sweep.py --strategy sample --sample-k 10000 --reps 5
    python variance_sweep.py --strategy sample_inline --sample-k 10000 --reps 5
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from statistics import mean, stdev

SCRIPT_DIR = Path(__file__).resolve().parent
BENCH = SCRIPT_DIR / "bench.py"
RESULTS = SCRIPT_DIR.parent / "results"


def run_once(strategy: str, target: str, rows: int, sample_k: int) -> str:
    """Run bench.py and return the distributions.json path."""
    cmd = [
        sys.executable, str(BENCH),
        "--target", target,
        "--strategy", strategy,
        "--rows", str(rows),
        "--sample-k", str(sample_k),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    # find the newest distribution file written
    files = sorted(RESULTS.glob(f"*_{strategy}*rows{rows}.distributions.json"))
    if not files:
        files = sorted(RESULTS.glob(f"*_{strategy}_{sample_k}*rows{rows}.distributions.json"))
    if not files:
        print(r.stderr, file=sys.stderr)
        raise RuntimeError("no distributions file")
    # take newest by mtime
    newest = max(files, key=lambda p: p.stat().st_mtime)
    # Try to find wall time
    wall = None
    for line in r.stdout.splitlines():
        if "wall:" in line:
            try:
                wall = float(line.split("wall:")[1].split("s")[0].strip())
            except Exception:
                pass
    return newest, wall


def proportions(slot: dict) -> dict:
    """Return per-bin/value proportional counts for a slot, keyed by bin index
    (histogram) or value string (topk)."""
    if slot is None:
        return None
    if slot.get("kind") == "topk":
        vals = slot.get("values") or []
        bc = slot.get("base_counts") or []
        cc = slot.get("current_counts") or []
        bt = slot.get("base_total") or 1
        ct = slot.get("current_total") or 1
        b_prop = {v: bc[i] / bt for i, v in enumerate(vals)}
        c_prop = {v: cc[i] / ct for i, v in enumerate(vals)}
        return {"base": b_prop, "curr": c_prop, "kind": "topk", "values": vals}
    if slot.get("kind") == "histogram":
        bc = slot.get("base_counts") or []
        cc = slot.get("current_counts") or []
        bt = slot.get("base_total") or 1
        ct = slot.get("current_total") or 1
        return {
            "base": {i: bc[i] / bt for i in range(len(bc))},
            "curr": {i: cc[i] / ct for i in range(len(cc))},
            "kind": "histogram",
        }
    return None


def paired_delta(slot: dict) -> dict:
    """Per-bin/value |base_prop − curr_prop| (the divergence the chart shows)."""
    p = proportions(slot)
    if p is None:
        return None
    keys = set(p["base"]) | set(p["curr"])
    return {k: abs(p["base"].get(k, 0) - p["curr"].get(k, 0)) for k in keys}


def variance_across_runs(run_paths):
    """For each column, compute spread of paired_delta values across runs."""
    runs = [json.load(open(p))["columns"] for p in run_paths]
    cols = sorted(set().union(*[set(r) for r in runs]))
    out = {}
    for c in cols:
        deltas_per_run = []
        for r in runs:
            slot = r.get(c)
            if slot is None or not slot.get("base_counts") and not slot.get("values"):
                deltas_per_run.append(None)
                continue
            deltas_per_run.append(paired_delta(slot))
        # Skip columns that had a None in any run
        if any(d is None for d in deltas_per_run):
            continue
        # Compute spread across runs at each key
        all_keys = set().union(*[set(d) for d in deltas_per_run])
        # For each key, take the std across runs
        per_key_stds = []
        per_key_means = []
        for k in all_keys:
            vals = [d.get(k, 0) for d in deltas_per_run]
            per_key_means.append(mean(vals))
            per_key_stds.append(stdev(vals) if len(vals) > 1 else 0)
        out[c] = {
            "mean_paired_delta_avg": mean(per_key_means) if per_key_means else 0,
            "std_paired_delta_max": max(per_key_stds) if per_key_stds else 0,
            "std_paired_delta_avg": mean(per_key_stds) if per_key_stds else 0,
            "kind": runs[0][c].get("kind"),
        }
    return out


def summarize(stats: dict) -> None:
    for kind in ("topk", "histogram"):
        rows = [s for s in stats.values() if s["kind"] == kind]
        if not rows:
            continue
        avg_std = mean(r["std_paired_delta_avg"] for r in rows)
        max_std = max(r["std_paired_delta_max"] for r in rows)
        avg_mean = mean(r["mean_paired_delta_avg"] for r in rows)
        print(f"[{kind}] n={len(rows)}")
        print(f"  mean paired_delta (across runs, across bins/values): {avg_mean:.4f}")
        print(f"  std  paired_delta (per-bin variance across runs):    avg={avg_std:.4f}  max={max_std:.4f}")

    # Top-5 columns by max std (most variance-prone)
    sorted_stats = sorted(stats.items(), key=lambda kv: -kv[1]["std_paired_delta_max"])[:5]
    print("\nTop-5 columns by std_paired_delta_max (most chart variance across runs):")
    for c, s in sorted_stats:
        print(f"  {c:25} kind={s['kind']:10} std_max={s['std_paired_delta_max']:.4f}  std_avg={s['std_paired_delta_avg']:.4f}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strategy", required=True, choices=("sample", "sample_inline"))
    ap.add_argument("--target", default="duckdb", choices=("duckdb", "snowflake"))
    ap.add_argument("--rows", type=int, default=1_000_000)
    ap.add_argument("--sample-k", type=int, default=10_000)
    ap.add_argument("--reps", type=int, default=5)
    args = ap.parse_args()

    print(f"Running {args.strategy} (K={args.sample_k}) {args.reps} times on {args.target}...", file=sys.stderr)
    paths = []
    walls = []
    for i in range(args.reps):
        t0 = time.time()
        p, wall = run_once(args.strategy, args.target, args.rows, args.sample_k)
        paths.append(p)
        if wall is not None:
            walls.append(wall)
        print(f"  rep {i+1}/{args.reps}: {p.name}  wall={wall}", file=sys.stderr)

    if walls:
        print(f"\nwall: mean={mean(walls):.2f}s  std={stdev(walls):.2f}s  range=[{min(walls):.2f}, {max(walls):.2f}]")

    print()
    stats = variance_across_runs(paths)
    summarize(stats)


if __name__ == "__main__":
    main()
