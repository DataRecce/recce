/**
 * @file distributionCellRenderer.test.tsx
 * @description Tests for `createDistributionCellRenderer` — the per-row cell
 * the schema grid actually invokes for the Distribution column. The leaf cell's
 * state machine is covered in InlineProfileDistributionCell.test.tsx; this pins
 * the wiring the grid depends on: per-column payload lookup, the
 * `isLoading && !payload` pending logic (the "Profile all columns" widening
 * keeps already-profiled columns on screen while new ones load), the run-level
 * pending/error state being confined to the columns the run actually requested
 * (`scopedColumns`), and the `currentType ?? baseType` fallback for removed
 * columns.
 */

import { render, screen } from "@testing-library/react";
import type { ICellRendererParams } from "ag-grid-community";
import { describe, expect, test, vi } from "vitest";
import type {
  ProfileDistributionColumnPayload,
  ProfileDistributionHistogramPayload,
} from "../../../../api";
import type { SchemaDiffRow } from "../../../../lib/dataGrid/generators/toSchemaDataGrid";
import { CONTINUOUS_ARIA_LABEL } from "../../../data/PairedHistogramCanvas";
import {
  createDistributionCellRenderer,
  type SchemaDistributionData,
} from "../schemaCells";

vi.mock("../../../../hooks/useIsDark", () => ({
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

// A date-typed histogram whose edges are epoch seconds (2021-01-01 onward), so
// the tooltips read as dates only if the column type reaches the formatter.
const dateHistogram: ProfileDistributionHistogramPayload = {
  ...histogram,
  base_bin_edges: histogram.base_bin_edges.map(
    (_, i) => 1609459200 + i * 86400,
  ),
  current_bin_edges: histogram.current_bin_edges.map(
    (_, i) => 1609459200 + i * 86400,
  ),
};

function row(over: Partial<SchemaDiffRow>): SchemaDiffRow {
  return { name: "amount", ...over } as SchemaDiffRow;
}

function params(
  data: SchemaDiffRow | undefined,
): ICellRendererParams<SchemaDiffRow> {
  return { data } as unknown as ICellRendererParams<SchemaDiffRow>;
}

function distribution(
  over: Partial<SchemaDistributionData> & {
    payloads?: Record<string, ProfileDistributionColumnPayload>;
  } = {},
): SchemaDistributionData {
  return {
    payloads: {},
    baseTotal: 0,
    currentTotal: 0,
    isLoading: false,
    hasError: false,
    ...over,
  };
}

describe("createDistributionCellRenderer", () => {
  test("renders the histogram for a column that has a payload", () => {
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: { amount: histogram } }),
    );
    render(<>{renderer(params(row({ name: "amount" })))}</>);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      CONTINUOUS_ARIA_LABEL,
    );
  });

  test("shows the pending dot for a column with no payload while the run loads", () => {
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: {}, isLoading: true }),
    );
    render(<>{renderer(params(row({ name: "amount" })))}</>);
    expect(
      screen.getByTestId("inline-distribution-pending"),
    ).toBeInTheDocument();
  });

  test("keeps an already-profiled column rendered while a wider run loads (no pending flash)", () => {
    // The "Profile all columns" widening sets isLoading on the run, but columns
    // that already have a payload must NOT flip back to a pending dot.
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: { amount: histogram }, isLoading: true }),
    );
    render(<>{renderer(params(row({ name: "amount" })))}</>);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(
      screen.queryByTestId("inline-distribution-pending"),
    ).not.toBeInTheDocument();
  });

  test("renders a blank cell for a column with no payload once the run has settled", () => {
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: {}, isLoading: false }),
    );
    const { container } = render(
      <>{renderer(params(row({ name: "amount" })))}</>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("surfaces a run-level error in every column's cell when the run covered all columns", () => {
    // No scopedColumns => the run profiled every column, so a run-level failure
    // belongs to all of them.
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: {}, hasError: true }),
    );
    render(<>{renderer(params(row({ name: "amount" })))}</>);
    expect(screen.getByTestId("inline-distribution-error")).toBeInTheDocument();
  });

  test("shows a run-level error only on columns the scoped run requested", () => {
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: {}, hasError: true, scopedColumns: ["amount"] }),
    );
    render(<>{renderer(params(row({ name: "amount" })))}</>);
    expect(screen.getByTestId("inline-distribution-error")).toBeInTheDocument();
  });

  test("marks a column 'not profiled' (no error icon) when it was outside the scoped run", () => {
    // The run failed, but it only ever requested `amount`; `quantity` was never
    // part of the run, so it shows the faint not-profiled dash, not an error.
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: {}, hasError: true, scopedColumns: ["amount"] }),
    );
    render(<>{renderer(params(row({ name: "quantity" })))}</>);
    expect(
      screen.getByTestId("inline-distribution-not-profiled"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("inline-distribution-error"),
    ).not.toBeInTheDocument();
  });

  test("shows the not-profiled dash, not a pending dot, on a column outside the scoped run", () => {
    const renderer = createDistributionCellRenderer(
      distribution({
        payloads: {},
        isLoading: true,
        scopedColumns: ["amount"],
      }),
    );
    render(<>{renderer(params(row({ name: "quantity" })))}</>);
    expect(
      screen.getByTestId("inline-distribution-not-profiled"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("inline-distribution-pending"),
    ).not.toBeInTheDocument();
  });

  test("falls back to baseType for a removed column so datetime edges still format as dates", () => {
    // A removed column has no currentType; the renderer must pass baseType as
    // the column type or the histogram tooltips degrade to bare epoch integers.
    const renderer = createDistributionCellRenderer(
      distribution({ payloads: { amount: dateHistogram } }),
    );
    const { container } = render(
      <>
        {renderer(
          params(
            row({ name: "amount", baseType: "date", currentType: undefined }),
          ),
        )}
      </>,
    );
    const titles = Array.from(container.querySelectorAll("title")).map(
      (t) => t.textContent ?? "",
    );
    expect(titles.some((t) => t.includes("2021"))).toBe(true);
  });

  test("returns null when the row data is missing", () => {
    const renderer = createDistributionCellRenderer(distribution());
    expect(renderer(params(undefined))).toBeNull();
  });
});
