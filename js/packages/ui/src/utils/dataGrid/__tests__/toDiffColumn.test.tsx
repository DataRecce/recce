/**
 * @file toDiffColumn.test.tsx
 * @description Tests for toDiffColumn shared column builder
 *
 * Tests cover:
 * - createCellClassBase factory function
 * - createCellClassCurrent factory function
 * - toDiffColumn inline mode
 * - toDiffColumn side_by_side mode
 * - Column metadata preservation
 * - Header cell class assignment
 * - Render component injection
 */

import type { CellClassParams } from "ag-grid-community";
import React from "react";
import type { ColumnRenderMode, ColumnType, RowObjectType } from "../../../api";
import type { DiffColumnRenderComponents } from "../renderTypes";
import {
  createCellClassBase,
  createCellClassCurrent,
  DiffColumnConfig,
  DiffColumnResult,
  toDiffColumn,
} from "../toDiffColumn";

// ============================================================================
// Mocks
// ============================================================================

// Mock render components for testing
const mockRenderComponents: DiffColumnRenderComponents = {
  DataFrameColumnGroupHeader: ({ name }) => (
    <div data-testid="header">{name}</div>
  ),
  defaultRenderCell: jest.fn(() => null),
  inlineRenderCell: jest.fn(() => null),
};

// ============================================================================
// Types for testing
// ============================================================================

interface TestColumnContext {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

interface TestColumn {
  field: string;
  headerName?: string;
  headerComponent?: React.ComponentType;
  headerClass?: string;
  cellClass?:
    | string
    | ((params: CellClassParams<RowObjectType>) => string | undefined);
  cellRenderer?: unknown;
  context?: TestColumnContext;
}

interface TestColumnGroup {
  headerName?: string;
  headerClass?: string;
  children: readonly TestColumn[];
  context?: TestColumnContext;
}

// ============================================================================
// Test Helpers
// ============================================================================

const createRow = (
  values: Record<string, number | string | boolean | null | undefined>,
  status: "added" | "removed" | "modified" | undefined = undefined,
): RowObjectType => ({
  ...values,
  __status: status,
});

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

const createConfig = (
  overrides: Partial<DiffColumnConfig> = {},
): DiffColumnConfig => ({
  name: "test_column",
  columnStatus: "",
  columnType: "text",
  displayMode: "inline",
  renderComponents: mockRenderComponents,
  ...overrides,
});

function isColumn(result: DiffColumnResult): boolean {
  return "field" in result && !("children" in result);
}

function isColumnGroup(result: DiffColumnResult): boolean {
  return (
    "children" in result &&
    Array.isArray((result as unknown as TestColumnGroup).children)
  );
}

function asColumn(result: DiffColumnResult): TestColumn {
  return result as unknown as TestColumn;
}

function asColumnGroup(result: DiffColumnResult): TestColumnGroup {
  return result as unknown as TestColumnGroup;
}

function getChildren(result: DiffColumnResult): TestColumn[] {
  return asColumnGroup(result).children as TestColumn[];
}

// ============================================================================
// createCellClassBase Tests
// ============================================================================

describe("createCellClassBase", () => {
  test("returns a function", () => {
    const cellClassFn = createCellClassBase("value", "");
    expect(typeof cellClassFn).toBe("function");
  });

  test("returns 'diff-cell-removed' for removed row status", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({}, "removed");
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-removed");
  });

  test("returns 'diff-cell-added' for added row status", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({}, "added");
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-added");
  });

  test("returns undefined for added column status", () => {
    const cellClassFn = createCellClassBase("value", "added");
    const row = createRow({ base__value: 100, current__value: 200 });
    expect(cellClassFn(createCellClassParams(row))).toBeUndefined();
  });

  test("returns undefined for removed column status", () => {
    const cellClassFn = createCellClassBase("value", "removed");
    const row = createRow({ base__value: 100, current__value: 200 });
    expect(cellClassFn(createCellClassParams(row))).toBeUndefined();
  });

  test("returns 'diff-cell-removed' when base and current values differ", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({ base__value: 100, current__value: 200 });
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-removed");
  });

  test("returns undefined when base and current values are equal", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({ base__value: 100, current__value: 100 });
    expect(cellClassFn(createCellClassParams(row))).toBeUndefined();
  });

  test("handles case-insensitive key lookup (lowercase)", () => {
    const cellClassFn = createCellClassBase("Value", "");
    const row = createRow({ base__value: 100, current__value: 200 });
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-removed");
  });

  test("handles null values", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({ base__value: null, current__value: "test" });
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-removed");
  });

  test("handles undefined values (both undefined = equal)", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({});
    expect(cellClassFn(createCellClassParams(row))).toBeUndefined();
  });
});

// ============================================================================
// createCellClassCurrent Tests
// ============================================================================

describe("createCellClassCurrent", () => {
  test("returns a function", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    expect(typeof cellClassFn).toBe("function");
  });

  test("returns 'diff-cell-removed' for removed row status", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({}, "removed");
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-removed");
  });

  test("returns 'diff-cell-added' for added row status", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({}, "added");
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-added");
  });

  test("returns 'diff-cell-added' when base and current values differ", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({ base__value: 100, current__value: 200 });
    expect(cellClassFn(createCellClassParams(row))).toBe("diff-cell-added");
  });

  test("returns undefined when base and current values are equal", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({ base__value: 100, current__value: 100 });
    expect(cellClassFn(createCellClassParams(row))).toBeUndefined();
  });
});

// ============================================================================
// toDiffColumn - Inline Mode Tests
// ============================================================================

describe("toDiffColumn - inline mode", () => {
  test("returns column with field matching column name", () => {
    const result = toDiffColumn(createConfig({ name: "price" }));

    expect(isColumn(result)).toBe(true);
    const col = asColumn(result);
    expect(col.field).toBe("price");
  });

  test("does not have children property", () => {
    const result = toDiffColumn(createConfig({ displayMode: "inline" }));
    expect(isColumnGroup(result)).toBe(false);
  });

  test("uses injected inlineRenderCell", () => {
    const result = toDiffColumn(createConfig({ displayMode: "inline" }));

    expect(isColumn(result)).toBe(true);
    const col = asColumn(result);
    expect(col.cellRenderer).toBe(mockRenderComponents.inlineRenderCell);
  });

  test("preserves columnType", () => {
    const result = toDiffColumn(
      createConfig({ columnType: "number", displayMode: "inline" }),
    );
    expect(result.context?.columnType).toBe("number");
  });

  test("preserves columnRenderMode", () => {
    const result = toDiffColumn(
      createConfig({ columnRenderMode: "percent", displayMode: "inline" }),
    );
    expect(result.context?.columnRenderMode).toBe("percent");
  });

  test("sets headerClass for added column", () => {
    const result = toDiffColumn(
      createConfig({ columnStatus: "added", displayMode: "inline" }),
    );
    expect(result.headerClass).toBe("diff-header-added");
  });

  test("sets headerClass for removed column", () => {
    const result = toDiffColumn(
      createConfig({ columnStatus: "removed", displayMode: "inline" }),
    );
    expect(result.headerClass).toBe("diff-header-removed");
  });

  test("headerClass is undefined for empty status", () => {
    const result = toDiffColumn(
      createConfig({ columnStatus: "", displayMode: "inline" }),
    );
    expect(result.headerClass).toBeUndefined();
  });

  test("has headerComponent", () => {
    const result = toDiffColumn(createConfig({ displayMode: "inline" }));
    // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
    expect((result as any).headerComponent).toBeDefined();
  });
});

// ============================================================================
// toDiffColumn - Side-by-Side Mode Tests
// ============================================================================

describe("toDiffColumn - side_by_side mode", () => {
  test("returns column group with children", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));
    expect(isColumnGroup(result)).toBe(true);
  });

  test("has exactly 2 children (base and current)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));
    const children = getChildren(result);
    expect(children).toHaveLength(2);
  });

  test("children have correct fields (base__name and current__name)", () => {
    const result = toDiffColumn(
      createConfig({ name: "value", displayMode: "side_by_side" }),
    );

    const children = getChildren(result);
    const fields = children.map((child) => child.field);
    expect(fields).toContain("base__value");
    expect(fields).toContain("current__value");
  });

  test("uses default titles 'Base' and 'Current'", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));
    const children = getChildren(result);
    const names = children.map((child) => child.headerName);
    expect(names).toContain("Base");
    expect(names).toContain("Current");
  });

  test("uses custom baseTitle and currentTitle", () => {
    const result = toDiffColumn(
      createConfig({
        displayMode: "side_by_side",
        baseTitle: "Before",
        currentTitle: "After",
      }),
    );

    const children = getChildren(result);
    const names = children.map((child) => child.headerName);
    expect(names).toContain("Before");
    expect(names).toContain("After");
  });

  test("children use injected defaultRenderCell", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    const children = getChildren(result);
    children.forEach((child) => {
      expect(child.cellRenderer).toBe(mockRenderComponents.defaultRenderCell);
    });
  });

  test("children have cellClass functions", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    const children = getChildren(result);
    children.forEach((child) => {
      expect(typeof child.cellClass).toBe("function");
    });
  });

  test("has headerGroupComponent", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));
    // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
    expect((result as any).headerGroupComponent).toBeDefined();
  });
});

// ============================================================================
// Render Component Injection Tests
// ============================================================================

describe("toDiffColumn - render component injection", () => {
  test("uses injected DataFrameColumnGroupHeader", () => {
    const customHeader = ({ name }: { name: string }) => (
      <div data-testid="custom-header">{name}</div>
    );

    const result = toDiffColumn(
      createConfig({
        renderComponents: {
          ...mockRenderComponents,
          DataFrameColumnGroupHeader: customHeader,
        },
      }),
    );

    // biome-ignore lint/suspicious/noExplicitAny: Accessing AG Grid internal property for testing
    expect((result as any).headerComponent).toBeDefined();
  });

  test("uses injected inlineRenderCell for inline mode", () => {
    const customInlineRenderer = jest.fn();

    const result = toDiffColumn(
      createConfig({
        displayMode: "inline",
        renderComponents: {
          ...mockRenderComponents,
          inlineRenderCell: customInlineRenderer,
        },
      }),
    );

    const col = asColumn(result);
    expect(col.cellRenderer).toBe(customInlineRenderer);
  });

  test("uses injected defaultRenderCell for side_by_side mode", () => {
    const customDefaultRenderer = jest.fn();

    const result = toDiffColumn(
      createConfig({
        displayMode: "side_by_side",
        renderComponents: {
          ...mockRenderComponents,
          defaultRenderCell: customDefaultRenderer,
        },
      }),
    );

    const children = getChildren(result);
    children.forEach((child) => {
      expect(child.cellRenderer).toBe(customDefaultRenderer);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("toDiffColumn - edge cases", () => {
  test("handles empty column name", () => {
    const result = toDiffColumn(createConfig({ name: "" }));
    const col = asColumn(result);
    expect(col.field).toBe("");
  });

  test("handles column name with special characters", () => {
    const result = toDiffColumn(createConfig({ name: "col-with-dashes" }));
    const col = asColumn(result);
    expect(col.field).toBe("col-with-dashes");
  });

  test("handles various columnType values", () => {
    const types = [
      "text",
      "number",
      "integer",
      "boolean",
      "date",
      "datetime",
      "unknown",
    ] as const;

    types.forEach((type) => {
      const result = toDiffColumn(createConfig({ columnType: type }));
      expect(result.context?.columnType).toBe(type);
    });
  });
});
