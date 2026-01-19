/**
 * @file schemaCells.test.tsx
 * @description Tests for Schema cell render functions
 *
 * Tests cover:
 * - renderIndexCell rendering logic for normal/added/removed rows
 * - renderTypeCell rendering logic and type change badges
 * - Accessibility attributes for type badges
 * - Null data handling
 */

import { render, screen } from "@testing-library/react";
import type { ICellRendererParams } from "ag-grid-community";
import React from "react";
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
import {
  MemoizedRenderIndexCell,
  MemoizedRenderTypeCell,
  renderIndexCell,
  renderTypeCell,
} from "../schemaCells";

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

/**
 * Creates a mock ICellRendererParams object for testing renderTypeCell
 */
function createTypeCellParams(
  data: {
    name?: string;
    currentIndex?: number;
    baseIndex?: number;
    currentType?: string;
    baseType?: string;
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
// renderTypeCell Tests
// ============================================================================

describe("renderTypeCell", () => {
  describe("type changed scenarios", () => {
    test("renders both badges when type changed", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(params)}</>);

      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.getByText("BIGINT")).toBeInTheDocument();
    });

    test("renders removed badge with correct class", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "VARCHAR",
        currentType: "TEXT",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      const removedBadge = container.querySelector(".type-badge-removed");
      expect(removedBadge).toBeInTheDocument();
      expect(removedBadge).toHaveTextContent("VARCHAR");
    });

    test("renders added badge with correct class", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "VARCHAR",
        currentType: "TEXT",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      const addedBadge = container.querySelector(".type-badge-added");
      expect(addedBadge).toBeInTheDocument();
      expect(addedBadge).toHaveTextContent("TEXT");
    });

    test("renders badges with title for accessibility", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(params)}</>);

      const integerBadge = screen.getByTitle("Base type: INTEGER");
      const bigintBadge = screen.getByTitle("Current type: BIGINT");

      expect(integerBadge).toBeInTheDocument();
      expect(bigintBadge).toBeInTheDocument();
    });
  });

  describe("added row scenarios", () => {
    test("renders currentType for added rows", () => {
      const params = createTypeCellParams({
        baseIndex: undefined,
        currentIndex: 3,
        baseType: undefined,
        currentType: "VARCHAR",
      });

      render(<>{renderTypeCell(params)}</>);

      expect(screen.getByText("VARCHAR")).toBeInTheDocument();
    });

    test("does not render badges for added rows", () => {
      const params = createTypeCellParams({
        baseIndex: undefined,
        currentIndex: 3,
        baseType: undefined,
        currentType: "VARCHAR",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      expect(container.querySelector(".type-badge")).not.toBeInTheDocument();
    });
  });

  describe("removed row scenarios", () => {
    test("renders baseType for removed rows", () => {
      const params = createTypeCellParams({
        baseIndex: 2,
        currentIndex: undefined,
        baseType: "DATE",
        currentType: undefined,
      });

      render(<>{renderTypeCell(params)}</>);

      expect(screen.getByText("DATE")).toBeInTheDocument();
    });

    test("does not render badges for removed rows", () => {
      const params = createTypeCellParams({
        baseIndex: 2,
        currentIndex: undefined,
        baseType: "DATE",
        currentType: undefined,
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      expect(container.querySelector(".type-badge")).not.toBeInTheDocument();
    });
  });

  describe("no change scenarios", () => {
    test("renders currentType when types are the same", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "BIGINT",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(params)}</>);

      expect(screen.getByText("BIGINT")).toBeInTheDocument();
    });

    test("does not render badges when types are the same", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "BIGINT",
        currentType: "BIGINT",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      expect(container.querySelector(".type-badge")).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    test("handles undefined baseType and currentType", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: undefined,
        currentType: undefined,
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      // Should render without crashing
      expect(container.querySelector("span")).toBeInTheDocument();
    });

    test("handles empty string types", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "",
        currentType: "VARCHAR",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      // Empty string vs non-empty should show type change with badges
      expect(screen.getByText("VARCHAR")).toBeInTheDocument();
      expect(container.querySelector(".type-badge")).toBeInTheDocument();

      // Verify both badge types are present when baseType differs from currentType
      const removedBadge = container.querySelector(".type-badge-removed");
      const addedBadge = container.querySelector(".type-badge-added");
      expect(removedBadge).toBeInTheDocument();
      expect(addedBadge).toBeInTheDocument();
      expect(addedBadge).toHaveTextContent("VARCHAR");
    });

    test("returns null when data is undefined", () => {
      const params = createTypeCellParams(null);

      const { container } = render(<>{renderTypeCell(params)}</>);
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

    test("renderTypeCell function execution performance", () => {
      const testData = Array.from({ length: ITERATIONS }, (_, i) =>
        createTypeCellParams({
          baseIndex: i,
          currentIndex: i,
          baseType: i % 2 === 0 ? "INTEGER" : "VARCHAR",
          currentType:
            i % 3 === 0 ? "BIGINT" : i % 2 === 0 ? "INTEGER" : "VARCHAR",
        }),
      );

      const startTime = performance.now();

      // Measure only function execution time, not DOM rendering
      testData.forEach((params) => {
        renderTypeCell(params);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / ITERATIONS;

      // Performance assertion: function execution should be very fast
      expect(avgTime).toBeLessThan(1);
    });

    test("MemoizedRenderIndexCell is properly memoized", () => {
      const params = createIndexCellParams({
        baseIndex: 1,
        currentIndex: 2,
      });

      // First render
      const { rerender } = render(
        React.createElement(MemoizedRenderIndexCell, params),
      );
      expect(screen.getByText("2")).toBeInTheDocument();

      // Re-render with same props (should not cause actual re-render due to memo)
      rerender(React.createElement(MemoizedRenderIndexCell, params));
      expect(screen.getByText("2")).toBeInTheDocument();

      // Verify the component is memoized
      expect(MemoizedRenderIndexCell).toHaveProperty(
        "$$typeof",
        Symbol.for("react.memo"),
      );
    });

    test("MemoizedRenderTypeCell is properly memoized", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      // First render
      const { rerender } = render(
        React.createElement(MemoizedRenderTypeCell, params),
      );
      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.getByText("BIGINT")).toBeInTheDocument();

      // Re-render with same props (should not cause actual re-render due to memo)
      rerender(React.createElement(MemoizedRenderTypeCell, params));
      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.getByText("BIGINT")).toBeInTheDocument();

      // Verify the component is memoized
      expect(MemoizedRenderTypeCell).toHaveProperty(
        "$$typeof",
        Symbol.for("react.memo"),
      );
    });
  });
});
