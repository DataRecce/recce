import { render } from "@testing-library/react";
import {
  PairedHistogramContinuousCell,
  type PairedHistogramContinuousData,
} from "../PairedHistogramContinuousCell";

const sampleData: PairedHistogramContinuousData = {
  binEdges: [0, 100, 200, 300, 400],
  baseCounts: [10, 20, 15, 5],
  currentCounts: [12, 18, 18, 7],
  baseTotal: 50,
  currentTotal: 55,
};

describe("PairedHistogramContinuousCell", () => {
  it("renders one stacked bar group per bin", () => {
    const { container } = render(
      <PairedHistogramContinuousCell data={sampleData} />,
    );
    const groups = container.querySelectorAll("svg > g");
    expect(groups.length).toBe(sampleData.baseCounts.length);
    const rects = container.querySelectorAll("svg > g rect");
    expect(rects.length).toBeGreaterThan(0);
    // Each bin can contribute up to 2 rects (overlap + differential).
    expect(rects.length).toBeLessThanOrEqual(sampleData.baseCounts.length * 2);
  });

  it("uses shmellow only when base equals current per bin", () => {
    const equal: PairedHistogramContinuousData = {
      binEdges: [0, 1, 2, 3],
      baseCounts: [4, 8, 2],
      currentCounts: [4, 8, 2],
      baseTotal: 14,
      currentTotal: 14,
    };
    const { container } = render(
      <PairedHistogramContinuousCell data={equal} />,
    );
    const fills = Array.from(container.querySelectorAll("svg > g rect")).map(
      (r) => r.getAttribute("fill"),
    );
    expect(fills.every((f) => f === "#B5A99B")).toBe(true);
  });

  it("uses cell-density defaults when width and height are not provided", () => {
    const { container } = render(
      <PairedHistogramContinuousCell data={sampleData} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("140");
    expect(svg?.getAttribute("height")).toBe("36");
  });

  it("respects custom width and height", () => {
    const { container } = render(
      <PairedHistogramContinuousCell
        data={sampleData}
        width={240}
        height={92}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("240");
    expect(svg?.getAttribute("height")).toBe("92");
  });

  it("does not render endpoint labels by default", () => {
    const { container } = render(
      <PairedHistogramContinuousCell data={sampleData} />,
    );
    expect(container.querySelectorAll("text").length).toBe(0);
  });

  it("renders min and max labels when showEndpoints is true", () => {
    const { container } = render(
      <PairedHistogramContinuousCell data={sampleData} showEndpoints />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    // Default formatter renders integers verbatim.
    expect(texts).toEqual(["0", "400"]);
  });

  it("renders midpoint when showMidpoint is true", () => {
    const { container } = render(
      <PairedHistogramContinuousCell
        data={sampleData}
        showEndpoints
        showMidpoint
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(["0", "200", "400"]);
  });

  it("uses custom formatter when provided", () => {
    const { container } = render(
      <PairedHistogramContinuousCell
        data={sampleData}
        showEndpoints
        formatValue={(v) => `$${v}`}
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(["$0", "$400"]);
  });

  it("formats abbreviated values for thousand-scale endpoints", () => {
    const big: PairedHistogramContinuousData = {
      ...sampleData,
      binEdges: [0, 5000, 10000, 15000, 20000],
    };
    const { container } = render(
      <PairedHistogramContinuousCell data={big} showEndpoints />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(["0", "20.0K"]);
  });

  it("handles zero totals without dividing by zero", () => {
    const zeroData: PairedHistogramContinuousData = {
      binEdges: [0, 1, 2],
      baseCounts: [0, 0],
      currentCounts: [0, 0],
      baseTotal: 0,
      currentTotal: 0,
    };
    const { container } = render(
      <PairedHistogramContinuousCell data={zeroData} />,
    );
    expect(container.querySelectorAll("svg > g rect").length).toBe(0);
  });

  it("includes a descriptive accessible title", () => {
    const { container } = render(
      <PairedHistogramContinuousCell data={sampleData} />,
    );
    expect(container.querySelector("title")?.textContent).toBe(
      "Paired histogram (continuous)",
    );
  });
});
