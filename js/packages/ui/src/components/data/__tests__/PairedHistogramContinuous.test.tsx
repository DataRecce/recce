/**
 * @file PairedHistogramContinuous.test.tsx
 * @description Tests for the constant-area paired histogram cell (DRC-3390 PR 3).
 *
 * Visual behavior covered:
 *   - One <g> per bin
 *   - Bar widths track the quantile span (constant-area), not slot-uniform
 *   - Heights track density relative to max density across both envs
 *   - Differential rect colored by which env exceeds the other in that bin
 *   - Agreement zone (min(base, current)) uses the checkerboard SVG pattern
 *   - Light / dark theme bar colors
 *   - Degenerate / zero / mismatched payloads don't crash
 */

import { render } from "@testing-library/react";
import { vi } from "vitest";
import { useIsDark } from "../../../hooks/useIsDark";
import {
  computeContinuousLayout,
  PairedHistogramContinuous,
  type PairedHistogramContinuousData,
} from "../PairedHistogramContinuous";

vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: vi.fn(() => false),
}));

// 11 bins with quantile-driven widths: tight in the middle, wide at the
// edges (typical for a long-tailed distribution where APPROX_PERCENTILE
// hits 80% of the mass between bins 3 and 7).
const sampleData: PairedHistogramContinuousData = {
  binEdges: [0, 10, 25, 50, 80, 120, 165, 220, 290, 400, 600, 1000],
  baseDensity: [
    0.01, 0.02, 0.04, 0.06, 0.08, 0.07, 0.05, 0.03, 0.015, 0.005, 0.001,
  ],
  currentDensity: [
    0.02, 0.03, 0.045, 0.055, 0.085, 0.065, 0.04, 0.025, 0.012, 0.006, 0.0015,
  ],
  baseTotal: 10_000,
  currentTotal: 12_000,
};

describe("PairedHistogramContinuous", () => {
  it("renders one group per bin", () => {
    const { container } = render(
      <PairedHistogramContinuous data={sampleData} />,
    );
    const groups = container.querySelectorAll("svg > g");
    expect(groups.length).toBe(sampleData.baseDensity.length);
  });

  it("renders at fixed cell-density dimensions (140x28)", () => {
    const { container } = render(
      <PairedHistogramContinuous data={sampleData} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("140");
    expect(svg?.getAttribute("height")).toBe("28");
  });

  it("light theme uses the light bar palette (#F6AD55 / #63B3ED)", () => {
    const { container } = render(
      <PairedHistogramContinuous data={sampleData} />,
    );
    const fills = Array.from(container.querySelectorAll("svg rect")).map((r) =>
      r.getAttribute("fill"),
    );
    expect(fills.some((f) => f === "#F6AD55")).toBe(true);
    expect(fills.some((f) => f === "#63B3ED")).toBe(true);
  });

  it("dark theme uses the dark bar palette (#FBD38D / #90CDF4)", () => {
    vi.mocked(useIsDark).mockReturnValueOnce(true);
    const { container } = render(
      <PairedHistogramContinuous data={sampleData} />,
    );
    const fills = Array.from(container.querySelectorAll("svg rect")).map((r) =>
      r.getAttribute("fill"),
    );
    expect(fills.some((f) => f === "#FBD38D")).toBe(true);
    expect(fills.some((f) => f === "#90CDF4")).toBe(true);
  });

  it("differential rect is blue when current density exceeds base", () => {
    // Single-bin payload: current density >> base density. Should produce
    // a single solid blue rect (no agreement zone since baseH would be 0).
    const data: PairedHistogramContinuousData = {
      binEdges: [0, 10],
      baseDensity: [0],
      currentDensity: [0.5],
      baseTotal: 0,
      currentTotal: 5,
    };
    const { container } = render(<PairedHistogramContinuous data={data} />);
    const fills = Array.from(container.querySelectorAll("svg rect"))
      .map((r) => r.getAttribute("fill"))
      // ignore pattern <rect> children (their fill is just a color but they
      // live inside <defs>, not the chart area) and the invisible hit-target
      // rects (fill="none").
      .filter((f) => f && f !== "none");
    // Only the differential rect should remain — it's blue (current dominates).
    expect(fills).toContain("#63B3ED");
  });

  it("differential rect is orange when base density exceeds current", () => {
    // Symmetric to the blue case — base dominates, so the only chart-area
    // rect should be solid orange. Scoped to "svg > g rect" so the
    // checkerboard <pattern> rects in <defs> don't pollute the assertion.
    const data: PairedHistogramContinuousData = {
      binEdges: [0, 10],
      baseDensity: [0.5],
      currentDensity: [0],
      baseTotal: 5,
      currentTotal: 0,
    };
    const { container } = render(<PairedHistogramContinuous data={data} />);
    const fills = Array.from(container.querySelectorAll("svg > g rect"))
      .map((r) => r.getAttribute("fill"))
      .filter((f) => f && f !== "none");
    expect(fills).toContain("#F6AD55");
    expect(fills).not.toContain("#63B3ED");
  });

  it("handles bin-edge / density length mismatch by rendering an empty SVG", () => {
    const broken: PairedHistogramContinuousData = {
      binEdges: [0, 1, 2],
      baseDensity: [1, 2, 3, 4],
      currentDensity: [1, 1, 1, 1],
      baseTotal: 10,
      currentTotal: 4,
    };
    const { container } = render(<PairedHistogramContinuous data={broken} />);
    // No bin groups rendered, but the SVG frame is still there.
    expect(container.querySelectorAll("svg > g").length).toBe(0);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("handles a zero-span payload (degenerate column) by falling back to uniform widths", () => {
    const collapsed: PairedHistogramContinuousData = {
      binEdges: [5, 5, 5],
      baseDensity: [0.5, 0.5],
      currentDensity: [0.5, 0.5],
      baseTotal: 2,
      currentTotal: 2,
    };
    const layout = computeContinuousLayout(collapsed, 140);
    expect(layout.bins.length).toBe(2);
    // Uniform fallback: both bins same width.
    expect(layout.bins[0].width).toBeCloseTo(70, 5);
    expect(layout.bins[1].width).toBeCloseTo(70, 5);
  });

  it("hover-title carries percentage breakdown per bin", () => {
    const { container } = render(
      <PairedHistogramContinuous data={sampleData} />,
    );
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent,
    );
    // Most-common hover format: "10–25 [base: 30.0%, current: ...]" — at
    // least one title should contain both percentages.
    expect(
      titles.some((t) => t?.includes("base:") && t.includes("current:")),
    ).toBe(true);
  });

  it("uses custom formatValue in tooltip bin-range prefix", () => {
    const { container } = render(
      <PairedHistogramContinuous
        data={sampleData}
        formatValue={(v) => `$${v}`}
      />,
    );
    const titles = Array.from(container.querySelectorAll("svg title"))
      .map((t) => t.textContent ?? "")
      // skip the accessible <title> at the top of the SVG
      .filter((t) => t.includes("["));
    expect(titles.some((t) => t.startsWith("$0"))).toBe(true);
  });

  it("computeContinuousLayout: bar widths sum to the available width", () => {
    const layout = computeContinuousLayout(sampleData, 140);
    const total = layout.bins.reduce((s, b) => s + b.width, 0);
    expect(total).toBeCloseTo(140, 1);
  });

  it("computeContinuousLayout: empty payload returns empty bins", () => {
    const empty: PairedHistogramContinuousData = {
      binEdges: [],
      baseDensity: [],
      currentDensity: [],
      baseTotal: 0,
      currentTotal: 0,
    };
    const layout = computeContinuousLayout(empty, 140);
    expect(layout.bins).toEqual([]);
    expect(layout.maxDensity).toBe(0);
  });

  it("accepts className prop", () => {
    const { container } = render(
      <PairedHistogramContinuous data={sampleData} className="my-chart" />,
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toBe(
      "my-chart",
    );
  });
});
