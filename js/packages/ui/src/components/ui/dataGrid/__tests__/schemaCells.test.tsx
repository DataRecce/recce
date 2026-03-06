/**
 * @file schemaCells.test.tsx
 * @description Tests for Schema cell render functions
 *
 * Tests cover:
 * - renderIndexCell rendering logic for normal/added/removed rows
 * - renderTypeCell rendering logic with DataTypeIcon
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

vi.mock("../../DataTypeIcon", () => ({
  DataTypeIcon: ({ type, size }: { type: string; size?: number }) => (
    <span data-testid="data-type-icon" data-type={type} data-size={size}>
      <svg />
    </span>
  ),
}));

// Import after mocks
import { renderIndexCell, renderTypeCell } from "../schemaCells";

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
    test("renders both DataTypeIcons when type changed", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(params)}</>);

      const icons = screen.getAllByTestId("data-type-icon");
      expect(icons).toHaveLength(2);
      expect(icons[0]).toHaveAttribute("data-type", "INTEGER");
      expect(icons[1]).toHaveAttribute("data-type", "BIGINT");
    });

    test("renders old type with correct class containing DataTypeIcon", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "VARCHAR",
        currentType: "TEXT",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      const oldType = container.querySelector(".schema-type-old");
      expect(oldType).toBeInTheDocument();
      expect(oldType?.querySelector("svg")).toBeInTheDocument();
    });

    test("renders new type with correct class containing DataTypeIcon", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "VARCHAR",
        currentType: "TEXT",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      const newType = container.querySelector(".schema-type-new");
      expect(newType).toBeInTheDocument();
      expect(newType?.querySelector("svg")).toBeInTheDocument();
    });

    test("DataTypeIcon receives correct type props in badges", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(params)}</>);

      const icons = screen.getAllByTestId("data-type-icon");
      expect(icons[0]).toHaveAttribute("data-type", "INTEGER");
      expect(icons[1]).toHaveAttribute("data-type", "BIGINT");
    });
  });

  describe("added row scenarios", () => {
    test("renders DataTypeIcon with currentType for added rows", () => {
      const params = createTypeCellParams({
        baseIndex: undefined,
        currentIndex: 3,
        baseType: undefined,
        currentType: "VARCHAR",
      });

      render(<>{renderTypeCell(params)}</>);

      const icon = screen.getByTestId("data-type-icon");
      expect(icon).toHaveAttribute("data-type", "VARCHAR");
    });

    test("does not render type-change classes for added rows", () => {
      const params = createTypeCellParams({
        baseIndex: undefined,
        currentIndex: 3,
        baseType: undefined,
        currentType: "VARCHAR",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      expect(
        container.querySelector(".schema-type-old"),
      ).not.toBeInTheDocument();
    });
  });

  describe("removed row scenarios", () => {
    test("renders DataTypeIcon with baseType for removed rows", () => {
      const params = createTypeCellParams({
        baseIndex: 2,
        currentIndex: undefined,
        baseType: "DATE",
        currentType: undefined,
      });

      render(<>{renderTypeCell(params)}</>);

      const icon = screen.getByTestId("data-type-icon");
      expect(icon).toHaveAttribute("data-type", "DATE");
    });

    test("does not render type-change classes for removed rows", () => {
      const params = createTypeCellParams({
        baseIndex: 2,
        currentIndex: undefined,
        baseType: "DATE",
        currentType: undefined,
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      expect(
        container.querySelector(".schema-type-old"),
      ).not.toBeInTheDocument();
    });
  });

  describe("no change scenarios", () => {
    test("renders DataTypeIcon when types are the same", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "BIGINT",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(params)}</>);

      const icon = screen.getByTestId("data-type-icon");
      expect(icon).toHaveAttribute("data-type", "BIGINT");
    });

    test("does not render type-change classes when types are the same", () => {
      const params = createTypeCellParams({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "BIGINT",
        currentType: "BIGINT",
      });

      const { container } = render(<>{renderTypeCell(params)}</>);

      expect(
        container.querySelector(".schema-type-old"),
      ).not.toBeInTheDocument();
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

      // Empty baseType is falsy, so old type span is not rendered
      expect(
        container.querySelector(".schema-type-old"),
      ).not.toBeInTheDocument();

      // New type should contain a DataTypeIcon
      const newType = container.querySelector(".schema-type-new");
      expect(newType).toBeInTheDocument();
      expect(newType?.querySelector("svg")).toBeInTheDocument();
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
  });
});
