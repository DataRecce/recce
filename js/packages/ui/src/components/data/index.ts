"use client";

// Data primitives - pure presentation components for data visualization

// AG Grid theme
export { dataGridThemeDark, dataGridThemeLight } from "./agGridTheme";
export {
  type ChartBarColors,
  type ChartThemeColors,
  getChartBarColors,
  getChartThemeColors,
  HistogramChart,
  type HistogramChartProps,
  type HistogramDataset,
  type HistogramDataType,
} from "./HistogramChart";
export {
  type ColumnRenderMode,
  type ProfileColumn,
  type ProfileDisplayMode,
  type ProfileRow,
  ProfileTable,
  type ProfileTableHandle,
  type ProfileTableProps,
} from "./ProfileTable";
// AG Grid wrapper with screenshot support
export {
  type ColDef,
  type ColGroupDef,
  type DataGridHandle,
  type DataGridRow,
  EmptyRowsRenderer,
  type EmptyRowsRendererProps,
  type GetRowIdParams,
  type GridReadyEvent,
  type RecceDataGridHandle,
  ScreenshotDataGrid,
  type ScreenshotDataGridProps,
} from "./ScreenshotDataGrid";

export {
  SingleBarChart,
  type SingleBarChartProps,
  TopKBarChart,
  type TopKBarChartProps,
  type TopKDataset,
  type TopKItem,
  TopKSummaryList,
  type TopKSummaryListProps,
} from "./TopKBarChart";
