/**
 * @file InlineProfileDistributionCell.test.tsx
 * @description Tests for the Compact-mode schema-row integration cell
 * that wraps the four states a column can be in (DRC-3390 PR 3).
 */

import { render } from "@testing-library/react";
import type {
  ProfileDistributionHistogramPayload,
  ProfileDistributionNullPayload,
  ProfileDistributionTopKPayload,
} from "../../../api/types/run";
import { InlineProfileDistributionCell } from "../InlineProfileDistributionCell";

const histogramPayload: ProfileDistributionHistogramPayload = {
  kind: "histogram",
  bin_edges: [0, 10, 25, 50, 80, 120, 165, 220, 290, 400, 600, 1000],
  base_density: [
    0.01, 0.02, 0.04, 0.06, 0.08, 0.07, 0.05, 0.03, 0.015, 0.005, 0.001,
  ],
  current_density: [
    0.02, 0.03, 0.045, 0.055, 0.085, 0.065, 0.04, 0.025, 0.012, 0.006, 0.0015,
  ],
  base_total: 10_000,
  current_total: 12_000,
};

const topKPayload: ProfileDistributionTopKPayload = {
  kind: "topk",
  values: ["US", "GB", "DE"],
  base_counts: [100, 50, 25],
  current_counts: [110, 40, 35],
  base_total: 175,
  current_total: 185,
  trimmed: false,
};

const nullPayload: ProfileDistributionNullPayload = {
  kind: null,
  reason: "column query failed",
};

describe("InlineProfileDistributionCell", () => {
  it("renders the loading state when loading is true", () => {
    const { getByTestId, queryByTestId } = render(
      <InlineProfileDistributionCell loading />,
    );
    expect(
      getByTestId("inline-profile-distribution-loading"),
    ).toBeInTheDocument();
    expect(
      queryByTestId("inline-profile-distribution-continuous"),
    ).not.toBeInTheDocument();
  });

  it("renders the error state when error is non-null", () => {
    const err = new Error("server returned 500");
    const { getByTestId } = render(
      <InlineProfileDistributionCell error={err} />,
    );
    expect(
      getByTestId("inline-profile-distribution-error"),
    ).toBeInTheDocument();
  });

  it("renders the empty state when payload is undefined", () => {
    const { getByTestId } = render(<InlineProfileDistributionCell />);
    expect(
      getByTestId("inline-profile-distribution-empty"),
    ).toBeInTheDocument();
  });

  it("renders the empty state when payload.kind === null (per-column failure)", () => {
    const { getByTestId, queryByTestId } = render(
      <InlineProfileDistributionCell payload={nullPayload} />,
    );
    expect(
      getByTestId("inline-profile-distribution-empty"),
    ).toBeInTheDocument();
    // Crucially: no spinner. Per-column failure ≠ loading.
    expect(
      queryByTestId("inline-profile-distribution-loading"),
    ).not.toBeInTheDocument();
  });

  it("renders the continuous chart when payload.kind === 'histogram'", () => {
    const { getByTestId } = render(
      <InlineProfileDistributionCell payload={histogramPayload} />,
    );
    expect(
      getByTestId("inline-profile-distribution-continuous"),
    ).toBeInTheDocument();
  });

  it("renders the discrete chart when payload.kind === 'topk'", () => {
    const { getByTestId } = render(
      <InlineProfileDistributionCell payload={topKPayload} />,
    );
    expect(
      getByTestId("inline-profile-distribution-discrete"),
    ).toBeInTheDocument();
  });

  it("passes the trimmed flag through to the discrete cell", () => {
    const { container } = render(
      <InlineProfileDistributionCell
        payload={{ ...topKPayload, trimmed: true }}
      />,
    );
    expect(container.textContent).toContain("trimmed");
  });

  it("loading takes precedence over a stale payload (no flicker)", () => {
    const { getByTestId, queryByTestId } = render(
      <InlineProfileDistributionCell payload={histogramPayload} loading />,
    );
    expect(
      getByTestId("inline-profile-distribution-loading"),
    ).toBeInTheDocument();
    expect(
      queryByTestId("inline-profile-distribution-continuous"),
    ).not.toBeInTheDocument();
  });

  it("error takes precedence over an existing payload", () => {
    const { getByTestId, queryByTestId } = render(
      <InlineProfileDistributionCell
        payload={topKPayload}
        error={new Error("backend exploded")}
      />,
    );
    expect(
      getByTestId("inline-profile-distribution-error"),
    ).toBeInTheDocument();
    expect(
      queryByTestId("inline-profile-distribution-discrete"),
    ).not.toBeInTheDocument();
  });

  it("forwards width and height to the underlying chart", () => {
    const { container } = render(
      <InlineProfileDistributionCell
        payload={histogramPayload}
        width={220}
        height={64}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("220");
    expect(svg?.getAttribute("height")).toBe("64");
  });
});
