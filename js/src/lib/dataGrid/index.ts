// js/src/lib/dataGrid/index.ts

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

// Value diff summary grid (column-level match statistics)
export {
  toValueDataGrid,
  type ValueDataGridOptions,
  type ValueDataGridResult,
} from "./generators/toValueDataGrid";
