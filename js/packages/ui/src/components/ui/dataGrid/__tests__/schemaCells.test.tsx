/**
 * @file schemaCells.test.tsx
 * @description Tests for Schema cell render functions
 *
 * Tests cover:
 * - renderIndexCell rendering logic for normal/added/removed rows
 * - (renderTypeCell removed — type now shown inline in ColumnNameCell)
 * - Null data handling
 */

import { render, screen } from "@testing-library/react";
import type { ICellRendererParams } from "ag-grid-community";
import { vi } from "vitest";
import type { RowObjectType } from "../../../../api";

// Performance testing utilities
const performance = {
  now: () => Date.now(),
};

// ============================================================================
// Mocks - Must be defined before imports that use them
// ============================================================================

vi.mock("../../../schema/ColumnNameCell", () => ({
  ColumnNameCell: () => null,
}));

vi.mock("../../../../api/info", () => ({}));

// Import after mocks
import { renderIndexCell } from "../schemaCells";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock ICellRendererParams object for testing renderIndexCell
 */
function createIndexCellParams(
  data: {
    name?: string;
    currentIndex?: number;
    baseIndex?: number;
  } | null,
): ICellRendererParams<RowObjectType> {
  return {
    data: data
      ? {
          name: "test_column",
          ...data,
        }
      : undefined,
  } as ICellRendererParams<RowObjectType>;
}

// ============================================================================
// renderIndexCell Tests
// ============================================================================

describe("renderIndexCell", () => {
  test("renders currentIndex for normal rows (both base and current exist)", () => {
    const params = createIndexCellParams({
      baseIndex: 1,
      currentIndex: 2,
    });

    render(<>{renderIndexCell(params)}</>);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("renders currentIndex for added rows (only current exists)", () => {
    const params = createIndexCellParams({
      baseIndex: undefined,
      currentIndex: 5,
    });

    render(<>{renderIndexCell(params)}</>);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  test("renders baseIndex for removed rows (only base exists)", () => {
    const params = createIndexCellParams({
      baseIndex: 3,
      currentIndex: undefined,
    });

    render(<>{renderIndexCell(params)}</>);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("renders currentIndex when both indices are the same", () => {
    const params = createIndexCellParams({
      baseIndex: 4,
      currentIndex: 4,
    });

    render(<>{renderIndexCell(params)}</>);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  test("renders fallback when both indices are undefined", () => {
    const params = createIndexCellParams({
      baseIndex: undefined,
      currentIndex: undefined,
    });

    render(<>{renderIndexCell(params)}</>);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  test("returns null when data is undefined", () => {
    const params = createIndexCellParams(null);

    const { container } = render(<>{renderIndexCell(params)}</>);
    expect(container).toBeEmptyDOMElement();
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe("performance benchmarks", () => {
  const ITERATIONS = 1000;

  test("renderIndexCell function execution performance", () => {
    const testData = Array.from({ length: ITERATIONS }, (_, i) =>
      createIndexCellParams({
        baseIndex: i,
        currentIndex: i + 1,
      }),
    );

    const startTime = performance.now();

    // Measure only function execution time, not DOM rendering
    testData.forEach((params) => {
      renderIndexCell(params);
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / ITERATIONS;

    // Performance assertion: function execution should be very fast
    expect(avgTime).toBeLessThan(1);
  });
});
