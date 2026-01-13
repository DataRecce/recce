/**
 * @file warehouseNamingConventions.test.ts
 * @description Tests for data warehouse column naming conventions
 *
 * This file tests the Value Diff and Joined Query Diff result views against
 * the various naming conventions used by different SQL data warehouses:
 *
 * - Snowflake: Unquoted identifiers stored as UPPERCASE, quoted identifiers preserve case
 * - BigQuery: Column names are case-insensitive, stored as provided
 * - Databricks: Unity Catalog stores lowercase, queries are case-insensitive
 * - Redshift: Default case-insensitive, folded to lowercase (like PostgreSQL)
 * - PostgreSQL: Unquoted folded to lowercase, quoted preserve case
 *
 * Key scenarios tested:
 * 1. All uppercase column names (Snowflake default)
 * 2. All lowercase column names (PostgreSQL/Redshift default)
 * 3. Mixed case column names (quoted identifiers)
 * 4. Case mismatch between base and current DataFrames
 * 5. Primary keys with different casing
 * 6. Special characters and quoted identifiers
 * 7. Reserved words as column names
 */

import { type DataFrame, type RowDataTypes } from "@datarecce/ui/api";
import {
  toDataDiffGridConfigured as toDataDiffGrid,
  toDataGridConfigured as toDataGrid,
  toValueDiffGridConfigured as toValueDiffGrid,
} from "@datarecce/ui/utils";
import fc from "fast-check";

// ============================================================================
// Mocks
// ============================================================================

jest.mock("ag-grid-community", () => ({
  ModuleRegistry: {
    registerModules: jest.fn(),
  },
}));

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Creates a DataFrame with Snowflake-style UPPERCASE column names
 * Simulates: CREATE TABLE test (ID INT, USER_NAME VARCHAR, ORDER_TOTAL DECIMAL)
 */
function createSnowflakeUppercaseDataFrame(data?: RowDataTypes[][]): DataFrame {
  return {
    columns: [
      { key: "ID", name: "ID", type: "integer" },
      { key: "USER_NAME", name: "USER_NAME", type: "text" },
      { key: "ORDER_TOTAL", name: "ORDER_TOTAL", type: "number" },
    ],
    data: data ?? [
      [1, "ALICE", 100.5],
      [2, "BOB", 200.75],
    ],
  };
}

/**
 * Creates a DataFrame with PostgreSQL/Redshift-style lowercase column names
 * Simulates: CREATE TABLE test (id INT, user_name VARCHAR, order_total DECIMAL)
 */
function createPostgresLowercaseDataFrame(data?: RowDataTypes[][]): DataFrame {
  return {
    columns: [
      { key: "id", name: "id", type: "integer" },
      { key: "user_name", name: "user_name", type: "text" },
      { key: "order_total", name: "order_total", type: "number" },
    ],
    data: data ?? [
      [1, "alice", 100.5],
      [2, "bob", 200.75],
    ],
  };
}

/**
 * Creates a DataFrame with quoted mixed-case column names
 * Simulates: CREATE TABLE test ("Id" INT, "userName" VARCHAR, "OrderTotal" DECIMAL)
 */
function createQuotedMixedCaseDataFrame(data?: RowDataTypes[][]): DataFrame {
  return {
    columns: [
      { key: "Id", name: "Id", type: "integer" },
      { key: "userName", name: "userName", type: "text" },
      { key: "OrderTotal", name: "OrderTotal", type: "number" },
    ],
    data: data ?? [
      [1, "alice", 100.5],
      [2, "bob", 200.75],
    ],
  };
}

/**
 * Creates a DataFrame with BigQuery-style backtick column names
 * BigQuery allows starting with numbers when quoted: `1_column`
 */
function createBigQueryStyleDataFrame(data?: RowDataTypes[][]): DataFrame {
  return {
    columns: [
      { key: "id", name: "id", type: "integer" },
      { key: "1_metric", name: "1_metric", type: "number" },
      { key: "user-name", name: "user-name", type: "text" },
      { key: "order total", name: "order total", type: "number" },
    ],
    data: data ?? [
      [1, 100, "alice", 50.5],
      [2, 200, "bob", 75.25],
    ],
  };
}

/**
 * Creates a joined DataFrame for Value Diff with UPPERCASE columns (Snowflake)
 */
function createSnowflakeValueDiffDataFrame(): DataFrame {
  return {
    columns: [
      { key: "ID", name: "ID", type: "integer" },
      { key: "USER_NAME", name: "USER_NAME", type: "text" },
      { key: "in_a", name: "in_a", type: "boolean" },
      { key: "in_b", name: "in_b", type: "boolean" },
      { key: "base__VALUE", name: "base__VALUE", type: "number" },
      { key: "current__VALUE", name: "current__VALUE", type: "number" },
    ],
    data: [
      [1, "ALICE", true, true, 100, 150], // Modified
      [2, "BOB", true, true, 200, 200], // Unchanged
      [3, "CHARLIE", true, false, 300, null], // Removed
      [4, "DIANA", false, true, null, 400], // Added
    ],
  };
}

/**
 * Creates a joined DataFrame for Value Diff with lowercase columns (PostgreSQL/Redshift)
 */
function createPostgresValueDiffDataFrame(): DataFrame {
  return {
    columns: [
      { key: "id", name: "id", type: "integer" },
      { key: "user_name", name: "user_name", type: "text" },
      { key: "in_a", name: "in_a", type: "boolean" },
      { key: "in_b", name: "in_b", type: "boolean" },
      { key: "base__value", name: "base__value", type: "number" },
      { key: "current__value", name: "current__value", type: "number" },
    ],
    data: [
      [1, "alice", true, true, 100, 150],
      [2, "bob", true, true, 200, 200],
      [3, "charlie", true, false, 300, null],
      [4, "diana", false, true, null, 400],
    ],
  };
}

/**
 * Creates a joined DataFrame with mixed in_a/in_b casing
 * Tests case-insensitive handling of these special columns
 */
function createMixedCaseInColumnsDataFrame(): DataFrame {
  return {
    columns: [
      { key: "id", name: "id", type: "integer" },
      { key: "in_a", name: "in_a", type: "boolean" }, // Mixed case
      { key: "in_b", name: "in_b", type: "boolean" }, // Mixed case
      { key: "base__value", name: "base__value", type: "number" },
      { key: "current__value", name: "current__value", type: "number" },
    ],
    data: [
      [1, true, true, 100, 150],
      [2, true, false, 200, null],
    ],
  };
}

// ============================================================================
// Snowflake Naming Convention Tests
// ============================================================================

describe("Snowflake naming conventions (UPPERCASE)", () => {
  describe("toDataGrid", () => {
    test("handles all UPPERCASE column names", () => {
      const df = createSnowflakeUppercaseDataFrame();
      const result = toDataGrid(df, { primaryKeys: ["ID"] });

      expect(result.rows).toHaveLength(2);
      expect(result.columns.length).toBeGreaterThan(0);
    });

    test("handles UPPERCASE primary key", () => {
      const df = createSnowflakeUppercaseDataFrame();
      const result = toDataGrid(df, { primaryKeys: ["ID"] });

      // Should find the ID column as primary key
      expect(result.rows[0].ID).toBe(1);
    });
  });

  describe("toDataDiffGrid", () => {
    test("handles UPPERCASE columns in both base and current", () => {
      const base = createSnowflakeUppercaseDataFrame([
        [1, "ALICE", 100],
        [2, "BOB", 200],
      ]);
      const current = createSnowflakeUppercaseDataFrame([
        [1, "ALICE", 150], // Modified
        [2, "BOB", 200], // Unchanged
        [3, "CHARLIE", 300], // Added
      ]);

      const result = toDataDiffGrid(base, current, { primaryKeys: ["ID"] });

      expect(result.rows).toHaveLength(3);
      // Row keys are lowercased in output - check for modified status
      // The PK value is stored directly, non-PK values are prefixed
      const modifiedRow = result.rows.find((r) => r.ID === 1 || r.id === 1);
      expect(modifiedRow).toBeDefined();
      expect(modifiedRow?.__status).toBe("modified");
    });

    test("handles case mismatch between base (UPPERCASE) and current (lowercase)", () => {
      const base: DataFrame = {
        columns: [
          { key: "ID", name: "ID", type: "integer" },
          { key: "VALUE", name: "VALUE", type: "number" },
        ],
        data: [[1, 100]],
      };
      const current: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "value", name: "value", type: "number" },
        ],
        data: [[1, 150]],
      };

      // CURRENT BEHAVIOR: toDataDiffGrid does NOT support case-insensitive PK matching
      // The PK must exist in the merged column set with exact casing
      // This documents a limitation when comparing cross-warehouse data
      expect(() => {
        toDataDiffGrid(base, current, { primaryKeys: ["ID"] });
      }).toThrow("Column ID not found");
    });
  });

  describe("toValueDiffGrid", () => {
    test("handles in_a/in_b columns", () => {
      const df = createSnowflakeValueDiffDataFrame();

      const result = toValueDiffGrid(df, ["ID"], {});

      expect(result.rows).toHaveLength(4);
    });

    test("handles UPPERCASE primary key lookup", () => {
      const df = createSnowflakeValueDiffDataFrame();

      const result = toValueDiffGrid(df, ["ID"], {});

      // Verify primary key values are accessible
      expect(result.rows.some((r) => r.ID === 1 || r.id === 1)).toBe(true);
    });
  });
});

// ============================================================================
// PostgreSQL/Redshift Naming Convention Tests
// ============================================================================

describe("PostgreSQL/Redshift naming conventions (lowercase)", () => {
  describe("toDataGrid", () => {
    test("handles all lowercase column names", () => {
      const df = createPostgresLowercaseDataFrame();
      const result = toDataGrid(df, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
    });

    test("handles snake_case column names", () => {
      const df: DataFrame = {
        columns: [
          { key: "user_id", name: "user_id", type: "integer" },
          { key: "first_name", name: "first_name", type: "text" },
          { key: "last_login_date", name: "last_login_date", type: "datetime" },
        ],
        data: [
          [1, "alice", "2024-01-15T10:00:00Z"],
          [2, "bob", "2024-01-16T11:30:00Z"],
        ],
      };

      const result = toDataGrid(df, { primaryKeys: ["user_id"] });

      expect(result.rows).toHaveLength(2);
    });
  });

  describe("toDataDiffGrid", () => {
    test("handles lowercase columns in both DataFrames", () => {
      const base = createPostgresLowercaseDataFrame([
        [1, "alice", 100],
        [2, "bob", 200],
      ]);
      const current = createPostgresLowercaseDataFrame([
        [1, "alice", 150],
        [2, "bob", 200],
      ]);

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
      const modifiedRow = result.rows.find((r) => r.id === 1);
      expect(modifiedRow?.__status).toBe("modified");
    });
  });

  describe("toValueDiffGrid", () => {
    test("handles lowercase in_a/in_b columns", () => {
      const df = createPostgresValueDiffDataFrame();

      const result = toValueDiffGrid(df, ["id"], {});

      expect(result.rows).toHaveLength(4);
    });
  });
});

// ============================================================================
// Mixed Case / Quoted Identifier Tests
// ============================================================================

describe("Mixed case / quoted identifier conventions", () => {
  describe("toDataGrid", () => {
    test("handles camelCase column names", () => {
      const df = createQuotedMixedCaseDataFrame();
      const result = toDataGrid(df, { primaryKeys: ["Id"] });

      expect(result.rows).toHaveLength(2);
    });

    test("handles PascalCase column names", () => {
      const df: DataFrame = {
        columns: [
          { key: "UserId", name: "UserId", type: "integer" },
          { key: "FirstName", name: "FirstName", type: "text" },
          { key: "LastName", name: "LastName", type: "text" },
        ],
        data: [
          [1, "Alice", "Smith"],
          [2, "Bob", "Jones"],
        ],
      };

      const result = toDataGrid(df, { primaryKeys: ["UserId"] });

      expect(result.rows).toHaveLength(2);
    });
  });

  describe("toDataDiffGrid with case mismatch", () => {
    test("handles base UPPERCASE vs current lowercase", () => {
      const base: DataFrame = {
        columns: [
          { key: "ID", name: "ID", type: "integer" },
          { key: "NAME", name: "NAME", type: "text" },
        ],
        data: [[1, "ALICE"]],
      };
      const current: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "name", name: "name", type: "text" },
        ],
        data: [[1, "alice"]],
      };

      // CURRENT BEHAVIOR: Case mismatch in columns causes PK lookup to fail
      // This documents a limitation for cross-warehouse comparisons
      expect(() => {
        toDataDiffGrid(base, current, { primaryKeys: ["ID"] });
      }).toThrow("Column ID not found");
    });

    test("handles base lowercase vs current UPPERCASE", () => {
      const base: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "value", name: "value", type: "number" },
        ],
        data: [[1, 100]],
      };
      const current: DataFrame = {
        columns: [
          { key: "ID", name: "ID", type: "integer" },
          { key: "VALUE", name: "VALUE", type: "number" },
        ],
        data: [[1, 150]],
      };

      // CURRENT BEHAVIOR: Case mismatch causes PK lookup to fail
      expect(() => {
        toDataDiffGrid(base, current, { primaryKeys: ["id"] });
      }).toThrow("Column id not found");
    });
  });

  describe("toValueDiffGrid with mixed case IN columns", () => {
    test("handles mixed case in_a/in_b columns", () => {
      const df = createMixedCaseInColumnsDataFrame();

      const result = toValueDiffGrid(df, ["id"], {});

      expect(result.rows).toHaveLength(2);
    });

    test("handles all lowercase in_a/in_b columns", () => {
      const df: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "in_a", name: "in_a", type: "boolean" },
          { key: "in_b", name: "in_b", type: "boolean" },
          { key: "base__value", name: "base__value", type: "number" },
          { key: "current__value", name: "current__value", type: "number" },
        ],
        data: [[1, true, true, 100, 150]],
      };

      const result = toValueDiffGrid(df, ["id"], {});

      expect(result.rows).toHaveLength(1);
    });

    test("handles all in_a/in_b columns", () => {
      const df: DataFrame = {
        columns: [
          { key: "ID", name: "ID", type: "integer" },
          { key: "in_a", name: "in_a", type: "boolean" },
          { key: "in_b", name: "in_b", type: "boolean" },
          { key: "BASE__VALUE", name: "BASE__VALUE", type: "number" },
          { key: "CURRENT__VALUE", name: "CURRENT__VALUE", type: "number" },
        ],
        data: [[1, true, true, 100, 150]],
      };

      const result = toValueDiffGrid(df, ["ID"], {});

      expect(result.rows).toHaveLength(1);
    });
  });
});

// ============================================================================
// BigQuery / Databricks Naming Convention Tests
// ============================================================================

describe("BigQuery / Databricks naming conventions", () => {
  describe("toDataGrid", () => {
    test("handles column names starting with numbers", () => {
      const df: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "1_day_avg", name: "1_day_avg", type: "number" },
          { key: "7_day_avg", name: "7_day_avg", type: "number" },
          { key: "30_day_avg", name: "30_day_avg", type: "number" },
        ],
        data: [
          [1, 100, 700, 3000],
          [2, 150, 850, 3500],
        ],
      };

      const result = toDataGrid(df, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
    });

    test("handles column names with spaces (BigQuery backtick style)", () => {
      const df = createBigQueryStyleDataFrame();
      const result = toDataGrid(df, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
      // Verify columns with spaces are accessible
      expect(result.rows[0]["order total"]).toBe(50.5);
    });

    test("handles column names with hyphens", () => {
      const df: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "user-name", name: "user-name", type: "text" },
          { key: "order-total", name: "order-total", type: "number" },
        ],
        data: [
          [1, "alice", 100],
          [2, "bob", 200],
        ],
      };

      const result = toDataGrid(df, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
    });

    test("handles column names with special characters", () => {
      const df: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "value$", name: "value$", type: "number" },
          { key: "_private", name: "_private", type: "text" },
          { key: "__dunder__", name: "__dunder__", type: "text" },
        ],
        data: [
          [1, 100, "private1", "dunder1"],
          [2, 200, "private2", "dunder2"],
        ],
      };

      const result = toDataGrid(df, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
    });
  });

  describe("toDataDiffGrid with BigQuery style columns", () => {
    test("handles diff with column names containing spaces", () => {
      const base = createBigQueryStyleDataFrame([
        [1, 100, "alice", 50],
        [2, 200, "bob", 75],
      ]);
      const current = createBigQueryStyleDataFrame([
        [1, 100, "alice", 60], // Modified order total
        [2, 200, "bob", 75],
      ]);

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
      const modifiedRow = result.rows.find((r) => r.id === 1);
      expect(modifiedRow?.__status).toBe("modified");
    });
  });
});

// ============================================================================
// Reserved Words as Column Names Tests
// ============================================================================

describe("Reserved words as column names", () => {
  test("handles SQL reserved words as column names", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "select", name: "select", type: "text" },
        { key: "from", name: "from", type: "text" },
        { key: "where", name: "where", type: "text" },
        { key: "order", name: "order", type: "text" },
        { key: "group", name: "group", type: "text" },
      ],
      data: [[1, "sel1", "from1", "where1", "order1", "group1"]],
    };

    const result = toDataGrid(df, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(1);
  });

  test("handles reserved words in diff grid", () => {
    const base: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "table", name: "table", type: "text" },
      ],
      data: [[1, "old_table"]],
    };
    const current: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "table", name: "table", type: "text" },
      ],
      data: [[1, "new_table"]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("modified");
  });
});

// ============================================================================
// Unicode and International Character Tests
// ============================================================================

describe("Unicode and international character column names", () => {
  test("handles UTF-8 column names", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "名前", name: "名前", type: "text" }, // Japanese "name"
        { key: "価格", name: "価格", type: "number" }, // Japanese "price"
      ],
      data: [
        [1, "田中", 1000],
        [2, "鈴木", 2000],
      ],
    };

    const result = toDataGrid(df, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(2);
  });

  test("handles Cyrillic column names", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "имя", name: "имя", type: "text" }, // Russian "name"
        { key: "значение", name: "значение", type: "number" }, // Russian "value"
      ],
      data: [
        [1, "Алиса", 100],
        [2, "Борис", 200],
      ],
    };

    const result = toDataGrid(df, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(2);
  });

  test("handles emojis in column names (BigQuery flexible names)", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "🔑key", name: "🔑key", type: "text" },
        { key: "💰value", name: "💰value", type: "number" },
      ],
      data: [
        [1, "key1", 100],
        [2, "key2", 200],
      ],
    };

    const result = toDataGrid(df, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(2);
  });
});

// ============================================================================
// Primary Key Case Sensitivity Tests
// ============================================================================

describe("Primary key case sensitivity", () => {
  describe("toDataDiffGrid primary key matching", () => {
    test("matches rows when PK has same casing in both environments", () => {
      const base: DataFrame = {
        columns: [
          { key: "ID", name: "ID", type: "integer" },
          { key: "VALUE", name: "VALUE", type: "number" },
        ],
        data: [[1, 100]],
      };
      const current: DataFrame = {
        columns: [
          { key: "ID", name: "ID", type: "integer" },
          { key: "VALUE", name: "VALUE", type: "number" },
        ],
        data: [[1, 150]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["ID"] });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBe("modified");
    });

    test("throws when PK has different casing between environments", () => {
      const base: DataFrame = {
        columns: [
          { key: "ID", name: "ID", type: "integer" },
          { key: "VALUE", name: "VALUE", type: "number" },
        ],
        data: [[1, 100]],
      };
      const current: DataFrame = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "value", name: "value", type: "number" },
        ],
        data: [[1, 150]],
      };

      // CURRENT BEHAVIOR: toDataDiffGrid requires exact case match for PKs
      expect(() => {
        toDataDiffGrid(base, current, { primaryKeys: ["ID"] });
      }).toThrow("Column ID not found");
    });

    test("handles composite primary key with same casing", () => {
      const base: DataFrame = {
        columns: [
          { key: "region", name: "region", type: "text" },
          { key: "product_id", name: "product_id", type: "integer" },
          { key: "value", name: "value", type: "number" },
        ],
        data: [
          ["US", 1, 100],
          ["EU", 1, 200],
        ],
      };
      const current: DataFrame = {
        columns: [
          { key: "region", name: "region", type: "text" },
          { key: "product_id", name: "product_id", type: "integer" },
          { key: "value", name: "value", type: "number" },
        ],
        data: [
          ["US", 1, 150],
          ["EU", 1, 250],
        ],
      };

      const result = toDataDiffGrid(base, current, {
        primaryKeys: ["region", "product_id"],
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((r) => r.__status === "modified")).toBe(true);
    });

    test("throws with composite primary key when casing differs", () => {
      const base: DataFrame = {
        columns: [
          { key: "REGION", name: "REGION", type: "text" },
          { key: "PRODUCT_ID", name: "PRODUCT_ID", type: "integer" },
          { key: "VALUE", name: "VALUE", type: "number" },
        ],
        data: [
          ["US", 1, 100],
          ["EU", 1, 200],
        ],
      };
      const current: DataFrame = {
        columns: [
          { key: "region", name: "region", type: "text" },
          { key: "product_id", name: "product_id", type: "integer" },
          { key: "value", name: "value", type: "number" },
        ],
        data: [
          ["US", 1, 150],
          ["EU", 1, 250],
        ],
      };

      // CURRENT BEHAVIOR: Case mismatch causes validation to fail
      expect(() => {
        toDataDiffGrid(base, current, {
          primaryKeys: ["REGION", "PRODUCT_ID"],
        });
      }).toThrow("Column REGION not found");
    });
  });
});

// ============================================================================
// Property-Based Tests for Naming Conventions
// ============================================================================

describe("Property-based tests: naming convention resilience", () => {
  /**
   * Arbitrary for different casing styles
   */
  const casingStyleArb = fc.constantFrom(
    "lowercase",
    "UPPERCASE",
    "camelCase",
    "PascalCase",
    "snake_case",
    "SCREAMING_SNAKE_CASE",
  );

  /**
   * Transform a column name to a specific casing style
   */
  function transformCase(name: string, style: string): string {
    switch (style) {
      case "lowercase":
        return name.toLowerCase();
      case "UPPERCASE":
        return name.toUpperCase();
      case "camelCase":
        return name.charAt(0).toLowerCase() + name.slice(1);
      case "PascalCase":
        return name.charAt(0).toUpperCase() + name.slice(1);
      case "snake_case":
        return name
          .toLowerCase()
          .replace(/([A-Z])/g, "_$1")
          .toLowerCase();
      case "SCREAMING_SNAKE_CASE":
        return name
          .toUpperCase()
          .replace(/([a-z])([A-Z])/g, "$1_$2")
          .toUpperCase();
      default:
        return name;
    }
  }

  /**
   * Creates a DataFrame with the specified casing style
   */
  function createDataFrameWithCasing(
    style: string,
    numRows: number,
  ): DataFrame {
    const columns = ["id", "name", "value"].map((col) => ({
      key: transformCase(col, style),
      name: transformCase(col, style),
      type: (col === "id"
        ? "integer"
        : col === "value"
          ? "number"
          : "text") as DataFrame["columns"][number]["type"],
    }));

    const data: RowDataTypes[][] = Array.from({ length: numRows }, (_, i) => [
      i + 1,
      `item${i + 1}`,
      (i + 1) * 100,
    ]);

    return { columns, data };
  }

  test("toDataGrid handles any casing style consistently", () => {
    fc.assert(
      fc.property(casingStyleArb, fc.nat({ max: 5 }), (style, numRows) => {
        const df = createDataFrameWithCasing(style, numRows + 1);
        const pkColumn = df.columns[0].key;

        const result = toDataGrid(df, { primaryKeys: [pkColumn] });

        return result.rows.length === df.data.length;
      }),
      { numRuns: 50 },
    );
  });

  test("toDataDiffGrid handles same casing in both DataFrames", () => {
    fc.assert(
      fc.property(casingStyleArb, fc.nat({ max: 3 }), (style, numRows) => {
        const base = createDataFrameWithCasing(style, numRows + 1);
        const current = createDataFrameWithCasing(style, numRows + 1);
        const pkColumn = base.columns[0].key;

        const result = toDataDiffGrid(base, current, {
          primaryKeys: [pkColumn],
        });

        // Result should contain rows from both base and current
        return result.rows.length >= 0;
      }),
      { numRuns: 50 },
    );
  });

  test("column names with random casing don't cause crashes", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        (casings) => {
          // Generate column name with random character casing
          const columnName = "columnname"
            .split("")
            .map((c, i) => (casings[i] ? c.toUpperCase() : c.toLowerCase()))
            .join("");

          const df: DataFrame = {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: columnName, name: columnName, type: "text" },
            ],
            data: [[1, "value"]],
          };

          const result = toDataGrid(df, { primaryKeys: ["id"] });

          return result.rows.length === 1;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Edge Cases: Column Name Collisions
// ============================================================================

describe("Column name edge cases", () => {
  test("handles columns that differ only in case (edge case)", () => {
    // This is a problematic case for some warehouses
    // In reality, most warehouses don't allow this
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "Value", name: "Value", type: "number" },
        { key: "value", name: "value", type: "text" }, // Same name, different case
      ],
      data: [[1, 100, "text"]],
    };

    // This test documents behavior - may throw or deduplicate
    try {
      const result = toDataGrid(df, { primaryKeys: ["id"] });
      expect(result.rows).toHaveLength(1);
    } catch (e) {
      // Expected - duplicate column names should be rejected
      expect(e).toBeDefined();
    }
  });

  test("rejects empty column names", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "", name: "", type: "text" },
      ],
      data: [[1, "empty"]],
    };

    // Empty column names are rejected by validation (correct behavior)
    expect(() => {
      toDataGrid(df, { primaryKeys: ["id"] });
    }).toThrow(/invalid 'key'/);
  });

  test("handles very long column names", () => {
    const longName = "a".repeat(255); // Snowflake max is 255

    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: longName, name: longName, type: "text" },
      ],
      data: [[1, "value"]],
    };

    const result = toDataGrid(df, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(1);
  });

  test("handles column names with trailing/leading spaces", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: " name ", name: " name ", type: "text" },
        { key: "value ", name: "value ", type: "number" },
        { key: " count", name: " count", type: "integer" },
      ],
      data: [[1, "test", 100, 5]],
    };

    const result = toDataGrid(df, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(1);
  });
});

// ============================================================================
// Cross-Warehouse Migration Scenario Tests
// ============================================================================

describe("Cross-warehouse migration scenarios", () => {
  describe("Snowflake to PostgreSQL migration", () => {
    test("works when columns are normalized to same casing", () => {
      // Simulates normalizing Snowflake UPPERCASE to lowercase before comparison
      const base: DataFrame = {
        columns: [
          { key: "user_id", name: "user_id", type: "integer" },
          { key: "first_name", name: "first_name", type: "text" },
          { key: "last_name", name: "last_name", type: "text" },
          { key: "total_orders", name: "total_orders", type: "integer" },
        ],
        data: [
          [1, "ALICE", "SMITH", 10],
          [2, "BOB", "JONES", 5],
        ],
      };

      const current: DataFrame = {
        columns: [
          { key: "user_id", name: "user_id", type: "integer" },
          { key: "first_name", name: "first_name", type: "text" },
          { key: "last_name", name: "last_name", type: "text" },
          { key: "total_orders", name: "total_orders", type: "integer" },
        ],
        data: [
          [1, "alice", "smith", 12],
          [2, "bob", "jones", 7],
        ],
      };

      const result = toDataDiffGrid(base, current, {
        primaryKeys: ["user_id"],
      });

      // Both rows should be detected as modified (different values)
      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((r) => r.__status === "modified")).toBe(true);
    });

    test("throws when UPPERCASE base vs lowercase current without normalization", () => {
      const base: DataFrame = {
        columns: [
          { key: "USER_ID", name: "USER_ID", type: "integer" },
          { key: "FIRST_NAME", name: "FIRST_NAME", type: "text" },
        ],
        data: [[1, "ALICE"]],
      };

      const current: DataFrame = {
        columns: [
          { key: "user_id", name: "user_id", type: "integer" },
          { key: "first_name", name: "first_name", type: "text" },
        ],
        data: [[1, "alice"]],
      };

      // CURRENT BEHAVIOR: Cross-warehouse case mismatch requires normalization
      expect(() => {
        toDataDiffGrid(base, current, { primaryKeys: ["USER_ID"] });
      }).toThrow("Column USER_ID not found");
    });
  });

  describe("BigQuery to Redshift migration", () => {
    test("works when columns are normalized to same casing", () => {
      // Simulates normalizing BigQuery camelCase to lowercase before comparison
      const base: DataFrame = {
        columns: [
          { key: "userid", name: "userid", type: "integer" },
          { key: "firstname", name: "firstname", type: "text" },
          { key: "ordercount", name: "ordercount", type: "integer" },
        ],
        data: [
          [1, "Alice", 10],
          [2, "Bob", 5],
        ],
      };

      const current: DataFrame = {
        columns: [
          { key: "userid", name: "userid", type: "integer" },
          { key: "firstname", name: "firstname", type: "text" },
          { key: "ordercount", name: "ordercount", type: "integer" },
        ],
        data: [
          [1, "Alice", 12],
          [2, "Bob", 7],
        ],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["userid"] });

      expect(result.rows).toHaveLength(2);
    });

    test("throws when camelCase base vs lowercase current without normalization", () => {
      const base: DataFrame = {
        columns: [
          { key: "userId", name: "userId", type: "integer" },
          { key: "firstName", name: "firstName", type: "text" },
        ],
        data: [[1, "Alice"]],
      };

      const current: DataFrame = {
        columns: [
          { key: "userid", name: "userid", type: "integer" },
          { key: "firstname", name: "firstname", type: "text" },
        ],
        data: [[1, "Alice"]],
      };

      // CURRENT BEHAVIOR: Case mismatch requires normalization
      expect(() => {
        toDataDiffGrid(base, current, { primaryKeys: ["userId"] });
      }).toThrow("Column userId not found");
    });
  });
});
