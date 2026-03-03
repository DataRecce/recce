/**
 * @file components/ui/dataGrid/index.ts
 * @description Barrel export for DataGrid UI components
 *
 * Exports cell renderers and column header components for AG Grid integration.
 */

export type { DataFrameColumnGroupHeaderProps } from "./DataFrameColumnGroupHeader";
export { DataFrameColumnGroupHeader } from "./DataFrameColumnGroupHeader";
// Column header components
export type { DataFrameColumnHeaderProps } from "./DataFrameColumnHeader";
export { DataFrameColumnHeader } from "./DataFrameColumnHeader";
export type {
  BaseGridOptions,
  DataGridFromDataResult,
  DataGridInput,
  DataGridResult,
  DiffGridOptions,
} from "./dataGridFactory";
export {
  createDataGrid,
  createDataGridFromData,
} from "./dataGridFactory";
// Cell renderers
export type {
  ColDefWithMetadata,
  RecceColumnContext,
} from "./defaultRenderCell";
export { defaultRenderCell } from "./defaultRenderCell";
// Grid generators
export type {
  ValueDataGridOptions,
  ValueDataGridResult,
} from "./generators";
export { toValueDataGrid } from "./generators";
export type {
  InlineDiffTextProps,
  InlineRenderCellConfig,
} from "./inlineRenderCell";
export {
  asNumber,
  createInlineRenderCell,
  inlineRenderCell,
} from "./inlineRenderCell";
// Schema cell components and render functions
export {
  createSchemaColumnNameRenderer,
  createSingleEnvColumnNameRenderer,
  MemoizedRenderIndexCell,
  MemoizedRenderTypeCell,
  renderIndexCell,
  renderTypeCell,
} from "./schemaCells";
// Value diff cell components and render functions
export type {
  MatchedPercentCellProps,
  PrimaryKeyIndicatorCellProps,
  ValueDiffColumnNameCellProps,
} from "./valueDiffCells";
export {
  createColumnNameRenderer,
  createPrimaryKeyIndicatorRenderer,
  MatchedPercentCell,
  PrimaryKeyIndicatorCell,
  renderMatchedPercentCell,
  ValueDiffColumnNameCell,
} from "./valueDiffCells";
