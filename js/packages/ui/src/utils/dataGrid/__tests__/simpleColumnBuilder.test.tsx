/**
 * @file simpleColumnBuilder.test.tsx
 * @description Tests for simple column definition builder
 *
 * Tests cover:
 * - buildSimpleColumnDefinitions: Main function for building column definitions
 * - Primary key column generation
 * - Regular column generation
 * - Index fallback behavior
 * - Render component injection
 */

import type { ColDef } from "ag-grid-community";
import React from "react";
import { vi } from "vitest";
import type { RowObjectType } from "../../../api";
import type { ColumnConfig } from "../columnBuilders";
import type { SimpleColumnRenderComponents } from "../renderTypes";
import {
  BuildSimpleColumnDefinitionsConfig,
  buildSimpleColumnDefinitions,
  SimpleColumnDefinition,
} from "../simpleColumnBuilder";
import type { RecceColumnContext } from "../toDiffColumn";

// ============================================================================
// Mock Render Components
// ============================================================================

const mockRenderComponents: SimpleColumnRenderComponents = {
  DataFrameColumnGroupHeader: ({ name }) => (
    <div data-testid="group-header">{name}</div>
  ),
  DataFrameColumnHeader: ({ name }) => <div data-testid="header">{name}</div>,
  defaultRenderCell: vi.fn(() => null),
};

// ============================================================================
// Helper Functions
// ============================================================================

type SingleColumn = ColDef<RowObjectType> & { context?: RecceColumnContext };

function isColumn(col: SimpleColumnDefinition): col is SingleColumn {
  return "field" in col && !("children" in col);
}

function getColumnKey(col: SimpleColumnDefinition): string | undefined {
  if (isColumn(col)) {
    return (col as SingleColumn).field;
  }
  return undefined;
}

function findColumnByKey(
  columns: SimpleColumnDefinition[],
  key: string,
): SimpleColumnDefinition | undefined {
  return columns.find((col) => {
    if (isColumn(col)) {
      return (col as SingleColumn).field === key;
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
  }),
];

const createConfig = (
  overrides: Partial<BuildSimpleColumnDefinitionsConfig> = {},
): BuildSimpleColumnDefinitionsConfig => ({
  columns: createStandardColumns(),
  headerProps: {
    pinnedColumns: [],
  },
  renderComponents: mockRenderComponents,
  ...overrides,
});

// ============================================================================
// Basic Functionality Tests
// ============================================================================

describe("buildSimpleColumnDefinitions - Basic Functionality", () => {
  test("generates column definitions from ColumnConfig array", () => {
    const result = buildSimpleColumnDefinitions(createConfig());

    expect(result.columns).toHaveLength(3);
    expect(result.usedIndexFallback).toBe(false);
  });

  test("returns usedIndexFallback as false when PKs exist", () => {
    const result = buildSimpleColumnDefinitions(createConfig());
    expect(result.usedIndexFallback).toBe(false);
  });

  test("handles empty columns array with allowIndexFallback false", () => {
    const result = buildSimpleColumnDefinitions(
      createConfig({ columns: [], allowIndexFallback: false }),
    );

    expect(result.columns).toHaveLength(0);
    expect(result.usedIndexFallback).toBe(false);
  });

  test("handles empty columns array with default allowIndexFallback (adds index)", () => {
    const result = buildSimpleColumnDefinitions(createConfig({ columns: [] }));

    // With default allowIndexFallback=true and no columns, index fallback is added
    expect(result.columns).toHaveLength(1);
    expect(result.usedIndexFallback).toBe(true);
    expect(getColumnKey(result.columns[0])).toBe("_index");
  });

  test("preserves column order from input", () => {
    const columns = [
      createColumnConfig({ key: "first", name: "first", isPrimaryKey: true }),
      createColumnConfig({ key: "second", name: "second" }),
      createColumnConfig({ key: "third", name: "third" }),
    ];

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

    const keys = result.columns.map(getColumnKey);
    expect(keys[0]).toBe("first");
    expect(keys[1]).toBe("second");
    expect(keys[2]).toBe("third");
  });
});

// ============================================================================
// Primary Key Column Tests
// ============================================================================

describe("buildSimpleColumnDefinitions - Primary Key Columns", () => {
  test("marks primary key columns as pinned left", () => {
    const result = buildSimpleColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      expect((pkColumn as SingleColumn).pinned).toBe("left");
    }
  });

  test("primary key columns use DataFrameColumnGroupHeader", () => {
    const result = buildSimpleColumnDefinitions(createConfig());

    const pkColumn = findColumnByKey(result.columns, "id");
    expect(pkColumn).toBeDefined();
    if (pkColumn && isColumn(pkColumn)) {
      // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
      expect((pkColumn as any).headerComponent).toBeDefined();
    }
  });

  test("primary key columns use injected defaultRenderCell", () => {
    const result = buildSimpleColumnDefinitions(createConfig());

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

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

    const pinnedColumns = result.columns.filter(
      (c) => isColumn(c) && (c as SingleColumn).pinned === "left",
    );
    expect(pinnedColumns).toHaveLength(2);
  });
});

// ============================================================================
// Regular Column Tests
// ============================================================================

describe("buildSimpleColumnDefinitions - Regular Columns", () => {
  test("regular columns use DataFrameColumnHeader", () => {
    const result = buildSimpleColumnDefinitions(createConfig());

    const nameColumn = findColumnByKey(result.columns, "name");
    expect(nameColumn).toBeDefined();
    if (nameColumn && isColumn(nameColumn)) {
      // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
      expect((nameColumn as any).headerComponent).toBeDefined();
    }
  });

  test("regular columns use injected defaultRenderCell", () => {
    const result = buildSimpleColumnDefinitions(createConfig());

    const nameColumn = findColumnByKey(result.columns, "name");
    expect(nameColumn).toBeDefined();
    if (nameColumn && isColumn(nameColumn)) {
      expect((nameColumn as SingleColumn).cellRenderer).toBe(
        mockRenderComponents.defaultRenderCell,
      );
    }
  });

  test("frozen non-PK columns are pinned left", () => {
    const columns = [
      createColumnConfig({ key: "id", name: "id", isPrimaryKey: true }),
      createColumnConfig({ key: "frozen", name: "frozen", frozen: true }),
      createColumnConfig({ key: "normal", name: "normal" }),
    ];

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

    const frozenColumn = findColumnByKey(result.columns, "frozen");
    const normalColumn = findColumnByKey(result.columns, "normal");

    if (frozenColumn && isColumn(frozenColumn)) {
      expect((frozenColumn as SingleColumn).pinned).toBe("left");
    }
    if (normalColumn && isColumn(normalColumn)) {
      expect((normalColumn as SingleColumn).pinned).toBeUndefined();
    }
  });
});

// ============================================================================
// Index Fallback Tests
// ============================================================================

describe("buildSimpleColumnDefinitions - Index Fallback", () => {
  test("adds index column when no PKs and allowIndexFallback is true", () => {
    const columns = [
      createColumnConfig({ key: "name", name: "name" }),
      createColumnConfig({ key: "value", name: "value" }),
    ];

    const result = buildSimpleColumnDefinitions(
      createConfig({
        columns,
        allowIndexFallback: true,
      }),
    );

    expect(result.usedIndexFallback).toBe(true);
    expect(getColumnKey(result.columns[0])).toBe("_index");
  });

  test("index column has correct configuration", () => {
    const result = buildSimpleColumnDefinitions(
      createConfig({
        columns: [createColumnConfig({ key: "value", name: "value" })],
        allowIndexFallback: true,
      }),
    );

    const indexColumn = result.columns[0];
    expect(isColumn(indexColumn)).toBe(true);
    if (isColumn(indexColumn)) {
      const col = indexColumn as SingleColumn;
      expect(col.field).toBe("_index");
      expect(col.headerName).toBe("");
      expect(col.width).toBe(50);
      expect(col.cellClass).toBe("index-column");
    }
  });

  test("does not add index column when PKs exist", () => {
    const result = buildSimpleColumnDefinitions(
      createConfig({ allowIndexFallback: true }),
    );

    expect(result.usedIndexFallback).toBe(false);
    expect(getColumnKey(result.columns[0])).not.toBe("_index");
  });

  test("adds index column by default when no PKs (allowIndexFallback defaults to true)", () => {
    const columns = [createColumnConfig({ key: "value", name: "value" })];

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

    expect(result.usedIndexFallback).toBe(true);
  });

  test("does not add index column when allowIndexFallback is false", () => {
    const columns = [createColumnConfig({ key: "value", name: "value" })];

    const result = buildSimpleColumnDefinitions(
      createConfig({
        columns,
        allowIndexFallback: false,
      }),
    );

    expect(result.usedIndexFallback).toBe(false);
  });
});

// ============================================================================
// Render Component Injection Tests
// ============================================================================

describe("buildSimpleColumnDefinitions - Render Component Injection", () => {
  test("uses injected render components", () => {
    const customDefaultRenderer = vi.fn();
    const customGroupHeader = ({ name }: { name: string }) => (
      <div data-testid="custom-group">{name}</div>
    );
    const customHeader = ({ name }: { name: string }) => (
      <div data-testid="custom">{name}</div>
    );

    const result = buildSimpleColumnDefinitions(
      createConfig({
        renderComponents: {
          DataFrameColumnGroupHeader: customGroupHeader,
          DataFrameColumnHeader: customHeader,
          defaultRenderCell: customDefaultRenderer,
        },
      }),
    );

    // All columns should use the custom renderer
    result.columns.forEach((col) => {
      if (isColumn(col) && (col as SingleColumn).field !== "_index") {
        expect((col as SingleColumn).cellRenderer).toBe(customDefaultRenderer);
      }
    });
  });
});

// ============================================================================
// Column Metadata Tests
// ============================================================================

describe("buildSimpleColumnDefinitions - Column Metadata", () => {
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

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

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

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

    const percentageCol = findColumnByKey(result.columns, "percentage");
    expect(percentageCol?.context?.columnRenderMode).toBe("percent");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("buildSimpleColumnDefinitions - Edge Cases", () => {
  test("handles columns with special characters", () => {
    const columns = [
      createColumnConfig({ key: "col-with-dashes", name: "col-with-dashes" }),
      createColumnConfig({ key: "col.with.dots", name: "col.with.dots" }),
    ];

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

    expect(result.columns).toHaveLength(3); // 2 columns + index fallback
  });

  test("handles all columns being primary keys", () => {
    const columns = [
      createColumnConfig({ key: "pk1", name: "pk1", isPrimaryKey: true }),
      createColumnConfig({ key: "pk2", name: "pk2", isPrimaryKey: true }),
    ];

    const result = buildSimpleColumnDefinitions(createConfig({ columns }));

    const allPinned = result.columns.every(
      (c) => isColumn(c) && (c as SingleColumn).pinned === "left",
    );
    expect(allPinned).toBe(true);
    expect(result.usedIndexFallback).toBe(false);
  });
});
