/**
 * @file InlineProfileDistributionCell.test.tsx
 * @description Tests for the Stage C schema-grid cell container (DRC-3390).
 * Covers the state machine: loading / error / empty / per-column failure /
 * histogram / topk (ranks + counts).
 */

import { render } from "@testing-library/react";
import { vi } from "vitest";
import type {
  ProfileDistributionHistogramPayload,
  ProfileDistributionTopKPayload,
  ProfileDistributionTopKRanksPayload,
} from "../../../api";
import { InlineProfileDistributionCell } from "../InlineProfileDistributionCell";
import {
  CONTINUOUS_ARIA_LABEL,
  DISCRETE_ARIA_LABEL,
} from "../PairedHistogramCanvas";

vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: vi.fn(() => false),
}));

const histogram: ProfileDistributionHistogramPayload = {
  kind: "histogram",
  base_bin_edges: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  current_bin_edges: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33],
  base_density: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
  current_density: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
  base_total: 100,
  current_total: 120,
};

const topkRanks: ProfileDistributionTopKRanksPayload = {
  kind: "topk",
  mode: "ranks",
  values: ["active", "pending", "done"],
  base_ranks: [1, 2, 3],
  current_ranks: [1, 3, null],
  k: 12,
  trimmed: false,
};

const topkCounts: ProfileDistributionTopKPayload = {
  kind: "topk",
  mode: "counts",
  values: ["US", "GB", "DE"],
  base_counts: [50, 30, null],
  current_counts: [40, 35, 10],
  trimmed: false,
};

describe("InlineProfileDistributionCell", () => {
  it("renders a pending dot while loading", () => {
    const { getByTestId, queryByRole } = render(
      <InlineProfileDistributionCell isLoading />,
    );
    expect(getByTestId("inline-distribution-pending")).toBeInTheDocument();
    expect(queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders an error marker on run-level error", () => {
    const { getByTestId } = render(<InlineProfileDistributionCell hasError />);
    expect(getByTestId("inline-distribution-error")).toBeInTheDocument();
  });

  it("renders nothing when there is no payload", () => {
    const { container } = render(<InlineProfileDistributionCell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a per-column failure marker for a null payload", () => {
    const { getByTestId } = render(
      <InlineProfileDistributionCell payload={{ kind: null }} />,
    );
    expect(
      getByTestId("inline-distribution-column-failure"),
    ).toBeInTheDocument();
  });

  it("renders the continuous cell for a histogram payload", () => {
    const { getByRole } = render(
      <InlineProfileDistributionCell payload={histogram} />,
    );
    expect(getByRole("img")).toHaveAttribute(
      "aria-label",
      CONTINUOUS_ARIA_LABEL,
    );
  });

  it("renders the discrete cell for a topk ranks payload", () => {
    const { getByRole } = render(
      <InlineProfileDistributionCell payload={topkRanks} />,
    );
    expect(getByRole("img")).toHaveAttribute("aria-label", DISCRETE_ARIA_LABEL);
  });

  it("renders the discrete cell for a topk counts payload", () => {
    const { getByRole } = render(
      <InlineProfileDistributionCell
        payload={topkCounts}
        baseTotal={80}
        currentTotal={85}
      />,
    );
    expect(getByRole("img")).toHaveAttribute("aria-label", DISCRETE_ARIA_LABEL);
  });

  it("formats datetime histogram edges as dates in tooltips", () => {
    // 2021-01-01 .. 2021-ish epoch seconds — the tooltip should read as a
    // date, not a raw number, when the column type is a timestamp.
    const datetimeHistogram: ProfileDistributionHistogramPayload = {
      ...histogram,
      base_bin_edges: histogram.base_bin_edges.map(
        (_, i) => 1609459200 + i * 86400,
      ),
      current_bin_edges: histogram.current_bin_edges.map(
        (_, i) => 1609459200 + i * 86400,
      ),
    };
    const { container } = render(
      <InlineProfileDistributionCell
        payload={datetimeHistogram}
        columnType="timestamp"
      />,
    );
    const titles = Array.from(container.querySelectorAll("title")).map(
      (t) => t.textContent ?? "",
    );
    // At least one tooltip mentions the year — i.e. it was date-formatted,
    // not left as a bare epoch integer.
    expect(titles.some((t) => t.includes("2021"))).toBe(true);
  });

  it("renders an empty frame (no bars) for a degenerate empty topk slot", () => {
    const emptyRanks: ProfileDistributionTopKRanksPayload = {
      kind: "topk",
      mode: "ranks",
      values: [],
      base_ranks: [],
      current_ranks: [],
      k: 12,
      trimmed: false,
    };
    const { getByRole } = render(
      <InlineProfileDistributionCell payload={emptyRanks} />,
    );
    // Still renders the SVG frame so the row layout stays stable.
    expect(getByRole("img")).toHaveAttribute("aria-label", DISCRETE_ARIA_LABEL);
  });
});
