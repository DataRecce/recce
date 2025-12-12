/**
 * @file schemaCells.test.tsx
 * @description Tests for Schema cell render functions
 *
 * Tests cover:
 * - renderIndexCell rendering logic for normal/added/removed rows
 * - renderTypeCell rendering logic and type change badges
 * - Accessibility attributes for type badges
 */

import { render, screen } from "@testing-library/react";
import React from "react";

// Performance testing utilities
const performance = {
  now: () => Date.now(),
};

// ============================================================================
// Mocks - Must be defined before imports that use them
// ============================================================================

jest.mock("react-data-grid", () => ({
  __esModule: true,
}));

jest.mock("@/components/schema/ColumnNameCell", () => ({
  ColumnNameCell: () => null,
}));

jest.mock("@/lib/api/info", () => ({}));

// Import after mocks
import {
  MemoizedRenderTypeCell,
  renderIndexCell,
  renderTypeCell,
} from "./schemaCells";

// ============================================================================
// Test Helpers
// ============================================================================

// Extract the expected props type from the actual function signatures
type IndexCellProps = Parameters<typeof renderIndexCell>[0];
type TypeCellProps = Parameters<typeof renderTypeCell>[0];

/**
 * Creates a mock RenderCellProps object for testing renderIndexCell
 */
function createIndexCellProps(row: {
  name?: string;
  currentIndex?: number;
  baseIndex?: number;
}): IndexCellProps {
  return {
    row: {
      name: "test_column",
      __status: undefined,
      ...row,
    },
    rowIdx: 0,
    column: {} as IndexCellProps["column"],
    isCellEditable: false,
    tabIndex: 0,
    onRowChange: jest.fn(),
  };
}

/**
 * Creates a mock RenderCellProps object for testing renderTypeCell
 */
function createTypeCellProps(row: {
  name?: string;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
}): TypeCellProps {
  return {
    row: {
      name: "test_column",
      __status: undefined,
      ...row,
    },
    rowIdx: 0,
    column: {} as TypeCellProps["column"],
    isCellEditable: false,
    tabIndex: 0,
    onRowChange: jest.fn(),
  };
}

// ============================================================================
// renderIndexCell Tests
// ============================================================================

describe("renderIndexCell", () => {
  test("renders currentIndex for normal rows (both base and current exist)", () => {
    const props = createIndexCellProps({
      baseIndex: 1,
      currentIndex: 2,
    });

    render(<>{renderIndexCell(props)}</>);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("renders currentIndex for added rows (only current exists)", () => {
    const props = createIndexCellProps({
      baseIndex: undefined,
      currentIndex: 5,
    });

    render(<>{renderIndexCell(props)}</>);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  test("renders baseIndex for removed rows (only base exists)", () => {
    const props = createIndexCellProps({
      baseIndex: 3,
      currentIndex: undefined,
    });

    render(<>{renderIndexCell(props)}</>);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("renders currentIndex when both indices are the same", () => {
    const props = createIndexCellProps({
      baseIndex: 4,
      currentIndex: 4,
    });

    render(<>{renderIndexCell(props)}</>);
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

// ============================================================================
// renderTypeCell Tests
// ============================================================================

describe("renderTypeCell", () => {
  describe("type changed scenarios", () => {
    test("renders both badges when type changed", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(props)}</>);

      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.getByText("BIGINT")).toBeInTheDocument();
    });

    test("renders removed badge with correct class", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "VARCHAR",
        currentType: "TEXT",
      });

      const { container } = render(<>{renderTypeCell(props)}</>);

      const removedBadge = container.querySelector(".type-badge-removed");
      expect(removedBadge).toBeInTheDocument();
      expect(removedBadge).toHaveTextContent("VARCHAR");
    });

    test("renders added badge with correct class", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "VARCHAR",
        currentType: "TEXT",
      });

      const { container } = render(<>{renderTypeCell(props)}</>);

      const addedBadge = container.querySelector(".type-badge-added");
      expect(addedBadge).toBeInTheDocument();
      expect(addedBadge).toHaveTextContent("TEXT");
    });

    test("renders badges with title for accessibility", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(props)}</>);

      const integerBadge = screen.getByTitle("Base type: INTEGER");
      const bigintBadge = screen.getByTitle("Current type: BIGINT");

      expect(integerBadge).toBeInTheDocument();
      expect(bigintBadge).toBeInTheDocument();
    });
  });

  describe("added row scenarios", () => {
    test("renders currentType for added rows", () => {
      const props = createTypeCellProps({
        baseIndex: undefined,
        currentIndex: 3,
        baseType: undefined,
        currentType: "VARCHAR",
      });

      render(<>{renderTypeCell(props)}</>);

      expect(screen.getByText("VARCHAR")).toBeInTheDocument();
    });

    test("does not render badges for added rows", () => {
      const props = createTypeCellProps({
        baseIndex: undefined,
        currentIndex: 3,
        baseType: undefined,
        currentType: "VARCHAR",
      });

      const { container } = render(<>{renderTypeCell(props)}</>);

      expect(container.querySelector(".type-badge")).not.toBeInTheDocument();
    });
  });

  describe("removed row scenarios", () => {
    test("renders baseType for removed rows", () => {
      const props = createTypeCellProps({
        baseIndex: 2,
        currentIndex: undefined,
        baseType: "DATE",
        currentType: undefined,
      });

      render(<>{renderTypeCell(props)}</>);

      expect(screen.getByText("DATE")).toBeInTheDocument();
    });

    test("does not render badges for removed rows", () => {
      const props = createTypeCellProps({
        baseIndex: 2,
        currentIndex: undefined,
        baseType: "DATE",
        currentType: undefined,
      });

      const { container } = render(<>{renderTypeCell(props)}</>);

      expect(container.querySelector(".type-badge")).not.toBeInTheDocument();
    });
  });

  describe("no change scenarios", () => {
    test("renders currentType when types are the same", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "BIGINT",
        currentType: "BIGINT",
      });

      render(<>{renderTypeCell(props)}</>);

      expect(screen.getByText("BIGINT")).toBeInTheDocument();
    });

    test("does not render badges when types are the same", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "BIGINT",
        currentType: "BIGINT",
      });

      const { container } = render(<>{renderTypeCell(props)}</>);

      expect(container.querySelector(".type-badge")).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    test("handles undefined baseType and currentType", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: undefined,
        currentType: undefined,
      });

      const { container } = render(<>{renderTypeCell(props)}</>);

      // Should render without crashing
      expect(container.querySelector("span")).toBeInTheDocument();
    });

    test("handles empty string types", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "",
        currentType: "VARCHAR",
      });

      render(<>{renderTypeCell(props)}</>);

      // Empty string vs non-empty should show type change
      expect(screen.getByText("VARCHAR")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe("performance benchmarks", () => {
    const ITERATIONS = 1000;

    test("renderIndexCell function execution performance", () => {
      const testData = Array.from({ length: ITERATIONS }, (_, i) =>
        createIndexCellProps({
          baseIndex: i,
          currentIndex: i + 1,
        }),
      );

      const startTime = performance.now();

      // Measure only function execution time, not DOM rendering
      testData.forEach((props) => {
        renderIndexCell(props);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / ITERATIONS;

      // Performance assertion: function execution should be very fast
      expect(avgTime).toBeLessThan(1);
    });

    test("renderTypeCell function execution performance", () => {
      const testData = Array.from({ length: ITERATIONS }, (_, i) =>
        createTypeCellProps({
          baseIndex: i,
          currentIndex: i,
          baseType: i % 2 === 0 ? "INTEGER" : "VARCHAR",
          currentType:
            i % 3 === 0 ? "BIGINT" : i % 2 === 0 ? "INTEGER" : "VARCHAR",
        }),
      );

      const startTime = performance.now();

      // Measure only function execution time, not DOM rendering
      testData.forEach((props) => {
        renderTypeCell(props);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / ITERATIONS;

      // Performance assertion: function execution should be very fast
      expect(avgTime).toBeLessThan(1);
    });

    test("React.memo prevents unnecessary re-renders", () => {
      const props = createTypeCellProps({
        baseIndex: 1,
        currentIndex: 1,
        baseType: "INTEGER",
        currentType: "BIGINT",
      });

      // First render
      const { rerender } = render(
        React.createElement(MemoizedRenderTypeCell, props),
      );
      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.getByText("BIGINT")).toBeInTheDocument();

      // Re-render with same props (should not cause actual re-render due to memo)
      rerender(React.createElement(MemoizedRenderTypeCell, props));
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
