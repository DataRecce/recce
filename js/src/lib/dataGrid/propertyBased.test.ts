/**
 * @file propertyBased.test.ts
 * @description Property-based tests for data grid functions using fast-check 4.4.0
 *
 * These tests verify invariants that should hold for ANY valid input,
 * automatically generating test cases and shrinking failures to minimal examples.
 *
 * Key invariants tested:
 * - Structural consistency: output rows have consistent shape
 * - Row count preservation: no data loss or duplication
 * - Primary key uniqueness: PK values are unique in output
 * - Diff symmetry: identical inputs produce no modifications
 * - Column alignment: output columns match input schema
 */

import {
  type ColumnRenderMode,
  type ColumnType,
  type DataFrame,
  type RowObjectType,
} from "@datarecce/ui/api";
import {
  toDataDiffGridConfigured as toDataDiffGrid,
  toDataGridConfigured as toDataGrid,
  toValueDiffGridConfigured as toValueDiffGrid,
} from "@datarecce/ui/utils";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import fc from "fast-check";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended column type returned by grid functions (AG Grid)
 */
type ExtendedColumn = (ColDef<RowObjectType> | ColGroupDef<RowObjectType>) & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
};

// ============================================================================
// Mocks
// ============================================================================

jest.mock("ag-grid-community", () => ({
  ModuleRegistry: { registerModules: jest.fn() },
  AllCommunityModule: {},
}));

// ============================================================================
// Custom Arbitraries for Data Grid Types
// ============================================================================

/**
 * Arbitrary for ColumnType enum values
 */
const columnTypeArb: fc.Arbitrary<ColumnType> = fc.constantFrom(
  "number",
  "integer",
  "text",
  "boolean",
  "date",
  "datetime",
  "timedelta",
  "unknown",
);

/**
 * Arbitrary for column names - valid identifiers without special chars
 */
const columnNameArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,19}$/)
  .filter((s) => s.length > 0 && s !== "id");

/**
 * Arbitrary for cell values based on column type
 * Excludes NaN/Infinity by default for cleaner property tests
 */
function cellValueArb(colType: ColumnType): fc.Arbitrary<unknown> {
  switch (colType) {
    case "integer":
      return fc.oneof(
        fc.integer({ min: -1000000, max: 1000000 }),
        fc.constant(null),
      );
    case "number":
      return fc.oneof(
        fc.double({
          noNaN: true,
          noDefaultInfinity: true,
          min: -1e6,
          max: 1e6,
        }),
        fc.constant(null),
      );
    case "text":
      return fc.oneof(
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.constant(null),
      );
    case "boolean":
      return fc.oneof(fc.boolean(), fc.constant(null));
    case "date":
      return fc.oneof(
        fc
          .date({ noInvalidDate: true })
          .map((d) => d.toISOString().split("T")[0]),
        fc.constant(null),
      );
    case "datetime":
      return fc.oneof(
        fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
        fc.constant(null),
      );
    case "timedelta":
      return fc.oneof(
        fc
          .tuple(fc.nat({ max: 23 }), fc.nat({ max: 59 }), fc.nat({ max: 59 }))
          .map(
            ([h, m, s]) =>
              `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
          ),
        fc.constant(null),
      );
    case "unknown":
    default:
      return fc.oneof(
        fc.string({ maxLength: 20 }),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
      );
  }
}

/**
 * Arbitrary for unique primary key values (integers)
 */
const primaryKeyValueArb: fc.Arbitrary<number> = fc.integer({
  min: 1,
  max: 100000,
});

/**
 * Configuration for DataFrame generation
 */
interface DataFrameConfig {
  minColumns?: number;
  maxColumns?: number;
  minRows?: number;
  maxRows?: number;
  includePrimaryKey?: boolean;
}

/**
 * Arbitrary for a complete DataFrame with consistent structure
 *
 * Generates columns with types, then generates row data that matches
 * the column types. Optionally includes a guaranteed integer primary key.
 */
function dataFrameArb(config: DataFrameConfig = {}): fc.Arbitrary<DataFrame> {
  const {
    minColumns = 1,
    maxColumns = 5,
    minRows = 0,
    maxRows = 20,
    includePrimaryKey = true,
  } = config;

  return fc
    .tuple(
      // Generate unique column names
      fc.uniqueArray(columnNameArb, {
        minLength: minColumns,
        maxLength: maxColumns,
      }),
      // Generate column types for each column
      fc.array(columnTypeArb, { minLength: minColumns, maxLength: maxColumns }),
      // Number of rows
      fc.nat({ max: maxRows - minRows }),
    )
    .chain(([names, types, extraRows]) => {
      // Ensure we have matching lengths
      const columnCount = Math.min(names.length, types.length);
      const trimmedNames = names.slice(0, columnCount);
      const trimmedTypes = types.slice(0, columnCount);
      const rowCount = minRows + extraRows;

      // Build column definitions
      // Filter out "id" from generated names when includePrimaryKey is true
      // to avoid duplicate column keys
      const filteredNames = includePrimaryKey
        ? trimmedNames.filter((name) => name !== "id")
        : trimmedNames;
      const filteredTypes = includePrimaryKey
        ? trimmedTypes.filter((_, i) => trimmedNames[i] !== "id")
        : trimmedTypes;

      const columns: DataFrame["columns"] = includePrimaryKey
        ? [
            { key: "id", name: "id", type: "integer" },
            ...filteredNames.map((name, i) => ({
              key: name,
              name: name,
              type: filteredTypes[i],
            })),
          ]
        : filteredNames.map((name, i) => ({
            key: name,
            name: name,
            type: filteredTypes[i],
          }));

      // Generate row data matching column types
      // Primary key uses dedicated arbitrary (non-null, unique), other columns use type-based
      const rowArb = includePrimaryKey
        ? fc.tuple(primaryKeyValueArb, ...filteredTypes.map(cellValueArb))
        : fc.tuple(...filteredTypes.map(cellValueArb));

      return fc
        .uniqueArray(rowArb, {
          minLength: rowCount,
          maxLength: rowCount,
          comparator: (a, b) => {
            // Ensure unique primary keys when included
            if (includePrimaryKey) {
              return a[0] === b[0];
            }
            return false;
          },
        })
        .map((data) => ({
          columns,
          data: data as DataFrame["data"],
        }));
    });
}

/**
 * Arbitrary for in_a/in_b flag pairs
 * At least one must be true (rows with both false are invalid - not in either dataset)
 */
const validInFlagsArb: fc.Arbitrary<[boolean, boolean]> = fc.constantFrom(
  [true, true] as [boolean, boolean], // In both (unchanged or modified)
  [true, false] as [boolean, boolean], // In base only (removed)
  [false, true] as [boolean, boolean], // In current only (added)
);

/**
 * Arbitrary for joined DataFrame (used by toValueDiffGrid)
 *
 * The input format for toValueDiffGrid is:
 * - Columns: [pk, ...valueColumns, in_a, in_b]
 * - Data: [pkValue, ...values, inA, inB]
 *
 * For modified rows, there are TWO input rows with the same PK:
 * - One with in_a=true, in_b=false (base version)
 * - One with in_a=false, in_b=true (current version)
 *
 * The function then merges these into base__/current__ prefixed output columns.
 */
function joinedDataFrameArb(config: DataFrameConfig = {}): fc.Arbitrary<{
  dataframe: DataFrame;
  primaryKeys: string[];
}> {
  const { minRows = 1, maxRows = 20 } = config;

  return fc
    .tuple(
      // Generate 1-3 value column names
      fc.uniqueArray(columnNameArb, { minLength: 1, maxLength: 3 }),
      // Generate column types
      fc.array(columnTypeArb, { minLength: 1, maxLength: 3 }),
      // Number of unique PKs
      fc.nat({ max: Math.max(0, maxRows - minRows) }),
    )
    .chain(([names, types, extraRows]) => {
      const columnCount = Math.min(names.length, types.length);
      const trimmedNames = names.slice(0, columnCount);
      const trimmedTypes = types.slice(0, columnCount);
      const pkCount = minRows + extraRows;

      // Build column definitions: [id, ...valueColumns, in_a, in_b]
      const columns: DataFrame["columns"] = [
        { key: "id", name: "id", type: "integer" },
        ...trimmedNames.map((name, i) => ({
          key: name,
          name: name,
          type: trimmedTypes[i],
        })),
        { key: "in_a", name: "in_a", type: "boolean" },
        { key: "in_b", name: "in_b", type: "boolean" },
      ];

      // Generate unique PK values
      return fc
        .uniqueArray(primaryKeyValueArb, {
          minLength: pkCount,
          maxLength: pkCount,
        })
        .chain((pkValues) => {
          // For each PK, generate status and values
          const rowGenArb = fc.tuple(
            validInFlagsArb,
            fc.tuple(...trimmedTypes.map(cellValueArb)),
          );

          return fc
            .array(rowGenArb, { minLength: pkCount, maxLength: pkCount })
            .map((rowSpecs) => {
              const data: unknown[][] = [];

              pkValues.forEach((pk, i) => {
                const [[inA, inB], values] = rowSpecs[i];

                if (inA && inB) {
                  // Row in both - single row with in_a=true, in_b=true
                  data.push([pk, ...values, true, true]);
                } else if (inA && !inB) {
                  // Removed - single row with in_a=true, in_b=false
                  data.push([pk, ...values, true, false]);
                } else if (!inA && inB) {
                  // Added - single row with in_a=false, in_b=true
                  data.push([pk, ...values, false, true]);
                }
              });

              return {
                dataframe: {
                  columns,
                  data: data as DataFrame["data"],
                },
                primaryKeys: ["id"],
              };
            });
        });
    });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract column field from a column or column group
 * Fields are lowercased for consistent comparison
 */
function getColumnKey(col: ExtendedColumn): string | undefined {
  if ("field" in col && col.field) {
    return col.field.toLowerCase();
  }
  if ("children" in col && Array.isArray(col.children) && col.children[0]) {
    const firstChild = col.children[0] as ColDef<RowObjectType>;
    if ("field" in firstChild && firstChild.field) {
      // Extract base column name from "base__colname"
      const field = firstChild.field;
      if (field.startsWith("base__")) {
        return field.replace("base__", "").toLowerCase();
      }
      return field.toLowerCase();
    }
  }
  return undefined;
}

/**
 * Extract all column keys from grid result, handling column groups
 * Keys are lowercased for consistent comparison
 */
function getResultColumnKeys(columns: ExtendedColumn[]): string[] {
  return columns.map(getColumnKey).filter((k): k is string => k !== undefined);
}

/**
 * Check if all rows have consistent keys
 */
function rowsHaveConsistentKeys(rows: RowObjectType[]): boolean {
  if (rows.length === 0) return true;

  const referenceKeys = new Set(
    Object.keys(rows[0]).filter((k) => !k.startsWith("__") && k !== "_index"),
  );

  return rows.every((row) => {
    const rowKeys = new Set(
      Object.keys(row).filter((k) => !k.startsWith("__") && k !== "_index"),
    );
    if (rowKeys.size !== referenceKeys.size) return false;
    for (const key of referenceKeys) {
      if (!rowKeys.has(key)) return false;
    }
    return true;
  });
}

// ============================================================================
// Property-Based Tests: toDataGrid
// ============================================================================

describe("Property-based tests: toDataGrid", () => {
  test("produces correct row count for any valid DataFrame", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 0, maxRows: 50 }), (df) => {
        const result = toDataGrid(df, { primaryKeys: ["id"] });
        return result.rows.length === df.data.length;
      }),
      { numRuns: 100 },
    );
  });

  test("all rows have consistent structure", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 30 }), (df) => {
        const result = toDataGrid(df, { primaryKeys: ["id"] });
        return rowsHaveConsistentKeys(result.rows);
      }),
      { numRuns: 100 },
    );
  });

  test("row data contains all column keys from input", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 20 }), (df) => {
        const result = toDataGrid(df, { primaryKeys: ["id"] });
        const inputKeys = new Set(df.columns.map((c) => c.key.toLowerCase()));

        // Every row should have all input column keys
        return result.rows.every((row) => {
          for (const key of inputKeys) {
            if (!(key in row)) return false;
          }
          return true;
        });
      }),
      { numRuns: 100 },
    );
  });

  test("primary key values are preserved in output rows", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 30 }), (df) => {
        const result = toDataGrid(df, { primaryKeys: ["id"] });
        const inputPKs = new Set(df.data.map((row) => row[0]));
        const outputPKs = new Set(result.rows.map((row) => row.id));

        // All input PKs should appear in output
        for (const pk of inputPKs) {
          if (!outputPKs.has(pk as number)) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });

  test("handles empty DataFrame without error", () => {
    fc.assert(
      fc.property(
        dataFrameArb({ minRows: 0, maxRows: 0, minColumns: 1 }),
        (df) => {
          const result = toDataGrid(df, { primaryKeys: ["id"] });
          return result.rows.length === 0 && result.columns.length > 0;
        },
      ),
      { numRuns: 50 },
    );
  });

  test("__status is undefined for single DataFrame (no diff)", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 20 }), (df) => {
        const result = toDataGrid(df, { primaryKeys: ["id"] });
        return result.rows.every((row) => row.__status === undefined);
      }),
      { numRuns: 100 },
    );
  });

  test("output columns include all input column keys", () => {
    fc.assert(
      fc.property(
        dataFrameArb({ minRows: 1, maxRows: 10, minColumns: 2 }),
        (df) => {
          const result = toDataGrid(df, { primaryKeys: ["id"] });
          const resultKeys = getResultColumnKeys(result.columns);
          const inputKeys = df.columns.map((c) => c.key.toLowerCase());

          // All input column keys should appear in result columns
          return inputKeys.every((key) => resultKeys.includes(key));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property-Based Tests: toDataDiffGrid
// ============================================================================

describe("Property-based tests: toDataDiffGrid", () => {
  test("identical DataFrames produce no modified/added/removed rows", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 30 }), (df) => {
        const result = toDataDiffGrid(df, df, { primaryKeys: ["id"] });

        // All rows should have undefined status (unchanged)
        return result.rows.every((row) => row.__status === undefined);
      }),
      { numRuns: 100 },
    );
  });

  test("row count with identical inputs equals input row count", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 0, maxRows: 30 }), (df) => {
        const result = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
        return result.rows.length === df.data.length;
      }),
      { numRuns: 100 },
    );
  });

  test("empty base produces all 'added' rows", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 20 }), (df) => {
        const emptyBase: DataFrame = { columns: df.columns, data: [] };
        const result = toDataDiffGrid(emptyBase, df, { primaryKeys: ["id"] });

        return (
          result.rows.length === df.data.length &&
          result.rows.every((row) => row.__status === "added")
        );
      }),
      { numRuns: 100 },
    );
  });

  test("empty current produces all 'removed' rows", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 20 }), (df) => {
        const emptyCurrent: DataFrame = { columns: df.columns, data: [] };
        const result = toDataDiffGrid(df, emptyCurrent, {
          primaryKeys: ["id"],
        });

        return (
          result.rows.length === df.data.length &&
          result.rows.every((row) => row.__status === "removed")
        );
      }),
      { numRuns: 100 },
    );
  });

  test("all rows have both base__ and current__ prefixed columns", () => {
    fc.assert(
      fc.property(
        dataFrameArb({ minRows: 1, maxRows: 20, minColumns: 2 }),
        (df) => {
          const result = toDataDiffGrid(df, df, {
            primaryKeys: ["id"],
            displayMode: "side_by_side",
          });

          // For side_by_side mode, non-PK columns should have base__/current__ versions
          const valueColumns = df.columns.slice(1); // Skip 'id'
          return result.rows.every((row) =>
            valueColumns.every((col) => {
              const baseKey = `base__${col.key}`.toLowerCase();
              const currentKey = `current__${col.key}`.toLowerCase();
              return baseKey in row && currentKey in row;
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  test("changedOnly=true with identical inputs returns empty rows", () => {
    fc.assert(
      fc.property(dataFrameArb({ minRows: 1, maxRows: 20 }), (df) => {
        const result = toDataDiffGrid(df, df, {
          primaryKeys: ["id"],
          changedOnly: true,
        });

        // No changes means no rows when changedOnly is true
        return result.rows.length === 0;
      }),
      { numRuns: 100 },
    );
  });

  test("total rows = base-only + current-only + matched", () => {
    fc.assert(
      fc.property(
        dataFrameArb({ minRows: 1, maxRows: 15 }),
        dataFrameArb({ minRows: 1, maxRows: 15 }),
        (base, current) => {
          const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

          const basePKs = new Set(base.data.map((r) => r[0]));
          const currentPKs = new Set(current.data.map((r) => r[0]));

          // Count expected rows
          const baseOnly = [...basePKs].filter(
            (pk) => !currentPKs.has(pk),
          ).length;
          const currentOnly = [...currentPKs].filter(
            (pk) => !basePKs.has(pk),
          ).length;
          const matched = [...basePKs].filter((pk) =>
            currentPKs.has(pk),
          ).length;

          const expectedTotal = baseOnly + currentOnly + matched;
          return result.rows.length === expectedTotal;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property-Based Tests: toValueDiffGrid
// ============================================================================

describe("Property-based tests: toValueDiffGrid", () => {
  test("row count matches input DataFrame row count", () => {
    fc.assert(
      fc.property(
        joinedDataFrameArb({ minRows: 1, maxRows: 30 }),
        ({ dataframe, primaryKeys }) => {
          const result = toValueDiffGrid(dataframe, primaryKeys, {});
          return result.rows.length === dataframe.data.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  test("primary key values are unique in output", () => {
    fc.assert(
      fc.property(
        joinedDataFrameArb({ minRows: 1, maxRows: 30 }),
        ({ dataframe, primaryKeys }) => {
          const result = toValueDiffGrid(dataframe, primaryKeys, {});
          const pkValues = result.rows.map((row) => row[primaryKeys[0]]);
          const uniquePKs = new Set(pkValues);
          return uniquePKs.size === pkValues.length;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property-Based Tests: Edge Cases with Special Values
// ============================================================================

describe("Property-based tests: special values", () => {
  /**
   * Arbitrary that includes NaN and Infinity for stress testing
   */
  const numericWithSpecialsArb = fc.oneof(
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity),
    fc.constant(null),
  );

  test("toDataGrid handles any numeric value without throwing", () => {
    fc.assert(
      fc.property(
        fc.array(numericWithSpecialsArb, { minLength: 1, maxLength: 20 }),
        (values) => {
          const df: DataFrame = {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "number" },
            ],
            data: values.map((v, i) => [i + 1, v]),
          };

          // Should not throw
          const result = toDataGrid(df, { primaryKeys: ["id"] });
          return result.rows.length === values.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  test("toDataDiffGrid handles NaN comparison correctly", () => {
    fc.assert(
      fc.property(fc.nat({ max: 100 }), (seed) => {
        // NaN === NaN should be true via lodash.isEqual
        const df: DataFrame = {
          columns: [
            { key: "id", name: "id", type: "integer" },
            { key: "value", name: "value", type: "number" },
          ],
          data: [[seed, NaN]],
        };

        const result = toDataDiffGrid(df, df, { primaryKeys: ["id"] });

        // NaN in both base and current should NOT be marked as modified
        // (lodash.isEqual treats NaN === NaN as true)
        return result.rows.every((row) => row.__status === undefined);
      }),
      { numRuns: 50 },
    );
  });

  test("null vs undefined handling in comparisons", () => {
    fc.assert(
      fc.property(fc.nat({ max: 100 }), (id) => {
        const base: DataFrame = {
          columns: [
            { key: "id", name: "id", type: "integer" },
            { key: "value", name: "value", type: "text" },
          ],
          data: [[id, null]],
        };
        const current: DataFrame = {
          columns: [
            { key: "id", name: "id", type: "integer" },
            { key: "value", name: "value", type: "text" },
          ],
          data: [[id, undefined]],
        };

        // Should handle both without throwing
        const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });
        return result.rows.length === 1;
      }),
      { numRuns: 50 },
    );
  });
});

// ============================================================================
// Property-Based Tests: Stress Testing with Large Data
// ============================================================================

describe("Property-based tests: stress testing", () => {
  test("handles wide DataFrames (many columns)", () => {
    fc.assert(
      fc.property(
        dataFrameArb({
          minColumns: 10,
          maxColumns: 20,
          minRows: 5,
          maxRows: 10,
        }),
        (df) => {
          const result = toDataGrid(df, { primaryKeys: ["id"] });
          return result.rows.length === df.data.length;
        },
      ),
      { numRuns: 50 },
    );
  });

  test("handles tall DataFrames (many rows)", () => {
    fc.assert(
      fc.property(
        dataFrameArb({
          minColumns: 2,
          maxColumns: 3,
          minRows: 50,
          maxRows: 100,
        }),
        (df) => {
          const result = toDataGrid(df, { primaryKeys: ["id"] });
          return result.rows.length === df.data.length;
        },
      ),
      { numRuns: 30 },
    );
  });

  test("diff grid handles large mismatched DataFrames", () => {
    fc.assert(
      fc.property(
        // Generate a shared column schema first, then two DataFrames with same schema
        fc
          .tuple(
            fc.uniqueArray(columnNameArb, { minLength: 2, maxLength: 4 }),
            fc.array(columnTypeArb, { minLength: 2, maxLength: 4 }),
          )
          .chain(([names, types]) => {
            const columnCount = Math.min(names.length, types.length);
            const columns: DataFrame["columns"] = [
              { key: "id", name: "id", type: "integer" },
              ...names.slice(0, columnCount).map((name, i) => ({
                key: name,
                name: name,
                type: types[i],
              })),
            ];

            // Generate two DataFrames with the same schema but different data
            const rowArb = fc.tuple(
              primaryKeyValueArb,
              ...types.slice(0, columnCount).map(cellValueArb),
            );

            return fc.tuple(
              fc
                .uniqueArray(rowArb, {
                  minLength: 20,
                  maxLength: 40,
                  comparator: (a, b) => a[0] === b[0],
                })
                .map((data) => ({ columns, data: data as DataFrame["data"] })),
              fc
                .uniqueArray(rowArb, {
                  minLength: 20,
                  maxLength: 40,
                  comparator: (a, b) => a[0] === b[0],
                })
                .map((data) => ({ columns, data: data as DataFrame["data"] })),
            );
          }),
        ([base, current]) => {
          const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

          // Should complete without error and produce reasonable output
          return result.rows.length >= 0 && result.columns.length > 0;
        },
      ),
      { numRuns: 30 },
    );
  });
});
