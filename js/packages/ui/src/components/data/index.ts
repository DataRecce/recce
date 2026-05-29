"use client";

// Data primitives - pure presentation components for data visualization

// AG Grid theme
export { dataGridThemeDark, dataGridThemeLight } from "./agGridTheme";
export {
  HistogramChart,
  type HistogramChartProps,
  type HistogramDataset,
  type HistogramDataType,
} from "./HistogramChart";
// Paired histograms for inline profile distribution (DRC-3390)
export {
  InlineProfileDistributionCell,
  type InlineProfileDistributionCellProps,
} from "./InlineProfileDistributionCell";
export {
  PairedHistogramContinuous,
  type PairedHistogramContinuousData,
  type PairedHistogramContinuousProps,
} from "./PairedHistogramContinuous";
export {
  PairedHistogramDiscrete,
  type PairedHistogramDiscreteCountsData,
  type PairedHistogramDiscreteData,
  type PairedHistogramDiscreteProps,
  type PairedHistogramDiscreteRanksData,
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
