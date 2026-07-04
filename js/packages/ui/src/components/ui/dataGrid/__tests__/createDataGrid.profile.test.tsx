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

// ============================================================================
// 6. Profile Diff of an UNCHANGED table — DRC-3025 real scenario
//
// The reported bug: a profile diff of a table that did not change shows phantom
// "modified" rows because a float stat (avg/mean) differs only in its raw
// floating-point tail (0.1 + 0.2 !== 0.3).
//
// ROOT CAUSE (backend): agate NUMBER stats arrive as Decimal, and pydantic v2
// serializes Decimal as a JSON *string*. So the stat reached this grid as the
// string "0.30000000000000004" vs "0.3" — and isCellChanged's numeric epsilon
// only fires on NUMBERS, so two unequal strings read "modified". The fix is in
// the backend (`recce/tasks/dataframe.py` from_agate: NUMBER Decimals are
// coerced to float), proven by `tests/tasks/test_dataframe_number_serialization.py`.
//
// These tests therefore split into two shapes:
//  - PRODUCTION shape AFTER the backend fix (numbers) → row reads UNCHANGED.
//  - The pre-fix STRING shape → row still reads MODIFIED. This is intentional:
//    the frontend comparator does NOT (by DRC-3025's design, cf. the
//    `isCellChanged(5, "5")` case in gridUtils.test.ts) numerically compare
//    stringified numbers — which is exactly WHY the fix lives in the backend.
//    If NUMBER stats ever regress to strings on the wire, this guard trips.
// ============================================================================

describe("createDataGrid - profile_diff float-noise reads unchanged (DRC-3025)", () => {
  const STAT_COLUMNS = [
    { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" },
    { key: "AVG", name: "AVG", type: "number" },
  ] as const;

  function rowFor(
    result: NonNullable<ReturnType<typeof createDataGrid>>,
    colName: string,
  ) {
    return result.rows.find((r) => {
      const name = (r.column_name as string) ?? (r.COLUMN_NAME as string);
      return name === colName;
    });
  }

  // ---- Production shape AFTER the backend fix: NUMBER stats are JS numbers ----
  // CUSTOMER_ID's avg differs only by float noise; AMOUNT genuinely changes.
  const numberBase = makeDataFrame(
    [...STAT_COLUMNS],
    [
      ["CUSTOMER_ID", 0.1 + 0.2], // 0.30000000000000004 — float noise vs 0.3
      ["AMOUNT", 100.0], // genuine change control
    ],
  );
  const numberCurrent = makeDataFrame(
    [...STAT_COLUMNS],
    [
      ["CUSTOMER_ID", 0.3],
      ["AMOUNT", 100.5],
    ],
  );

  test("numbers (post-fix shape), inline: float-noise stat row is NOT modified", () => {
    const run = makeProfileDiffRun({
      base: numberBase,
      current: numberCurrent,
    });
    const result = createDataGrid(run, { displayMode: "inline" })!;
    expect(rowFor(result, "CUSTOMER_ID")!.__status).not.toBe("modified");
  });

  test("numbers (post-fix shape), side_by_side: float-noise stat row is NOT modified", () => {
    const run = makeProfileDiffRun({
      base: numberBase,
      current: numberCurrent,
    });
    const result = createDataGrid(run, { displayMode: "side_by_side" })!;
    expect(rowFor(result, "CUSTOMER_ID")!.__status).not.toBe("modified");
  });

  test("numbers (post-fix shape): genuine stat change is still modified (control)", () => {
    const run = makeProfileDiffRun({
      base: numberBase,
      current: numberCurrent,
    });
    const result = createDataGrid(run, { displayMode: "inline" })!;
    expect(rowFor(result, "AMOUNT")!.__status).toBe("modified");
  });

  // ---- Pre-fix wire shape: NUMBER stats as Decimal-serialized STRINGS --------
  // The exact bytes the OLD pipeline produced. The frontend cannot epsilon-
  // compare strings, so this row reads MODIFIED — documenting why the fix must
  // live in the backend (which now emits numbers, see the tests above + the
  // Python serialization test).
  const stringBase = makeDataFrame(
    [...STAT_COLUMNS],
    [["CUSTOMER_ID", "0.30000000000000004"]],
  );
  const stringCurrent = makeDataFrame(
    [...STAT_COLUMNS],
    [["CUSTOMER_ID", "0.3"]],
  );

  test("strings (pre-fix wire shape): float-noise stat row reads MODIFIED — the frontend cannot fix this, the backend must emit numbers", () => {
    const run = makeProfileDiffRun({
      base: stringBase,
      current: stringCurrent,
    });
    const result = createDataGrid(run, { displayMode: "inline" })!;
    expect(rowFor(result, "CUSTOMER_ID")!.__status).toBe("modified");
  });
});
