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
  TopKBarChart,
  type TopKBarChartProps,
  type TopKDataset,
  type TopKItem,
} from "./TopKBarChart";
