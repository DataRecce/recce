// packages/storybook/stories/data/fixtures.ts
import type {
  ColDef,
  DataGridRow,
  HistogramDataset,
  ProfileColumn,
  ProfileRow,
  TopKDataset,
} from "@datarecce/ui/primitives";

// ============================================
// Histogram Fixtures
// ============================================

/**
 * Create histogram dataset with sensible defaults
 */
export const createHistogramDataset = (
  overrides: Partial<HistogramDataset> = {},
): HistogramDataset => ({
  counts: [10, 25, 45, 60, 50, 35, 20, 10, 5, 2],
  label: "Data",
  ...overrides,
});

/**
 * Sample histogram bin edges for numeric data
 */
export const sampleBinEdges = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/**
 * Sample histogram bin edges for datetime data (timestamps in milliseconds)
 */
export const sampleDatetimeBinEdges = [
  1609459200000, // 2021-01-01
  1612137600000, // 2021-02-01
  1614556800000, // 2021-03-01
  1617235200000, // 2021-04-01
  1619827200000, // 2021-05-01
  1622505600000, // 2021-06-01
  1625097600000, // 2021-07-01
  1627776000000, // 2021-08-01
  1630454400000, // 2021-09-01
  1633046400000, // 2021-10-01
  1635724800000, // 2021-11-01
];

/**
 * Create histogram with skewed distribution
 */
export const createSkewedHistogram = (): HistogramDataset => ({
  counts: [100, 80, 50, 30, 15, 8, 4, 2, 1, 0],
  label: "Skewed Data",
});

/**
 * Create histogram with uniform distribution
 */
export const createUniformHistogram = (): HistogramDataset => ({
  counts: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  label: "Uniform Data",
});

// ============================================
// Profile Table Fixtures
// ============================================

/**
 * Create profile column definition
 */
export const createProfileColumn = (
  overrides: Partial<ProfileColumn> = {},
): ProfileColumn => ({
  field: "column_name",
  headerName: "Column",
  width: 150,
  isMetric: false,
  ...overrides,
});

/**
 * Create profile row data
 */
export const createProfileRow = (
  overrides: Partial<ProfileRow> = {},
): ProfileRow => ({
  column: "sample_column",
  dtype: "VARCHAR",
  count: 1000,
  nulls: 10,
  distinct: 500,
  ...overrides,
});

/**
 * Sample profile columns for diff view
 */
export const sampleProfileColumns: ProfileColumn[] = [
  { field: "column", headerName: "Column", width: 200, pinned: "left" },
  { field: "dtype", headerName: "Type", width: 120 },
  { field: "count_base", headerName: "Base Count", width: 120, isMetric: true },
  {
    field: "count_current",
    headerName: "Current Count",
    width: 120,
    isMetric: true,
  },
  { field: "nulls_base", headerName: "Base Nulls", width: 120, isMetric: true },
  {
    field: "nulls_current",
    headerName: "Current Nulls",
    width: 120,
    isMetric: true,
  },
  {
    field: "distinct_base",
    headerName: "Base Distinct",
    width: 140,
    isMetric: true,
  },
  {
    field: "distinct_current",
    headerName: "Current Distinct",
    width: 140,
    isMetric: true,
  },
];

/**
 * Sample profile rows for diff view
 */
export const sampleProfileRows: ProfileRow[] = [
  {
    __rowKey: "col1",
    column: "user_id",
    dtype: "INTEGER",
    count_base: 1000,
    count_current: 1050,
    nulls_base: 0,
    nulls_current: 0,
    distinct_base: 1000,
    distinct_current: 1050,
    __status: "modified",
  },
  {
    __rowKey: "col2",
    column: "username",
    dtype: "VARCHAR",
    count_base: 1000,
    count_current: 1050,
    nulls_base: 5,
    nulls_current: 8,
    distinct_base: 995,
    distinct_current: 1042,
    __status: "modified",
  },
  {
    __rowKey: "col3",
    column: "email",
    dtype: "VARCHAR",
    count_base: 1000,
    count_current: 1050,
    nulls_base: 0,
    nulls_current: 0,
    distinct_base: 1000,
    distinct_current: 1050,
    __status: "unchanged",
  },
  {
    __rowKey: "col4",
    column: "created_at",
    dtype: "TIMESTAMP",
    count_base: 1000,
    count_current: 1050,
    nulls_base: 0,
    nulls_current: 0,
    distinct_base: 1000,
    distinct_current: 1050,
    __status: "unchanged",
  },
];

// ============================================
// Top-K Fixtures
// ============================================

/**
 * Create Top-K dataset with sensible defaults
 */
export const createTopKDataset = (
  overrides: Partial<TopKDataset> = {},
): TopKDataset => ({
  values: ["apple", "banana", "orange", "grape", "melon"],
  counts: [100, 80, 60, 40, 20],
  valids: 300,
  ...overrides,
});

/**
 * Sample Top-K dataset with more values
 */
export const sampleTopKDataset: TopKDataset = {
  values: [
    "active",
    "pending",
    "completed",
    "cancelled",
    "failed",
    "processing",
    "queued",
    "archived",
    "deleted",
    "suspended",
    "other1",
    "other2",
  ],
  counts: [1200, 800, 600, 400, 200, 150, 100, 80, 50, 30, 20, 10],
  valids: 3640,
};

/**
 * Sample Top-K dataset with special values (null, empty)
 */
export const topKWithSpecialValues: TopKDataset = {
  values: [null, "", "value1", "value2", "value3"],
  counts: [50, 30, 100, 80, 60],
  valids: 320,
};

// ============================================
// Data Grid Fixtures
// ============================================

/**
 * Create column definition for data grid
 */
export const createGridColumn = (overrides: Partial<ColDef> = {}): ColDef => ({
  field: "column_name",
  headerName: "Column",
  width: 150,
  ...overrides,
});

/**
 * Create data grid row
 */
export const createGridRow = (
  index: number,
  overrides: Partial<DataGridRow> = {},
): DataGridRow => ({
  __rowKey: `row-${index}`,
  id: index,
  name: `Row ${index}`,
  value: Math.floor(Math.random() * 1000),
  status: index % 2 === 0 ? "active" : "inactive",
  ...overrides,
});

/**
 * Sample grid columns
 */
export const sampleGridColumns: ColDef[] = [
  { field: "id", headerName: "ID", width: 80 },
  { field: "name", headerName: "Name", width: 200 },
  { field: "value", headerName: "Value", width: 120 },
  { field: "status", headerName: "Status", width: 120 },
  { field: "created_at", headerName: "Created", width: 180 },
];

/**
 * Generate sample grid rows
 */
export const generateGridRows = (count: number): DataGridRow[] => {
  return Array.from({ length: count }, (_, i) => createGridRow(i));
};

/**
 * Sample grid rows with diff status
 */
export const gridRowsWithDiff: DataGridRow[] = [
  { __rowKey: "1", id: 1, name: "Added Row", value: 100, __status: "added" },
  {
    __rowKey: "2",
    id: 2,
    name: "Removed Row",
    value: 200,
    __status: "removed",
  },
  {
    __rowKey: "3",
    id: 3,
    name: "Modified Row",
    value: 300,
    __status: "modified",
  },
  {
    __rowKey: "4",
    id: 4,
    name: "Unchanged Row",
    value: 400,
    __status: "unchanged",
  },
];
