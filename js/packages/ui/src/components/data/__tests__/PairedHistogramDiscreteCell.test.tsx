import { render } from "@testing-library/react";
import {
  PairedHistogramDiscreteCell,
  type PairedHistogramDiscreteData,
} from "../PairedHistogramDiscreteCell";

const sampleData: PairedHistogramDiscreteData = {
  values: ["US", "GB", "DE"],
  baseCounts: [100, 50, 25],
  currentCounts: [110, 40, 35],
  baseTotal: 175,
  currentTotal: 185,
};

describe("PairedHistogramDiscreteCell", () => {
  it("renders one stacked bar group per value", () => {
    const { container } = render(
      <PairedHistogramDiscreteCell data={sampleData} />,
    );
    // Each slot renders a <g> with 1–2 <rect> children: a shmellow overlap
    // segment (min(base, curr)) and an optional differential segment in the
    // dominant side's color.
    const groups = container.querySelectorAll("svg > g");
    expect(groups.length).toBe(sampleData.values.length);
    const rects = container.querySelectorAll("svg > g rect");
    expect(rects.length).toBeGreaterThan(0);
    expect(rects.length).toBeLessThanOrEqual(sampleData.values.length * 2);
  });

  it("renders only a shmellow segment when base equals current", () => {
    const equalData = {
      values: ["a", "b"],
      baseCounts: [10, 5],
      currentCounts: [10, 5],
      baseTotal: 15,
      currentTotal: 15,
    };
    const { container } = render(
      <PairedHistogramDiscreteCell data={equalData} />,
    );
    const fills = Array.from(container.querySelectorAll("svg > g rect")).map(
      (r) => r.getAttribute("fill"),
    );
    // Every segment is shmellow; no base/current differential anywhere.
    expect(fills.every((f) => f === "#B5A99B")).toBe(true);
    expect(fills.length).toBe(equalData.values.length);
  });

  it("renders a current-color differential when current proportion exceeds base", () => {
    // slot a: base prop 0.1, curr prop 0.5 → shmellow up to 0.1, blue 0.1→0.5
    const data = {
      values: ["a", "b"],
      baseCounts: [10, 90],
      currentCounts: [50, 50],
      baseTotal: 100,
      currentTotal: 100,
    };
    const { container } = render(<PairedHistogramDiscreteCell data={data} />);
    const fills = Array.from(container.querySelectorAll("svg > g rect")).map(
      (r) => r.getAttribute("fill"),
    );
    expect(fills).toContain("#B5A99B"); // overlap segment(s)
    expect(fills).toContain("#63B3ED"); // current differential on slot a
    expect(fills).toContain("#F6AD55"); // base differential on slot b
  });

  it("renders a base-color differential when base proportion exceeds current", () => {
    // slot a: base prop 0.9, curr prop 0.5 → shmellow up to 0.5, base 0.5→0.9
    const data = {
      values: ["a"],
      baseCounts: [90, 10],
      currentCounts: [50, 50],
      baseTotal: 100,
      currentTotal: 100,
    };
    const { container } = render(<PairedHistogramDiscreteCell data={data} />);
    const fills = Array.from(container.querySelectorAll("svg > g rect")).map(
      (r) => r.getAttribute("fill"),
    );
    expect(fills).toContain("#F6AD55");
  });

  it("renders a single solid current segment when base is zero (added)", () => {
    const data = {
      values: ["a"],
      baseCounts: [0],
      currentCounts: [10],
      baseTotal: 0,
      currentTotal: 10,
    };
    const { container } = render(<PairedHistogramDiscreteCell data={data} />);
    const fills = Array.from(container.querySelectorAll("svg > g rect")).map(
      (r) => r.getAttribute("fill"),
    );
    // No overlap (min height = 0), only the differential blue rect.
    expect(fills).toEqual(["#63B3ED"]);
  });

  it("uses default cell-density width and height when not provided", () => {
    const { container } = render(
      <PairedHistogramDiscreteCell data={sampleData} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("140");
    expect(svg?.getAttribute("height")).toBe("36");
  });

  it("respects custom width and height", () => {
    const { container } = render(
      <PairedHistogramDiscreteCell data={sampleData} width={220} height={100} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("220");
    expect(svg?.getAttribute("height")).toBe("100");
  });

  it("does not render value labels when showLabels is false", () => {
    const { container } = render(
      <PairedHistogramDiscreteCell data={sampleData} />,
    );
    expect(container.querySelectorAll("text").length).toBe(0);
  });

  it("renders one label per value when showLabels is true", () => {
    const { container } = render(
      <PairedHistogramDiscreteCell data={sampleData} showLabels />,
    );
    const labels = container.querySelectorAll("text");
    expect(labels.length).toBe(sampleData.values.length);
    expect(Array.from(labels).map((l) => l.textContent)).toEqual([
      "US",
      "GB",
      "DE",
    ]);
  });

  it("truncates labels longer than labelMaxChars", () => {
    const longData: PairedHistogramDiscreteData = {
      ...sampleData,
      values: ["United States", "Great Britain", "Germany"],
    };
    const { container } = render(
      <PairedHistogramDiscreteCell data={longData} showLabels labelMaxChars={4} />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    // Truncated to 3 visible chars + ellipsis = 4 chars total.
    for (const t of texts) {
      expect(t?.length).toBeLessThanOrEqual(4);
      expect(t?.endsWith("…")).toBe(true);
    }
  });

  it("renders trimmed marker when trimmed prop is set", () => {
    const { container, queryByText } = render(
      <PairedHistogramDiscreteCell data={sampleData} trimmed />,
    );
    expect(queryByText("trimmed")).toBeInTheDocument();
    expect(container.querySelector("title")?.textContent).toBe(
      "Paired histogram (discrete)",
    );
  });

  it("does not render trimmed marker by default", () => {
    const { queryByText } = render(
      <PairedHistogramDiscreteCell data={sampleData} />,
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
    const { container } = render(<PairedHistogramDiscreteCell data={zeroData} />);
    // No segments render when both sides are zero.
    expect(container.querySelectorAll("svg > g rect").length).toBe(0);
  });
});
