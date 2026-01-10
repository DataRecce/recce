/**
 * @file generators/index.ts
 * @description Grid generator functions for building AG Grid configurations
 *
 * These generators transform raw data into AG Grid-compatible column definitions
 * and row data. Each generator accepts render components for dependency injection,
 * allowing OSS to provide its own React components.
 */

// Data diff grid (base vs current DataFrames)
export type {
  DataDiffGridResult,
  QueryDataDiffGridOptions,
  ToDataDiffGridConfig,
} from "./toDataDiffGrid";
export { toDataDiffGrid } from "./toDataDiffGrid";
// Data grid (single DataFrame)
export type {
  DataGridResult,
  QueryDataGridOptions,
  ToDataGridConfig,
} from "./toDataGrid";
export { toDataGrid } from "./toDataGrid";
// Row count grid (single environment)
export type { RowCountDataGridResult } from "./toRowCountDataGrid";
export { toRowCountDataGrid } from "./toRowCountDataGrid";
// Row count diff grid (base vs current row counts)
export type { RowCountDiffDataGridResult } from "./toRowCountDiffDataGrid";
export { toRowCountDiffDataGrid } from "./toRowCountDiffDataGrid";
// Value diff grid (joined data with in_a/in_b)
export type {
  ToValueDiffGridConfig,
  ValueDiffGridResult,
} from "./toValueDiffGrid";
export { toValueDiffGrid } from "./toValueDiffGrid";
