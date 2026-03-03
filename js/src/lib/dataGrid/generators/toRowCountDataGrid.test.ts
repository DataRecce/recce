/**
 * @file toRowCountDataGrid.test.ts
 * @description Tests for toRowCountDataGrid generator (single environment)
 */

import { type RowCountResult, type RowObjectType } from "@datarecce/ui/api";
import { toRowCountDataGrid } from "@datarecce/ui/utils";
import { vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

// Mock ag-grid-community to avoid ES module parsing issues
vi.mock("ag-grid-community", () => ({
  themeQuartz: {
    withParams: vi.fn(() => "mocked-theme"),
  },
  AllCommunityModule: {},
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
}));

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
  entries: Record<string, { curr: number | null }>,
): RowCountResult => entries;

// ============================================================================
// Column Structure Tests
// ============================================================================

describe("toRowCountDataGrid - Column Structure", () => {
  test("creates 2 columns", () => {
    const result = createResult({ orders: { curr: 100 } });
    const { columns } = toRowCountDataGrid(result);

    expect(columns).toHaveLength(2);
  });

  test("columns have correct fields", () => {
    const result = createResult({ orders: { curr: 100 } });
    const { columns } = toRowCountDataGrid(result);

    expect(getColumn(columns, 0).field).toBe("name");
    expect(getColumn(columns, 1).field).toBe("current");
  });

  test("columns are resizable", () => {
    const result = createResult({ orders: { curr: 100 } });
    const { columns } = toRowCountDataGrid(result);

    columns.forEach((col) => {
      expect(getColumn([col], 0).resizable).toBe(true);
    });
  });

  test("columns have no cellClass (single env)", () => {
    const result = createResult({ orders: { curr: 100 } });
    const { columns } = toRowCountDataGrid(result);

    columns.forEach((col) => {
      expect(getColumn([col], 0).cellClass).toBeUndefined();
    });
  });
});

// ============================================================================
// Row Generation Tests
// ============================================================================

describe("toRowCountDataGrid - Row Generation", () => {
  test("generates correct number of rows", () => {
    const result = createResult({
      orders: { curr: 100 },
      customers: { curr: 50 },
    });
    const { rows } = toRowCountDataGrid(result);

    expect(rows).toHaveLength(2);
  });

  test("row contains name and current", () => {
    const result = createResult({ orders: { curr: 150 } });
    const { rows } = toRowCountDataGrid(result);

    expect(rows[0].name).toBe("orders");
    expect(rows[0].current).toBe(150);
  });

  test("null values display as 'N/A'", () => {
    const result = createResult({ failed_model: { curr: null } });
    const { rows } = toRowCountDataGrid(result);

    expect(rows[0].current).toBe("N/A");
  });

  test("rows have undefined __status", () => {
    const result = createResult({ orders: { curr: 100 } });
    const { rows } = toRowCountDataGrid(result);

    expect(rows[0].__status).toBeUndefined();
  });
});

// ============================================================================
// Empty Result Tests
// ============================================================================

describe("toRowCountDataGrid - Empty Results", () => {
  test("handles empty result", () => {
    const { columns, rows } = toRowCountDataGrid({});

    expect(columns).toHaveLength(2);
    expect(rows).toHaveLength(0);
  });
});
