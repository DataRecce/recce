// packages/storybook/stories/profile/fixtures.ts
import type { ColumnType, DataFrame } from "@datarecce/ui/api";
import type {
  ProfileDiffRun,
  ProfileRun,
} from "@datarecce/ui/components/profile/ProfileResultView";

/**
 * Create a DataFrame for profile data
 * Note: DataFrame.data is an array of arrays (rows), not an array of objects
 * Structure matches actual profile diff output from recce backend
 */
export const createProfileDataFrame = (): DataFrame => {
  return {
    columns: [
      { key: "column_name", name: "column_name", type: "text" as ColumnType },
      { key: "data_type", name: "data_type", type: "text" as ColumnType },
      { key: "row_count", name: "row_count", type: "integer" as ColumnType },
      {
        key: "not_null_proportion",
        name: "not_null_proportion",
        type: "number" as ColumnType,
      },
      {
        key: "distinct_proportion",
        name: "distinct_proportion",
        type: "number" as ColumnType,
      },
      {
        key: "distinct_count",
        name: "distinct_count",
        type: "integer" as ColumnType,
      },
      { key: "is_unique", name: "is_unique", type: "boolean" as ColumnType },
      { key: "min", name: "min", type: "text" as ColumnType },
      { key: "max", name: "max", type: "text" as ColumnType },
      { key: "avg", name: "avg", type: "number" as ColumnType },
      { key: "median", name: "median", type: "number" as ColumnType },
    ],
    data: [
      [
        "customer_id",
        "bigint",
        1000,
        "1.0",
        "1.0",
        1000,
        true,
        "1",
        "1000",
        "500.5",
        "500.5",
      ],
      [
        "order_count",
        "bigint",
        1000,
        "1.0",
        "0.433",
        433,
        false,
        "1",
        "537",
        "151.3",
        "118.0",
      ],
      [
        "email",
        "character varying(256)",
        1000,
        "0.995",
        "0.985",
        985,
        false,
        null,
        null,
        null,
        null,
      ],
      [
        "status",
        "character varying(256)",
        1000,
        "0.876",
        "0.003",
        3,
        false,
        null,
        null,
        null,
        null,
      ],
      [
        "created_at",
        "timestamp",
        1000,
        "1.0",
        "1.0",
        1000,
        true,
        null,
        null,
        null,
        null,
      ],
    ],
  };
};

/**
 * Create profile diff DataFrames showing changes between base and current
 * Structure matches actual profile diff output with meaningful differences:
 * - Unchanged columns (customer_id, number_of_orders)
 * - Modified column (customer_lifetime_value with different stats)
 * - Removed column (deprecated_field exists in base but not current)
 * - Added columns (net_customer_lifetime_value, net_value_segment in current only)
 */
export const createProfileDiffDataFrames = (): {
  base: DataFrame;
  current: DataFrame;
} => {
  const columns: Array<{ key: string; name: string; type: ColumnType }> = [
    { key: "column_name", name: "column_name", type: "text" },
    { key: "data_type", name: "data_type", type: "text" },
    { key: "row_count", name: "row_count", type: "integer" },
    { key: "not_null_proportion", name: "not_null_proportion", type: "number" },
    { key: "distinct_proportion", name: "distinct_proportion", type: "number" },
    { key: "distinct_count", name: "distinct_count", type: "integer" },
    { key: "is_unique", name: "is_unique", type: "boolean" },
    { key: "min", name: "min", type: "text" },
    { key: "max", name: "max", type: "text" },
    { key: "avg", name: "avg", type: "number" },
    { key: "median", name: "median", type: "number" },
  ];

  return {
    base: {
      columns,
      data: [
        [
          "customer_id",
          "bigint",
          1856,
          "1.0",
          "1.0",
          1856,
          true,
          "3",
          "4599",
          "2018.899",
          "1851.5",
        ],
        [
          "number_of_orders",
          "bigint",
          1856,
          "1.0",
          "0.233",
          433,
          false,
          "1",
          "537",
          "151.316",
          "118.0",
        ],
        [
          "customer_lifetime_value",
          "bigint",
          1856,
          "1.0",
          "0.856",
          1590,
          false,
          "5",
          "10092",
          "2758.600",
          "2126.5",
        ],
        // This column will be removed in current
        [
          "deprecated_field",
          "character varying(256)",
          1856,
          "0.523",
          "0.145",
          269,
          false,
          null,
          null,
          null,
          null,
        ],
        [
          "order_frequency_segment",
          "character varying(256)",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
        [
          "value_segment",
          "character varying(256)",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
      ],
    },
    current: {
      columns,
      data: [
        // Unchanged
        [
          "customer_id",
          "bigint",
          1856,
          "1.0",
          "1.0",
          1856,
          true,
          "3",
          "4599",
          "2018.899",
          "1851.5",
        ],
        [
          "number_of_orders",
          "bigint",
          1856,
          "1.0",
          "0.233",
          433,
          false,
          "1",
          "537",
          "151.316",
          "118.0",
        ],
        // Modified - lower not_null_proportion and different stats
        [
          "customer_lifetime_value",
          "bigint",
          1856,
          "0.997",
          "0.804",
          1494,
          false,
          "5",
          "6852",
          "1871.768",
          "1451.0",
        ],
        // deprecated_field removed (not in current)
        // New column added
        [
          "net_customer_lifetime_value",
          "bigint",
          1856,
          "0.997",
          "0.782",
          1452,
          false,
          "0",
          "6168",
          "1655.379",
          "1282.0",
        ],
        [
          "order_frequency_segment",
          "character varying(256)",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
        [
          "value_segment",
          "character varying(256)",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
        // New column added
        [
          "net_value_segment",
          "character varying(256)",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
      ],
    },
  };
};

/**
 * Create a profile run
 */
export const createProfileRun = (
  overrides: Partial<ProfileRun> = {},
): ProfileRun => ({
  run_id: `run-${Math.random().toString(36).slice(2, 9)}`,
  type: "profile",
  run_at: new Date().toISOString(),
  result: {
    current: createProfileDataFrame(),
  },
  ...overrides,
});

/**
 * Create a profile diff run
 */
export const createProfileDiffRun = (
  overrides: Partial<ProfileDiffRun> = {},
): ProfileDiffRun => {
  const { base, current } = createProfileDiffDataFrames();
  return {
    run_id: `run-${Math.random().toString(36).slice(2, 9)}`,
    type: "profile_diff",
    run_at: new Date().toISOString(),
    result: {
      base,
      current,
    },
    ...overrides,
  };
};

/**
 * Large profile result with many columns (50 rows for testing scrolling)
 */
export const createLargeProfileDataFrame = (): DataFrame => {
  return {
    columns: [
      { key: "column_name", name: "column_name", type: "text" },
      { key: "data_type", name: "data_type", type: "text" },
      { key: "row_count", name: "row_count", type: "integer" },
      {
        key: "not_null_proportion",
        name: "not_null_proportion",
        type: "number",
      },
      {
        key: "distinct_proportion",
        name: "distinct_proportion",
        type: "number",
      },
      { key: "distinct_count", name: "distinct_count", type: "integer" },
      { key: "is_unique", name: "is_unique", type: "boolean" },
      { key: "min", name: "min", type: "text" },
      { key: "max", name: "max", type: "text" },
      { key: "avg", name: "avg", type: "number" },
      { key: "median", name: "median", type: "number" },
    ],
    data: Array.from({ length: 50 }, (_, i) => {
      const isNumeric = i % 3 === 0;
      const dataType = isNumeric
        ? "bigint"
        : i % 3 === 1
          ? "character varying(256)"
          : "timestamp";
      const rowCount = 10000;
      const distinctCount = Math.floor(Math.random() * rowCount);

      return [
        `column_${i}`,
        dataType,
        rowCount,
        (0.9 + Math.random() * 0.1).toFixed(3),
        (distinctCount / rowCount).toFixed(3),
        distinctCount,
        distinctCount === rowCount,
        isNumeric ? Math.floor(Math.random() * 100).toString() : null,
        isNumeric ? Math.floor(Math.random() * 10000).toString() : null,
        isNumeric ? (Math.random() * 5000).toFixed(2) : null,
        isNumeric ? (Math.random() * 5000).toFixed(2) : null,
      ];
    }),
  };
};

/**
 * Empty profile result - has column definitions but no data rows
 */
/**
 * Create a DataFrame with UPPERCASE column keys matching real backend data
 * (BigQuery, Snowflake, etc. return uppercase column names)
 * This fixture helps catch bugs where rendering depends on key casing.
 */
export const createProfileDataFrameUppercase = (): DataFrame => {
  return {
    columns: [
      { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" as ColumnType },
      { key: "DATA_TYPE", name: "DATA_TYPE", type: "text" as ColumnType },
      { key: "ROW_COUNT", name: "ROW_COUNT", type: "integer" as ColumnType },
      {
        key: "NOT_NULL_PROPORTION",
        name: "NOT_NULL_PROPORTION",
        type: "number" as ColumnType,
      },
      {
        key: "DISTINCT_PROPORTION",
        name: "DISTINCT_PROPORTION",
        type: "number" as ColumnType,
      },
      {
        key: "DISTINCT_COUNT",
        name: "DISTINCT_COUNT",
        type: "integer" as ColumnType,
      },
      { key: "IS_UNIQUE", name: "IS_UNIQUE", type: "boolean" as ColumnType },
      { key: "MIN", name: "MIN", type: "text" as ColumnType },
      { key: "MAX", name: "MAX", type: "text" as ColumnType },
      { key: "AVG", name: "AVG", type: "number" as ColumnType },
      { key: "MEDIAN", name: "MEDIAN", type: "number" as ColumnType },
    ],
    data: [
      [
        "customer_id",
        "INTEGER",
        2500,
        "1.0",
        "1.0",
        2500,
        true,
        "1",
        "2500",
        "1250.5",
        "1250.0",
      ],
      [
        "order_count",
        "INTEGER",
        2500,
        "1.0",
        "0.388",
        970,
        false,
        "0",
        "847",
        "203.7",
        "165.0",
      ],
      [
        "email",
        "VARCHAR",
        2500,
        "0.992",
        "0.990",
        2475,
        false,
        null,
        null,
        null,
        null,
      ],
      [
        "created_date",
        "DATE",
        2500,
        "1.0",
        "0.876",
        2190,
        false,
        null,
        null,
        null,
        null,
      ],
      [
        "is_active",
        "BOOLEAN",
        2500,
        "1.0",
        "0.001",
        2,
        false,
        null,
        null,
        null,
        null,
      ],
      [
        "total_revenue",
        "NUMBER",
        2500,
        "0.998",
        "0.912",
        2280,
        false,
        "0.50",
        "99999.99",
        "4521.33",
        "2150.00",
      ],
    ],
  };
};

/**
 * Create UPPERCASE profile diff DataFrames showing changes between base and current
 * Mirrors createProfileDiffDataFrames() but with UPPERCASE column keys
 */
export const createProfileDiffDataFramesUppercase = (): {
  base: DataFrame;
  current: DataFrame;
} => {
  const columns: Array<{ key: string; name: string; type: ColumnType }> = [
    { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" },
    { key: "DATA_TYPE", name: "DATA_TYPE", type: "text" },
    { key: "ROW_COUNT", name: "ROW_COUNT", type: "integer" },
    { key: "NOT_NULL_PROPORTION", name: "NOT_NULL_PROPORTION", type: "number" },
    {
      key: "DISTINCT_PROPORTION",
      name: "DISTINCT_PROPORTION",
      type: "number",
    },
    { key: "DISTINCT_COUNT", name: "DISTINCT_COUNT", type: "integer" },
    { key: "IS_UNIQUE", name: "IS_UNIQUE", type: "boolean" },
    { key: "MIN", name: "MIN", type: "text" },
    { key: "MAX", name: "MAX", type: "text" },
    { key: "AVG", name: "AVG", type: "number" },
    { key: "MEDIAN", name: "MEDIAN", type: "number" },
  ];

  return {
    base: {
      columns,
      data: [
        [
          "customer_id",
          "INTEGER",
          1856,
          "1.0",
          "1.0",
          1856,
          true,
          "3",
          "4599",
          "2018.899",
          "1851.5",
        ],
        [
          "number_of_orders",
          "INTEGER",
          1856,
          "1.0",
          "0.233",
          433,
          false,
          "1",
          "537",
          "151.316",
          "118.0",
        ],
        [
          "customer_lifetime_value",
          "NUMBER",
          1856,
          "1.0",
          "0.856",
          1590,
          false,
          "5",
          "10092",
          "2758.600",
          "2126.5",
        ],
        // This column will be removed in current
        [
          "deprecated_field",
          "VARCHAR",
          1856,
          "0.523",
          "0.145",
          269,
          false,
          null,
          null,
          null,
          null,
        ],
        [
          "order_frequency_segment",
          "VARCHAR",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
        [
          "is_active",
          "BOOLEAN",
          1856,
          "1.0",
          "0.001",
          2,
          false,
          null,
          null,
          null,
          null,
        ],
      ],
    },
    current: {
      columns,
      data: [
        // Unchanged
        [
          "customer_id",
          "INTEGER",
          1856,
          "1.0",
          "1.0",
          1856,
          true,
          "3",
          "4599",
          "2018.899",
          "1851.5",
        ],
        [
          "number_of_orders",
          "INTEGER",
          1856,
          "1.0",
          "0.233",
          433,
          false,
          "1",
          "537",
          "151.316",
          "118.0",
        ],
        // Modified - lower not_null_proportion and different stats
        [
          "customer_lifetime_value",
          "NUMBER",
          1856,
          "0.997",
          "0.804",
          1494,
          false,
          "5",
          "6852",
          "1871.768",
          "1451.0",
        ],
        // deprecated_field removed (not in current)
        // New column added
        [
          "net_customer_lifetime_value",
          "NUMBER",
          1856,
          "0.997",
          "0.782",
          1452,
          false,
          "0",
          "6168",
          "1655.379",
          "1282.0",
        ],
        [
          "order_frequency_segment",
          "VARCHAR",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
        [
          "is_active",
          "BOOLEAN",
          1856,
          "1.0",
          "0.001",
          2,
          false,
          null,
          null,
          null,
          null,
        ],
        // New column added
        [
          "net_value_segment",
          "VARCHAR",
          1856,
          "1.0",
          "0.001",
          3,
          false,
          null,
          null,
          null,
          null,
        ],
      ],
    },
  };
};

/**
 * Create a profile run with UPPERCASE column keys
 */
export const createProfileRunUppercase = (
  overrides: Partial<ProfileRun> = {},
): ProfileRun => ({
  run_id: `run-${Math.random().toString(36).slice(2, 9)}`,
  type: "profile",
  run_at: new Date().toISOString(),
  result: {
    current: createProfileDataFrameUppercase(),
  },
  ...overrides,
});

/**
 * Create a profile diff run with UPPERCASE column keys
 */
export const createProfileDiffRunUppercase = (
  overrides: Partial<ProfileDiffRun> = {},
): ProfileDiffRun => {
  const { base, current } = createProfileDiffDataFramesUppercase();
  return {
    run_id: `run-${Math.random().toString(36).slice(2, 9)}`,
    type: "profile_diff",
    run_at: new Date().toISOString(),
    result: {
      base,
      current,
    },
    ...overrides,
  };
};

/**
 * Empty profile result - has column definitions but no data rows
 */
export const createEmptyProfileDataFrame = (): DataFrame => ({
  columns: [
    { key: "column_name", name: "column_name", type: "text" },
    { key: "data_type", name: "data_type", type: "text" },
    { key: "row_count", name: "row_count", type: "integer" },
    { key: "not_null_proportion", name: "not_null_proportion", type: "number" },
    { key: "distinct_proportion", name: "distinct_proportion", type: "number" },
    { key: "distinct_count", name: "distinct_count", type: "integer" },
    { key: "is_unique", name: "is_unique", type: "boolean" },
    { key: "min", name: "min", type: "text" },
    { key: "max", name: "max", type: "text" },
    { key: "avg", name: "avg", type: "number" },
    { key: "median", name: "median", type: "number" },
  ],
  data: [],
});
