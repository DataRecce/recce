/**
 * @file toValueDataGrid.test.ts
 * @description Tests for toValueDataGrid generator
 *
 * Tests cover:
 * - Basic column and row generation
 * - Primary key indicator column
 * - Matched percentage formatting
 * - Column name cell rendering
 */

import React from "react";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
import { ValueDiffParams, ValueDiffResult } from "@/lib/api/valuediff";
import { toValueDataGrid } from "@/lib/dataGrid";

// ============================================================================
// Mocks
// ============================================================================

jest.mock("react-data-grid", () => ({
  renderTextEditor: jest.fn(),
}));

jest.mock("@chakra-ui/react", () => ({
  Box: ({ children }: { children: React.ReactNode }) => children,
  Center: ({ children }: { children: React.ReactNode }) => children,
  Flex: ({ children }: { children: React.ReactNode }) => children,
  Icon: () => null,
  IconButton: () => null,
  Menu: {
    Root: ({ children }: { children: React.ReactNode }) => children,
    Trigger: ({ children }: { children: React.ReactNode }) => children,
    Content: ({ children }: { children: React.ReactNode }) => children,
    Item: ({ children }: { children: React.ReactNode }) => children,
    ItemGroup: ({ children }: { children: React.ReactNode }) => children,
    Positioner: ({ children }: { children: React.ReactNode }) => children,
  },
  Portal: ({ children }: { children: React.ReactNode }) => children,
  Spacer: () => null,
}));

jest.mock("@/lib/hooks/RecceActionContext", () => ({
  useRecceActionContext: () => ({
    runAction: jest.fn(),
  }),
}));

jest.mock("@/lib/hooks/RecceInstanceContext", () => ({
  useRecceInstanceContext: () => ({
    featureToggles: {
      disableDatabaseQuery: false,
    },
  }),
}));

// ============================================================================
// Types for testing (avoids ESM import issues with react-data-grid)
// ============================================================================

/**
 * Test-friendly Column type (mirrors react-data-grid Column)
 */
interface TestColumn {
  key: string;
  name?: React.ReactNode;
  width?: number;
  maxWidth?: number;
  resizable?: boolean;
  cellClass?: string | ((row: RowObjectType) => string | undefined);
  headerCellClass?: string;
  renderCell?: unknown;
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
// Column Configuration Tests
// ============================================================================

describe("toValueDataGrid - Column Configuration", () => {
  test("creates primary key indicator column first", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const pkColumn = getColumn(columns, 0);

    expect(pkColumn.key).toBe("__is_pk__");
    expect(pkColumn.width).toBe(30);
    expect(pkColumn.maxWidth).toBe(30);
  });

  test("creates column name column second", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const columnNameCol = getColumn(columns, 1);

    expect(columnNameCol.key).toBe("0");
    expect(columnNameCol.name).toBe("Column");
    expect(columnNameCol.resizable).toBe(true);
  });

  test("creates matched count column third", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const matchedColumn = getColumn(columns, 2);

    expect(matchedColumn.key).toBe("1");
    expect(matchedColumn.name).toBe("Matched");
  });

  test("creates matched percent column fourth", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const percentColumn = getColumn(columns, 3);

    expect(percentColumn.key).toBe("2");
    expect(percentColumn.name).toBe("Matched %");
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

    // Primary key column should exist and have renderCell
    expect(pkColumn.key).toBe("__is_pk__");
    expect(pkColumn.renderCell).toBeDefined();
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

    expect(pkColumn.key).toBe("__is_pk__");
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

  test("cellClass returns 'diff-cell-modified' for values < 100%", () => {
    const result = createValueDiffResult([["id", 80, 0.8]]);
    const params = createValueDiffParams();

    const { columns, rows } = toValueDataGrid(result, { params });
    const percentColumn = getColumn(columns, 3);

    const cellClassFn = percentColumn.cellClass as (
      row: RowObjectType,
    ) => string | undefined;
    const cellClass = cellClassFn(rows[0]);
    expect(cellClass).toBe("diff-cell-modified");
  });

  test("cellClass returns undefined for 100% match", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns, rows } = toValueDataGrid(result, { params });
    const percentColumn = getColumn(columns, 3);

    const cellClassFn = percentColumn.cellClass as (
      row: RowObjectType,
    ) => string | undefined;
    const cellClass = cellClassFn(rows[0]);
    expect(cellClass).toBeUndefined();
  });
});

// ============================================================================
// Column Name Cell Tests
// ============================================================================

describe("toValueDataGrid - Column Name Cell", () => {
  test("column name column has renderCell function", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const columnNameCol = getColumn(columns, 1);

    expect(columnNameCol.renderCell).toBeDefined();
  });

  test("column name column has context menu cell class", () => {
    const result = createValueDiffResult([["id", 100, 1.0]]);
    const params = createValueDiffParams();

    const { columns } = toValueDataGrid(result, { params });
    const columnNameCol = getColumn(columns, 1);

    expect(columnNameCol.cellClass).toBe("cell-show-context-menu");
  });
});
