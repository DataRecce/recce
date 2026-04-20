/**
 * @file createDataGrid.profile.test.tsx
 * @description Integration tests for createDataGrid with profile and profile_diff run types.
 *
 * These tests exercise the full pipeline from Run object to grid output,
 * specifically with UPPERCASE column keys to match real backend data.
 * The key concern: backends send UPPERCASE keys (COLUMN_NAME, DATA_TYPE, ROW_COUNT),
 * but buildDiffRows lowercases PK keys in diff rows.
 */

import { render, screen } from "@testing-library/react";
import type {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
} from "ag-grid-community";
import { describe, expect, test, vi } from "vitest";
import type { RowObjectType } from "../../../../api";
import type { DataFrame, Run } from "../../../../api/types";
import { createDataGrid } from "../dataGridFactory";

// ============================================================================
// Test Data Factories
// ============================================================================

function makeDataFrame(
  columns: { key: string; name: string; type: string }[],
  data: (string | number | boolean | null)[][],
): DataFrame {
  return {
    columns: columns as DataFrame["columns"],
    data,
  };
}

function makeProfileRun(result: { current: DataFrame }): Run {
  return {
    type: "profile",
    run_id: "test-profile",
    run_at: "2026-01-01T00:00:00Z",
    name: "test",
    check_id: undefined,
    params: { model: "test_model" },
    result,
    status: "Finished",
    error: undefined,
    progress: undefined,
  };
}

function makeProfileDiffRun(result: {
  base?: DataFrame;
  current?: DataFrame;
}): Run {
  return {
    type: "profile_diff",
    run_id: "test-profile-diff",
    run_at: "2026-01-01T00:00:00Z",
    name: "test",
    check_id: undefined,
    params: { model: "test_model" },
    result,
    status: "Finished",
    error: undefined,
    progress: undefined,
  };
}

const UPPERCASE_COLUMNS = [
  { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" },
  { key: "DATA_TYPE", name: "DATA_TYPE", type: "text" },
  { key: "ROW_COUNT", name: "ROW_COUNT", type: "integer" },
  { key: "DISTINCT_COUNT", name: "DISTINCT_COUNT", type: "integer" },
  { key: "NULL_COUNT", name: "NULL_COUNT", type: "integer" },
] as const;

const UPPERCASE_DATA: (string | number)[][] = [
  ["CUSTOMER_ID", "integer", 1000, 950, 0],
  ["FIRST_NAME", "varchar", 1000, 800, 5],
  ["EMAIL", "varchar", 1000, 990, 10],
];

const LOWERCASE_COLUMNS = [
  { key: "column_name", name: "column_name", type: "text" },
  { key: "data_type", name: "data_type", type: "text" },
  { key: "row_count", name: "row_count", type: "integer" },
  { key: "distinct_count", name: "distinct_count", type: "integer" },
] as const;

const LOWERCASE_DATA: (string | number)[][] = [
  ["customer_id", "integer", 500, 450],
  ["name", "varchar", 500, 400],
];

// ============================================================================
// Helper: create mock ICellRendererParams
// ============================================================================

function createRendererParams(
  data: Partial<RowObjectType>,
  colDef: ColDef<RowObjectType>,
  value?: unknown,
): ICellRendererParams<RowObjectType> {
  return {
    data: { __status: undefined, ...data },
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
// Helper: extract flat ColDef fields
// ============================================================================

function flatFields(
  columns: (ColDef<RowObjectType> | ColGroupDef<RowObjectType>)[],
): (string | undefined)[] {
  return columns.map((c) => (c as ColDef<RowObjectType>).field);
}

function findColumn(
  columns: (ColDef<RowObjectType> | ColGroupDef<RowObjectType>)[],
  fieldLower: string,
): ColDef<RowObjectType> | undefined {
  return columns.find(
    (c) => (c as ColDef<RowObjectType>).field?.toLowerCase() === fieldLower,
  ) as ColDef<RowObjectType> | undefined;
}

// ============================================================================
// 1. Profile (single env) with UPPERCASE keys
// ============================================================================

describe("createDataGrid - profile (single env) with UPPERCASE keys", () => {
  const run = makeProfileRun({
    current: makeDataFrame([...UPPERCASE_COLUMNS], [...UPPERCASE_DATA]),
  });

  test("returns non-null result", () => {
    const result = createDataGrid(run, {});
    expect(result).not.toBeNull();
  });

  test("COLUMN_NAME column has a cellRenderer", () => {
    const result = createDataGrid(run, {})!;
    const col = findColumn(result.columns, "column_name");
    expect(col).toBeDefined();
    expect(col!.cellRenderer).toBeDefined();
  });

  test("DATA_TYPE column is removed (merged into COLUMN_NAME renderer)", () => {
    const result = createDataGrid(run, {})!;
    const fields = flatFields(result.columns).map((f) => f?.toLowerCase());
    expect(fields).not.toContain("data_type");
  });

  test("rows are present and match input data count", () => {
    const result = createDataGrid(run, {})!;
    expect(result.rows.length).toBe(UPPERCASE_DATA.length);
  });

  test("row data is accessible via column keys", () => {
    const result = createDataGrid(run, {})!;
    // For single-env profile, dataFrameToRowObjects preserves original keys
    const firstRow = result.rows[0];
    // The row should have COLUMN_NAME accessible (original case or lowercase)
    const colNameValue = firstRow.COLUMN_NAME ?? firstRow.column_name;
    expect(colNameValue).toBe("CUSTOMER_ID");
  });
});

// ============================================================================
// 2. Profile Diff (inline mode) with UPPERCASE keys
// ============================================================================

describe("createDataGrid - profile_diff (inline) with UPPERCASE keys", () => {
  const baseData = makeDataFrame(
    [...UPPERCASE_COLUMNS],
    [
      ["CUSTOMER_ID", "integer", 900, 850, 0],
      ["FIRST_NAME", "varchar", 900, 700, 3],
      ["EMAIL", "varchar", 900, 880, 8],
    ],
  );
  const currentData = makeDataFrame(
    [...UPPERCASE_COLUMNS],
    [...UPPERCASE_DATA],
  );
  const run = makeProfileDiffRun({ base: baseData, current: currentData });

  test("returns non-null result", () => {
    const result = createDataGrid(run, { displayMode: "inline" });
    expect(result).not.toBeNull();
  });

  test("COLUMN_NAME column has cellRenderer injected", () => {
    const result = createDataGrid(run, { displayMode: "inline" })!;
    const col = findColumn(result.columns, "column_name");
    expect(col).toBeDefined();
    expect(col!.cellRenderer).toBeDefined();
  });

  test("DATA_TYPE columns are removed (data_type, base__data_type, current__data_type)", () => {
    const result = createDataGrid(run, { displayMode: "inline" })!;
    const fields = flatFields(result.columns).map((f) => f?.toLowerCase());
    expect(fields).not.toContain("data_type");
    expect(fields).not.toContain("base__data_type");
    expect(fields).not.toContain("current__data_type");
  });

  test("cellRenderer renders column name from diff row data (lowercase PK key)", () => {
    const result = createDataGrid(run, { displayMode: "inline" })!;
    const col = findColumn(result.columns, "column_name")!;
    const renderer = col.cellRenderer as (
      params: ICellRendererParams<RowObjectType>,
    ) => React.ReactNode;

    // buildDiffRows lowercases PK keys, so the row has "column_name" not "COLUMN_NAME"
    const params = createRendererParams(
      {
        column_name: "CUSTOMER_ID",
        base__data_type: "integer",
        current__data_type: "integer",
      },
      col,
      undefined, // ag-grid can't resolve COLUMN_NAME from row with lowercase key
    );

    render(<>{renderer(params)}</>);
    expect(screen.getByText("CUSTOMER_ID")).toBeInTheDocument();
  });

  test("rows contain expected number of entries", () => {
    const result = createDataGrid(run, { displayMode: "inline" })!;
    // Both base and current have the same 3 columns
    expect(result.rows.length).toBe(3);
  });
});

// ============================================================================
// 3. Profile Diff (side-by-side mode) with UPPERCASE keys
// ============================================================================

describe("createDataGrid - profile_diff (side_by_side) with UPPERCASE keys", () => {
  const baseData = makeDataFrame(
    [...UPPERCASE_COLUMNS],
    [
      ["CUSTOMER_ID", "integer", 900, 850, 0],
      ["FIRST_NAME", "varchar", 900, 700, 3],
    ],
  );
  const currentData = makeDataFrame(
    [...UPPERCASE_COLUMNS],
    [
      ["CUSTOMER_ID", "integer", 1000, 950, 0],
      ["FIRST_NAME", "varchar", 1000, 800, 5],
    ],
  );
  const run = makeProfileDiffRun({ base: baseData, current: currentData });

  test("returns non-null result", () => {
    const result = createDataGrid(run, { displayMode: "side_by_side" });
    expect(result).not.toBeNull();
  });

  test("column groups have children without DATA_TYPE", () => {
    const result = createDataGrid(run, { displayMode: "side_by_side" })!;
    const groups = result.columns.filter(
      (c) => "children" in c && c.children,
    ) as ColGroupDef<RowObjectType>[];

    for (const group of groups) {
      const childFields = group.children.map((child) =>
        (child as ColDef<RowObjectType>).field?.toLowerCase(),
      );
      expect(childFields).not.toContain("data_type");
      expect(childFields).not.toContain("base__data_type");
      expect(childFields).not.toContain("current__data_type");
    }
  });

  test("COLUMN_NAME children have cellRenderer", () => {
    const result = createDataGrid(run, { displayMode: "side_by_side" })!;

    // In side-by-side mode, COLUMN_NAME can appear as a flat column (PK column)
    // or as a child in a column group
    const flatCol = findColumn(result.columns, "column_name");
    if (flatCol) {
      expect(flatCol.cellRenderer).toBeDefined();
    }

    // Also check column group children
    const groups = result.columns.filter(
      (c) => "children" in c && c.children,
    ) as ColGroupDef<RowObjectType>[];

    for (const group of groups) {
      for (const child of group.children) {
        const childCol = child as ColDef<RowObjectType>;
        if (childCol.field?.toLowerCase() === "column_name") {
          expect(childCol.cellRenderer).toBeDefined();
        }
      }
    }
  });
});

// ============================================================================
// 4. Profile with lowercase keys (backwards compat)
// ============================================================================

describe("createDataGrid - profile with lowercase keys (backwards compat)", () => {
  const run = makeProfileRun({
    current: makeDataFrame([...LOWERCASE_COLUMNS], [...LOWERCASE_DATA]),
  });

  test("returns non-null result", () => {
    const result = createDataGrid(run, {});
    expect(result).not.toBeNull();
  });

  test("column_name column has cellRenderer", () => {
    const result = createDataGrid(run, {})!;
    const col = findColumn(result.columns, "column_name");
    expect(col).toBeDefined();
    expect(col!.cellRenderer).toBeDefined();
  });

  test("data_type column is removed", () => {
    const result = createDataGrid(run, {})!;
    const fields = flatFields(result.columns).map((f) => f?.toLowerCase());
    expect(fields).not.toContain("data_type");
  });

  test("rows are present", () => {
    const result = createDataGrid(run, {})!;
    expect(result.rows.length).toBe(LOWERCASE_DATA.length);
  });

  test("cellRenderer works with lowercase row keys", () => {
    const result = createDataGrid(run, {})!;
    const col = findColumn(result.columns, "column_name")!;
    const renderer = col.cellRenderer as (
      params: ICellRendererParams<RowObjectType>,
    ) => React.ReactNode;

    const params = createRendererParams(
      { column_name: "customer_id", data_type: "integer" },
      col,
      "customer_id",
    );

    render(<>{renderer(params)}</>);
    expect(screen.getByText("customer_id")).toBeInTheDocument();
  });
});

// ============================================================================
// 5. Profile Diff with added/removed columns between base and current
// ============================================================================

describe("createDataGrid - profile_diff with schema differences", () => {
  const baseColumns = [
    { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" },
    { key: "DATA_TYPE", name: "DATA_TYPE", type: "text" },
    { key: "ROW_COUNT", name: "ROW_COUNT", type: "integer" },
  ];
  const currentColumns = [
    { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" },
    { key: "DATA_TYPE", name: "DATA_TYPE", type: "text" },
    { key: "ROW_COUNT", name: "ROW_COUNT", type: "integer" },
  ];

  // Base has columns A, B, C; Current has columns A, B, D
  const baseData = makeDataFrame(baseColumns as DataFrame["columns"], [
    ["COL_A", "integer", 100],
    ["COL_B", "varchar", 100],
    ["COL_C", "boolean", 100],
  ]);
  const currentData = makeDataFrame(currentColumns as DataFrame["columns"], [
    ["COL_A", "integer", 200],
    ["COL_B", "varchar", 200],
    ["COL_D", "timestamp", 200],
  ]);

  test("inline mode handles schema differences (added/removed columns)", () => {
    const run = makeProfileDiffRun({ base: baseData, current: currentData });
    const result = createDataGrid(run, { displayMode: "inline" });

    expect(result).not.toBeNull();
    // Should have rows for the union of columns: A, B, C, D
    expect(result!.rows.length).toBe(4);
  });

  test("side_by_side mode handles schema differences", () => {
    const run = makeProfileDiffRun({ base: baseData, current: currentData });
    const result = createDataGrid(run, { displayMode: "side_by_side" });

    expect(result).not.toBeNull();
    // Should have rows for the union of columns: A, B, C, D
    expect(result!.rows.length).toBe(4);
  });

  test("added column rows have status 'added'", () => {
    const run = makeProfileDiffRun({ base: baseData, current: currentData });
    const result = createDataGrid(run, { displayMode: "inline" })!;

    // COL_D is only in current, so it should be marked as "added"
    const addedRow = result.rows.find((r) => {
      const colName = (r.column_name as string) ?? (r.COLUMN_NAME as string);
      return colName === "COL_D";
    });
    expect(addedRow).toBeDefined();
    expect(addedRow!.__status).toBe("added");
  });

  test("removed column rows have status 'removed'", () => {
    const run = makeProfileDiffRun({ base: baseData, current: currentData });
    const result = createDataGrid(run, { displayMode: "inline" })!;

    // COL_C is only in base, so it should be marked as "removed"
    const removedRow = result.rows.find((r) => {
      const colName = (r.column_name as string) ?? (r.COLUMN_NAME as string);
      return colName === "COL_C";
    });
    expect(removedRow).toBeDefined();
    expect(removedRow!.__status).toBe("removed");
  });
});
