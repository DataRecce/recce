/**
 * @file diffColumnBuilder.test.tsx
 * @description Tests for diff column definition builder
 *
 * Tests cover:
 * - buildDiffColumnDefinitions: Main function for building column definitions
 * - Primary key column generation (frozen, special cellClass)
 * - Diff column generation (inline vs side_by_side modes)
 * - Index fallback behavior when no PKs
 * - Header props propagation
 */

// Mock AG Grid modules
jest.mock("ag-grid-community", () => ({
  ModuleRegistry: { registerModules: jest.fn() },
  AllCommunityModule: {},
}));

// Mock MUI wrapper components
jest.mock("@/components/ui/mui", () => ({
  Box: ({ children }: { children: React.ReactNode }) => children,
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
  Text: ({ children }: { children: React.ReactNode }) => children,
}));

import type { CellClassParams, ColDef, ColGroupDef } from "ag-grid-community";
import React from "react";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
import { ColumnConfig } from "./columnBuilders";
import {
  BuildDiffColumnDefinitionsConfig,
  buildDiffColumnDefinitions,
  DiffColumnDefinition,
} from "./diffColumnBuilder";

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
// Type Guards
// ============================================================================

/**
 * Type guard to check if a column definition is a ColDef (has field)
 */
function isColumn(col: DiffColumnDefinition): col is ColDef<RowObjectType> & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
} {
  return "field" in col && !("children" in col);
}

/**
 * Type guard to check if a column definition is a ColGroupDef (has children)
 */
function isColumnGroup(
  col: DiffColumnDefinition,
): col is ColGroupDef<RowObjectType> & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
} {
  return "children" in col && Array.isArray(col.children);
}

/**
 * Helper to extract field from a column (works for both ColDef and ColGroupDef)
 */
function getColumnKey(col: DiffColumnDefinition): string | undefined {
  if (isColumn(col) && col.field) {
    return col.field;
  }
  return undefined;
}

/**
 * Helper to find a column by field
 */
function findColumnByKey(
  columns: DiffColumnDefinition[],
  key: string,
): DiffColumnDefinition | undefined {
  return columns.find((col) => {
    if (isColumn(col)) {
      return col.field === key;
    }
    // For ColGroupDefs in side_by_side mode, check children
    if (isColumnGroup(col) && col.children) {
      return col.children.some(
        (child) => "field" in child && child.field === `base__${key}`,
      );
    }
    return false;
  });
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a ColumnConfig for testing
 */
const createColumnConfig = (
  overrides: Partial<ColumnConfig> = {},
): ColumnConfig => ({
  key: "test_column",
  name: "test_column",
  columnType: "text",
  ...overrides,
});

/**
 * Creates standard column configs for testing
 */
const createStandardColumns = (): ColumnConfig[] => [
  createColumnConfig({
    key: "id",
    name: "id",
    columnType: "integer",
    isPrimaryKey: true,
    frozen: true,
  }),
  createColumnConfig({
    key: "name",
    name: "name",
    columnType: "text",
  }),
  createColumnConfig({
    key: "value",
    name: "value",
    columnType: "number",
    columnStatus: "modified",
  }),
];

/**
 * Creates a basic config for buildDiffColumnDefinitions
 */
const createConfig = (
  overrides: Partial<BuildDiffColumnDefinitionsConfig> = {},
): BuildDiffColumnDefinitionsConfig => ({
  columns: createStandardColumns(),
  displayMode: "inline",
  headerProps: {
    primaryKeys: ["id"],
    pinnedColumns: [],
  },
  ...overrides,
});

// ============================================================================
// Basic Functionality Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Basic Functionality", () => {
  test("generates column definitions from ColumnConfig array", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    expect(result.columns).toHaveLength(3);
    expect(result.usedIndexFallback).toBe(false);
  });

  test("returns usedIndexFallback as false when PKs exist", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    expect(result.usedIndexFallback).toBe(false);
  });

  test("handles empty columns array", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({
        columns: [],
      }),
    );

    expect(result.columns).toHaveLength(0);
    expect(result.usedIndexFallback).toBe(false);
  });

  test("preserves column order from input", () => {
    const columns = [
      createColumnConfig({ key: "first", name: "first", isPrimaryKey: true }),
      createColumnConfig({ key: "second", name: "second" }),
      createColumnConfig({ key: "third", name: "third" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: ["first"] },
      }),
    );

    const keys = result.columns.map(getColumnKey);
    expect(keys[0]).toBe("first");
    expect(keys[1]).toBe("second");
    expect(keys[2]).toBe("third");
  });
});

// ============================================================================
// Primary Key Column Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Primary Key Columns", () => {
  test("marks primary key columns as frozen", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      expect(pkColumn.pinned).toBe("left");
    }
  });

  test("primary key columns have cellClass function", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      expect(typeof pkColumn.cellClass).toBe("function");
    }
  });

  test("primary key cellClass returns status-based class", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (
      pkColumn &&
      isColumn(pkColumn) &&
      typeof pkColumn.cellClass === "function"
    ) {
      const cellClassFn = pkColumn.cellClass as (
        params: CellClassParams<RowObjectType>,
      ) => string | undefined;

      expect(cellClassFn(createCellClassParams({ __status: "added" }))).toBe(
        "diff-header-added",
      );
      expect(cellClassFn(createCellClassParams({ __status: "removed" }))).toBe(
        "diff-header-removed",
      );
      expect(cellClassFn(createCellClassParams({ __status: "modified" }))).toBe(
        "diff-header-modified",
      );
      expect(
        cellClassFn(createCellClassParams({ __status: undefined })),
      ).toBeUndefined();
    }
  });

  test("primary key columns have headerComponent", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
      expect((pkColumn as any).headerComponent).toBeDefined();
    }
  });

  test("primary key columns have cellRenderer function", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      expect(pkColumn.cellRenderer).toBeDefined();
    }
  });

  test("handles multiple primary key columns", () => {
    const columns = [
      createColumnConfig({
        key: "region",
        name: "region",
        columnType: "text",
        isPrimaryKey: true,
      }),
      createColumnConfig({
        key: "product",
        name: "product",
        columnType: "text",
        isPrimaryKey: true,
      }),
      createColumnConfig({ key: "sales", name: "sales", columnType: "number" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: ["region", "product"] },
      }),
    );

    const pinnedColumns = result.columns.filter(
      (c) => isColumn(c) && c.pinned === "left",
    );
    expect(pinnedColumns).toHaveLength(2);

    const pinnedKeys = pinnedColumns.map(getColumnKey);
    expect(pinnedKeys[0]).toBe("region");
    expect(pinnedKeys[1]).toBe("product");
  });
});

// ============================================================================
// Index Fallback Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Index Fallback", () => {
  test("adds index column when no PKs and allowIndexFallback is true", () => {
    const columns = [
      createColumnConfig({ key: "name", name: "name" }),
      createColumnConfig({ key: "value", name: "value" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        allowIndexFallback: true,
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(result.usedIndexFallback).toBe(true);
    expect(getColumnKey(result.columns[0])).toBe("_index");
  });

  test("index column has correct configuration", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({
        columns: [createColumnConfig({ key: "value", name: "value" })],
        allowIndexFallback: true,
        headerProps: { primaryKeys: [] },
      }),
    );

    const indexColumn = result.columns[0];
    expect(isColumn(indexColumn)).toBe(true);
    if (isColumn(indexColumn)) {
      expect(indexColumn.field).toBe("_index");
      expect(indexColumn.headerName).toBe("");
      expect(indexColumn.width).toBe(50);
      expect(indexColumn.maxWidth).toBe(100);
      expect(indexColumn.cellClass).toBe("index-column");
    }
  });

  test("does not add index column when PKs exist", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({
        allowIndexFallback: true,
      }),
    );

    expect(result.usedIndexFallback).toBe(false);
    expect(getColumnKey(result.columns[0])).not.toBe("_index");
  });

  test("does not add index column when allowIndexFallback is false", () => {
    const columns = [createColumnConfig({ key: "value", name: "value" })];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        allowIndexFallback: false,
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(result.usedIndexFallback).toBe(false);
    const indexColumn = result.columns.find(
      (c) => isColumn(c) && c.field === "_index",
    );
    expect(indexColumn).toBeUndefined();
  });

  test("index column appears before other columns", () => {
    const columns = [
      createColumnConfig({ key: "first", name: "first" }),
      createColumnConfig({ key: "second", name: "second" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        allowIndexFallback: true,
        headerProps: { primaryKeys: [] },
      }),
    );

    const keys = result.columns.map(getColumnKey);
    expect(keys[0]).toBe("_index");
    expect(keys[1]).toBe("first");
    expect(keys[2]).toBe("second");
  });
});

// ============================================================================
// Display Mode Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Display Modes", () => {
  test("inline mode creates single columns without children", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({
        displayMode: "inline",
      }),
    );

    const nonPkColumns = result.columns.filter(
      (c) => isColumn(c) && c.field !== "id",
    );
    nonPkColumns.forEach((col) => {
      expect(isColumnGroup(col)).toBe(false);
    });
  });

  test("side_by_side mode creates columns with children for non-PK columns", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({
        displayMode: "side_by_side",
      }),
    );

    // PK column should still be a regular column
    const pkColumn = result.columns[0];
    expect(isColumn(pkColumn)).toBe(true);
    if (isColumn(pkColumn)) {
      expect(pkColumn.field).toBe("id");
    }

    // Non-PK columns should be column groups with children
    const nonPkColumns = result.columns.slice(1);
    nonPkColumns.forEach((col) => {
      expect(isColumnGroup(col)).toBe(true);
      if (isColumnGroup(col)) {
        expect(col.children).toHaveLength(2);
      }
    });
  });

  test("side_by_side mode creates base and current child columns", () => {
    const columns = [
      createColumnConfig({ key: "id", name: "id", isPrimaryKey: true }),
      createColumnConfig({ key: "value", name: "value" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        displayMode: "side_by_side",
        headerProps: { primaryKeys: ["id"] },
      }),
    );

    const valueColumn = result.columns[1];
    expect(isColumnGroup(valueColumn)).toBe(true);
    if (isColumnGroup(valueColumn) && valueColumn.children) {
      const childKeys = valueColumn.children.map((child) =>
        "field" in child ? child.field : undefined,
      );
      expect(childKeys[0]).toBe("base__value");
      expect(childKeys[1]).toBe("current__value");
    }
  });

  test("side_by_side mode uses custom base/current titles", () => {
    const columns = [createColumnConfig({ key: "value", name: "value" })];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        displayMode: "side_by_side",
        baseTitle: "Before",
        currentTitle: "After",
        headerProps: { primaryKeys: [] },
      }),
    );

    const valueColumn = result.columns[0];
    expect(isColumnGroup(valueColumn)).toBe(true);
    if (isColumnGroup(valueColumn) && valueColumn.children) {
      const childNames = valueColumn.children.map(
        (child) => (child as ColDef<RowObjectType>).headerName,
      );
      expect(childNames[0]).toBe("Before");
      expect(childNames[1]).toBe("After");
    }
  });

  test("side_by_side mode uses default titles when not specified", () => {
    const columns = [createColumnConfig({ key: "value", name: "value" })];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        displayMode: "side_by_side",
        headerProps: { primaryKeys: [] },
      }),
    );

    const valueColumn = result.columns[0];
    expect(isColumnGroup(valueColumn)).toBe(true);
    if (isColumnGroup(valueColumn) && valueColumn.children) {
      const childNames = valueColumn.children.map(
        (child) => (child as ColDef<RowObjectType>).headerName,
      );
      expect(childNames[0]).toBe("Base");
      expect(childNames[1]).toBe("Current");
    }
  });
});

// ============================================================================
// Column Metadata Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Column Metadata", () => {
  test("preserves columnType from config", () => {
    const columns = [
      createColumnConfig({
        key: "id",
        name: "id",
        columnType: "integer",
        isPrimaryKey: true,
      }),
      createColumnConfig({
        key: "price",
        name: "price",
        columnType: "number",
      }),
      createColumnConfig({
        key: "name",
        name: "name",
        columnType: "text",
      }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        displayMode: "inline",
        headerProps: { primaryKeys: ["id"] },
      }),
    );

    const idCol = findColumnByKey(result.columns, "id");
    const priceCol = findColumnByKey(result.columns, "price");
    const nameCol = findColumnByKey(result.columns, "name");

    expect(idCol?.columnType).toBe("integer");
    expect(priceCol?.columnType).toBe("number");
    expect(nameCol?.columnType).toBe("text");
  });

  test("preserves columnRenderMode from config", () => {
    const columns = [
      createColumnConfig({
        key: "percentage",
        name: "percentage",
        columnType: "number",
        columnRenderMode: "percent",
      }),
      createColumnConfig({
        key: "decimal",
        name: "decimal",
        columnType: "number",
        columnRenderMode: 2,
      }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        displayMode: "inline",
        headerProps: { primaryKeys: [] },
      }),
    );

    const percentageCol = findColumnByKey(result.columns, "percentage");
    const decimalCol = findColumnByKey(result.columns, "decimal");

    expect(percentageCol?.columnRenderMode).toBe("percent");
    expect(decimalCol?.columnRenderMode).toBe(2);
  });

  test("handles undefined columnStatus", () => {
    const columns = [
      createColumnConfig({
        key: "col",
        name: "col",
        columnStatus: undefined,
      }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(result.columns).toHaveLength(1);
  });

  test("handles various column statuses", () => {
    const columns = [
      createColumnConfig({
        key: "added",
        name: "added",
        columnStatus: "added",
      }),
      createColumnConfig({
        key: "removed",
        name: "removed",
        columnStatus: "removed",
      }),
      createColumnConfig({
        key: "modified",
        name: "modified",
        columnStatus: "modified",
      }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        displayMode: "inline",
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(result.columns).toHaveLength(3);
  });
});

// ============================================================================
// Header Props Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Header Props", () => {
  test("passes headerProps to column headers", () => {
    const onPrimaryKeyChange = jest.fn();
    const onPinnedColumnsChange = jest.fn();

    const result = buildDiffColumnDefinitions(
      createConfig({
        headerProps: {
          primaryKeys: ["id"],
          pinnedColumns: ["name"],
          onPrimaryKeyChange,
          onPinnedColumnsChange,
        },
      }),
    );

    // Headers use headerComponent in AG Grid (for ColDef) or headerGroupComponent (for ColGroupDef)
    result.columns.forEach((col) => {
      const key = getColumnKey(col);
      if (key !== "_index") {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
        const hasHeader =
          // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
          (col as any).headerComponent || (col as any).headerGroupComponent;
        expect(hasHeader).toBeDefined();
      }
    });
  });

  test("handles empty headerProps", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({
        headerProps: {},
      }),
    );

    expect(result.columns.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("buildDiffColumnDefinitions - Edge Cases", () => {
  test("handles columns with same key and name", () => {
    const columns = [createColumnConfig({ key: "test", name: "test" })];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(getColumnKey(result.columns[0])).toBe("test");
  });

  test("handles columns with different key and name", () => {
    const columns = [
      createColumnConfig({ key: "col_0", name: "Display Name" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: [] },
      }),
    );

    // toDiffColumn uses 'name' as the column key for react-data-grid
    expect(getColumnKey(result.columns[0])).toBe("Display Name");
  });

  test("handles all columns being primary keys", () => {
    const columns = [
      createColumnConfig({ key: "pk1", name: "pk1", isPrimaryKey: true }),
      createColumnConfig({ key: "pk2", name: "pk2", isPrimaryKey: true }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: ["pk1", "pk2"] },
      }),
    );

    const allPinned = result.columns.every(
      (c) => isColumn(c) && c.pinned === "left",
    );
    expect(allPinned).toBe(true);
    expect(result.usedIndexFallback).toBe(false);
  });

  test("handles no primary keys with no index fallback", () => {
    const columns = [
      createColumnConfig({ key: "col1", name: "col1" }),
      createColumnConfig({ key: "col2", name: "col2" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        allowIndexFallback: false,
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(result.columns).toHaveLength(2);
    expect(result.usedIndexFallback).toBe(false);

    const anyPinned = result.columns.some(
      (c) => isColumn(c) && c.pinned === "left",
    );
    expect(anyPinned).toBe(false);
  });

  test("handles special characters in column names", () => {
    const columns = [
      createColumnConfig({ key: "col-with-dashes", name: "col-with-dashes" }),
      createColumnConfig({ key: "col.with.dots", name: "col.with.dots" }),
      createColumnConfig({
        key: "col_with_underscores",
        name: "col_with_underscores",
      }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(result.columns).toHaveLength(3);
  });
});
