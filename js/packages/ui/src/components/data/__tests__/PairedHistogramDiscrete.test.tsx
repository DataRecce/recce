/**
 * @file PairedHistogramDiscrete.test.tsx
 * @description Tests for the top-K paired histogram cell with
 * gap-on-absent semantics (DRC-3390 PR 3).
 */

import { render } from "@testing-library/react";
import {
  computeDiscreteSlots,
  PairedHistogramDiscrete,
  type PairedHistogramDiscreteData,
} from "../PairedHistogramDiscrete";

const sampleData: PairedHistogramDiscreteData = {
  values: ["US", "GB", "DE", "FR", "JP"],
  baseCounts: [100, 50, 25, 10, 5],
  currentCounts: [110, 40, 35, 8, 6],
  baseTotal: 190,
  currentTotal: 199,
};

describe("PairedHistogramDiscrete", () => {
  it("renders one group per value", () => {
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
    const groups = container.querySelectorAll("svg > g");
    expect(groups.length).toBe(sampleData.values.length);
  });

  it("renders both bars when both sides have counts > 0", () => {
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
    // Each slot: 1 invisible hit-target + base bar + current bar = 3 rects max.
    const rects = container.querySelectorAll("svg > g rect");
    expect(rects.length).toBeGreaterThan(sampleData.values.length);
  });

  it("leaves a gap (no rect) when one side count is 0 — added value", () => {
    const data: PairedHistogramDiscreteData = {
      values: ["new_only"],
      baseCounts: [0],
      currentCounts: [10],
      baseTotal: 0,
      currentTotal: 10,
    };
    const { container } = render(<PairedHistogramDiscrete data={data} />);
    const visibleFills = Array.from(container.querySelectorAll("svg > g rect"))
      .map((r) => r.getAttribute("fill"))
      .filter((f) => f && f !== "transparent");
    // Only the current bar renders — no base bar means a visible gap on
    // the base side of the slot.
    expect(visibleFills).toEqual(["#63B3ED"]);
  });

  it("leaves a gap when current side count is 0 — removed value", () => {
    const data: PairedHistogramDiscreteData = {
      values: ["legacy_only"],
      baseCounts: [10],
      currentCounts: [0],
      baseTotal: 10,
      currentTotal: 0,
    };
    const { container } = render(<PairedHistogramDiscrete data={data} />);
    const visibleFills = Array.from(container.querySelectorAll("svg > g rect"))
      .map((r) => r.getAttribute("fill"))
      .filter((f) => f && f !== "transparent");
    expect(visibleFills).toEqual(["#F6AD55"]);
  });

  it("uses default cell-density dimensions when not provided", () => {
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("140");
    expect(svg?.getAttribute("height")).toBe("36");
  });

  it("respects custom width and height", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleData} width={220} height={100} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("220");
    expect(svg?.getAttribute("height")).toBe("100");
  });

  it("does not render value labels by default", () => {
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
    expect(container.querySelectorAll("svg g text").length).toBe(0);
  });

  it("renders one label per value when showLabels is true", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleData} showLabels />,
    );
    const labels = container.querySelectorAll("svg g text");
    expect(labels.length).toBe(sampleData.values.length);
    expect(Array.from(labels).map((l) => l.textContent)).toEqual(
      sampleData.values,
    );
  });

  it("truncates labels longer than labelMaxChars", () => {
    const longData: PairedHistogramDiscreteData = {
      ...sampleData,
      values: ["United States", "Great Britain", "Germany", "France", "Japan"],
    };
    const { container } = render(
      <PairedHistogramDiscrete data={longData} showLabels labelMaxChars={4} />,
    );
    const texts = Array.from(container.querySelectorAll("svg g text")).map(
      (t) => t.textContent ?? "",
    );
    for (const t of texts) {
      expect(t.length).toBeLessThanOrEqual(4);
    }
    // Each truncated label ends with the ellipsis character.
    expect(texts.every((t) => t.endsWith("…"))).toBe(true);
  });

  it("renders trimmed marker when trimmed prop is set", () => {
    const { queryByText } = render(
      <PairedHistogramDiscrete data={{ ...sampleData, trimmed: true }} />,
    );
    expect(queryByText("trimmed")).toBeInTheDocument();
  });

  it("does not render trimmed marker by default", () => {
    const { queryByText } = render(
      <PairedHistogramDiscrete data={sampleData} />,
    );
    expect(queryByText("trimmed")).not.toBeInTheDocument();
  });

  it("handles zero totals without dividing by zero", () => {
    const zeroData: PairedHistogramDiscreteData = {
      values: ["a", "b"],
      baseCounts: [0, 0],
      currentCounts: [0, 0],
      baseTotal: 0,
      currentTotal: 0,
    };
    const { container } = render(<PairedHistogramDiscrete data={zeroData} />);
    // Hit-target rects (fill="transparent") still render so users can
    // hover; no visible bar fills.
    const visible = Array.from(container.querySelectorAll("svg > g rect"))
      .map((r) => r.getAttribute("fill"))
      .filter((f) => f && f !== "transparent");
    expect(visible.length).toBe(0);
  });

  it("dark theme uses the dark palette", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleData} theme="dark" />,
    );
    const fills = Array.from(container.querySelectorAll("svg > g rect")).map(
      (r) => r.getAttribute("fill"),
    );
    expect(fills.some((f) => f === "#FBD38D")).toBe(true);
    expect(fills.some((f) => f === "#90CDF4")).toBe(true);
  });

  it("hover-title carries percentage breakdown per value", () => {
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent,
    );
    expect(
      titles.some((t) => t?.includes("base:") && t?.includes("current:")),
    ).toBe(true);
    // The accessible title is also present.
    expect(titles).toContain(
      "Paired baseline and current categorical distribution",
    );
  });

  it("computeDiscreteSlots: counts and values length mismatch returns empty", () => {
    const broken: PairedHistogramDiscreteData = {
      values: ["a", "b"],
      baseCounts: [1, 2, 3],
      currentCounts: [1, 2, 3],
      baseTotal: 6,
      currentTotal: 6,
    };
    const { slots } = computeDiscreteSlots(broken);
    expect(slots).toEqual([]);
  });

  it("computeDiscreteSlots: empty values returns empty slots", () => {
    const { slots, maxProp } = computeDiscreteSlots({
      values: [],
      baseCounts: [],
      currentCounts: [],
      baseTotal: 0,
      currentTotal: 0,
    });
    expect(slots).toEqual([]);
    expect(maxProp).toBe(0);
  });

  it("computeDiscreteSlots: max proportion floors at 0.001 to avoid div-by-zero scales", () => {
    const tiny: PairedHistogramDiscreteData = {
      values: ["a"],
      baseCounts: [0],
      currentCounts: [0],
      baseTotal: 0,
      currentTotal: 0,
    };
    const { maxProp } = computeDiscreteSlots(tiny);
    expect(maxProp).toBeGreaterThan(0);
  });

  it("accepts className prop", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleData} className="my-cell" />,
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toBe(
      "my-cell",
    );
  });
});
