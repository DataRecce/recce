/**
 * @file PairedHistogramDiscrete.test.tsx
 * @description Tests for the top-K paired histogram cell with
 * gap-on-absent semantics (DRC-3390 PR 3).
 */

import { render } from "@testing-library/react";
import { vi } from "vitest";
import { useIsDark } from "../../../hooks/useIsDark";
import {
  computeDiscreteSlots,
  computeRanksSlots,
  PairedHistogramDiscrete,
  type PairedHistogramDiscreteData,
  type PairedHistogramDiscreteRanksData,
} from "../PairedHistogramDiscrete";

vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: vi.fn(() => false),
}));

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
    const width = 140;
    const { container } = render(
      <PairedHistogramDiscrete data={data} width={width} />,
    );
    const visibleRects = Array.from(
      container.querySelectorAll("svg > g rect"),
    ).filter((r) => r.getAttribute("fill") !== "none");
    // Only the current bar renders — no base bar means a visible gap on
    // the base side of the slot.
    expect(visibleRects.length).toBe(1);
    const rect = visibleRects[0];
    expect(rect.getAttribute("fill")).toBe("#63B3ED");
    // Current bar sits on the right half of its slot (slot midpoint = width / 2
    // when there's a single slot).
    const x = Number.parseFloat(rect.getAttribute("x") ?? "0");
    expect(x).toBeGreaterThan(width / 2);
  });

  it("leaves a gap when current side count is 0 — removed value", () => {
    const data: PairedHistogramDiscreteData = {
      values: ["legacy_only"],
      baseCounts: [10],
      currentCounts: [0],
      baseTotal: 10,
      currentTotal: 0,
    };
    const width = 140;
    const { container } = render(
      <PairedHistogramDiscrete data={data} width={width} />,
    );
    const visibleRects = Array.from(
      container.querySelectorAll("svg > g rect"),
    ).filter((r) => r.getAttribute("fill") !== "none");
    expect(visibleRects.length).toBe(1);
    const rect = visibleRects[0];
    expect(rect.getAttribute("fill")).toBe("#F6AD55");
    // Base bar sits on the left half of its slot.
    const x = Number.parseFloat(rect.getAttribute("x") ?? "0");
    expect(x).toBeLessThan(width / 2);
  });

  it("uses default cell-density dimensions when not provided", () => {
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("140");
    expect(svg?.getAttribute("height")).toBe("28");
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

  it("renders a chip-style background rect behind the trimmed marker so it stays legible over tall bars", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={{ ...sampleData, trimmed: true }} />,
    );
    const bg = container.querySelector("[data-testid='trimmed-marker-bg']");
    expect(bg).toBeInTheDocument();
    expect(bg?.tagName.toLowerCase()).toBe("rect");
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
    // Hit-target rects (fill="none") still render so users can
    // hover; no visible bar fills.
    const visible = Array.from(container.querySelectorAll("svg > g rect"))
      .map((r) => r.getAttribute("fill"))
      .filter((f) => f && f !== "none");
    expect(visible.length).toBe(0);
  });

  it("dark theme uses the dark palette", () => {
    vi.mocked(useIsDark).mockReturnValueOnce(true);
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
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

  it("computeDiscreteSlots: max proportion floors above zero to avoid div-by-zero scales", () => {
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

// ---------------------------------------------------------------------
// Ranks mode — rank-only rendering (DuckDB `approx_top_k` path)
// ---------------------------------------------------------------------

const sampleRanks: PairedHistogramDiscreteRanksData = {
  mode: "ranks",
  values: ["alpha", "beta", "gamma", "delta", "epsilon"],
  baseRanks: [1, 2, 3, 4, 5],
  currentRanks: [1, 2, 3, 4, 5],
  k: 5,
};

describe("PairedHistogramDiscrete — ranks mode", () => {
  it("renders one group per value in ranks mode", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleRanks} />,
    );
    const groups = container.querySelectorAll("svg > g");
    expect(groups.length).toBe(sampleRanks.values.length);
  });

  it("stable ranks produce matching base+current bar heights", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleRanks} />,
    );
    // For each slot we expect one hit-target (fill=none) + one base bar
    // + one current bar of equal height. Group rects by slot index.
    const groups = container.querySelectorAll("svg > g");
    for (const group of Array.from(groups)) {
      const visible = Array.from(group.querySelectorAll("rect")).filter(
        (r) => r.getAttribute("fill") !== "none",
      );
      expect(visible.length).toBe(2);
      const h0 = Number.parseFloat(visible[0].getAttribute("height") ?? "0");
      const h1 = Number.parseFloat(visible[1].getAttribute("height") ?? "0");
      expect(h0).toBeCloseTo(h1);
    }
  });

  it("rank 1 bar is taller than rank k bar", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleRanks} />,
    );
    const groups = container.querySelectorAll("svg > g");
    // First group renders rank 1; last group renders rank k.
    const firstBars = Array.from(groups[0].querySelectorAll("rect")).filter(
      (r) => r.getAttribute("fill") !== "none",
    );
    const lastBars = Array.from(
      groups[groups.length - 1].querySelectorAll("rect"),
    ).filter((r) => r.getAttribute("fill") !== "none");
    const firstH = Number.parseFloat(
      firstBars[0].getAttribute("height") ?? "0",
    );
    const lastH = Number.parseFloat(lastBars[0].getAttribute("height") ?? "0");
    expect(firstH).toBeGreaterThan(lastH);
  });

  it("value present only in base top-K: no current bar", () => {
    const data: PairedHistogramDiscreteRanksData = {
      mode: "ranks",
      values: ["base_only"],
      baseRanks: [2],
      currentRanks: [null],
      k: 5,
    };
    const width = 140;
    const { container } = render(
      <PairedHistogramDiscrete data={data} width={width} />,
    );
    const visible = Array.from(
      container.querySelectorAll("svg > g rect"),
    ).filter((r) => r.getAttribute("fill") !== "none");
    // Only base bar drawn — orange palette in light theme.
    expect(visible.length).toBe(1);
    expect(visible[0].getAttribute("fill")).toBe("#F6AD55");
    // Base bar sits on the left half of its slot.
    const x = Number.parseFloat(visible[0].getAttribute("x") ?? "0");
    expect(x).toBeLessThan(width / 2);
  });

  it("value present only in current top-K: no base bar, sits on the right of the chart", () => {
    const data: PairedHistogramDiscreteRanksData = {
      mode: "ranks",
      values: ["base_a", "base_b", "current_only"],
      baseRanks: [1, 2, null],
      currentRanks: [1, 2, 3],
      k: 5,
    };
    const width = 150;
    const { container } = render(
      <PairedHistogramDiscrete data={data} width={width} />,
    );
    // The current-only slot is the last group (rightmost).
    const groups = container.querySelectorAll("svg > g");
    const lastBars = Array.from(
      groups[groups.length - 1].querySelectorAll("rect"),
    ).filter((r) => r.getAttribute("fill") !== "none");
    expect(lastBars.length).toBe(1);
    expect(lastBars[0].getAttribute("fill")).toBe("#63B3ED");
    // And the slot itself is on the right two-thirds of the chart.
    const lastSlotX = Number.parseFloat(lastBars[0].getAttribute("x") ?? "0");
    expect(lastSlotX).toBeGreaterThan(width * (2 / 3));
  });

  it("tooltip shows both ranks when present", () => {
    const { container } = render(
      <PairedHistogramDiscrete data={sampleRanks} />,
    );
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent ?? "",
    );
    expect(
      titles.some(
        (t) => t.includes("base rank:") && t.includes("current rank:"),
      ),
    ).toBe(true);
  });

  it("tooltip says 'not in current top-K' when current rank is null", () => {
    const data: PairedHistogramDiscreteRanksData = {
      mode: "ranks",
      values: ["only_in_base"],
      baseRanks: [1],
      currentRanks: [null],
      k: 5,
    };
    const { container } = render(<PairedHistogramDiscrete data={data} />);
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent ?? "",
    );
    expect(titles.some((t) => t.includes("not in current top-K"))).toBe(true);
  });

  it("tooltip says 'not in base top-K' when base rank is null", () => {
    const data: PairedHistogramDiscreteRanksData = {
      mode: "ranks",
      values: ["only_in_current"],
      baseRanks: [null],
      currentRanks: [2],
      k: 5,
    };
    const { container } = render(<PairedHistogramDiscrete data={data} />);
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent ?? "",
    );
    expect(titles.some((t) => t.includes("not in base top-K"))).toBe(true);
  });

  it("ranks-mode trimmed marker renders", () => {
    const { queryByText } = render(
      <PairedHistogramDiscrete data={{ ...sampleRanks, trimmed: true }} />,
    );
    expect(queryByText("trimmed")).toBeInTheDocument();
  });

  it("computeRanksSlots: empty values returns empty slots", () => {
    const { slots } = computeRanksSlots({
      mode: "ranks",
      values: [],
      baseRanks: [],
      currentRanks: [],
      k: 5,
    });
    expect(slots).toEqual([]);
  });

  it("computeRanksSlots: rank arrays length mismatch returns empty", () => {
    const { slots } = computeRanksSlots({
      mode: "ranks",
      values: ["a", "b"],
      baseRanks: [1],
      currentRanks: [1, 2],
      k: 5,
    });
    expect(slots).toEqual([]);
  });

  it("computeRanksSlots: slot ordering — base-first then current-only appended", () => {
    // The compute function preserves the caller's order; this test
    // documents that contract (Stage B is the one that bakes in the
    // base-first / current-only-appended ordering).
    const data: PairedHistogramDiscreteRanksData = {
      mode: "ranks",
      values: ["a", "b", "c", "new_d"],
      baseRanks: [1, 2, 3, null],
      currentRanks: [1, 3, null, 2],
      k: 4,
    };
    const { slots } = computeRanksSlots(data);
    expect(slots.map((s) => s.value)).toEqual(["a", "b", "c", "new_d"]);
    // First slot has both ranks set; third slot has no current bar
    // (currRank null); fourth slot has no base bar (baseRank null).
    expect(slots[0]).toEqual({ value: "a", baseRank: 1, currRank: 1 });
    expect(slots[2]).toEqual({ value: "c", baseRank: 3, currRank: null });
    expect(slots[3]).toEqual({ value: "new_d", baseRank: null, currRank: 2 });
  });

  it("computeRanksSlots: drops entries absent from both sides defensively", () => {
    const { slots } = computeRanksSlots({
      mode: "ranks",
      values: ["a", "ghost", "b"],
      baseRanks: [1, null, 2],
      currentRanks: [1, null, 2],
      k: 3,
    });
    expect(slots.map((s) => s.value)).toEqual(["a", "b"]);
  });

  it("counts-mode payload without explicit mode still renders bars (back-compat)", () => {
    // Existing callers don't pass `mode`; that path must keep working.
    const { container } = render(<PairedHistogramDiscrete data={sampleData} />);
    const groups = container.querySelectorAll("svg > g");
    expect(groups.length).toBe(sampleData.values.length);
  });
});

// ---------------------------------------------------------------------
// formatValue — `values: unknown[]` contract seam (Stage B → Stage C)
// ---------------------------------------------------------------------

describe("PairedHistogramDiscrete — formatValue", () => {
  it("applies default formatter (`String(v)`) when no formatValue prop is given", () => {
    const data: PairedHistogramDiscreteData = {
      values: [null, 42, "a"],
      baseCounts: [10, 20, 30],
      currentCounts: [12, 18, 35],
      baseTotal: 60,
      currentTotal: 65,
    };
    const { container } = render(<PairedHistogramDiscrete data={data} />);
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent ?? "",
    );
    // Default `String(v)` produces "null", "42", "a" verbatim in the
    // tooltip prefix. These would be a wrapper's job to prettify in
    // Stage C; the cell just round-trips whatever the formatter returns.
    expect(titles.some((t) => t.includes("null ["))).toBe(true);
    expect(titles.some((t) => t.includes("42 ["))).toBe(true);
    expect(titles.some((t) => t.includes("a ["))).toBe(true);
  });

  it("applies custom formatValue prop to labels", () => {
    const data: PairedHistogramDiscreteData = {
      values: [null],
      baseCounts: [10],
      currentCounts: [12],
      baseTotal: 10,
      currentTotal: 12,
    };
    const { container } = render(
      <PairedHistogramDiscrete
        data={data}
        showLabels
        formatValue={() => "∅"}
      />,
    );
    // Visible label uses the formatted string.
    const labels = Array.from(container.querySelectorAll("svg g text")).map(
      (t) => t.textContent,
    );
    expect(labels).toContain("∅");
    // And so does the per-bar hover title (prefix).
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent ?? "",
    );
    expect(titles.some((t) => t.startsWith("∅ ["))).toBe(true);
  });

  it("default formatter handles boolean / number / string / null values without crashing", () => {
    const data: PairedHistogramDiscreteData = {
      values: ["s", 7, true, null, 1_500_000],
      baseCounts: [1, 2, 3, 4, 5],
      currentCounts: [5, 4, 3, 2, 1],
      baseTotal: 15,
      currentTotal: 15,
    };
    expect(() => render(<PairedHistogramDiscrete data={data} />)).not.toThrow();
  });
});
