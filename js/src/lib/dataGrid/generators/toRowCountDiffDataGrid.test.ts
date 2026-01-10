/**
 * @file toRowCountDiffDataGrid.test.ts
 * @description Tests for toRowCountDiffDataGrid generator
 */

import { type RowCountDiffResult, type RowObjectType } from "@datarecce/ui/api";
import { toRowCountDiffDataGrid } from "@datarecce/ui/utils";
import type { CellClassParams } from "ag-grid-community";

// ============================================================================
// Mocks
// ============================================================================

// Mock ag-grid-community to avoid ES module parsing issues
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

// ============================================================================
// Types for testing (avoids ESM import issues with ag-grid-community)
// ============================================================================

/**
 * Test-friendly Column type (mirrors AG Grid ColDef)
 */
interface TestColumn {
  field: string;
  headerName?: string;
  resizable?: boolean;
  cellClass?:
    | string
    | ((params: CellClassParams<RowObjectType>) => string | undefined);
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

const createResult = (
  entries: Record<string, { base: number | null; curr: number | null }>,
): RowCountDiffResult => entries;

// ============================================================================
// Column Structure Tests
// ============================================================================

describe("toRowCountDiffDataGrid - Column Structure", () => {
  test("creates 4 columns", () => {
    const result = createResult({ orders: { base: 100, curr: 100 } });
    const { columns } = toRowCountDiffDataGrid(result);

    expect(columns).toHaveLength(4);
  });

  test("columns have correct fields", () => {
    const result = createResult({ orders: { base: 100, curr: 100 } });
    const { columns } = toRowCountDiffDataGrid(result);

    expect(getColumn(columns, 0).field).toBe("name");
    expect(getColumn(columns, 1).field).toBe("base");
    expect(getColumn(columns, 2).field).toBe("current");
    expect(getColumn(columns, 3).field).toBe("delta");
  });

  test("columns are resizable", () => {
    const result = createResult({ orders: { base: 100, curr: 100 } });
    const { columns } = toRowCountDiffDataGrid(result);

    columns.forEach((col) => {
      expect(getColumn([col], 0).resizable).toBe(true);
    });
  });

  test("columns have cellClass function", () => {
    const result = createResult({ orders: { base: 100, curr: 100 } });
    const { columns } = toRowCountDiffDataGrid(result);

    columns.forEach((col) => {
      expect(typeof getColumn([col], 0).cellClass).toBe("function");
    });
  });
});

// ============================================================================
// Row Generation Tests
// ============================================================================

describe("toRowCountDiffDataGrid - Row Generation", () => {
  test("generates correct number of rows", () => {
    const result = createResult({
      orders: { base: 100, curr: 100 },
      customers: { base: 50, curr: 60 },
    });
    const { rows } = toRowCountDiffDataGrid(result);

    expect(rows).toHaveLength(2);
  });

  test("row contains name, base, current, delta", () => {
    const result = createResult({ orders: { base: 100, curr: 150 } });
    const { rows } = toRowCountDiffDataGrid(result);

    expect(rows[0].name).toBe("orders");
    expect(rows[0].base).toBe(100);
    expect(rows[0].current).toBe(150);
    expect(rows[0].delta).toMatch(/^\+50/);
  });

  test("null values display as 'N/A'", () => {
    const result = createResult({ new_model: { base: null, curr: 100 } });
    const { rows } = toRowCountDiffDataGrid(result);

    expect(rows[0].base).toBe("N/A");
    expect(rows[0].current).toBe(100);
  });
});

// ============================================================================
// Row Status Tests
// ============================================================================

describe("toRowCountDiffDataGrid - Row Status", () => {
  test("unchanged rows have undefined __status", () => {
    const result = createResult({ orders: { base: 100, curr: 100 } });
    const { rows } = toRowCountDiffDataGrid(result);

    expect(rows[0].__status).toBeUndefined();
  });

  test("added models have 'added' __status", () => {
    const result = createResult({ new_model: { base: null, curr: 100 } });
    const { rows } = toRowCountDiffDataGrid(result);

    expect(rows[0].__status).toBe("added");
  });

  test("removed models have 'removed' __status", () => {
    const result = createResult({ old_model: { base: 100, curr: null } });
    const { rows } = toRowCountDiffDataGrid(result);

    expect(rows[0].__status).toBe("removed");
  });

  test("modified models have 'modified' __status", () => {
    const result = createResult({ orders: { base: 100, curr: 150 } });
    const { rows } = toRowCountDiffDataGrid(result);

    expect(rows[0].__status).toBe("modified");
  });
});

// ============================================================================
// Cell Class Tests
// ============================================================================

describe("toRowCountDiffDataGrid - Cell Classes", () => {
  test("unchanged rows return undefined cellClass", () => {
    const result = createResult({ orders: { base: 100, curr: 100 } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string | undefined;
    expect(cellClassFn(createCellClassParams(rows[0]))).toBeUndefined();
  });

  test("increased counts return 'diff-cell-added'", () => {
    const result = createResult({ orders: { base: 100, curr: 150 } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string | undefined;
    expect(cellClassFn(createCellClassParams(rows[0]))).toBe("diff-cell-added");
  });

  test("decreased counts return 'diff-cell-removed'", () => {
    const result = createResult({ orders: { base: 150, curr: 100 } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string | undefined;
    expect(cellClassFn(createCellClassParams(rows[0]))).toBe(
      "diff-cell-removed",
    );
  });

  test("added models (null base) return 'diff-cell-added'", () => {
    const result = createResult({ new_model: { base: null, curr: 100 } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string | undefined;
    expect(cellClassFn(createCellClassParams(rows[0]))).toBe("diff-cell-added");
  });

  test("removed models (null current) return 'diff-cell-removed'", () => {
    const result = createResult({ old_model: { base: 100, curr: null } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string | undefined;
    expect(cellClassFn(createCellClassParams(rows[0]))).toBe(
      "diff-cell-removed",
    );
  });
});

// ============================================================================
// Empty Result Tests
// ============================================================================

describe("toRowCountDiffDataGrid - Empty Results", () => {
  test("handles empty result", () => {
    const { columns, rows } = toRowCountDiffDataGrid({});

    expect(columns).toHaveLength(4);
    expect(rows).toHaveLength(0);
  });
});
