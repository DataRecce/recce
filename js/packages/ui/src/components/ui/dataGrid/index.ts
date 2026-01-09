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
// Cell renderers
export type {
  ColDefWithMetadata,
  RecceColumnContext,
} from "./defaultRenderCell";
export { defaultRenderCell } from "./defaultRenderCell";
export type {
  InlineDiffTextProps,
  InlineRenderCellConfig,
} from "./inlineRenderCell";
export {
  asNumber,
  createInlineRenderCell,
  inlineRenderCell,
} from "./inlineRenderCell";
