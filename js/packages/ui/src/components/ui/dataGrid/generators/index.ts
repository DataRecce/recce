/**
 * @file generators/index.ts
 * @description Barrel exports for data grid generator functions
 *
 * These generators transform run results into AG Grid configurations.
 */

export type {
  ValueDataGridOptions,
  ValueDataGridResult,
} from "./toValueDataGrid";
export { toValueDataGrid } from "./toValueDataGrid";
