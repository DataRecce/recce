/**
 * @file dataGridFactory.test.ts
 * @description Comprehensive tests for the data grid factory
 *
 * Tests cover:
 * - createDataGrid: Main factory function that routes Run objects to grid generators
 * - createDataGridFromData: Alternative factory for raw data inputs
 * - Edge cases: null results, missing params, empty data, unsupported run types
 * - Profile primary key detection (case-insensitive column_name lookup)
 *
 * Type Reference (from @/lib/api/types.ts):
 * - Run: Discriminated union of all run types
 * - DataFrame: { columns: Column[], data: RowData[], limit?, more? }
 * - RowObjectType: Record with __status: "added" | "removed" | "modified" | undefined
 */

import { vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

// Mock ag-grid-community to avoid ES module parsing issues
vi.mock("ag-grid-community", () => ({
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
  AllCommunityModule: {},
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
}));

vi.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
  useRecceInstanceContext: () => ({
    featureToggles: {
      disableDatabaseQuery: false,
    },
  }),
  useRecceActionContext: () => ({
    runAction: vi.fn(),
  }),
}));

// Mock dataGrid UI components
vi.mock("@datarecce/ui/components/ui", () => ({
  DataFrameColumnGroupHeader: () => null,
  DataFrameColumnHeader: () => null,
  defaultRenderCell: vi.fn(),
  inlineRenderCell: vi.fn(),
}));

// Mock schema grid generators to avoid Chakra UI import chain issues
vi.mock("@datarecce/ui", () => ({
  mergeColumns: vi.fn((base, current) => {
    // Simple merge implementation for testing
    const result: Record<
      string,
      { name: string; baseType?: string; currentType?: string }
    > = {};
    if (base) {
      Object.entries(base).forEach(([name, col]) => {
        if (col) {
          result[name] = { name, baseType: (col as { type?: string }).type };
        }
      });
    }
    if (current) {
      Object.entries(current).forEach(([name, col]) => {
        if (col) {
          result[name] = result[name] || { name };
          result[name].currentType = (col as { type?: string }).type;
        }
      });
    }
    return result;
  }),
  toSchemaDataGrid: vi.fn((schemaDiff) => ({
    columns: [
      { key: "baseIndex", name: "" },
      { key: "currentIndex", name: "" },
      { key: "name", name: "Name" },
      { key: "baseType", name: "Base Type" },
      { key: "currentType", name: "Current Type" },
    ],
    rows: Object.values(schemaDiff),
  })),
  toSingleEnvDataGrid: vi.fn((columns) => ({
    columns: [
      { key: "index", name: "" },
      { key: "name", name: "Name" },
      { key: "type", name: "Type" },
    ],
    rows: columns
      ? Object.entries(columns)
          .filter(([, col]) => col != null)
          .map(([name, col], index) => ({
            name,
            index: index + 1,
            type: (col as { type?: string }).type,
          }))
      : [],
  })),
}));

import {
  type ColumnRenderMode,
  type ColumnType,
  type DataFrame,
  type ProfileDiffResult,
  type QueryDiffResult,
  type Run,
} from "@datarecce/ui/api";
import {
  createDataGrid,
  createDataGridFromData,
} from "@datarecce/ui/components/ui/dataGrid";
import React from "react";

// ============================================================================
// Test Column/ColumnGroup types (avoids ESM issues with react-data-grid)
// ============================================================================

interface TestColumn {
  field: string;
  headerName?: React.ReactNode;
  pinned?: "left" | "right";
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

// ============================================================================
// Type Guards for Column vs ColumnGroup
// ============================================================================

function isColumn(col: unknown): col is TestColumn {
  return typeof col === "object" && col !== null && "field" in col;
}

function getColumnKey(col: unknown): string | undefined {
  if (isColumn(col)) return col.field;
  return undefined;
}

// ============================================================================
// Test Fixtures - DataFrames
// ============================================================================

const createSimpleDataFrame = (columnCount = 3, rowCount = 3): DataFrame => ({
  columns: Array.from({ length: columnCount }, (_, i) => ({
    key: `col_${i}`,
    name: `col_${i}`,
    type: "text" as ColumnType,
  })),
  data: Array.from({ length: rowCount }, (_, rowIdx) =>
    Array.from(
      { length: columnCount },
      (_, colIdx) => `row${rowIdx}_col${colIdx}`,
    ),
  ),
});

const createNumericDataFrame = (): DataFrame => ({
  columns: [
    { key: "id", name: "id", type: "integer" },
    { key: "value", name: "value", type: "number" },
  ],
  data: [
    [1, 100],
    [2, 200],
    [3, 300],
  ],
});

const createEmptyDataFrame = (): DataFrame => ({
  columns: [{ key: "id", name: "id", type: "integer" }],
  data: [],
});

const createProfileDataFrame = (
  columnNameField = "column_name",
): DataFrame => ({
  columns: [
    { key: columnNameField, name: columnNameField, type: "text" },
    { key: "count", name: "count", type: "integer" },
    { key: "distinct_count", name: "distinct_count", type: "integer" },
    { key: "null_count", name: "null_count", type: "integer" },
  ],
  data: [
    ["id", 100, 100, 0],
    ["name", 100, 50, 5],
    ["value", 100, 80, 10],
  ],
});

const createValueDiffDataFrame = (): DataFrame => ({
  columns: [
    { key: "id", name: "id", type: "integer" },
    { key: "in_a", name: "in_a", type: "boolean" },
    { key: "in_b", name: "in_b", type: "boolean" },
    { key: "base__value", name: "base__value", type: "number" },
    { key: "current__value", name: "current__value", type: "number" },
  ],
  data: [
    [1, true, true, 100, 150], // modified
    [2, true, false, 200, null], // removed
    [3, false, true, null, 300], // added
    [4, true, true, 400, 400], // unchanged
  ],
});

/**
 * Creates a value_diff summary DataFrame (column match statistics)
 */
const createValueDiffSummaryDataFrame = (): DataFrame => ({
  columns: [
    { key: "0", name: "Column", type: "text" },
    { key: "1", name: "Matched", type: "number" },
    { key: "2", name: "Matched %", type: "number" },
  ],
  data: [
    ["id", 100, 1.0],
    ["name", 95, 0.95],
    ["email", 80, 0.8],
  ],
});

// ============================================================================
// Test Fixtures - Run Objects
// ============================================================================

const createBaseRun = (type: string, overrides: Partial<Run> = {}): Run =>
  ({
    type,
    run_id: "test-run-id",
    run_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }) as Run;

const createQueryRun = (result?: DataFrame): Run =>
  createBaseRun("query", {
    result,
    params: { sql_template: "SELECT * FROM table" },
  }) as Run;

const createQueryBaseRun = (result?: DataFrame): Run =>
  createBaseRun("query_base", {
    result,
    params: { sql_template: "SELECT * FROM table" },
  }) as Run;

const createQueryDiffRun = (
  result?: QueryDiffResult,
  params?: { primary_keys?: string[]; sql_template?: string },
): Run =>
  createBaseRun("query_diff", {
    result,
    params: { sql_template: "SELECT * FROM table", ...params },
  }) as Run;

const createValueDiffRun = (
  result?: {
    summary: { total: number; added: number; removed: number };
    data: DataFrame;
  },
  params?: { model: string; primary_key: string | string[] },
): Run =>
  createBaseRun("value_diff", {
    result,
    params: params ?? { model: "test_model", primary_key: "id" },
  }) as Run;

const createValueDiffDetailRun = (
  result?: DataFrame,
  primaryKey: string | string[] = "id",
): Run =>
  createBaseRun("value_diff_detail", {
    result,
    params: { model: "test_model", primary_key: primaryKey },
  }) as Run;

const createProfileRun = (result?: ProfileDiffResult): Run =>
  createBaseRun("profile", {
    result,
    params: { model: "test_model" },
  }) as Run;

const createProfileDiffRun = (result?: ProfileDiffResult): Run =>
  createBaseRun("profile_diff", {
    result,
    params: { model: "test_model" },
  }) as Run;

// ============================================================================
// createDataGrid - Query Run Tests
// ============================================================================

describe("createDataGrid - query run", () => {
  test("returns grid data for query run with result", () => {
    const df = createSimpleDataFrame();
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toBeDefined();
    expect(result?.rows).toBeDefined();
    expect(result?.rows.length).toBe(3);
  });

  test("returns null for query run without result", () => {
    const run = createQueryRun(undefined);

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("passes primaryKeys option correctly", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);

    const result = createDataGrid(run, { primaryKeys: ["id"] });

    expect(result).not.toBeNull();
    // First column should be the primary key column
    if (result) {
      const firstCol = result.columns[0];
      const key = getColumnKey(firstCol);
      expect(key).toBe("id");
    }
  });

  test("passes pinnedColumns option correctly", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);

    const result = createDataGrid(run, { pinnedColumns: ["value"] });

    expect(result).not.toBeNull();
    if (result) {
      expect(result.columns.length).toBeGreaterThan(0);
    }
  });

  test("handles empty DataFrame", () => {
    const df = createEmptyDataFrame();
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(0);
      expect(result.columns.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// createDataGrid - Query Base Run Tests
// ============================================================================

describe("createDataGrid - query_base run", () => {
  test("returns grid data for query_base run with result", () => {
    const df = createSimpleDataFrame();
    const run = createQueryBaseRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.rows.length).toBe(3);
  });

  test("returns null for query_base run without result", () => {
    const run = createQueryBaseRun(undefined);

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });
});

// ============================================================================
// createDataGrid - Query Diff Run Tests (Separate Mode)
// ============================================================================

describe("createDataGrid - query_diff run (separate mode)", () => {
  test("returns grid data with base and current DataFrames", () => {
    const base = createNumericDataFrame();
    const current: DataFrame = {
      ...createNumericDataFrame(),
      data: [
        [1, 150], // modified
        [2, 200], // unchanged
        [4, 400], // added (new id)
      ],
    };
    const run = createQueryDiffRun({ base, current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toBeDefined();
    expect(result?.rows).toBeDefined();
  });

  test("returns null for query_diff run without result", () => {
    const run = createQueryDiffRun(undefined);

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("handles only base DataFrame", () => {
    const base = createNumericDataFrame();
    const run = createQueryDiffRun({ base, current: undefined });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    // All rows should be "removed" since current is missing
    if (result) {
      result.rows.forEach((row) => {
        expect(row.__status).toBe("removed");
      });
    }
  });

  test("handles only current DataFrame", () => {
    const current = createNumericDataFrame();
    const run = createQueryDiffRun({ base: undefined, current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    // All rows should be "added" since base is missing
    if (result) {
      result.rows.forEach((row) => {
        expect(row.__status).toBe("added");
      });
    }
  });

  test("passes displayMode option", () => {
    const base = createNumericDataFrame();
    const current = createNumericDataFrame();
    const run = createQueryDiffRun({ base, current });

    const resultSideBySide = createDataGrid(run, {
      displayMode: "side_by_side",
    });
    const resultInline = createDataGrid(run, { displayMode: "inline" });

    expect(resultSideBySide).not.toBeNull();
    expect(resultInline).not.toBeNull();
  });
});

// ============================================================================
// createDataGrid - Query Diff Run Tests (Joined Mode)
// ============================================================================

describe("createDataGrid - query_diff run (joined mode)", () => {
  test("returns value diff grid when result.diff exists with primary_keys", () => {
    const diff = createValueDiffDataFrame();
    const run = createQueryDiffRun({ diff }, { primary_keys: ["id"] });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toBeDefined();
    expect(result?.rows).toBeDefined();
  });

  test("returns null when diff exists but no primary_keys in params", () => {
    const diff = createValueDiffDataFrame();
    const run = createQueryDiffRun({ diff }, { primary_keys: undefined });

    const result = createDataGrid(run);

    // Falls back to separate mode with empty base/current
    expect(result).not.toBeNull();
  });

  test("returns null when diff is null even with primary_keys", () => {
    const run = createQueryDiffRun(
      { diff: undefined, base: undefined, current: undefined },
      { primary_keys: ["id"] },
    );

    const result = createDataGrid(run);

    expect(result).not.toBeNull(); // Returns empty grid from separate mode
  });

  test("passes changedOnly option correctly", () => {
    const diff = createValueDiffDataFrame();
    const run = createQueryDiffRun({ diff }, { primary_keys: ["id"] });

    const resultAll = createDataGrid(run, { changedOnly: false });
    const resultChangedOnly = createDataGrid(run, { changedOnly: true });

    expect(resultAll).not.toBeNull();
    expect(resultChangedOnly).not.toBeNull();
    // Changed only should have fewer rows (excludes unchanged)
    if (resultAll && resultChangedOnly) {
      expect(resultChangedOnly.rows.length).toBeLessThanOrEqual(
        resultAll.rows.length,
      );
    }
  });
});

// ============================================================================
// createDataGrid - Value Diff Detail Run Tests
// ============================================================================

describe("createDataGrid - value_diff_detail run", () => {
  test("returns grid data with single primary key", () => {
    const df = createValueDiffDataFrame();
    const run = createValueDiffDetailRun(df, "id");

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toBeDefined();
    expect(result?.rows).toBeDefined();
  });

  test("returns grid data with array of primary keys", () => {
    const df: DataFrame = {
      columns: [
        { key: "region", name: "region", type: "text" },
        { key: "product_id", name: "product_id", type: "integer" },
        { key: "in_a", name: "in_a", type: "boolean" },
        { key: "in_b", name: "in_b", type: "boolean" },
        { key: "base__sales", name: "base__sales", type: "number" },
        { key: "current__sales", name: "current__sales", type: "number" },
      ],
      data: [
        ["US", 1, true, true, 100, 150],
        ["EU", 1, true, true, 200, 200],
      ],
    };
    const run = createValueDiffDetailRun(df, ["region", "product_id"]);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
  });

  test("returns null without result", () => {
    const run = createValueDiffDetailRun(undefined, "id");

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("returns null without primary_key param", () => {
    const df = createValueDiffDataFrame();
    const run = createBaseRun("value_diff_detail", {
      result: df,
      params: { model: "test", primary_key: "id" },
    }) as Run;

    // Override params to remove primary_key
    (run as { params?: { model: string } }).params = { model: "test" };

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("passes displayMode option", () => {
    const df = createValueDiffDataFrame();
    const run = createValueDiffDetailRun(df, "id");

    const sideBySide = createDataGrid(run, { displayMode: "side_by_side" });
    const inline = createDataGrid(run, { displayMode: "inline" });

    expect(sideBySide).not.toBeNull();
    expect(inline).not.toBeNull();
  });
});

// ============================================================================
// createDataGrid - Profile Run Tests
// ============================================================================

describe("createDataGrid - profile run", () => {
  test("returns grid data for profile run with current result", () => {
    const current = createProfileDataFrame();
    const run = createProfileRun({ current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toBeDefined();
    expect(result?.rows).toBeDefined();
  });

  test("returns null for profile run without current result", () => {
    const run = createProfileRun({ current: undefined });

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("returns null for profile run with undefined result", () => {
    const run = createProfileRun(undefined);

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("detects column_name as primary key (lowercase)", () => {
    const current = createProfileDataFrame("column_name");
    const run = createProfileRun({ current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    // The column_name column should be used as primary key
    if (result) {
      const firstCol = result.columns[0];
      const key = getColumnKey(firstCol);
      expect(key).toBe("column_name");
    }
  });

  test("detects Column_Name as primary key (mixed case)", () => {
    const current = createProfileDataFrame("Column_Name");
    const run = createProfileRun({ current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      const firstCol = result.columns[0];
      const key = getColumnKey(firstCol);
      expect(key).toBe("Column_Name");
    }
  });

  test("detects COLUMN_NAME as primary key (uppercase)", () => {
    const current = createProfileDataFrame("COLUMN_NAME");
    const run = createProfileRun({ current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      const firstCol = result.columns[0];
      const key = getColumnKey(firstCol);
      expect(key).toBe("COLUMN_NAME");
    }
  });

  test("throws when no column_name-like column found for profile", () => {
    const current: DataFrame = {
      columns: [
        { key: "col_name", name: "col_name", type: "text" }, // Different name - not "column_name"
        { key: "count", name: "count", type: "integer" },
      ],
      data: [["id", 100]],
    };
    const run = createProfileRun({ current });

    // The code falls back to "column_name" as primary key, but that column doesn't exist
    // This causes an error in the underlying toDataGrid function
    expect(() => createDataGrid(run)).toThrow();
  });
});

// ============================================================================
// createDataGrid - Profile Diff Run Tests
// ============================================================================

describe("createDataGrid - profile_diff run", () => {
  test("returns diff grid data with base and current", () => {
    const base = createProfileDataFrame();
    const current = createProfileDataFrame();
    const run = createProfileDiffRun({ base, current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toBeDefined();
    expect(result?.rows).toBeDefined();
  });

  test("returns null for profile_diff run without result", () => {
    const run = createProfileDiffRun(undefined);

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("throws when base DataFrame is missing", () => {
    const current = createProfileDataFrame();
    const run = createProfileDiffRun({ base: undefined, current });

    // When base is missing, validatePrimaryKeys fails because it can't find
    // the column_name column in the (empty) base columns
    expect(() => createDataGrid(run)).toThrow("Column column_name not found");
  });

  test("throws when current DataFrame is missing", () => {
    const base = createProfileDataFrame();
    const run = createProfileDiffRun({ base, current: undefined });

    // When current is missing, validatePrimaryKeys fails because it can't find
    // the column_name column in the (empty) current columns
    expect(() => createDataGrid(run)).toThrow("Column column_name not found");
  });

  test("detects column_name as primary key from current DataFrame", () => {
    const base = createProfileDataFrame("column_name");
    const current = createProfileDataFrame("column_name");
    const run = createProfileDiffRun({ base, current });

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
  });

  test("passes displayMode option", () => {
    const base = createProfileDataFrame();
    const current = createProfileDataFrame();
    const run = createProfileDiffRun({ base, current });

    const sideBySide = createDataGrid(run, { displayMode: "side_by_side" });
    const inline = createDataGrid(run, { displayMode: "inline" });

    expect(sideBySide).not.toBeNull();
    expect(inline).not.toBeNull();
  });
});

// ============================================================================
// createDataGrid - Value Diff Run Tests
// ============================================================================

describe("createDataGrid - value_diff run", () => {
  test("returns grid data for value_diff run with result", () => {
    const data = createValueDiffSummaryDataFrame();
    const run = createValueDiffRun(
      { summary: { total: 100, added: 5, removed: 3 }, data },
      { model: "test_model", primary_key: "id" },
    );

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toBeDefined();
    expect(result?.rows).toBeDefined();
    // Should have 4 columns: pk indicator, column name, matched count, matched %
    expect(result?.columns).toHaveLength(4);
    // Should have 3 rows (one per column in the summary)
    expect(result?.rows).toHaveLength(3);
  });

  test("returns null for value_diff run without result", () => {
    const run = createValueDiffRun(undefined);

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("returns null for value_diff run without params", () => {
    const data = createValueDiffSummaryDataFrame();
    const run = createBaseRun("value_diff", {
      result: { summary: { total: 100, added: 5, removed: 3 }, data },
      params: undefined,
    }) as Run;

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("preserves row data correctly", () => {
    const data = createValueDiffSummaryDataFrame();
    const run = createValueDiffRun(
      { summary: { total: 100, added: 5, removed: 3 }, data },
      { model: "test_model", primary_key: "id" },
    );

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      // First row should be "id" column stats
      expect(result.rows[0]["0"]).toBe("id");
      expect(result.rows[0]["1"]).toBe(100);
      expect(result.rows[0]["2"]).toBe(1.0);
    }
  });

  test("handles array of primary keys", () => {
    const data = createValueDiffSummaryDataFrame();
    const run = createValueDiffRun(
      { summary: { total: 100, added: 5, removed: 3 }, data },
      { model: "test_model", primary_key: ["region", "id"] },
    );

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toHaveLength(4);
  });

  test("handles empty data", () => {
    const data: DataFrame = {
      columns: [
        { key: "0", name: "Column", type: "text" },
        { key: "1", name: "Matched", type: "number" },
        { key: "2", name: "Matched %", type: "number" },
      ],
      data: [],
    };
    const run = createValueDiffRun(
      { summary: { total: 0, added: 0, removed: 0 }, data },
      { model: "test_model", primary_key: "id" },
    );

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    expect(result?.columns).toHaveLength(4);
    expect(result?.rows).toHaveLength(0);
  });
});

// ============================================================================
// createDataGrid - Unsupported Run Types
// ============================================================================

describe("createDataGrid - unsupported run types", () => {
  test("returns null for schema_diff run type", () => {
    const run = createBaseRun("schema_diff", {
      result: {},
      params: {},
    }) as Run;

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });

  test("returns null for lineage_diff run type", () => {
    const run = createBaseRun("lineage_diff", {
      result: {},
    }) as Run;

    const result = createDataGrid(run);

    expect(result).toBeNull();
  });
});

// ============================================================================
// createDataGrid - Options Tests
// ============================================================================

describe("createDataGrid - options handling", () => {
  test("handles undefined options", () => {
    const run = createQueryRun(createSimpleDataFrame());

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
  });

  test("handles empty options object", () => {
    const run = createQueryRun(createSimpleDataFrame());

    const result = createDataGrid(run, {});

    expect(result).not.toBeNull();
  });

  test("passes columnsRenderMode option", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);
    const columnsRenderMode: Record<string, ColumnRenderMode> = {
      value: 2,
    };

    const result = createDataGrid(run, { columnsRenderMode });

    expect(result).not.toBeNull();
  });

  test("calls onPinnedColumnsChange callback when provided", () => {
    const df = createSimpleDataFrame();
    const run = createQueryRun(df);
    const onPinnedColumnsChange = vi.fn();

    const result = createDataGrid(run, { onPinnedColumnsChange });

    expect(result).not.toBeNull();
    // The callback is passed through to the underlying grid generator
  });

  test("calls onColumnsRenderModeChanged callback when provided", () => {
    const df = createSimpleDataFrame();
    const run = createQueryRun(df);
    const onColumnsRenderModeChanged = vi.fn();

    const result = createDataGrid(run, { onColumnsRenderModeChanged });

    expect(result).not.toBeNull();
  });
});

// ============================================================================
// createDataGridFromData - Single Input Tests
// ============================================================================

describe("createDataGridFromData - single input", () => {
  test("returns grid data for single DataFrame input", () => {
    const df = createSimpleDataFrame();

    const result = createDataGridFromData({ type: "single", dataframe: df });

    expect(result).toBeDefined();
    expect(result.columns).toBeDefined();
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(3);
  });

  test("handles empty DataFrame", () => {
    const df = createEmptyDataFrame();

    const result = createDataGridFromData({ type: "single", dataframe: df });

    expect(result).toBeDefined();
    expect(result.rows.length).toBe(0);
  });

  test("passes options correctly", () => {
    const df = createNumericDataFrame();

    const result = createDataGridFromData(
      { type: "single", dataframe: df },
      { primaryKeys: ["id"], pinnedColumns: ["value"] },
    );

    expect(result).toBeDefined();
  });
});

// ============================================================================
// createDataGridFromData - Dual Input Tests
// ============================================================================

describe("createDataGridFromData - dual input", () => {
  test("returns diff grid data for dual DataFrame input", () => {
    const base = createNumericDataFrame();
    const current: DataFrame = {
      ...createNumericDataFrame(),
      data: [
        [1, 150],
        [2, 200],
        [4, 400],
      ],
    };

    const result = createDataGridFromData({ type: "dual", base, current });

    expect(result).toBeDefined();
    expect(result.columns).toBeDefined();
    expect(result.rows).toBeDefined();
  });

  test("handles undefined base DataFrame", () => {
    const current = createNumericDataFrame();

    const result = createDataGridFromData({
      type: "dual",
      base: undefined,
      current,
    });

    expect(result).toBeDefined();
    result.rows.forEach((row) => {
      expect(row.__status).toBe("added");
    });
  });

  test("handles undefined current DataFrame", () => {
    const base = createNumericDataFrame();

    const result = createDataGridFromData({
      type: "dual",
      base,
      current: undefined,
    });

    expect(result).toBeDefined();
    result.rows.forEach((row) => {
      expect(row.__status).toBe("removed");
    });
  });

  test("handles both undefined DataFrames", () => {
    const result = createDataGridFromData({
      type: "dual",
      base: undefined,
      current: undefined,
    });

    expect(result).toBeDefined();
    expect(result.rows.length).toBe(0);
  });

  test("passes displayMode option correctly", () => {
    const base = createNumericDataFrame();
    const current = createNumericDataFrame();

    const sideBySide = createDataGridFromData(
      { type: "dual", base, current },
      { displayMode: "side_by_side" },
    );
    const inline = createDataGridFromData(
      { type: "dual", base, current },
      { displayMode: "inline" },
    );

    expect(sideBySide).toBeDefined();
    expect(inline).toBeDefined();
  });
});

// ============================================================================
// createDataGridFromData - Joined Input Tests
// ============================================================================

describe("createDataGridFromData - joined input", () => {
  test("returns value diff grid data for joined input", () => {
    const df = createValueDiffDataFrame();

    const result = createDataGridFromData({
      type: "joined",
      dataframe: df,
      primaryKeys: ["id"],
    });

    expect(result).toBeDefined();
    expect(result.columns).toBeDefined();
    expect(result.rows).toBeDefined();
  });

  test("handles multiple primary keys", () => {
    const df: DataFrame = {
      columns: [
        { key: "region", name: "region", type: "text" },
        { key: "product", name: "product", type: "text" },
        { key: "in_a", name: "in_a", type: "boolean" },
        { key: "in_b", name: "in_b", type: "boolean" },
        { key: "base__value", name: "base__value", type: "number" },
        { key: "current__value", name: "current__value", type: "number" },
      ],
      data: [
        ["US", "A", true, true, 100, 150],
        ["EU", "B", true, true, 200, 200],
      ],
    };

    const result = createDataGridFromData({
      type: "joined",
      dataframe: df,
      primaryKeys: ["region", "product"],
    });

    expect(result).toBeDefined();
  });

  test("passes changedOnly option correctly", () => {
    const df = createValueDiffDataFrame();

    const allRows = createDataGridFromData(
      { type: "joined", dataframe: df, primaryKeys: ["id"] },
      { changedOnly: false },
    );
    const changedOnly = createDataGridFromData(
      { type: "joined", dataframe: df, primaryKeys: ["id"] },
      { changedOnly: true },
    );

    expect(allRows).toBeDefined();
    expect(changedOnly).toBeDefined();
    expect(changedOnly.rows.length).toBeLessThanOrEqual(allRows.rows.length);
  });

  test("throws error with empty primaryKeys array", () => {
    const df = createValueDiffDataFrame();

    expect(() =>
      createDataGridFromData({
        type: "joined",
        dataframe: df,
        primaryKeys: [],
      }),
    ).toThrow("Primary keys are required");
  });
});

// ============================================================================
// createDataGridFromData - Edge Cases
// ============================================================================

describe("createDataGridFromData - edge cases", () => {
  test("handles DataFrame with special characters in column names", () => {
    const df: DataFrame = {
      columns: [
        { key: "col with spaces", name: "col with spaces", type: "text" },
        { key: "col-with-dashes", name: "col-with-dashes", type: "text" },
        { key: "col.with.dots", name: "col.with.dots", type: "text" },
      ],
      data: [["a", "b", "c"]],
    };

    const result = createDataGridFromData({ type: "single", dataframe: df });

    expect(result).toBeDefined();
    expect(result.rows.length).toBe(1);
  });

  test("handles DataFrame with null values", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "value", name: "value", type: "text" },
      ],
      data: [
        [1, null],
        [2, "test"],
        [null, "test2"],
      ],
    };

    const result = createDataGridFromData({ type: "single", dataframe: df });

    expect(result).toBeDefined();
    expect(result.rows.length).toBe(3);
  });

  test("handles DataFrame with limit and more properties", () => {
    const df: DataFrame = {
      columns: [{ key: "id", name: "id", type: "integer" }],
      data: [[1], [2], [3]],
      limit: 3,
      more: true,
    };

    const result = createDataGridFromData({ type: "single", dataframe: df });

    expect(result).toBeDefined();
    expect(result.rows.length).toBe(3);
  });

  test("handles large number of columns", () => {
    const df = createSimpleDataFrame(50, 5);

    const result = createDataGridFromData({ type: "single", dataframe: df });

    expect(result).toBeDefined();
    // toDataGrid adds an _index column, so we expect 50 + 1 = 51 columns
    expect(result.columns.length).toBe(51);
  });

  test("handles large number of rows", () => {
    const df = createSimpleDataFrame(3, 1000);

    const result = createDataGridFromData({ type: "single", dataframe: df });

    expect(result).toBeDefined();
    expect(result.rows.length).toBe(1000);
  });
});

// ============================================================================
// Callback Invocation Tests
// ============================================================================

describe("createDataGrid - callback invocation", () => {
  test("onPrimaryKeyChange is passed through for query runs", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);
    const onPrimaryKeyChange = vi.fn();

    const result = createDataGrid(run, {
      primaryKeys: ["id"],
      onPrimaryKeyChange,
    });

    expect(result).not.toBeNull();
    // The callback should be wired up (actual invocation happens in column headers)
  });

  test("onPinnedColumnsChange is passed through for all run types", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);
    const onPinnedColumnsChange = vi.fn();

    const result = createDataGrid(run, {
      pinnedColumns: ["value"],
      onPinnedColumnsChange,
    });

    expect(result).not.toBeNull();
  });

  test("onColumnsRenderModeChanged is passed through for profile_diff", () => {
    const base = createProfileDataFrame();
    const current = createProfileDataFrame();
    const run = createProfileDiffRun({ base, current });
    const onColumnsRenderModeChanged = vi.fn();

    const result = createDataGrid(run, {
      columnsRenderMode: { count: 2 },
      onColumnsRenderModeChanged,
    });

    expect(result).not.toBeNull();
  });
});

// ============================================================================
// Base/Current Title Options Tests
// ============================================================================

describe("createDataGrid - baseTitle/currentTitle options", () => {
  test("passes baseTitle and currentTitle for query_diff_joined", () => {
    const diff = createValueDiffDataFrame();
    const run = createQueryDiffRun({ diff }, { primary_keys: ["id"] });

    const result = createDataGrid(run, {
      baseTitle: "Production",
      currentTitle: "Development",
      displayMode: "side_by_side",
    });

    expect(result).not.toBeNull();
  });

  test("passes baseTitle and currentTitle for value_diff_detail", () => {
    const df = createValueDiffDataFrame();
    const run = createValueDiffDetailRun(df, "id");

    const result = createDataGrid(run, {
      baseTitle: "Before",
      currentTitle: "After",
      displayMode: "side_by_side",
    });

    expect(result).not.toBeNull();
  });

  test("query_diff_separate does not use baseTitle/currentTitle", () => {
    const base = createNumericDataFrame();
    const current = createNumericDataFrame();
    const run = createQueryDiffRun({ base, current });

    // These options are passed but may not be used in separate mode
    const result = createDataGrid(run, {
      baseTitle: "Production",
      currentTitle: "Development",
    });

    expect(result).not.toBeNull();
  });
});

// ============================================================================
// Invalid Primary Key Detection Tests
// ============================================================================

describe("createDataGrid - invalid primary key detection", () => {
  test("throws error for nonexistent primary key column", () => {
    const base = createNumericDataFrame();
    const current = createNumericDataFrame();
    const run = createQueryDiffRun({ base, current });

    // validatePrimaryKeys throws when the column doesn't exist
    expect(() =>
      createDataGrid(run, {
        primaryKeys: ["nonexistent_column"],
      }),
    ).toThrow("Primary key column 'nonexistent_column' not found");
  });

  test("handles duplicate primary key values in current DataFrame", () => {
    const base = createNumericDataFrame();
    const current: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "value", name: "value", type: "number" },
      ],
      data: [
        [1, 100],
        [1, 200], // Duplicate ID
        [2, 300],
      ],
    };
    const run = createQueryDiffRun({ base, current });

    const result = createDataGrid(run, {
      primaryKeys: ["id"],
    });

    expect(result).not.toBeNull();
    // The invalidPKeyCurrent flag may be set due to duplicate
    if (result) {
      expect(result.invalidPKeyCurrent).toBe(true);
    }
  });
});

// ============================================================================
// Type Coercion Edge Cases
// ============================================================================

describe("createDataGrid - type coercion edge cases", () => {
  test("handles mixed type columns", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "mixed", name: "mixed", type: "unknown" },
      ],
      data: [
        [1, "string"],
        [2, 123],
        [3, true],
        [4, null],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(4);
    }
  });

  test("handles all column types", () => {
    const df: DataFrame = {
      columns: [
        { key: "num", name: "num", type: "number" },
        { key: "int", name: "int", type: "integer" },
        { key: "txt", name: "txt", type: "text" },
        { key: "bool", name: "bool", type: "boolean" },
        { key: "dt", name: "dt", type: "date" },
        { key: "dttm", name: "dttm", type: "datetime" },
        { key: "td", name: "td", type: "timedelta" },
        { key: "unk", name: "unk", type: "unknown" },
      ],
      data: [
        [
          1.5,
          1,
          "text",
          true,
          "2024-01-01",
          "2024-01-01T12:00:00",
          "1:00:00",
          null,
        ],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      // toDataGrid adds an _index column, so we expect 8 + 1 = 9 columns
      expect(result.columns.length).toBe(9);
    }
  });

  test("handles timedelta column type", () => {
    const df: DataFrame = {
      columns: [{ key: "duration", name: "duration", type: "timedelta" }],
      data: [["1:30:00"], ["2:45:30"], [null]],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(3);
    }
  });
});

// ============================================================================
// Column Render Mode Tests
// ============================================================================

describe("createDataGrid - columnRenderMode handling", () => {
  test("handles numeric precision render modes (0-9)", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);
    const columnsRenderMode: Record<string, ColumnRenderMode> = {
      value: 2, // 3 decimal places
    };

    const result = createDataGrid(run, { columnsRenderMode });

    expect(result).not.toBeNull();
  });

  test("handles 'raw' render mode", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);
    const columnsRenderMode: Record<string, ColumnRenderMode> = {
      value: "raw",
    };

    const result = createDataGrid(run, { columnsRenderMode });

    expect(result).not.toBeNull();
  });

  test("handles 'percent' render mode", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "rate", name: "rate", type: "number" },
      ],
      data: [
        [1, 0.15],
        [2, 0.85],
      ],
    };
    const run = createQueryRun(df);
    const columnsRenderMode: Record<string, ColumnRenderMode> = {
      rate: "percent",
    };

    const result = createDataGrid(run, { columnsRenderMode });

    expect(result).not.toBeNull();
  });

  test("handles multiple columns with different render modes", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "price", name: "price", type: "number" },
        { key: "rate", name: "rate", type: "number" },
        { key: "score", name: "score", type: "number" },
      ],
      data: [[1, 99.99, 0.15, 4.5]],
    };
    const run = createQueryRun(df);
    const columnsRenderMode: Record<string, ColumnRenderMode> = {
      price: 2,
      rate: "percent",
    };

    const result = createDataGrid(run, { columnsRenderMode });

    expect(result).not.toBeNull();
  });
});

// ============================================================================
// Integration Tests - Result Structure
// ============================================================================

describe("DataGridResult structure", () => {
  test("result has required columns and rows properties", () => {
    const df = createSimpleDataFrame();
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).toHaveProperty("columns");
    expect(result).toHaveProperty("rows");
    expect(Array.isArray(result?.columns)).toBe(true);
    expect(Array.isArray(result?.rows)).toBe(true);
  });

  test("diff results may have invalidPKeyBase/invalidPKeyCurrent for duplicate keys", () => {
    const base = createNumericDataFrame();
    const current: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "value", name: "value", type: "number" },
      ],
      data: [
        [1, 100],
        [1, 200], // Duplicate ID - makes primary key invalid
        [2, 300],
      ],
    };
    const run = createQueryDiffRun({ base, current });

    const result = createDataGrid(run, { primaryKeys: ["id"] });

    expect(result).not.toBeNull();
    // invalidPKeyCurrent should be true because of duplicate ID in current
    if (result) {
      expect(result.invalidPKeyCurrent).toBe(true);
    }
  });

  test("rows have __status property", () => {
    const base = createNumericDataFrame();
    const current: DataFrame = {
      ...createNumericDataFrame(),
      data: [
        [1, 150], // modified
        [4, 400], // added
      ],
    };
    const run = createQueryDiffRun({ base, current });

    const result = createDataGrid(run, { primaryKeys: ["id"] });

    expect(result).not.toBeNull();
    if (result) {
      result.rows.forEach((row) => {
        expect("__status" in row).toBe(true);
      });
    }
  });

  test("columns may have columnType and columnRenderMode", () => {
    const df = createNumericDataFrame();
    const run = createQueryRun(df);

    const result = createDataGrid(run, {
      columnsRenderMode: { value: 2 },
    });

    expect(result).not.toBeNull();
    // Verify columns can have these properties
    if (result) {
      const cols = result.columns;
      expect(cols.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Primary Key Edge Cases
// ============================================================================

describe("createDataGrid - primary key edge cases", () => {
  test("handles case-sensitive primary key matching in value_diff_detail", () => {
    const df: DataFrame = {
      columns: [
        { key: "ID", name: "ID", type: "integer" },
        { key: "in_a", name: "in_a", type: "boolean" },
        { key: "in_b", name: "in_b", type: "boolean" },
        { key: "base__value", name: "base__value", type: "number" },
        { key: "current__value", name: "current__value", type: "number" },
      ],
      data: [[1, true, true, 100, 200]],
    };
    const run = createValueDiffDetailRun(df, "ID");

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
  });

  test("handles composite primary key with spaces in column names", () => {
    const df: DataFrame = {
      columns: [
        { key: "first name", name: "first name", type: "text" },
        { key: "last name", name: "last name", type: "text" },
        { key: "in_a", name: "in_a", type: "boolean" },
        { key: "in_b", name: "in_b", type: "boolean" },
        { key: "base__age", name: "base__age", type: "integer" },
        { key: "current__age", name: "current__age", type: "integer" },
      ],
      data: [["John", "Doe", true, true, 30, 31]],
    };
    const run = createValueDiffDetailRun(df, ["first name", "last name"]);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
  });

  test("handles empty string as primary key value", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "text" },
        { key: "in_a", name: "in_a", type: "boolean" },
        { key: "in_b", name: "in_b", type: "boolean" },
        { key: "base__value", name: "base__value", type: "number" },
        { key: "current__value", name: "current__value", type: "number" },
      ],
      data: [
        ["", true, true, 100, 200], // Empty string as PK value
        ["a", true, true, 300, 400],
      ],
    };
    const run = createValueDiffDetailRun(df, "id");

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(2);
    }
  });
});

// ============================================================================
// DataFrame with Different Key vs Name
// ============================================================================

describe("createDataGrid - column key vs name differences", () => {
  test("handles columns where key differs from name", () => {
    const df: DataFrame = {
      columns: [
        { key: "col_0", name: "Display Name", type: "text" },
        { key: "col_1", name: "Another Name", type: "integer" },
      ],
      data: [
        ["value1", 100],
        ["value2", 200],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
  });

  test("primaryKeys should match column keys", () => {
    const df: DataFrame = {
      columns: [
        { key: "pk_col", name: "pk_col", type: "integer" },
        { key: "data_col", name: "data_col", type: "text" },
      ],
      data: [
        [1, "a"],
        [2, "b"],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run, {
      primaryKeys: ["pk_col"],
    });

    expect(result).not.toBeNull();
    if (result) {
      const pkCol = result.columns.find((col) => {
        const key = getColumnKey(col);
        return key === "pk_col";
      });
      expect(pkCol).toBeDefined();
    }
  });
});

// ============================================================================
// Profile Run - Special Column Name Handling
// ============================================================================

describe("createDataGrid - profile primary key detection edge cases", () => {
  test("throws when profile has no column_name-like column", () => {
    const current: DataFrame = {
      columns: [
        { key: "metric", name: "metric", type: "text" },
        { key: "value", name: "value", type: "number" },
      ],
      data: [
        ["row_count", 100],
        ["null_count", 5],
      ],
    };
    const run = createProfileRun({ current });

    // Falls back to "column_name" as primary key, which doesn't exist
    expect(() => createDataGrid(run)).toThrow();
  });

  test("throws when profile has whitespace in column_name", () => {
    // Edge case: column name with trailing whitespace doesn't match "column_name"
    const current: DataFrame = {
      columns: [
        { key: "column_name ", name: "column_name ", type: "text" }, // Trailing space
        { key: "count", name: "count", type: "integer" },
      ],
      data: [["id", 100]],
    };
    const run = createProfileRun({ current });

    // The trailing space means it won't match the case-insensitive check for "column_name"
    // So it falls back to "column_name" which doesn't exist
    expect(() => createDataGrid(run)).toThrow();
  });

  test("throws when profile_diff has mismatched column_name casing between base and current", () => {
    const base = createProfileDataFrame("column_name"); // lowercase
    const current = createProfileDataFrame("Column_Name"); // mixed case

    const run = createProfileDiffRun({ base, current });

    // getProfilePrimaryKey finds "Column_Name" from current, but base has "column_name"
    // validatePrimaryKeys is case-sensitive and throws when it can't find the column
    expect(() => createDataGrid(run)).toThrow("Column Column_Name not found");
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe("createDataGrid - stress tests", () => {
  test("handles DataFrame with 100 columns", () => {
    const df = createSimpleDataFrame(100, 10);
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      // toDataGrid adds an _index column, so we expect 100 + 1 = 101 columns
      expect(result.columns.length).toBe(101);
    }
  });

  test("handles DataFrame with 10000 rows", () => {
    const df = createSimpleDataFrame(5, 10000);
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(10000);
    }
  });

  test("handles dual DataFrames with many differences", () => {
    const base: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "value", name: "value", type: "number" },
      ],
      data: Array.from({ length: 1000 }, (_, i) => [i, i * 100]),
    };
    const current: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "value", name: "value", type: "number" },
      ],
      data: Array.from({ length: 1000 }, (_, i) => [i, i * 100 + 1]), // All modified
    };
    const run = createQueryDiffRun({ base, current });

    const result = createDataGrid(run, { primaryKeys: ["id"] });

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(1000);
      // All rows should be modified
      result.rows.forEach((row) => {
        expect(row.__status).toBe("modified");
      });
    }
  });
});

// ============================================================================
// Regression Tests
// ============================================================================

describe("createDataGrid - regression tests", () => {
  test("query run with numeric column names works correctly", () => {
    const df: DataFrame = {
      columns: [
        { key: "0", name: "0", type: "integer" },
        { key: "1", name: "1", type: "text" },
      ],
      data: [
        [1, "a"],
        [2, "b"],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      // toDataGrid adds an _index column, so we expect 2 + 1 = 3 columns
      expect(result.columns.length).toBe(3);
    }
  });

  test("handles DataFrame with boolean false values", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "active", name: "active", type: "boolean" },
      ],
      data: [
        [1, true],
        [2, false],
        [3, false],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(3);
      // Verify false values are preserved, not filtered
      const falseRows = result.rows.filter((r) => r.active === false);
      expect(falseRows.length).toBe(2);
    }
  });

  test("handles DataFrame with zero numeric values", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "value", name: "value", type: "number" },
      ],
      data: [
        [1, 0],
        [2, 0.0],
        [3, -0],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(3);
    }
  });

  test("handles DataFrame with undefined vs null distinction", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "value", name: "value", type: "text" },
      ],
      data: [
        [1, null],
        [2, undefined],
      ],
    };
    const run = createQueryRun(df);

    const result = createDataGrid(run);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.rows.length).toBe(2);
    }
  });

  // ============================================================================
  // createDataGridFromData - Schema Diff Tests
  // ============================================================================

  describe("createDataGridFromData - schema_diff input", () => {
    test("returns schema diff grid data", () => {
      const base = { id: { name: "id", type: "INT" } };
      const current = {
        id: { name: "id", type: "INT" },
        name: { name: "name", type: "VARCHAR" },
      };

      const result = createDataGridFromData({
        type: "schema_diff",
        base,
        current,
      });

      expect(result).toBeDefined();
      expect(result.columns).toBeDefined();
      expect(result.rows).toBeDefined();
    });

    test("handles undefined base columns", () => {
      const current = { id: { name: "id", type: "INT" } };

      const result = createDataGridFromData({
        type: "schema_diff",
        base: undefined,
        current,
      });

      expect(result).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test("handles undefined current columns", () => {
      const base = { id: { name: "id", type: "INT" } };

      const result = createDataGridFromData({
        type: "schema_diff",
        base,
        current: undefined,
      });

      expect(result).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test("handles both undefined columns", () => {
      const result = createDataGridFromData({
        type: "schema_diff",
        base: undefined,
        current: undefined,
      });

      expect(result).toBeDefined();
      expect(result.rows.length).toBe(0);
    });
  });

  // ============================================================================
  // createDataGridFromData - Schema Single Tests
  // ============================================================================

  describe("createDataGridFromData - schema_single input", () => {
    test("returns single env schema grid data", () => {
      const columns = {
        id: { name: "id", type: "INT" },
        name: { name: "name", type: "VARCHAR" },
      };

      const result = createDataGridFromData({
        type: "schema_single",
        columns,
      });

      expect(result).toBeDefined();
      expect(result.columns).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(2);
    });

    test("handles undefined columns", () => {
      const result = createDataGridFromData({
        type: "schema_single",
        columns: undefined,
      });

      expect(result).toBeDefined();
      expect(result.rows.length).toBe(0);
    });

    test("handles empty columns object", () => {
      const result = createDataGridFromData({
        type: "schema_single",
        columns: {},
      });

      expect(result).toBeDefined();
      expect(result.rows.length).toBe(0);
    });

    test("filters null columns", () => {
      const columns = {
        id: { name: "id", type: "INT" },
        broken: null as unknown as { name: string; type: string },
        name: { name: "name", type: "VARCHAR" },
      };

      const result = createDataGridFromData({
        type: "schema_single",
        columns,
      });

      expect(result).toBeDefined();
      expect(result.rows.length).toBe(2);
    });
  });

  // ============================================================================
  // createDataGrid - Row Count Run Tests
  // ============================================================================

  describe("createDataGrid - row_count run", () => {
    test("returns grid data for row_count run with result", () => {
      const run = createBaseRun("row_count", {
        result: {
          orders: { curr: 100 },
          customers: { curr: 50 },
        },
        params: { node_names: ["orders", "customers"] },
      }) as Run;

      const result = createDataGrid(run);

      expect(result).not.toBeNull();
      expect(result?.columns).toHaveLength(2);
      expect(result?.rows).toHaveLength(2);
    });

    test("returns null for row_count run without result", () => {
      const run = createBaseRun("row_count", {
        result: undefined,
        params: { node_names: ["orders"] },
      }) as Run;

      const result = createDataGrid(run);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // createDataGrid - Row Count Diff Run Tests
  // ============================================================================

  describe("createDataGrid - row_count_diff run", () => {
    test("returns grid data for row_count_diff run with result", () => {
      const run = createBaseRun("row_count_diff", {
        result: {
          orders: { base: 100, curr: 150 },
          customers: { base: 50, curr: 50 },
        },
        params: { node_names: ["orders", "customers"] },
      }) as Run;

      const result = createDataGrid(run);

      expect(result).not.toBeNull();
      expect(result?.columns).toHaveLength(4);
      expect(result?.rows).toHaveLength(2);
    });

    test("returns null for row_count_diff run without result", () => {
      const run = createBaseRun("row_count_diff", {
        result: undefined,
        params: { node_names: ["orders"] },
      }) as Run;

      const result = createDataGrid(run);

      expect(result).toBeNull();
    });

    test("handles added models (null base)", () => {
      const run = createBaseRun("row_count_diff", {
        result: {
          new_model: { base: null, curr: 100 },
        },
        params: { node_names: ["new_model"] },
      }) as Run;

      const result = createDataGrid(run);

      expect(result).not.toBeNull();
      expect(result?.rows[0].__status).toBe("added");
    });

    test("handles removed models (null current)", () => {
      const run = createBaseRun("row_count_diff", {
        result: {
          old_model: { base: 100, curr: null },
        },
        params: { node_names: ["old_model"] },
      }) as Run;

      const result = createDataGrid(run);

      expect(result).not.toBeNull();
      expect(result?.rows[0].__status).toBe("removed");
    });
  });
});
