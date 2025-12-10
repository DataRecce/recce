/**
 * @file toRowCountDiffDataGrid.test.ts
 * @description Tests for toRowCountDiffDataGrid generator
 */

import { RowCountDiffResult } from "@/lib/api/rowcount";
import { RowObjectType } from "@/lib/api/types";
import { toRowCountDiffDataGrid } from "./toRowCountDiffDataGrid";

// ============================================================================
// Mocks
// ============================================================================

// Mock react-data-grid to avoid ES module parsing issues
jest.mock("react-data-grid", () => ({
  renderTextEditor: jest.fn(),
}));

// ============================================================================
// Types for testing (avoids ESM import issues with react-data-grid)
// ============================================================================

/**
 * Test-friendly Column type (mirrors react-data-grid Column)
 */
interface TestColumn {
  key: string;
  name?: string;
  resizable?: boolean;
  cellClass?: string | ((row: RowObjectType) => string | undefined);
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

  test("columns have correct keys", () => {
    const result = createResult({ orders: { base: 100, curr: 100 } });
    const { columns } = toRowCountDiffDataGrid(result);

    expect(getColumn(columns, 0).key).toBe("name");
    expect(getColumn(columns, 1).key).toBe("base");
    expect(getColumn(columns, 2).key).toBe("current");
    expect(getColumn(columns, 3).key).toBe("delta");
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
      row: unknown,
    ) => string | undefined;
    expect(cellClassFn(rows[0])).toBeUndefined();
  });

  test("increased counts return 'diff-cell-added'", () => {
    const result = createResult({ orders: { base: 100, curr: 150 } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      row: unknown,
    ) => string | undefined;
    expect(cellClassFn(rows[0])).toBe("diff-cell-added");
  });

  test("decreased counts return 'diff-cell-removed'", () => {
    const result = createResult({ orders: { base: 150, curr: 100 } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      row: unknown,
    ) => string | undefined;
    expect(cellClassFn(rows[0])).toBe("diff-cell-removed");
  });

  test("added models (null base) return 'diff-cell-added'", () => {
    const result = createResult({ new_model: { base: null, curr: 100 } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      row: unknown,
    ) => string | undefined;
    expect(cellClassFn(rows[0])).toBe("diff-cell-added");
  });

  test("removed models (null current) return 'diff-cell-removed'", () => {
    const result = createResult({ old_model: { base: 100, curr: null } });
    const { columns, rows } = toRowCountDiffDataGrid(result);

    const cellClassFn = getColumn(columns, 0).cellClass as (
      row: unknown,
    ) => string | undefined;
    expect(cellClassFn(rows[0])).toBe("diff-cell-removed");
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
