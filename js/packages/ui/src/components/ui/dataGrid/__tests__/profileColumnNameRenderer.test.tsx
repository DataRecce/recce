/**
 * @file profileColumnNameRenderer.test.tsx
 * @description Tests for profile column name cell renderers
 *
 * These renderers display the column name (+ DataTypeIcon) in profile diff grids.
 * The key challenge: buildDiffRows stores PK values with LOWERCASED keys,
 * but column definitions keep the original case in their `field` property.
 * The renderers must handle this case mismatch.
 */

import { render, screen } from "@testing-library/react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { describe, expect, test, vi } from "vitest";
import type { RowObjectType } from "../../../../api";
import {
  injectProfileColumnNameRenderer,
  profileColumnNameRenderer,
  profileDiffColumnNameRenderer,
} from "../dataGridFactory";

// ============================================================================
// Helper Functions
// ============================================================================

function createParams(
  data: Partial<RowObjectType> | undefined,
  colDef: ColDef<RowObjectType>,
  value?: unknown,
): ICellRendererParams<RowObjectType> {
  const fullData: RowObjectType | undefined = data
    ? { __status: undefined, ...data }
    : undefined;

  return {
    data: fullData,
    colDef,
    value,
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
// profileColumnNameRenderer Tests
// ============================================================================

describe("profileColumnNameRenderer", () => {
  test("renders column name from row data with UPPERCASE field (single profile)", () => {
    // Simulates: field="COLUMN_NAME", row has row["COLUMN_NAME"]="CUSTOMER_ID"
    // This is the non-diff case where dataFrameToRowObjects preserves original keys
    const colDef: ColDef<RowObjectType> = { field: "COLUMN_NAME" };
    const params = createParams(
      { COLUMN_NAME: "CUSTOMER_ID", data_type: "integer" },
      colDef,
      "CUSTOMER_ID", // ag-grid resolves params.value from row[field] — matches here
    );

    render(<>{profileColumnNameRenderer(params)}</>);

    expect(screen.getByText("CUSTOMER_ID")).toBeInTheDocument();
  });

  test("renders column name when row key is lowercase but field is UPPERCASE (diff PK)", () => {
    // Simulates: field="COLUMN_NAME", but buildDiffRows lowercases PK keys
    // so row has row["column_name"]="CUSTOMER_ID" (not row["COLUMN_NAME"])
    // ag-grid resolves params.value as undefined because row["COLUMN_NAME"] doesn't exist
    const colDef: ColDef<RowObjectType> = { field: "COLUMN_NAME" };
    const params = createParams(
      { column_name: "CUSTOMER_ID", data_type: "integer" },
      colDef,
      undefined, // ag-grid can't find row["COLUMN_NAME"] → undefined
    );

    render(<>{profileColumnNameRenderer(params)}</>);

    // Regression: previously rendered empty string when params.value was undefined
    expect(screen.getByText("CUSTOMER_ID")).toBeInTheDocument();
  });

  test("renders null when data is undefined", () => {
    const colDef: ColDef<RowObjectType> = { field: "COLUMN_NAME" };
    const params = createParams(undefined, colDef);

    const result = profileColumnNameRenderer(params);
    expect(result).toBeNull();
  });

  test("renders empty name gracefully when column name is truly missing", () => {
    const colDef: ColDef<RowObjectType> = { field: "COLUMN_NAME" };
    const params = createParams(
      { some_other_field: "value" },
      colDef,
      undefined,
    );

    // Should not throw
    expect(() => {
      render(<>{profileColumnNameRenderer(params)}</>);
    }).not.toThrow();
  });
});

// ============================================================================
// profileDiffColumnNameRenderer Tests
// ============================================================================

describe("profileDiffColumnNameRenderer", () => {
  test("renders column name when row key is lowercase but field is UPPERCASE (inline diff)", () => {
    // This is the exact bug scenario: inline diff mode with UPPERCASE column keys
    const colDef: ColDef<RowObjectType> = { field: "COLUMN_NAME" };
    const params = createParams(
      {
        column_name: "FIRST_NAME",
        base__data_type: "varchar",
        current__data_type: "varchar",
      },
      colDef,
      undefined, // ag-grid can't find row["COLUMN_NAME"] → undefined
    );

    render(<>{profileDiffColumnNameRenderer(params)}</>);

    // Regression: previously rendered empty string when params.value was undefined
    expect(screen.getByText("FIRST_NAME")).toBeInTheDocument();
  });

  test("renders column name from params.value when it exists (lowercase keys match)", () => {
    const colDef: ColDef<RowObjectType> = { field: "column_name" };
    const params = createParams(
      {
        column_name: "FIRST_NAME",
        base__data_type: "varchar",
        current__data_type: "varchar",
      },
      colDef,
      "FIRST_NAME",
    );

    render(<>{profileDiffColumnNameRenderer(params)}</>);

    expect(screen.getByText("FIRST_NAME")).toBeInTheDocument();
  });

  test("renders null when data is undefined", () => {
    const colDef: ColDef<RowObjectType> = { field: "COLUMN_NAME" };
    const params = createParams(undefined, colDef);

    const result = profileDiffColumnNameRenderer(params);
    expect(result).toBeNull();
  });
});

// ============================================================================
// injectProfileColumnNameRenderer Tests
// ============================================================================

describe("injectProfileColumnNameRenderer", () => {
  test("replaces COLUMN_NAME column cellRenderer for non-diff profile", () => {
    const result = injectProfileColumnNameRenderer({
      columns: [
        { field: "COLUMN_NAME", headerName: "COLUMN_NAME" },
        { field: "ROW_COUNT", headerName: "ROW_COUNT" },
        { field: "DATA_TYPE", headerName: "DATA_TYPE" },
      ],
      rows: [
        {
          __status: undefined,
          COLUMN_NAME: "CUSTOMER_ID",
          DATA_TYPE: "integer",
          ROW_COUNT: 100,
        },
      ],
    });

    // DATA_TYPE column should be removed
    const fields = result.columns.map(
      (c) => (c as ColDef<RowObjectType>).field,
    );
    expect(fields).not.toContain("DATA_TYPE");

    // COLUMN_NAME column should have a cellRenderer
    const colNameCol = result.columns.find(
      (c) => (c as ColDef<RowObjectType>).field === "COLUMN_NAME",
    ) as ColDef<RowObjectType>;
    expect(colNameCol).toBeDefined();
    expect(colNameCol.cellRenderer).toBeDefined();
  });

  test("replaces COLUMN_NAME column cellRenderer for inline diff profile", () => {
    const result = injectProfileColumnNameRenderer({
      columns: [
        { field: "COLUMN_NAME", headerName: "COLUMN_NAME" },
        { field: "ROW_COUNT", headerName: "ROW_COUNT" },
      ],
      rows: [
        {
          __status: undefined,
          column_name: "CUSTOMER_ID",
          base__data_type: "integer",
          current__data_type: "integer",
          base__row_count: 100,
          current__row_count: 100,
        },
      ],
    });

    const colNameCol = result.columns.find(
      (c) => (c as ColDef<RowObjectType>).field === "COLUMN_NAME",
    ) as ColDef<RowObjectType>;
    expect(colNameCol).toBeDefined();
    expect(colNameCol.cellRenderer).toBeDefined();
  });

  test("injected renderer shows column name with lowercased row keys (diff mode)", () => {
    const result = injectProfileColumnNameRenderer({
      columns: [{ field: "COLUMN_NAME", headerName: "COLUMN_NAME" }],
      rows: [
        {
          __status: undefined,
          column_name: "CUSTOMER_ID",
          base__data_type: "integer",
          current__data_type: "integer",
        },
      ],
    });

    const colNameCol = result.columns.find(
      (c) => (c as ColDef<RowObjectType>).field === "COLUMN_NAME",
    ) as ColDef<RowObjectType>;

    // Call the renderer with the same data shape buildDiffRows produces
    const renderer = colNameCol.cellRenderer as (
      params: ICellRendererParams<RowObjectType>,
    ) => React.ReactNode;

    const params = createParams(
      {
        column_name: "CUSTOMER_ID",
        base__data_type: "integer",
        current__data_type: "integer",
      },
      colNameCol,
      undefined, // ag-grid can't find row["COLUMN_NAME"]
    );

    render(<>{renderer(params)}</>);

    expect(screen.getByText("CUSTOMER_ID")).toBeInTheDocument();
  });
});
