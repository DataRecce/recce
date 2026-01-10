/**
 * @file inlineRenderCell.test.tsx
 * @description Tests for inline diff cell renderer
 *
 * Tests cover:
 * - Single value rendering when base equals current
 * - Diff rendering when values differ
 * - Delta mode for numeric columns
 * - Custom DiffText component injection
 * - asNumber utility function
 */

import { render, screen } from "@testing-library/react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import React from "react";
import type { RowObjectType } from "../../../../api";
import {
  asNumber,
  createInlineRenderCell,
  inlineRenderCell,
} from "../inlineRenderCell";

// ============================================================================
// Helper Functions
// ============================================================================

interface RecceColumnContext {
  columnType?: string;
  columnRenderMode?: string | number;
}

type ColDefWithMetadata = ColDef<RowObjectType> & {
  context?: RecceColumnContext;
};

function createParams(
  data: Partial<RowObjectType> | undefined,
  colDef: ColDefWithMetadata,
): ICellRendererParams<RowObjectType> {
  // Ensure __status is present as required by RowObjectType
  const fullData: RowObjectType | undefined = data
    ? { __status: undefined, ...data }
    : undefined;

  return {
    data: fullData,
    colDef,
    value: undefined,
    node: undefined,
    api: undefined,
    rowIndex: 0,
    column: undefined,
    eGridCell: document.createElement("div"),
    getValue: jest.fn(),
    setValue: jest.fn(),
    formatValue: jest.fn(),
    refreshCell: jest.fn(),
    registerRowDragger: jest.fn(),
    setTooltip: jest.fn(),
  } as unknown as ICellRendererParams<RowObjectType>;
}

// ============================================================================
// asNumber Tests
// ============================================================================

describe("asNumber", () => {
  test("returns number as-is", () => {
    expect(asNumber(42)).toBe(42);
    expect(asNumber(3.14)).toBe(3.14);
    expect(asNumber(-10)).toBe(-10);
  });

  test("parses string to number", () => {
    expect(asNumber("42")).toBe(42);
    expect(asNumber("3.14")).toBe(3.14);
    expect(asNumber("-10")).toBe(-10);
  });

  test("returns 0 for non-numeric strings", () => {
    expect(asNumber("hello")).toBe(0);
    expect(asNumber("")).toBe(0);
  });

  test("returns 0 for non-numeric types", () => {
    expect(asNumber(null as unknown as string)).toBe(0);
    expect(asNumber(undefined as unknown as string)).toBe(0);
    expect(asNumber(true as unknown as number)).toBe(0);
  });

  test("handles NaN input", () => {
    expect(asNumber(NaN)).toBe(NaN);
    expect(Number.isNaN(asNumber(NaN))).toBe(true);
  });
});

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe("inlineRenderCell - Basic Rendering", () => {
  test("renders null when data is undefined", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams(undefined, colDef);

    const result = inlineRenderCell(params);

    expect(result).toBeNull();
  });

  test("renders dash when neither base nor current exists", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({}, colDef);

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  test("renders single value when base equals current", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams(
      { base__price: 100, current__price: 100 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

// ============================================================================
// Diff Rendering Tests
// ============================================================================

describe("inlineRenderCell - Diff Rendering", () => {
  test("renders both values when they differ", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams(
      { base__price: 100, current__price: 150 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    // Both values should be present via DiffText
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  test("renders only current when base is missing", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams({ current__price: 150 }, colDef);

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("150")).toBeInTheDocument();
  });

  test("renders only base when current is missing", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams({ base__price: 100 }, colDef);

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

// ============================================================================
// Delta Mode Tests
// ============================================================================

describe("inlineRenderCell - Delta Mode", () => {
  test("shows delta for numeric columns in delta mode", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number", columnRenderMode: "delta" },
    };
    const params = createParams(
      { base__price: 100, current__price: 150 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    // Current value should be shown
    expect(screen.getByText("150")).toBeInTheDocument();
    // Delta should be shown as (+50)
    expect(screen.getByText("(+50)")).toBeInTheDocument();
  });

  test("shows negative delta correctly", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number", columnRenderMode: "delta" },
    };
    const params = createParams(
      { base__price: 150, current__price: 100 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("(-50)")).toBeInTheDocument();
  });

  test("handles zero base value in delta mode", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number", columnRenderMode: "delta" },
    };
    const params = createParams(
      { base__price: 0, current__price: 100 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("(+100)")).toBeInTheDocument();
  });
});

// ============================================================================
// createInlineRenderCell Tests
// ============================================================================

describe("createInlineRenderCell", () => {
  test("creates renderer with default DiffText", () => {
    const renderer = createInlineRenderCell();
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({ base__value: 1, current__value: 2 }, colDef);

    render(<>{renderer(params)}</>);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("accepts custom DiffText component", () => {
    const CustomDiffText = ({ value }: { value: string }) => (
      <span data-testid="custom-diff">[{value}]</span>
    );

    const renderer = createInlineRenderCell({
      DiffTextComponent: CustomDiffText,
    });
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({ base__value: 1, current__value: 2 }, colDef);

    render(<>{renderer(params)}</>);

    const customElements = screen.getAllByTestId("custom-diff");
    expect(customElements).toHaveLength(2);
    expect(screen.getByText("[1]")).toBeInTheDocument();
    expect(screen.getByText("[2]")).toBeInTheDocument();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("inlineRenderCell - Edge Cases", () => {
  test("handles case-insensitive field matching", () => {
    const colDef: ColDefWithMetadata = { field: "Price" };
    const params = createParams(
      { base__price: 100, current__price: 150 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    // Should find values with lowercase keys
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  test("handles null values in diff", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams(
      { base__value: null, current__value: 42 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    // null is rendered as "-" in DiffText when grayOut is true
    // The current value should be present
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("handles missing colDef field gracefully", () => {
    const colDef: ColDefWithMetadata = {};
    const params = createParams({ base__: 1, current__: 2 }, colDef);

    // Should not throw
    expect(() => inlineRenderCell(params)).not.toThrow();
  });
});
