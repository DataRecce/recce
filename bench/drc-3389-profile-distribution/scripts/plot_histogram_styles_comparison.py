"""
Visual comparison of histogram representations: uniform-bin vs percentile-bin,
single-series and paired (base vs current).

Produces results/histogram_styles_comparison.png.
"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

# ---------- data ----------
np.random.seed(1)
N = 100_000
base = np.random.lognormal(mean=1.5, sigma=0.7, size=N)
current = np.random.lognormal(mean=1.8, sigma=0.8, size=N)

# Common visualization range (clip the very long right tail so the picture
# stays readable; this is a presentation choice, not a stats one).
# Use ~p98 so the last percentile bin's wide bar doesn't visually swallow the
# rest of the chart.
xmax = float(np.quantile(np.concatenate([base, current]), 0.98))
xmin = 0.0


def _clip_edges(edges: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """Clip bin edges into [lo, hi] so the rightmost bin is bounded visually.

    This is purely a rendering choice — the underlying bin still represents
    its full slice of data, but the bar is drawn only out to `hi`.
    """
    clipped = edges.copy()
    clipped[0] = max(clipped[0], lo)
    clipped[-1] = min(clipped[-1], hi)
    return clipped

# ---------- colors ----------
ORANGE = (255 / 255, 173 / 255, 21 / 255)      # base
BLUE = (0 / 255, 122 / 255, 255 / 255)         # current
NEUTRAL = (90 / 255, 95 / 255, 110 / 255)      # single-series

# ---------- figure ----------
fig, axes = plt.subplots(2, 2, figsize=(14, 8))
fig.suptitle(
    "Histogram representation: uniform-bin vs percentile-bin",
    fontsize=15,
    fontweight="bold",
)

# === TOP-LEFT: uniform bins, single distribution (base only) ===
ax = axes[0, 0]
n_bins_uniform = 20
edges_u = np.linspace(xmin, xmax, n_bins_uniform + 1)
counts_b, _ = np.histogram(base, bins=edges_u)
widths = np.diff(edges_u)
ax.bar(
    edges_u[:-1],
    counts_b,
    width=widths,
    align="edge",
    color=NEUTRAL,
    edgecolor="white",
    linewidth=0.5,
)
ax.set_title("Uniform bins (current Recce)", fontsize=11, fontweight="bold")
ax.set_xlabel("value")
ax.set_ylabel("count per bin")
ax.set_xlim(xmin, xmax)

# === TOP-RIGHT: percentile bins, single distribution (base only) ===
ax = axes[0, 1]
n_bins_pct = 10
qs = np.linspace(0, 1, n_bins_pct + 1)
edges_p = _clip_edges(np.quantile(base, qs), xmin, xmax)
bar_widths_p = np.diff(edges_p)
# CONSTANT-VOLUME bins: each bin holds 1/n_bins_pct of the mass, so
#   height = (1/n_bins_pct) / width
# Every bar has equal area; the envelope of heights traces the real density.
mass_per_bin = 1.0 / n_bins_pct
heights_p = mass_per_bin / bar_widths_p
ax.bar(
    edges_p[:-1],
    heights_p,
    width=bar_widths_p,
    align="edge",
    color=NEUTRAL,
    edgecolor="white",
    linewidth=1.2,
)
# tick at each percentile edge
for e in edges_p:
    ax.axvline(e, color="white", alpha=0.9, linewidth=0.8)
ax.set_title("Percentile bins (proposed)", fontsize=11, fontweight="bold")
ax.set_xlabel("value")
ax.set_ylabel("density (rows per unit, normalized)")
ax.set_xlim(xmin, xmax)

# === BOTTOM-LEFT: uniform bins, paired (base + current overlaid) ===
ax = axes[1, 0]
counts_b_u, _ = np.histogram(base, bins=edges_u)
counts_c_u, _ = np.histogram(current, bins=edges_u)
ax.bar(
    edges_u[:-1],
    counts_b_u,
    width=widths,
    align="edge",
    color=ORANGE,
    alpha=0.5,
    edgecolor="white",
    linewidth=0.5,
    label="base",
)
ax.bar(
    edges_u[:-1],
    counts_c_u,
    width=widths,
    align="edge",
    color=BLUE,
    alpha=0.5,
    edgecolor="white",
    linewidth=0.5,
    label="current",
)
ax.set_title("Uniform bins — paired", fontsize=11, fontweight="bold")
ax.set_xlabel("value")
ax.set_ylabel("count per bin")
ax.set_xlim(xmin, xmax)
ax.legend(loc="upper right", frameon=False)

# === BOTTOM-RIGHT: percentile bins, paired (each env has its own edges) ===
ax = axes[1, 1]
edges_b_p = _clip_edges(np.quantile(base, qs), xmin, xmax)
edges_c_p = _clip_edges(np.quantile(current, qs), xmin, xmax)
widths_b_p = np.diff(edges_b_p)
widths_c_p = np.diff(edges_c_p)
# CONSTANT-VOLUME bins for each env independently.
mass_per_bin = 1.0 / n_bins_pct
heights_b_p = mass_per_bin / widths_b_p
heights_c_p = mass_per_bin / widths_c_p
ax.bar(
    edges_b_p[:-1],
    heights_b_p,
    width=widths_b_p,
    align="edge",
    color=ORANGE,
    alpha=0.55,
    edgecolor=ORANGE,
    linewidth=0.8,
    label="base",
)
ax.bar(
    edges_c_p[:-1],
    heights_c_p,
    width=widths_c_p,
    align="edge",
    color=BLUE,
    alpha=0.45,
    edgecolor=BLUE,
    linewidth=0.8,
    label="current",
)
ax.set_title("Percentile bins — paired", fontsize=11, fontweight="bold")
ax.set_xlabel("value (edges = each env's 10% quantiles)")
ax.set_ylabel("density (rows per unit, normalized)")
ax.set_xlim(xmin, xmax)
ax.legend(loc="upper right", frameon=False)

# ---------- caption ----------
fig.text(
    0.5,
    0.01,
    "Percentile bins are constant-VOLUME: every bar has equal area, "
    "so heights vary inversely with width and the envelope traces the true density.",
    ha="center",
    fontsize=10,
    style="italic",
    color="#444",
)

plt.tight_layout(rect=(0, 0.035, 1, 0.95))

out_path = Path(
    "/Users/danyel/code/Recce/recce/.claude/worktrees/"
    "DRC-33890-fast-histo/bench/drc-3389-profile-distribution/"
    "results/histogram_styles_comparison.png"
)
out_path.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(out_path, dpi=110, bbox_inches="tight")
print(f"wrote {out_path}")
