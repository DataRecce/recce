/**
 * @file index.ts
 * @description Barrel export for DataGrid UI components
 *
 * NOTE: valueDiffCells.tsx is intentionally NOT exported here.
 * Those components use hooks (useRecceActionContext, useRecceInstanceContext)
 * that pull in heavy dependencies. Import them directly from
 * @/components/ui/dataGrid/valueDiffCells when needed.
 */

export {
  DataFrameColumnGroupHeader,
  type DataFrameColumnGroupHeaderProps,
} from "./DataFrameColumnGroupHeader";
export {
  DataFrameColumnHeader,
  type DataFrameColumnHeaderProps,
} from "./DataFrameColumnHeader";
export { defaultRenderCell } from "./defaultRenderCell";
export { asNumber, inlineRenderCell } from "./inlineRenderCell";
