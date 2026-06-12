"use client";

import type { ReactNode } from "react";

/**
 * Shared canvas primitives for the paired-histogram cell pair
 * (`PairedHistogramContinuous` and `PairedHistogramDiscrete`).
 *
 * Both cells render the same outer shell — a fixed-size SVG with an
 * accessible title and a baseline rule — and format their per-bar
 * hover tooltips the same way. Keeping that shell in one place stops
 * the two cells from drifting on size, ARIA semantics, or tooltip
 * phrasing.
 *
 * The layout math, agreement-zone palette, and trimmed-marker glyph
 * remain in each cell because they diverge structurally: quantile-span
 * widths vs uniform-slot widths, checkerboard agreement vs paired
 * side-by-side bars, etc.
 */

/** Schema-row cell width (px). Tuned to the SchemaView column. */
export const CELL_WIDTH = 140;

/** Schema-row cell height (px). Fits inside the current 35px schema row. */
export const CELL_HEIGHT = 28;

/** Accessible label for the continuous paired-histogram cell. */
export const CONTINUOUS_ARIA_LABEL =
  "Paired baseline and current continuous distribution";

/** Accessible label for the discrete paired-histogram cell. */
export const DISCRETE_ARIA_LABEL =
  "Paired baseline and current categorical distribution";

export interface PairedHistogramSvgProps {
  ariaLabel: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Outer SVG frame used by both paired-histogram cells. Renders an
 * accessible title and reserves the chart area; callers draw bins and
 * decorations as children. Size is fixed at `CELL_WIDTH × CELL_HEIGHT`.
 */
export function PairedHistogramSvg({
  ariaLabel,
  className,
  children,
}: PairedHistogramSvgProps) {
  return (
    <svg
      width={CELL_WIDTH}
      height={CELL_HEIGHT}
      viewBox={`0 0 ${CELL_WIDTH} ${CELL_HEIGHT}`}
      className={className}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      {children}
    </svg>
  );
}

export interface BaselineRuleProps {
  y: number;
  stroke: string;
}

/**
 * Horizontal rule drawn under the bars so empty slots still read as
 * "this slot has zero bars" rather than "this slot doesn't exist".
 * Spans the full `CELL_WIDTH`.
 */
export function BaselineRule({ y, stroke }: BaselineRuleProps) {
  return (
    <line
      x1={0}
      y1={y}
      x2={CELL_WIDTH}
      y2={y}
      stroke={stroke}
      strokeWidth={0.5}
    />
  );
}

/**
 * Per-bar hover tooltip text: `<prefix> [base: X%, current: Y%]`.
 * Both cells use this; centralizing means a copy tweak doesn't have to
 * land twice. Always shows both sides — even 0% — because the divergence
 * reads more directly than "only in X" framing.
 *
 * The proportions are **row-share**: for the discrete cell that's
 * `count / total`; for the continuous cell the caller passes
 * `density × span` (the bin's area-proportion of the data). Either way
 * the percentage the user sees describes the share of rows in this bin,
 * not the bar's pixel-area share of the chart (which depends on the
 * chart's max-density normalization).
 */
export function formatProportionTooltip(
  prefix: string,
  baseProp: number,
  currProp: number,
): string {
  const bp = `${(baseProp * 100).toFixed(1)}%`;
  const cp = `${(currProp * 100).toFixed(1)}%`;
  return `${prefix} [base: ${bp}, current: ${cp}]`;
}

/**
 * Per-bar hover tooltip text for the rank-only paired histogram mode:
 * `<prefix> [base rank: N, current rank: M]`. Either rank may be `null`
 * — meaning the value isn't in that side's top-K — in which case that
 * half of the bracket is replaced with "not in <side> top-K".
 *
 * Parallels `formatProportionTooltip` so the two cell modes have one
 * place to tweak phrasing. Stays terse because the tooltip is rendered
 * via SVG `<title>` and lives in a 28-px-tall cell.
 */
export function formatRankTooltip(
  prefix: string,
  baseRank: number | null,
  currRank: number | null,
): string {
  const baseSeg =
    baseRank === null ? "not in base top-K" : `base rank: ${baseRank}`;
  const currSeg =
    currRank === null ? "not in current top-K" : `current rank: ${currRank}`;
  return `${prefix} [${baseSeg}, ${currSeg}]`;
}
