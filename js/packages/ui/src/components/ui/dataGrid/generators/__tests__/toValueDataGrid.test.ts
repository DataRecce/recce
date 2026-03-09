/**
 * @file toValueDataGrid.test.ts
 * @description Tests for Value Diff summary grid sorting behavior
 *
 * Tests cover:
 * - Columns are sortable by default
 * - Matched % column has ascending default sort (mismatches first)
 * - Matched count column is sortable but has no default sort
 * - Column name column is sortable but has no default sort
 * - PK indicator column is NOT sortable
 * - Matched % comparator handles null values (sorts them last)
 */

import type { ColDef } from "ag-grid-community";
import { describe, expect, it } from "vitest";

/** Extract the comparator as a callable function for testing */
type ComparatorFn = (
  a: unknown,
  b: unknown,
  nodeA: never,
  nodeB: never,
  isDescending: boolean,
) => number;

import type {
  RowObjectType,
  ValueDiffParams,
  ValueDiffResult,
} from "../../../../../api";
import { toValueDataGrid } from "../toValueDataGrid";

// ============================================================================
// Test Helpers
// ============================================================================

function makeResult(data: (string | number | null)[][]): ValueDiffResult {
  return {
    summary: { total: 100, added: 2, removed: 1 },
    data: {
      columns: [
        { key: "0", name: "Column", type: "text" },
        { key: "1", name: "Matched", type: "number" },
        { key: "2", name: "Matched %", type: "number" },
      ],
      data,
    },
  };
}

function makeParams(overrides: Partial<ValueDiffParams> = {}): ValueDiffParams {
  return {
    model: "test_model",
    primary_key: "id",
    ...overrides,
  } as ValueDiffParams;
}

function getColumnByHeader(
  columns: ColDef<RowObjectType>[],
  headerName: string,
): ColDef<RowObjectType> | undefined {
  return columns.find((c) => c.headerName === headerName);
}

function getColumnByField(
  columns: ColDef<RowObjectType>[],
  field: string,
): ColDef<RowObjectType> | undefined {
  return columns.find((c) => c.field === field);
}

// ============================================================================
// Tests: Column Sorting Configuration
// ============================================================================

describe("toValueDataGrid sorting", () => {
  const result = makeResult([
    ["email", 95, 0.95],
    ["name", 100, 1.0],
    ["age", 50, 0.5],
  ]);
  const params = makeParams();

  it("should make the Matched % column sortable", () => {
    const { columns } = toValueDataGrid(result, { params });
    const matchedPctCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched %",
    );
    expect(matchedPctCol).toBeDefined();
    expect(matchedPctCol!.sortable).not.toBe(false);
  });

  it("should set ascending default sort on Matched % column", () => {
    const { columns } = toValueDataGrid(result, { params });
    const matchedPctCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched %",
    );
    expect(matchedPctCol).toBeDefined();
    expect(matchedPctCol!.sort).toBe("asc");
  });

  it("should make the Matched count column sortable", () => {
    const { columns } = toValueDataGrid(result, { params });
    const matchedCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched",
    );
    expect(matchedCol).toBeDefined();
    expect(matchedCol!.sortable).not.toBe(false);
  });

  it("should NOT set default sort on Matched count column", () => {
    const { columns } = toValueDataGrid(result, { params });
    const matchedCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched",
    );
    expect(matchedCol).toBeDefined();
    expect(matchedCol!.sort).toBeUndefined();
  });

  it("should make the Column name column sortable", () => {
    const { columns } = toValueDataGrid(result, { params });
    const colNameCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Column",
    );
    expect(colNameCol).toBeDefined();
    expect(colNameCol!.sortable).not.toBe(false);
  });

  it("should NOT set default sort on Column name column", () => {
    const { columns } = toValueDataGrid(result, { params });
    const colNameCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Column",
    );
    expect(colNameCol).toBeDefined();
    expect(colNameCol!.sort).toBeUndefined();
  });

  it("should NOT make the PK indicator column sortable", () => {
    const { columns } = toValueDataGrid(result, { params });
    const pkCol = getColumnByField(
      columns as ColDef<RowObjectType>[],
      "__is_pk__",
    );
    expect(pkCol).toBeDefined();
    expect(pkCol!.sortable).toBe(false);
  });
});

// ============================================================================
// Tests: Matched % Comparator (null handling)
// ============================================================================

describe("toValueDataGrid Matched % comparator", () => {
  it("should provide a comparator on the Matched % column", () => {
    const result = makeResult([["col_a", 10, 0.5]]);
    const { columns } = toValueDataGrid(result, { params: makeParams() });
    const matchedPctCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched %",
    );
    expect(matchedPctCol).toBeDefined();
    expect(matchedPctCol!.comparator).toBeTypeOf("function");
  });

  it("should sort null values after non-null in ascending order", () => {
    const result = makeResult([["col_a", 10, 0.5]]);
    const { columns } = toValueDataGrid(result, { params: makeParams() });
    const matchedPctCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched %",
    );
    const comparator = matchedPctCol!.comparator as ComparatorFn;

    // null vs number: null sorts last (returns 1 so null > number in asc)
    expect(comparator(null, 0.5, {} as never, {} as never, false)).toBe(1);
    // number vs null: number sorts first (returns -1)
    expect(comparator(0.5, null, {} as never, {} as never, false)).toBe(-1);
    // both null: equal
    expect(comparator(null, null, {} as never, {} as never, false)).toBe(0);
  });

  it("should sort numeric values correctly", () => {
    const result = makeResult([["col_a", 10, 0.5]]);
    const { columns } = toValueDataGrid(result, { params: makeParams() });
    const matchedPctCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched %",
    );
    const comparator = matchedPctCol!.comparator as ComparatorFn;

    // 0.3 < 0.7
    expect(comparator(0.3, 0.7, {} as never, {} as never, false)).toBeLessThan(
      0,
    );
    // 0.7 > 0.3
    expect(
      comparator(0.7, 0.3, {} as never, {} as never, false),
    ).toBeGreaterThan(0);
    // equal
    expect(comparator(0.5, 0.5, {} as never, {} as never, false)).toBe(0);
  });

  it("should handle undefined values like null", () => {
    const result = makeResult([["col_a", 10, 0.5]]);
    const { columns } = toValueDataGrid(result, { params: makeParams() });
    const matchedPctCol = getColumnByHeader(
      columns as ColDef<RowObjectType>[],
      "Matched %",
    );
    const comparator = matchedPctCol!.comparator as ComparatorFn;

    expect(comparator(undefined, 0.5, {} as never, {} as never, false)).toBe(1);
    expect(comparator(0.5, undefined, {} as never, {} as never, false)).toBe(
      -1,
    );
  });
});
