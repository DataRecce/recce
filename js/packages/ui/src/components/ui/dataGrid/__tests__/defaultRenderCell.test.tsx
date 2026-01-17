/**
 * @file defaultRenderCell.test.tsx
 * @description Tests for default cell renderer
 *
 * Tests cover:
 * - Basic value rendering
 * - Column type formatting
 * - Gray-out styling for null/empty values
 * - ColDef context handling
 */

import { render, screen } from "@testing-library/react";
import type { ICellRendererParams } from "ag-grid-community";
import React from "react";
import { vi } from "vitest";
import type { RowObjectType } from "../../../../api";
import {
  type ColDefWithMetadata,
  defaultRenderCell,
} from "../defaultRenderCell";

// ============================================================================
// Helper Functions
// ============================================================================

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
    getValue: vi.fn(),
    setValue: vi.fn(),
    formatValue: vi.fn(),
    refreshCell: vi.fn(),
    registerRowDragger: vi.fn(),
    setTooltip: vi.fn(),
  } as unknown as ICellRendererParams<RowObjectType>;
}

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe("defaultRenderCell - Basic Rendering", () => {
  test("renders null when data is undefined", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams(undefined, colDef);

    const result = defaultRenderCell(params);

    expect(result).toBeNull();
  });

  test("renders string value", () => {
    const colDef: ColDefWithMetadata = { field: "name" };
    const params = createParams({ name: "John" }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("John")).toBeInTheDocument();
  });

  test("renders number value", () => {
    const colDef: ColDefWithMetadata = { field: "count" };
    const params = createParams({ count: 42 }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("renders boolean true", () => {
    const colDef: ColDefWithMetadata = { field: "active" };
    const params = createParams({ active: true }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("true")).toBeInTheDocument();
  });

  test("renders boolean false without gray styling", () => {
    const colDef: ColDefWithMetadata = { field: "active" };
    const params = createParams({ active: false }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    const element = screen.getByText("false");
    expect(element).toBeInTheDocument();
    // Boolean false does not get grayOut styling per toRenderedValue implementation
    expect(element).toHaveStyle({ color: "inherit" });
  });
});

// ============================================================================
// Null/Empty Value Tests
// ============================================================================

describe("defaultRenderCell - Null/Empty Values", () => {
  test("renders null value with gray styling", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({ value: null }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    // toRenderedValue returns "-" for null with grayOut=true
    const element = screen.getByText("-");
    // Gray is rendered as rgb(128, 128, 128) by MUI
    expect(element).toHaveStyle({ color: "rgb(128, 128, 128)" });
  });

  test("renders empty string with gray styling", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({ value: "" }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    const element = screen.getByText("(empty)");
    // Gray is rendered as rgb(128, 128, 128) by MUI
    expect(element).toHaveStyle({ color: "rgb(128, 128, 128)" });
  });
});

// ============================================================================
// Column Type Formatting Tests
// ============================================================================

describe("defaultRenderCell - Column Type Formatting", () => {
  test("formats number column with decimals", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number" },
    };
    const params = createParams({ price: 123.456 }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    // formatSmartDecimal rounds to 2 decimal places
    expect(screen.getByText("123.46")).toBeInTheDocument();
  });

  test("formats integer column without decimals", () => {
    const colDef: ColDefWithMetadata = {
      field: "count",
      context: { columnType: "integer" },
    };
    const params = createParams({ count: 123 }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("123")).toBeInTheDocument();
  });

  test("respects columnRenderMode for raw display", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number", columnRenderMode: "raw" },
    };
    const params = createParams({ price: 123.456789 }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("123.456789")).toBeInTheDocument();
  });

  test("respects columnRenderMode for percent display", () => {
    const colDef: ColDefWithMetadata = {
      field: "rate",
      context: { columnType: "number", columnRenderMode: "percent" },
    };
    const params = createParams({ rate: 0.5 }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("defaultRenderCell - Edge Cases", () => {
  test("handles missing field in colDef", () => {
    const colDef: ColDefWithMetadata = {};
    const params = createParams({ value: "test" }, colDef);

    // Should not throw, renders empty field
    expect(() => defaultRenderCell(params)).not.toThrow();
  });

  test("handles missing context in colDef", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({ value: 42 }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("handles special number values - Infinity", () => {
    const colDef: ColDefWithMetadata = {
      field: "value",
      context: { columnType: "number" },
    };
    const params = createParams({ value: Infinity }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("∞")).toBeInTheDocument();
  });

  test("handles special number values - NaN", () => {
    const colDef: ColDefWithMetadata = {
      field: "value",
      context: { columnType: "number" },
    };
    const params = createParams({ value: NaN }, colDef);

    render(<>{defaultRenderCell(params)}</>);

    expect(screen.getByText("NaN")).toBeInTheDocument();
  });
});
