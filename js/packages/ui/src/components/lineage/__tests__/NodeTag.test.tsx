/**
 * @file NodeTag.test.tsx
 * @description Tests for inline row-count summary components rendered inside
 * the NodeView Row Count action button.
 */

import { render, screen } from "@testing-library/react";
import type { RowCount, RowCountDiff } from "../../../api";
import { RowCountSummary } from "../NodeTag";

describe("RowCountSummary (single-env shape)", () => {
  test("renders 'N/A' when curr is null", () => {
    const rc: RowCount = { curr: null };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  test("renders thousands-separated count for plural rows", () => {
    const rc: RowCount = { curr: 99231 };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("99,231 rows")).toBeInTheDocument();
  });

  test("renders singular 'row' when count is 1", () => {
    const rc: RowCount = { curr: 1 };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("1 row")).toBeInTheDocument();
  });

  test("renders '0 rows' for empty result", () => {
    const rc: RowCount = { curr: 0 };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("0 rows")).toBeInTheDocument();
  });
});

describe("RowCountSummary (diff shape)", () => {
  test("renders 'Failed to load' when both base and curr are null", () => {
    const rc: RowCountDiff = { base: null, curr: null };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
  });

  test("renders base-only arrow when curr is null", () => {
    const rc: RowCountDiff = { base: 1000, curr: null };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("1,000 rows")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  test("renders curr-only arrow when base is null", () => {
    const rc: RowCountDiff = { base: null, curr: 1000 };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("1,000 rows")).toBeInTheDocument();
  });

  test("renders 'No Change' when base equals curr", () => {
    const rc: RowCountDiff = { base: 1200, curr: 1200 };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("1,200 rows")).toBeInTheDocument();
    expect(screen.getByText("No Change")).toBeInTheDocument();
  });

  test("renders increase delta when curr > base", () => {
    const rc: RowCountDiff = { base: 1000, curr: 1200 };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("1,200 rows")).toBeInTheDocument();
    expect(screen.getByText(/\+20/)).toBeInTheDocument();
  });

  test("renders decrease delta when curr < base", () => {
    const rc: RowCountDiff = { base: 1000, curr: 800 };
    render(<RowCountSummary rowCount={rc} />);
    expect(screen.getByText("800 rows")).toBeInTheDocument();
    expect(screen.getByText(/-20/)).toBeInTheDocument();
  });
});
