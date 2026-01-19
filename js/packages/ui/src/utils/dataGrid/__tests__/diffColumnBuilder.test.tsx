/**
 * @file diffColumnBuilder.test.tsx
 * @description Tests for diff column definition builder
 *
 * Tests cover:
 * - buildDiffColumnDefinitions: Main function for building column definitions
 * - Primary key column generation (frozen, special cellClass)
 * - Diff column generation (inline vs side_by_side modes)
 * - Index fallback behavior when no PKs
 * - Render component injection
 */

import type { CellClassParams, ColDef, ColGroupDef } from "ag-grid-community";
import React from "react";
import { vi } from "vitest";
import type { RowObjectType } from "../../../api";
import type { ColumnConfig } from "../columnBuilders";
import {
  BuildDiffColumnDefinitionsConfig,
  buildDiffColumnDefinitions,
  DiffColumnDefinition,
} from "../diffColumnBuilder";
import type { DiffColumnRenderComponents } from "../renderTypes";
import type { RecceColumnContext } from "../toDiffColumn";

// ============================================================================
// Mock Render Components
// ============================================================================

const mockRenderComponents: DiffColumnRenderComponents = {
  DataFrameColumnGroupHeader: ({ name }) => (
    <div data-testid="header">{name}</div>
  ),
  defaultRenderCell: vi.fn(() => null),
  inlineRenderCell: vi.fn(() => null),
};

// ============================================================================
// Helper Functions
// ============================================================================

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

type SingleColumn = ColDef<RowObjectType> & { context?: RecceColumnContext };
type ColumnGroup = ColGroupDef<RowObjectType> & {
  context?: RecceColumnContext;
};

function isColumn(col: DiffColumnDefinition): col is SingleColumn {
  return "field" in col && !("children" in col);
}

function isColumnGroup(col: DiffColumnDefinition): col is ColumnGroup {
  return "children" in col && Array.isArray(col.children);
}

function getColumnKey(col: DiffColumnDefinition): string | undefined {
  if (isColumn(col)) {
    return (col as SingleColumn).field;
  }
  return undefined;
}

function findColumnByKey(
  columns: DiffColumnDefinition[],
  key: string,
): DiffColumnDefinition | undefined {
  return columns.find((col) => {
    if (isColumn(col)) {
      return (col as SingleColumn).field === key;
    }
    if (isColumnGroup(col)) {
      const groupCol = col as ColumnGroup;
      return groupCol.children?.some(
        (child: ColDef<RowObjectType>) =>
          "field" in child && child.field === `base__${key}`,
      );
    }
    return false;
  });
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createColumnConfig = (
  overrides: Partial<ColumnConfig> = {},
): ColumnConfig => ({
  key: "test_column",
  name: "test_column",
  columnType: "text",
  ...overrides,
});

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

const createConfig = (
  overrides: Partial<BuildDiffColumnDefinitionsConfig> = {},
): BuildDiffColumnDefinitionsConfig => ({
  columns: createStandardColumns(),
  displayMode: "inline",
  headerProps: {
    primaryKeys: ["id"],
    pinnedColumns: [],
  },
  renderComponents: mockRenderComponents,
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
    const result = buildDiffColumnDefinitions(createConfig({ columns: [] }));

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
  test("marks primary key columns as pinned left", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      expect((pkColumn as SingleColumn).pinned).toBe("left");
    }
  });

  test("primary key columns have cellClass function", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      expect(typeof (pkColumn as SingleColumn).cellClass).toBe("function");
    }
  });

  test("primary key cellClass returns status-based class", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      const col = pkColumn as SingleColumn;
      if (typeof col.cellClass === "function") {
        const cellClassFn = col.cellClass as (
          params: CellClassParams<RowObjectType>,
        ) => string | undefined;

        expect(cellClassFn(createCellClassParams({ __status: "added" }))).toBe(
          "diff-header-added",
        );
        expect(
          cellClassFn(createCellClassParams({ __status: "removed" })),
        ).toBe("diff-header-removed");
        expect(
          cellClassFn(createCellClassParams({ __status: "modified" })),
        ).toBe("diff-header-modified");
        expect(
          cellClassFn(createCellClassParams({ __status: undefined })),
        ).toBeUndefined();
      }
    }
  });

  test("primary key columns use injected defaultRenderCell", () => {
    const result = buildDiffColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      expect((pkColumn as SingleColumn).cellRenderer).toBe(
        mockRenderComponents.defaultRenderCell,
      );
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
      (c) => isColumn(c) && (c as SingleColumn).pinned === "left",
    );
    expect(pinnedColumns).toHaveLength(2);
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
      const col = indexColumn as SingleColumn;
      expect(col.field).toBe("_index");
      expect(col.headerName).toBe("");
      expect(col.width).toBe(50);
      expect(col.maxWidth).toBe(100);
      expect(col.cellClass).toBe("index-column");
    }
  });

  test("does not add index column when PKs exist", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({ allowIndexFallback: true }),
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
  });
});

// ============================================================================
// Display Mode Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Display Modes", () => {
  test("inline mode creates single columns for non-PK columns", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({ displayMode: "inline" }),
    );

    const nonPkColumns = result.columns.filter(
      (c) => isColumn(c) && (c as SingleColumn).field !== "id",
    );
    nonPkColumns.forEach((col) => {
      expect(isColumnGroup(col)).toBe(false);
    });
  });

  test("side_by_side mode creates columns with children for non-PK columns", () => {
    const result = buildDiffColumnDefinitions(
      createConfig({ displayMode: "side_by_side" }),
    );

    // PK column should still be a regular column
    const pkColumn = result.columns[0];
    expect(isColumn(pkColumn)).toBe(true);
    if (isColumn(pkColumn)) {
      expect((pkColumn as SingleColumn).field).toBe("id");
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
});

// ============================================================================
// Render Component Injection Tests
// ============================================================================

describe("buildDiffColumnDefinitions - Render Component Injection", () => {
  test("uses injected render components", () => {
    const customDefaultRenderer = vi.fn();
    const customInlineRenderer = vi.fn();

    const result = buildDiffColumnDefinitions(
      createConfig({
        displayMode: "inline",
        renderComponents: {
          DataFrameColumnGroupHeader: ({ name }) => <div>{name}</div>,
          defaultRenderCell: customDefaultRenderer,
          inlineRenderCell: customInlineRenderer,
        },
      }),
    );

    // PK column uses defaultRenderCell
    const pkColumn = findColumnByKey(result.columns, "id");
    if (pkColumn && isColumn(pkColumn)) {
      expect((pkColumn as SingleColumn).cellRenderer).toBe(
        customDefaultRenderer,
      );
    }

    // Non-PK columns in inline mode use inlineRenderCell
    const nameColumn = findColumnByKey(result.columns, "name");
    if (nameColumn && isColumn(nameColumn)) {
      expect((nameColumn as SingleColumn).cellRenderer).toBe(
        customInlineRenderer,
      );
    }
  });

  test("passes render components to toDiffColumn", () => {
    const customInlineRenderer = vi.fn();

    const result = buildDiffColumnDefinitions(
      createConfig({
        displayMode: "inline",
        renderComponents: {
          ...mockRenderComponents,
          inlineRenderCell: customInlineRenderer,
        },
      }),
    );

    // Non-PK columns should use the custom inline renderer
    const nameColumn = findColumnByKey(result.columns, "name");
    if (nameColumn && isColumn(nameColumn)) {
      expect((nameColumn as SingleColumn).cellRenderer).toBe(
        customInlineRenderer,
      );
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

    expect(idCol?.context?.columnType).toBe("integer");
    expect(priceCol?.context?.columnType).toBe("number");
  });

  test("preserves columnRenderMode from config", () => {
    const columns = [
      createColumnConfig({
        key: "percentage",
        name: "percentage",
        columnType: "number",
        columnRenderMode: "percent",
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
    expect(percentageCol?.context?.columnRenderMode).toBe("percent");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("buildDiffColumnDefinitions - Edge Cases", () => {
  test("handles columns with special characters", () => {
    const columns = [
      createColumnConfig({ key: "col-with-dashes", name: "col-with-dashes" }),
      createColumnConfig({ key: "col.with.dots", name: "col.with.dots" }),
    ];

    const result = buildDiffColumnDefinitions(
      createConfig({
        columns,
        headerProps: { primaryKeys: [] },
      }),
    );

    expect(result.columns).toHaveLength(2);
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
      (c) => isColumn(c) && (c as SingleColumn).pinned === "left",
    );
    expect(allPinned).toBe(true);
  });
});
