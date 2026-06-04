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

  it("renders a failed-to-read error icon with a specifying tooltip on run-level error", () => {
    const { getByTestId } = render(<InlineProfileDistributionCell hasError />);
    const marker = getByTestId("inline-distribution-error");
    expect(marker).toBeInTheDocument();
    // Tooltip (and aria-label) spell out what failed, not a bare dash.
    expect(marker).toHaveAttribute("title", "Failed to read distribution");
    expect(marker).toHaveAttribute("aria-label", "Failed to read distribution");
    // An actual icon, not a text glyph.
    expect(marker.querySelector("svg")).toBeInTheDocument();
  });

  it("renders nothing when there is no payload", () => {
    const { container } = render(<InlineProfileDistributionCell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a per-column failure icon with a column-scoped tooltip for a null payload", () => {
    const { getByTestId } = render(
      <InlineProfileDistributionCell payload={{ kind: null }} />,
    );
    const marker = getByTestId("inline-distribution-column-failure");
    expect(marker).toBeInTheDocument();
    expect(marker).toHaveAttribute(
      "title",
      "Failed to read distribution for this column",
    );
    expect(marker.querySelector("svg")).toBeInTheDocument();
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

  it("formats TIME histogram edges as HH:MM:SS clock times, not dates", () => {
    // The backend's epoch() cast emits seconds-since-midnight for TIME, so the
    // tooltip must read as a clock time — never the bogus "Jan 1, 1970" a
    // calendar-date formatter would produce (DRC-3390 review note 1).
    const timeHistogram: ProfileDistributionHistogramPayload = {
      ...histogram,
      // 00:00:00, 01:00:00, 02:00:00, ... (whole hours past midnight)
      base_bin_edges: histogram.base_bin_edges.map((_, i) => i * 3600),
      current_bin_edges: histogram.current_bin_edges.map((_, i) => i * 3600),
    };
    const { container } = render(
      <InlineProfileDistributionCell
        payload={timeHistogram}
        columnType="time"
      />,
    );
    const titles = Array.from(container.querySelectorAll("title")).map(
      (t) => t.textContent ?? "",
    );
    // A clock time appears; the 1970 epoch-date never does.
    expect(titles.some((t) => /\d{2}:\d{2}:\d{2}/.test(t))).toBe(true);
    expect(titles.some((t) => t.includes("1970"))).toBe(false);
  });

  it("still date-formats TIMESTAMP (not treated as time-of-day)", () => {
    // `timestamp` contains the substring "time" but must NOT be read as a clock
    // time — its edges are real epoch seconds.
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
        columnType="timestamp without time zone"
      />,
    );
    const titles = Array.from(container.querySelectorAll("title")).map(
      (t) => t.textContent ?? "",
    );
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
