/**
 * @file createDataGrid.profile.test.tsx
 * @description Integration tests for createDataGrid with profile and profile_diff run types.
 *
 * These tests exercise the full pipeline from Run object to grid output,
 * specifically with UPPERCASE column keys to match real backend data.
 * The key concern: backends send UPPERCASE keys (COLUMN_NAME, DATA_TYPE, ROW_COUNT),
 * but buildDiffRows lowercases PK keys in diff rows.
 */

import { fireEvent, render, screen } from "@testing-library/react";
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
  {
    key: "not_null_proportion",
    name: "not_null_proportion",
    type: "float",
  },
] as const;

const LOWERCASE_DATA: (string | number)[][] = [
  ["customer_id", "integer", 500, 450, 0.9],
  ["name", "varchar", 500, 400, 0.8],
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

function profileStatHeaderText(
  column: ColDef<RowObjectType> | ColGroupDef<RowObjectType> | undefined,
): string {
  if (!column) {
    throw new Error("Expected a profile stat column");
  }

  const Header =
    (column as ColDef<RowObjectType>).headerComponent ??
    (column as ColGroupDef<RowObjectType>).headerGroupComponent;
  if (!Header) {
    throw new Error("Expected a profile stat header component");
  }

  const { container, unmount } = render(<Header />);
  const text = container.querySelector(".grid-header")?.textContent ?? "";
  unmount();
  return text;
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

  test("humanizes profile statistic headers without changing raw fields", () => {
    const result = createDataGrid(run, {})!;

    expect(profileStatHeaderText(findColumn(result.columns, "row_count"))).toBe(
      "Row Count",
    );
    expect(findColumn(result.columns, "row_count")?.field).toBe("ROW_COUNT");
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

  test("humanizes inline profile diff headers and retains the structural key", () => {
    const result = createDataGrid(run, { displayMode: "inline" })!;
    const primaryKeyColumn = findColumn(result.columns, "column_name");

    expect(profileStatHeaderText(findColumn(result.columns, "row_count"))).toBe(
      "Row Count",
    );
    expect(findColumn(result.columns, "row_count")?.field).toBe("ROW_COUNT");
    expect(primaryKeyColumn?.field).toBe("COLUMN_NAME");
    expect(primaryKeyColumn?.pinned).toBe("left");
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

  test("humanizes side-by-side profile diff group headers", () => {
    const result = createDataGrid(run, { displayMode: "side_by_side" })!;
    const rowCountGroup = result.columns.find(
      (column) =>
        "children" in column &&
        column.headerName?.toLowerCase() === "row_count",
    ) as ColGroupDef<RowObjectType> | undefined;

    expect(profileStatHeaderText(rowCountGroup)).toBe("Row Count");
    expect(
      rowCountGroup?.children.map(
        (child) => (child as ColDef<RowObjectType>).field,
      ),
    ).toEqual(["base__ROW_COUNT", "current__ROW_COUNT"]);
  });
});

// ============================================================================
// DRC-2866: explicit percentage modes are limited to inline Profile Diff
// ============================================================================

describe("createDataGrid - profile_diff explicit percentage mode eligibility", () => {
  const columns = [
    { key: "column_name", name: "column_name", type: "text" },
    { key: "data_type", name: "data_type", type: "text" },
    { key: "row_count", name: "row_count", type: "integer" },
    {
      key: "not_null_proportion",
      name: "not_null_proportion",
      type: "float",
    },
  ] as const;
  const run = makeProfileDiffRun({
    base: makeDataFrame([...columns], [["id", "integer", 10, 0.98]]),
    current: makeDataFrame([...columns], [["id", "integer", 12, 0.94]]),
  });

  function renderHeaderFor(
    result: ReturnType<typeof createDataGrid>,
    field: string,
  ) {
    const column = findColumn(result!.columns, field);
    const Header = column?.headerComponent;
    if (!Header) {
      throw new Error(`Expected ${field} to have a header component`);
    }
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
  }

  function renderActualCellFor(
    result: ReturnType<typeof createDataGrid>,
    field: string,
  ) {
    const column = findColumn(result!.columns, field)!;
    const renderer = column.cellRenderer as (
      params: ICellRendererParams<RowObjectType>,
    ) => React.ReactNode;

    render(<>{renderer(createRendererParams(result!.rows[0], column))}</>);
  }

  test("offers percentage-point delta only for inline proportion fields", () => {
    const callback = vi.fn();
    const result = createDataGrid(run, {
      displayMode: "inline",
      onColumnsRenderModeChanged: callback,
    });

    renderHeaderFor(result, "not_null_proportion");

    expect(screen.getByText("Show percentage-point delta")).toBeInTheDocument();
    expect(
      screen.queryByText("Show relative percentage change"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Show percentage-point delta"));
    expect(callback).toHaveBeenCalledWith({
      not_null_proportion: "percent_delta",
    });
  });

  test("offers relative percentage change for other inline numeric fields", () => {
    const callback = vi.fn();
    const result = createDataGrid(run, {
      displayMode: "inline",
      onColumnsRenderModeChanged: callback,
    });

    renderHeaderFor(result, "row_count");

    expect(
      screen.getByText("Show relative percentage change"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Show percentage-point delta"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Show relative percentage change"));
    expect(callback).toHaveBeenCalledWith({ row_count: "percent_change" });
  });

  test("renders percent_delta through the actual modified Profile Diff row", () => {
    const result = createDataGrid(run, {
      displayMode: "inline",
      columnsRenderMode: { not_null_proportion: "percent_delta" },
    });

    expect(result!.rows[0].__status).toBe("modified");
    renderActualCellFor(result, "not_null_proportion");

    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByText("(-4pp)")).toHaveAttribute(
      "data-direction",
      "decrease",
    );
  });

  test("renders percent_change with an ordinary current value through the factory", () => {
    const result = createDataGrid(run, {
      displayMode: "inline",
      columnsRenderMode: { row_count: "percent_change" },
    });

    renderActualCellFor(result, "row_count");

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("(+20%)")).toHaveAttribute(
      "data-direction",
      "increase",
    );
    expect(screen.queryByText("1,200%")).not.toBeInTheDocument();
  });

  test.each([
    ["row_count", "percent_delta", "10", "12"],
    ["not_null_proportion", "percent_change", "0.98", "0.94"],
  ] as const)(
    "falls back for persisted %s on %s",
    (field, mode, baseText, currentText) => {
      const result = createDataGrid(run, {
        displayMode: "inline",
        columnsRenderMode: { [field]: mode },
      });

      renderActualCellFor(result, field);

      expect(screen.getByText(baseText)).toBeInTheDocument();
      expect(screen.getByText(currentText)).toBeInTheDocument();
      expect(screen.queryByText(/pp\)|%\)/)).not.toBeInTheDocument();
    },
  );

  test("keeps the new modes out of side-by-side Profile Diff headers", () => {
    const result = createDataGrid(run, {
      displayMode: "side_by_side",
      onColumnsRenderModeChanged: vi.fn(),
    })!;
    const proportionGroup = result.columns.find(
      (column) =>
        "children" in column &&
        column.headerName?.toLowerCase() === "not_null_proportion",
    ) as ColGroupDef<RowObjectType>;

    const Header = proportionGroup.headerGroupComponent;
    if (!Header) {
      throw new Error("Expected a side-by-side Profile Diff group header");
    }
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));

    expect(
      screen.queryByText("Show percentage-point delta"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Show relative percentage change"),
    ).not.toBeInTheDocument();
  });

  test("keeps the new modes out of single Profile headers", () => {
    const singleProfileRun = makeProfileRun({
      current: makeDataFrame([...columns], [["id", "integer", 12, 0.94]]),
    });
    const result = createDataGrid(singleProfileRun, {
      onColumnsRenderModeChanged: vi.fn(),
    });
    const column = findColumn(result!.columns, "not_null_proportion");
    const Header = column?.headerComponent;
    if (!Header) {
      throw new Error("Expected a single Profile header component");
    }

    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));

    expect(
      screen.queryByText("Show percentage-point delta"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Show relative percentage change"),
    ).not.toBeInTheDocument();
  });

  test("passes profile presentation metadata through the factory to hide the key icon", () => {
    const result = createDataGrid(run, { displayMode: "inline" })!;
    const primaryKeyColumn = findColumn(result.columns, "column_name");

    render(<>{primaryKeyColumn?.headerComponent?.()}</>);

    expect(screen.queryByTestId("primary-key-icon")).not.toBeInTheDocument();
  });
});

// ============================================================================
// DRC-2866: generic grid factories never expose Profile Diff-only modes
// ============================================================================

describe("createDataGrid - generic percentage mode exclusion", () => {
  const dataframe = makeDataFrame(
    [
      { key: "id", name: "id", type: "integer" },
      { key: "value", name: "value", type: "number" },
    ],
    [[1, 10]],
  );
  const queryRun = {
    type: "query",
    run_id: "query-run",
    run_at: "2026-01-01T00:00:00Z",
    status: "Finished",
    params: { sql_template: "select 1" },
    result: dataframe,
  } as Extract<Run, { type: "query" }>;
  const queryDiffRun = {
    type: "query_diff",
    run_id: "query-diff-run",
    run_at: "2026-01-01T00:00:00Z",
    status: "Finished",
    params: { sql_template: "select 1", primary_keys: ["id"] },
    result: { base: dataframe, current: dataframe },
  } as Extract<Run, { type: "query_diff" }>;
  const valueDiffDetailDataframe = makeDataFrame(
    [
      { key: "id", name: "id", type: "integer" },
      { key: "value", name: "value", type: "number" },
      { key: "in_a", name: "in_a", type: "boolean" },
      { key: "in_b", name: "in_b", type: "boolean" },
    ],
    [[1, 10, true, true]],
  );
  const valueDiffDetailRun = {
    type: "value_diff_detail",
    run_id: "value-diff-detail-run",
    run_at: "2026-01-01T00:00:00Z",
    status: "Finished",
    params: { model: "model", primary_key: "id" },
    result: valueDiffDetailDataframe,
  } as Extract<Run, { type: "value_diff_detail" }>;

  test.each([
    ["Query", queryRun],
    ["Query Diff", queryDiffRun],
    ["Value Diff Detail", valueDiffDetailRun],
  ] as const)("keeps Profile Diff-only modes out of %s", (_name, run) => {
    const result = createDataGrid(run, {
      displayMode: "inline",
      onColumnsRenderModeChanged: vi.fn(),
    })!;
    const column = findColumn(result.columns, "value")!;
    const Header = column.headerComponent;
    if (!Header) {
      throw new Error("Expected a numeric grid header");
    }

    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));

    expect(
      screen.queryByText("Show percentage-point delta"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Show relative percentage change"),
    ).not.toBeInTheDocument();
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

  test("humanizes lowercase profile statistic headers", () => {
    const result = createDataGrid(run, {})!;

    expect(profileStatHeaderText(findColumn(result.columns, "row_count"))).toBe(
      "Row Count",
    );
    expect(findColumn(result.columns, "row_count")?.field).toBe("row_count");
    expect(
      profileStatHeaderText(findColumn(result.columns, "not_null_proportion")),
    ).toBe("Not Null Proportion");
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
