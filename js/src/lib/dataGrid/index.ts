// js/src/lib/dataGrid/index.ts

// Value diff summary grid (column-level match statistics)
export {
  toValueDataGrid,
  type ValueDataGridOptions,
  type ValueDataGridResult,
} from "src/lib/dataGrid/generators/toValueDataGrid";
export type {
  BaseGridOptions,
  DataGridResult,
  DiffGridOptions,
} from "./dataGridFactory";
export {
  createDataGrid,
  createDataGridFromData,
  toDataDiffGrid,
  toDataGrid,
  toValueDiffGrid,
} from "./dataGridFactory";
