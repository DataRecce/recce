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
  InlineProfileDistributionCell,
  type InlineProfileDistributionCellProps,
} from "./InlineProfileDistributionCell";
// Paired histograms for inline profile distribution (DRC-3390)
export {
  computeContinuousLayout,
  PairedHistogramContinuous,
  type PairedHistogramContinuousData,
  type PairedHistogramContinuousProps,
} from "./PairedHistogramContinuous";
export {
  computeDiscreteSlots,
  PairedHistogramDiscrete,
  type PairedHistogramDiscreteData,
  type PairedHistogramDiscreteProps,
} from "./PairedHistogramDiscrete";
export {
  ProfileDistributionUnsupportedBanner,
  type ProfileDistributionUnsupportedBannerProps,
} from "./ProfileDistributionUnsupportedBanner";
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
