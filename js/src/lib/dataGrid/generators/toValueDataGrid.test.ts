/**
 * @file toValueDataGrid.test.ts
 * @description Tests for toValueDataGrid generator
 *
 * Tests cover:
 * - Basic column and row generation
 * - Primary key handling (single and array)
 * - Cell class functions
 * - Column structure
 */

import {
  type ColumnRenderMode,
  type ColumnType,
  type RowObjectType,
  type ValueDiffParams,
  type ValueDiffResult,
} from "@datarecce/ui/api";
import { toValueDataGrid } from "@datarecce/ui/components/ui/dataGrid/generators/toValueDataGrid";
import type { CellClassParams } from "ag-grid-community";

// ============================================================================
// Mocks
// ============================================================================

jest.mock("ag-grid-community", () => ({
  ModuleRegistry: {
    registerModules: jest.fn(),
  },
}));

// ============================================================================
// Helper to create mock CellClassParams
// ============================================================================

/**
 * Helper to create mock CellClassParams from a row
 * This is needed because AG Grid cellClass functions expect CellClassParams
 */
const createCellClassParams = (
  row: RowObjectType,
): CellClassParams<RowObjectType> =>
  ({
    data: row,
    value: undefined,
    node: undefined,
    colDef: {},
    column: {},
    api: {},
    rowIndex: 0,
  }) as unknown as CellClassParams<RowObjectType>;

jest.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: jest.fn(() => ({ basePath: "" })),
  useRecceInstanceContext: () => ({
    featureToggles: {
      disableDatabaseQuery: false,
    },
  }),
  useRecceActionContext: () => ({
    runAction: jest.fn(),
  }),
}));

// ============================================================================
// Types for testing (avoids ESM import issues with ag-grid-community)
// ============================================================================

/**
 * Test-friendly Column type (mirrors AG Grid ColDef)
 */
interface TestColumn {
  field: string;
  headerName?: React.ReactNode;
  width?: number;
  maxWidth?: number;
  resizable?: boolean;
  cellClass?:
    | string
    | ((params: CellClassParams<RowObjectType>) => string | undefined);
  headerClass?: string;
  cellRenderer?: unknown;
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Get a specific column by index and cast to TestColumn
 */
function getColumn(columns: unknown[], index: number): TestColumn {
  return columns[index] as TestColumn;
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createValueDiffResult(
  columnData: [string, number, number][],
): ValueDiffResult {
  return {
    data: {
      columns: [
        { key: "0", name: "Column", type: "text" },
        { key: "1", name: "Matched", type: "number" },
        { key: "2", name: "Matched %", type: "number" },
      ],
      data: columnData,
    },
    summary: {
      total: 100,
      added: 5,
      removed: 3,
    },
  };
}

function createValueDiffParams(
  overrides: Partial<ValueDiffParams> = {},
): ValueDiffParams {
  return {
    model: "test_model",
    primary_key: "id",
    ...overrides,
  };
}

// ============================================================================
// Basic Functionality Tests
// ============================================================================

describe("toValueDataGrid - Basic Functionality", () => {
  test("generates columns and rows from result", () => {
    const result = createValueDiffResult([
      ["id", 100, 1.0],
      ["name", 95, 0.95],
      ["email", 80, 0.8],
    ]);
    const params = createValueDiffParams();

    const { columns, rows } = toValueDataGrid(result, { params });

    expect(columns).toHaveLength(4); // pk indicator + column + matched + matched %
    expect(rows).toHaveLength(3);
  });

  test("preserves row data correctly", () => {
    const result = createValueDiffResult([
      ["user_id", 1000, 1.0],
      ["email", 950, 0.95],
    ]);
    const params = createValueDiffParams();

    const { rows } = toValueDataGrid(result, { params });

    expect(rows[0]["0"]).toBe("user_id");
    expect(rows[0]["1"]).toBe(1000);
    expect(rows[0]["2"]).toBe(1.0);
    expect(rows[1]["0"]).toBe("email");
    expect(rows[1]["1"]).toBe(950);
    expect(rows[1]["2"]).toBe(0.95);
  });

  test("handles empty data", () => {
    const result = createValueDiffResult([]);
    const params = createValueDiffParams();

    const { columns, rows } = toValueDataGrid(result, { params });

    expect(columns).toHaveLength(4);
    expect(rows).toHaveLength(0);
  });
});

// ============================================================================
// Column Structure Tests
// ============================================================================

describe("toValueDataGrid - Column Structure", () => {
  test("creates primary key indicator column", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const pkColumn = getColumn(columns, 0);

    expect(pkColumn.field).toBe("__is_pk__");
    expect(pkColumn.headerName).toBe("");
    expect(pkColumn.width).toBe(30);
    expect(pkColumn.maxWidth).toBe(30);
    expect(pkColumn.cellRenderer).toBeDefined();
  });

  test("creates column name column", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const nameColumn = getColumn(columns, 1);

    expect(nameColumn.field).toBe("0");
    expect(nameColumn.headerName).toBe("Column");
    expect(nameColumn.resizable).toBe(true);
    expect(nameColumn.cellRenderer).toBeDefined();
    expect(nameColumn.cellClass).toBe("cell-show-context-menu");
  });

  test("creates matched count column", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const matchedColumn = getColumn(columns, 2);

    expect(matchedColumn.field).toBe("1");
    expect(matchedColumn.headerName).toBe("Matched");
    expect(matchedColumn.resizable).toBe(true);
  });

  test("creates matched percent column", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const percentColumn = getColumn(columns, 3);

    expect(percentColumn.field).toBe("2");
    expect(percentColumn.headerName).toBe("Matched %");
    expect(percentColumn.resizable).toBe(true);
    expect(percentColumn.cellRenderer).toBeDefined();
  });
});

// ============================================================================
// Primary Key Handling Tests
// ============================================================================

describe("toValueDataGrid - Primary Key Handling", () => {
  test("handles single primary key", () => {
    const result = createValueDiffResult([["user_id", 100, 1.0]]);
    const params = createValueDiffParams({ primary_key: "user_id" });

    const { columns } = toValueDataGrid(result, { params });
    const pkColumn = getColumn(columns, 0);

    expect(pkColumn.field).toBe("__is_pk__");
    expect(pkColumn.cellRenderer).toBeDefined();
  });

  test("handles array of primary keys", () => {
    const result = createValueDiffResult([
      ["region", 100, 1.0],
      ["user_id", 100, 1.0],
      ["name", 95, 0.95],
    ]);
    const params = createValueDiffParams({
      primary_key: ["region", "user_id"],
    });

    const { columns } = toValueDataGrid(result, { params });
    const pkColumn = getColumn(columns, 0);

    expect(pkColumn.field).toBe("__is_pk__");
    expect(pkColumn.cellRenderer).toBeDefined();
  });
});

// ============================================================================
// Cell Class Tests
// ============================================================================

describe("toValueDataGrid - Cell Classes", () => {
  test("matched count column has cellClass function", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const matchedColumn = getColumn(columns, 2);

    expect(typeof matchedColumn.cellClass).toBe("function");
  });

  test("matched percent column has cellClass function", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const percentColumn = getColumn(columns, 3);

    expect(typeof percentColumn.cellClass).toBe("function");
  });

  test("cellClass returns diff-cell-modified when value < 1", () => {
    const result = createValueDiffResult([["email", 80, 0.8]]);
    const params = createValueDiffParams();

    const { columns, rows } = toValueDataGrid(result, { params });
    const matchedColumn = getColumn(columns, 2);

    const cellClass = matchedColumn.cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string | undefined;
    expect(cellClass(createCellClassParams(rows[0]))).toBe(
      "diff-cell-modified",
    );
  });

  test("cellClass returns undefined when value is 1 (100%)", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns, rows } = toValueDataGrid(result, { params });
    const matchedColumn = getColumn(columns, 2);

    const cellClass = matchedColumn.cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string | undefined;
    expect(cellClass(createCellClassParams(rows[0]))).toBeUndefined();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("toValueDataGrid - Edge Cases", () => {
  test("handles null/undefined values in data", () => {
    const result: ValueDiffResult = {
      data: {
        columns: [
          { key: "0", name: "Column", type: "text" },
          { key: "1", name: "Matched", type: "number" },
          { key: "2", name: "Matched %", type: "number" },
        ],
        data: [
          ["id", null, null],
          ["name", 100, 1.0],
        ],
      },
      summary: { total: 100, added: 0, removed: 0 },
    };
    const params = createValueDiffParams();

    const { rows } = toValueDataGrid(result, { params });

    expect(rows[0]["1"]).toBeNull();
    expect(rows[0]["2"]).toBeNull();
  });

  test("handles special characters in column names", () => {
    const result = createValueDiffResult([
      ["user.email", 100, 1.0],
      ["order-id", 95, 0.95],
      ["first name", 80, 0.8],
    ]);
    const params = createValueDiffParams();

    const { rows } = toValueDataGrid(result, { params });

    expect(rows[0]["0"]).toBe("user.email");
    expect(rows[1]["0"]).toBe("order-id");
    expect(rows[2]["0"]).toBe("first name");
  });

  test("handles large numbers", () => {
    const result = createValueDiffResult([
      ["big_column", 1000000000, 0.999999999],
    ]);
    const params = createValueDiffParams();

    const { rows } = toValueDataGrid(result, { params });

    expect(rows[0]["1"]).toBe(1000000000);
    expect(rows[0]["2"]).toBe(0.999999999);
  });
});
