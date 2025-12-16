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

import { render, screen } from "@testing-library/react";
import { RowObjectType } from "@/lib/api/types";
import { asNumber, inlineRenderCell } from "./inlineRenderCell";

// ============================================================================
// Mocks
// ============================================================================

// Mock react-data-grid to avoid ES module parsing issues
jest.mock("react-data-grid", () => ({
  textEditor: jest.fn(),
}));

// Mock Chakra UI components
jest.mock("@chakra-ui/react", () => ({
  Flex: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="flex" {...props}>
      {children}
    </div>
  ),
  Text: ({
    children,
    style,
    ...props
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }) => (
    <span data-testid="text" style={style} {...props}>
      {children}
    </span>
  ),
}));

// Mock DiffText component
jest.mock("@/components/query/DiffText", () => ({
  DiffText: ({
    value,
    colorPalette,
    grayOut,
  }: {
    value: string;
    colorPalette: string;
    grayOut: boolean;
  }) => (
    <span
      data-testid={`diff-text-${colorPalette}`}
      data-grayout={grayOut.toString()}
    >
      {value}
    </span>
  ),
}));

// Mock Tooltip component
jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: string;
  }) => (
    <div data-testid="tooltip" data-content={content}>
      {children}
    </div>
  ),
}));

// Mock gridUtils
jest.mock("@/lib/dataGrid/shared/gridUtils", () => ({
  formatSmartDecimal: (value: number, maxDecimals = 2) => {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "∞" : "-∞";
    return value.toFixed(maxDecimals).replace(/\.?0+$/, "");
  },
  toRenderedValue: (
    row: Record<string, unknown>,
    key: string,
    columnType?: string,
    columnRenderMode?: unknown,
  ): [string, boolean] => {
    const value = row[key.toLowerCase()];
    if (value == null) return ["-", true];
    if (value === "") return ["(empty)", true];
    if (typeof value === "number") return [String(value), false];
    return [String(value), false];
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a row with base and current values
 */
function createRow(
  values: Record<string, unknown>,
  status?: "added" | "removed" | "modified",
): RowObjectType {
  return { ...values, __status: status } as RowObjectType;
}

/**
 * Creates a mock column for testing
 */
function createColumn(
  key: string,
  options: {
    columnType?: "number" | "integer" | "text";
    columnRenderMode?: "delta" | "percent" | "raw" | number;
  } = {},
) {
  return {
    key,
    idx: 0,
    name: key,
    width: 100,
    minWidth: 50,
    maxWidth: undefined,
    frozen: false,
    resizable: true,
    sortable: false,
    draggable: false,
    editable: false,
    columnType: options.columnType,
    columnRenderMode: options.columnRenderMode,
  };
}

/**
 * Renders inlineRenderCell with the provided row and column
 */
function renderCell(
  row: RowObjectType,
  column: ReturnType<typeof createColumn>,
) {
  const result = inlineRenderCell({
    row,
    column: column as never,
    rowIdx: 0,
    isCellEditable: false,
    tabIndex: 0,
    onRowChange: jest.fn(),
  });

  // Handle string return values (like "-")
  if (typeof result === "string") {
    return render(<span>{result}</span>);
  }

  return render(result as React.ReactElement);
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
// inlineRenderCell Tests - Basic Rendering
// ============================================================================

describe("inlineRenderCell", () => {
  describe("missing values", () => {
    test("returns dash when neither base nor current exist", () => {
      const row = createRow({ other: "value" });
      const column = createColumn("value");

      renderCell(row, column);

      expect(screen.getByText("-")).toBeInTheDocument();
    });
  });

  describe("unchanged values", () => {
    test("renders single value when base equals current", () => {
      const row = createRow({
        base__value: 100,
        current__value: 100,
      });
      const column = createColumn("value");

      renderCell(row, column);

      expect(screen.getByTestId("text")).toHaveTextContent("100");
    });
  });

  describe("changed values - inline diff", () => {
    test("renders base and current when values differ", () => {
      const row = createRow({
        base__value: 100,
        current__value: 200,
      });
      const column = createColumn("value");

      renderCell(row, column);

      expect(screen.getByTestId("diff-text-red")).toHaveTextContent("100");
      expect(screen.getByTestId("diff-text-green")).toHaveTextContent("200");
    });

    test("renders only base when current is missing", () => {
      const row = createRow({
        base__value: 100,
      });
      const column = createColumn("value");

      renderCell(row, column);

      expect(screen.getByTestId("diff-text-red")).toHaveTextContent("100");
      expect(screen.queryByTestId("diff-text-green")).not.toBeInTheDocument();
    });

    test("renders only current when base is missing", () => {
      const row = createRow({
        current__value: 200,
      });
      const column = createColumn("value");

      renderCell(row, column);

      expect(screen.queryByTestId("diff-text-red")).not.toBeInTheDocument();
      expect(screen.getByTestId("diff-text-green")).toHaveTextContent("200");
    });
  });

  describe("delta mode", () => {
    test("shows delta for numeric columns in delta mode", () => {
      const row = createRow({
        base__value: 100,
        current__value: 150,
      });
      const column = createColumn("value", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      renderCell(row, column);

      // Should show tooltip with delta information
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
      expect(screen.getByTestId("diff-text-green")).toHaveTextContent("150");
    });

    test("shows delta for integer columns in delta mode", () => {
      const row = createRow({
        base__value: 100,
        current__value: 150,
      });
      const column = createColumn("value", {
        columnType: "integer",
        columnRenderMode: "delta",
      });

      renderCell(row, column);

      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });

    test("falls back to diff when base is missing in delta mode", () => {
      const row = createRow({
        current__value: 150,
      });
      const column = createColumn("value", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      renderCell(row, column);

      // Should fall back to regular diff display (no tooltip)
      expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
      expect(screen.getByTestId("diff-text-green")).toBeInTheDocument();
    });

    test("falls back to diff when current is missing in delta mode", () => {
      const row = createRow({
        base__value: 100,
      });
      const column = createColumn("value", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      renderCell(row, column);

      expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
      expect(screen.getByTestId("diff-text-red")).toBeInTheDocument();
    });

    test("falls back to diff when values are not finite numbers", () => {
      const row = createRow({
        base__value: NaN,
        current__value: 100,
      });
      const column = createColumn("value", {
        columnType: "number",
        columnRenderMode: "delta",
      });

      renderCell(row, column);

      // NaN is not finite, should fall back to diff
      expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
    });

    test("does not show delta for text columns", () => {
      const row = createRow({
        base__value: "hello",
        current__value: "world",
      });
      const column = createColumn("value", {
        columnType: "text",
        columnRenderMode: "delta",
      });

      renderCell(row, column);

      // Text columns should not use delta mode
      expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
      expect(screen.getByTestId("diff-text-red")).toBeInTheDocument();
      expect(screen.getByTestId("diff-text-green")).toBeInTheDocument();
    });
  });

  describe("column key casing", () => {
    test("handles lowercase column keys", () => {
      const row = createRow({
        base__value: 100,
        current__value: 200,
      });
      const column = createColumn("value");

      renderCell(row, column);

      expect(screen.getByTestId("diff-text-red")).toBeInTheDocument();
      expect(screen.getByTestId("diff-text-green")).toBeInTheDocument();
    });

    test("converts uppercase column key to lowercase for lookup", () => {
      // The component lowercases the key, so row keys should be lowercase
      const row = createRow({
        base__value: 100,
        current__value: 200,
      });
      const column = createColumn("VALUE"); // Uppercase key

      renderCell(row, column);

      expect(screen.getByTestId("diff-text-red")).toBeInTheDocument();
      expect(screen.getByTestId("diff-text-green")).toBeInTheDocument();
    });
  });
});
