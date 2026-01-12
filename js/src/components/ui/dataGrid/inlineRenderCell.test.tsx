/**
 * @file inlineRenderCell.test.tsx
 * @description Tests for inline diff cell renderer
 *
 * Tests cover:
 * - asNumber helper function
 * - inlineRenderCell component rendering
 * - Delta mode display
 * - Diff display (base vs current)
 */

import type {
  ColumnRenderMode,
  ColumnType,
  RowObjectType,
} from "@datarecce/ui/api";
import { type ColDefWithMetadata } from "@datarecce/ui/components/ui/dataGrid/defaultRenderCell";
import {
  asNumber,
  inlineRenderCell,
} from "@datarecce/ui/components/ui/dataGrid/inlineRenderCell";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import type { ICellRendererParams } from "ag-grid-community";
import type { ReactNode } from "react";

// Create a minimal theme for testing
const theme = createTheme({
  palette: {
    mode: "light",
  },
});

// ============================================================================
// Test Wrapper
// ============================================================================

/**
 * Test wrapper that provides MUI ThemeProvider context
 */
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

/**
 * Custom render function that includes providers
 */
function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock row object with required __status property
 */
function createRow(data: Record<string, unknown>): RowObjectType {
  return {
    __status: undefined,
    ...data,
  } as RowObjectType;
}

/**
 * Creates a mock column definition for testing
 * Using ColDefWithMetadata which includes columnType and columnRenderMode
 */
function createMockColDef(
  field: string,
  options: {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } = {},
): ColDefWithMetadata {
  return {
    field,
    headerName: field,
    context: {
      columnType: options.columnType,
      columnRenderMode: options.columnRenderMode,
    },
  };
}

/**
 * Renders inlineRenderCell with provided row and column configuration
 */
function renderInlineCell(
  rowData: Record<string, unknown>,
  columnField: string,
  options: {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } = {},
) {
  const row = createRow(rowData);
  const colDef = createMockColDef(columnField, options);

  // Create mock ICellRendererParams
  const params = {
    data: row,
    colDef,
    value: row[columnField],
  } as ICellRendererParams<RowObjectType>;

  const element = inlineRenderCell(params);

  return renderWithProviders(<>{element}</>);
}

// ============================================================================
// asNumber Tests
// ============================================================================

describe("asNumber", () => {
  describe("number input", () => {
    test("returns number as-is", () => {
      expect(asNumber(123)).toBe(123);
    });

    test("returns negative number as-is", () => {
      expect(asNumber(-456)).toBe(-456);
    });

    test("returns decimal number as-is", () => {
      expect(asNumber(123.456)).toBe(123.456);
    });

    test("returns zero as-is", () => {
      expect(asNumber(0)).toBe(0);
    });

    test("returns negative zero as-is", () => {
      expect(asNumber(-0)).toBe(-0);
    });

    test("returns NaN as-is", () => {
      expect(Number.isNaN(asNumber(NaN))).toBe(true);
    });

    test("returns Infinity as-is", () => {
      expect(asNumber(Infinity)).toBe(Infinity);
    });

    test("returns negative Infinity as-is", () => {
      expect(asNumber(-Infinity)).toBe(-Infinity);
    });
  });

  describe("string input", () => {
    test("parses numeric string", () => {
      expect(asNumber("123")).toBe(123);
    });

    test("parses decimal string", () => {
      expect(asNumber("123.456")).toBe(123.456);
    });

    test("parses negative string", () => {
      expect(asNumber("-456")).toBe(-456);
    });

    test("parses string with leading whitespace", () => {
      expect(asNumber("  123")).toBe(123);
    });

    test("parses string with trailing whitespace", () => {
      expect(asNumber("123  ")).toBe(123);
    });

    test("returns 0 for non-numeric string", () => {
      expect(asNumber("abc")).toBe(0);
    });

    test("returns 0 for empty string", () => {
      expect(asNumber("")).toBe(0);
    });

    test("parses string starting with number", () => {
      // parseFloat stops at first non-numeric character
      expect(asNumber("123abc")).toBe(123);
    });

    test("returns 0 for string starting with non-number", () => {
      expect(asNumber("abc123")).toBe(0);
    });

    test("parses scientific notation string", () => {
      expect(asNumber("1.5e10")).toBe(1.5e10);
    });

    test("parses Infinity string", () => {
      expect(asNumber("Infinity")).toBe(Infinity);
    });

    test("parses negative Infinity string", () => {
      expect(asNumber("-Infinity")).toBe(-Infinity);
    });
  });

  describe("other types", () => {
    test("returns 0 for null", () => {
      expect(asNumber(null as never)).toBe(0);
    });

    test("returns 0 for undefined", () => {
      expect(asNumber(undefined as never)).toBe(0);
    });

    test("returns 0 for boolean true", () => {
      expect(asNumber(true as never)).toBe(0);
    });

    test("returns 0 for boolean false", () => {
      expect(asNumber(false as never)).toBe(0);
    });

    test("returns 0 for object", () => {
      expect(asNumber({} as never)).toBe(0);
    });

    test("returns 0 for array", () => {
      expect(asNumber([] as never)).toBe(0);
    });
  });
});

// ============================================================================
// inlineRenderCell Tests - No Values
// ============================================================================

describe("inlineRenderCell", () => {
  describe("when neither base nor current values exist", () => {
    test("returns dash for missing column data", () => {
      const row = { id: 1, other_column: "value" };
      renderInlineCell(row, "missing_column");

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    test("returns dash for empty row", () => {
      const row = {};
      renderInlineCell(row, "any_column");

      expect(screen.getByText("-")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // inlineRenderCell Tests - Equal Values
  // ============================================================================

  describe("when base and current values are equal", () => {
    test("renders single value for matching strings", () => {
      const row = {
        base__name: "John",
        current__name: "John",
      };
      renderInlineCell(row, "name");

      expect(screen.getByText("John")).toBeInTheDocument();
      // Should only show once (not in DiffText components)
      expect(screen.queryAllByText("John")).toHaveLength(1);
    });

    test("renders single value for matching numbers", () => {
      const row = {
        base__amount: 100,
        current__amount: 100,
      };
      renderInlineCell(row, "amount", { columnType: "number" });

      expect(screen.getByText("100")).toBeInTheDocument();
    });

    test("renders single value for matching null values", () => {
      const row = {
        base__value: null,
        current__value: null,
      };
      renderInlineCell(row, "value");

      // Null values are rendered as "-"
      expect(screen.getByText("-")).toBeInTheDocument();
    });

    test("renders grayed out text for null values", () => {
      const row = {
        base__value: null,
        current__value: null,
      };
      const { container } = renderInlineCell(row, "value");

      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
      // Check that the span has gray color style
      expect(span).toHaveAttribute("style", expect.stringContaining("gray"));
    });
  });

  // ============================================================================
  // inlineRenderCell Tests - Delta Mode
  // ============================================================================

  describe("delta mode with numeric columns", () => {
    test("renders positive delta for increased values", () => {
      const row = {
        base__count: 100,
        current__count: 150,
      };
      renderInlineCell(row, "count", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Should show current value
      expect(screen.getByText("150")).toBeInTheDocument();
      // Should show positive delta
      expect(screen.getByText("(+50)")).toBeInTheDocument();
    });

    test("renders negative delta for decreased values", () => {
      const row = {
        base__count: 200,
        current__count: 150,
      };
      renderInlineCell(row, "count", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Should show current value
      expect(screen.getByText("150")).toBeInTheDocument();
      // Should show negative delta
      expect(screen.getByText("(-50)")).toBeInTheDocument();
    });

    test("renders zero delta when values are equal", () => {
      const row = {
        base__count: 100,
        current__count: 100,
      };
      // Note: When values are equal, it renders single value, not delta
      renderInlineCell(row, "count", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Should show single value (no delta display for equal values)
      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.queryByText("(+0)")).not.toBeInTheDocument();
    });

    test("handles zero base value (avoids division by zero)", () => {
      const row = {
        base__count: 0,
        current__count: 50,
      };
      renderInlineCell(row, "count", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Should show current value and delta
      expect(screen.getByText("50")).toBeInTheDocument();
      expect(screen.getByText("(+50)")).toBeInTheDocument();
    });

    test("works with integer column type", () => {
      const row = {
        base__id: 10,
        current__id: 15,
      };
      renderInlineCell(row, "id", {
        columnType: "integer",
        columnRenderMode: "delta",
      });

      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("(+5)")).toBeInTheDocument();
    });

    test("works with string numeric values", () => {
      const row = {
        base__amount: "100.50",
        current__amount: "200.75",
      };
      renderInlineCell(row, "amount", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      expect(screen.getByText("200.75")).toBeInTheDocument();
      expect(screen.getByText("(+100.25)")).toBeInTheDocument();
    });

    test("formats decimal values with smart decimals", () => {
      const row = {
        base__price: 10.1,
        current__price: 10.25,
      };
      renderInlineCell(row, "price", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      expect(screen.getByText("10.25")).toBeInTheDocument();
      expect(screen.getByText("(+0.15)")).toBeInTheDocument();
    });

    test("falls back to standard diff for non-numeric column types in delta mode", () => {
      const row = {
        base__status: "active",
        current__status: "inactive",
      };
      renderInlineCell(row, "status", {
        columnType: "text",
        columnRenderMode: "delta",
      });

      // Should render as standard diff (both values shown)
      expect(screen.getByText("active")).toBeInTheDocument();
      expect(screen.getByText("inactive")).toBeInTheDocument();
    });

    test("falls back to standard diff when only base exists", () => {
      const row = {
        base__count: 100,
      };
      renderInlineCell(row, "count", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Should show only base value (no delta calculation possible)
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    test("falls back to standard diff when only current exists", () => {
      const row = {
        current__count: 150,
      };
      renderInlineCell(row, "count", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Should show only current value
      expect(screen.getByText("150")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // inlineRenderCell Tests - Standard Diff Display
  // ============================================================================

  describe("standard diff display (values differ)", () => {
    test("renders both base and current when values differ", () => {
      const row = {
        base__name: "John",
        current__name: "Jane",
      };
      renderInlineCell(row, "name");

      expect(screen.getByText("John")).toBeInTheDocument();
      expect(screen.getByText("Jane")).toBeInTheDocument();
    });

    test("renders only base value when current is missing", () => {
      const row = {
        base__name: "John",
      };
      renderInlineCell(row, "name");

      expect(screen.getByText("John")).toBeInTheDocument();
      expect(screen.queryByText("Jane")).not.toBeInTheDocument();
    });

    test("renders only current value when base is missing", () => {
      const row = {
        current__name: "Jane",
      };
      renderInlineCell(row, "name");

      expect(screen.getByText("Jane")).toBeInTheDocument();
      expect(screen.queryByText("John")).not.toBeInTheDocument();
    });

    test("handles null to value change", () => {
      const row = {
        base__status: null,
        current__status: "active",
      };
      renderInlineCell(row, "status");

      // Null values are rendered as "-"
      expect(screen.getByText("-")).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
    });

    test("handles value to null change", () => {
      const row = {
        base__status: "active",
        current__status: null,
      };
      renderInlineCell(row, "status");

      expect(screen.getByText("active")).toBeInTheDocument();
      // Null values are rendered as "-"
      expect(screen.getByText("-")).toBeInTheDocument();
    });

    test("renders numeric values correctly", () => {
      const row = {
        base__price: 99.99,
        current__price: 149.99,
      };
      renderInlineCell(row, "price", { columnType: "number" });

      expect(screen.getByText("99.99")).toBeInTheDocument();
      expect(screen.getByText("149.99")).toBeInTheDocument();
    });

    test("handles case-insensitive column key matching", () => {
      // The component lowercases the keys
      const row = {
        base__name: "John",
        current__name: "Jane",
      };
      renderInlineCell(row, "NAME");

      expect(screen.getByText("John")).toBeInTheDocument();
      expect(screen.getByText("Jane")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // inlineRenderCell Tests - Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    test("handles empty string values", () => {
      const row = {
        base__name: "",
        current__name: "Jane",
      };
      renderInlineCell(row, "name");

      // Empty string should be rendered (possibly as empty DiffText)
      expect(screen.getByText("Jane")).toBeInTheDocument();
    });

    test("handles boolean values", () => {
      const row = {
        base__active: true,
        current__active: false,
      };
      renderInlineCell(row, "active", { columnType: "boolean" });

      expect(screen.getByText("true")).toBeInTheDocument();
      expect(screen.getByText("false")).toBeInTheDocument();
    });

    test("handles very large numbers in delta mode", () => {
      const row = {
        base__amount: 1000000,
        current__amount: 2500000,
      };
      renderInlineCell(row, "amount", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Large numbers are formatted with thousand separators
      expect(screen.getByText("2,500,000")).toBeInTheDocument();
      expect(screen.getByText("(+1,500,000)")).toBeInTheDocument();
    });

    test("handles negative numbers in delta mode", () => {
      const row = {
        base__balance: -100,
        current__balance: -50,
      };
      renderInlineCell(row, "balance", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      // Change from -100 to -50 is an increase of 50
      expect(screen.getByText("-50")).toBeInTheDocument();
      expect(screen.getByText("(+50)")).toBeInTheDocument();
    });

    test("handles decimal precision in delta calculations", () => {
      const row = {
        base__rate: 0.123,
        current__rate: 0.456,
      };
      renderInlineCell(row, "rate", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      expect(screen.getByText("0.46")).toBeInTheDocument();
      expect(screen.getByText("(+0.33)")).toBeInTheDocument();
    });
  });
});
