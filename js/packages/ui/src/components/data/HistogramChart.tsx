"use client";

import {
  BarElement,
  CategoryScale,
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  TimeSeriesScale,
  Title,
  Tooltip,
} from "chart.js";
import { memo, useMemo } from "react";
import { Chart } from "react-chartjs-2";

// Register Chart.js modules once
ChartJS.register(
  BarElement,
  TimeSeriesScale,
  LinearScale,
  CategoryScale,
  Title,
  Legend,
  Tooltip,
);

/**
 * Theme-aware colors for charts
 */
export interface ChartThemeColors {
  gridColor: string;
  textColor: string;
  borderColor: string;
  tooltipBackgroundColor: string;
  tooltipTextColor: string;
}

/**
 * Bar colors for base/current comparison
 */
export interface ChartBarColors {
  current: string;
  base: string;
  currentWithAlpha: string;
  baseWithAlpha: string;
}

// Light mode colors
const CURRENT_BAR_COLOR = "#63B3ED";
const BASE_BAR_COLOR = "#F6AD55";
const CURRENT_BAR_COLOR_WITH_ALPHA = `${CURRENT_BAR_COLOR}A5`;
const BASE_BAR_COLOR_WITH_ALPHA = `${BASE_BAR_COLOR}A5`;

// Dark mode colors
const CURRENT_BAR_COLOR_DARK = "#90CDF4";
const BASE_BAR_COLOR_DARK = "#FBD38D";
const CURRENT_BAR_COLOR_DARK_WITH_ALPHA = `${CURRENT_BAR_COLOR_DARK}A5`;
const BASE_BAR_COLOR_DARK_WITH_ALPHA = `${BASE_BAR_COLOR_DARK}A5`;

/**
 * Get theme-aware colors for charts
 */
export function getChartThemeColors(isDark: boolean): ChartThemeColors {
  return {
    gridColor: isDark ? "#4b5563" : "#d1d5db",
    textColor: isDark ? "#e5e7eb" : "#374151",
    borderColor: isDark ? "#6b7280" : "#9ca3af",
    tooltipBackgroundColor: isDark ? "#1f2937" : "#ffffff",
    tooltipTextColor: isDark ? "#e5e7eb" : "#111827",
  };
}

/**
 * Get theme-aware bar colors
 */
export function getChartBarColors(isDark: boolean): ChartBarColors {
  return {
    current: isDark ? CURRENT_BAR_COLOR_DARK : CURRENT_BAR_COLOR,
    base: isDark ? BASE_BAR_COLOR_DARK : BASE_BAR_COLOR,
    currentWithAlpha: isDark
      ? CURRENT_BAR_COLOR_DARK_WITH_ALPHA
      : CURRENT_BAR_COLOR_WITH_ALPHA,
    baseWithAlpha: isDark
      ? BASE_BAR_COLOR_DARK_WITH_ALPHA
      : BASE_BAR_COLOR_WITH_ALPHA,
  };
}

/**
 * Histogram dataset for a single environment
 */
export interface HistogramDataset {
  /** Count values per bin */
  counts: number[];
  /** Optional dataset label */
  label?: string;
}

/**
 * Histogram data type
 */
export type HistogramDataType = "numeric" | "datetime" | "string";

/**
 * Props for the HistogramChart component
 */
export interface HistogramChartProps {
  /** Chart title */
  title: string;
  /** Data type (numeric, datetime, or string) */
  dataType?: HistogramDataType;
  /** Total sample count */
  samples?: number;
  /** Minimum value (for datetime scale) */
  min?: string | number;
  /** Maximum value (for datetime scale) */
  max?: string | number;
  /** Bin edge values */
  binEdges: number[];
  /** Base environment dataset */
  baseData: HistogramDataset;
  /** Current environment dataset */
  currentData: HistogramDataset;
  /** Enable animation */
  animate?: boolean;
  /** Hide axis labels and ticks */
  hideAxis?: boolean;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Chart height in pixels */
  height?: number;
  /** Optional CSS class */
  className?: string;
}

/**
 * Format number as abbreviated (K, M, B, T)
 */
function formatAbbreviatedNumber(input: number | string): string {
  if (typeof input !== "number") return String(input);

  const absValue = Math.abs(input);
  const trillion = 1e12;
  const billion = 1e9;
  const million = 1e6;
  const thousand = 1e3;

  if (absValue >= trillion) {
    return `${(input / trillion).toFixed(1)}T`;
  }
  if (absValue >= billion) {
    return `${(input / billion).toFixed(1)}B`;
  }
  if (absValue >= million) {
    return `${(input / million).toFixed(1)}M`;
  }
  if (absValue >= thousand) {
    return `${(input / thousand).toFixed(1)}K`;
  }
  if (absValue >= 1) {
    return input.toFixed(2);
  }
  if (absValue >= 0.01) {
    return input.toFixed(3);
  }
  return input.toExponential(2);
}

/**
 * Format bin range display
 */
function formatBinRange(binEdges: number[], index: number): string {
  const start = binEdges[index];
  const end = binEdges[index + 1];
  return `${formatAbbreviatedNumber(start)} - ${formatAbbreviatedNumber(end)}`;
}

/**
 * Format percentage display
 */
function formatPercentage(value: number): string {
  if (value > 0 && value <= 0.001) return "<0.1%";
  if (value < 1 && value >= 0.999) return ">99.9%";
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * HistogramChart Component
 *
 * A pure presentation component for displaying histogram charts comparing
 * base and current data distributions using Chart.js.
 *
 * @example Basic usage
 * ```tsx
 * import { HistogramChart } from '@datarecce/ui/primitives';
 *
 * function ProfilePanel({ histogramData }) {
 *   return (
 *     <HistogramChart
 *       title="Age Distribution"
 *       dataType="numeric"
 *       binEdges={histogramData.binEdges}
 *       baseData={{ counts: histogramData.baseCounts }}
 *       currentData={{ counts: histogramData.currentCounts }}
 *       samples={1000}
 *     />
 *   );
 * }
 * ```
 *
 * @example With datetime scale
 * ```tsx
 * <HistogramChart
 *   title="Events Over Time"
 *   dataType="datetime"
 *   binEdges={timestamps}
 *   baseData={{ counts: baseCounts }}
 *   currentData={{ counts: currentCounts }}
 *   min={startDate}
 *   max={endDate}
 * />
 * ```
 */
function HistogramChartComponent({
  title,
  dataType = "numeric",
  samples = 0,
  min = 0,
  max = 0,
  binEdges,
  baseData,
  currentData,
  animate = false,
  hideAxis = false,
  theme = "light",
  height = 300,
  className,
}: HistogramChartProps) {
  const isDark = theme === "dark";
  const themeColors = getChartThemeColors(isDark);
  const barColors = getChartBarColors(isDark);
  const isDatetime = dataType === "datetime";

  // Build chart data
  const chartData = useMemo<ChartData<"bar">>(() => {
    const labels = binEdges
      .slice(0, -1)
      .map((_, i) => formatBinRange(binEdges, i));

    const buildDataset = (
      data: HistogramDataset,
      label: string,
      color: string,
    ) => {
      const counts = data.counts ?? [];
      const chartValues = isDatetime
        ? counts.map((v, i) => ({ x: binEdges[i], y: v }))
        : counts;

      return {
        label,
        data: chartValues as number[],
        backgroundColor: color,
        borderColor: color,
        hoverBackgroundColor: color,
        borderWidth: 0,
        categoryPercentage: 1,
        barPercentage: 1,
        xAxisID: "x",
        offset: false,
      };
    };

    return {
      labels,
      datasets: [
        buildDataset(
          currentData,
          currentData.label ?? "Current",
          barColors.currentWithAlpha,
        ),
        buildDataset(
          baseData,
          baseData.label ?? "Base",
          barColors.baseWithAlpha,
        ),
      ],
    };
  }, [binEdges, baseData, currentData, barColors, isDatetime]);

  // Build chart options
  const chartOptions = useMemo<ChartOptions<"bar">>(() => {
    const maxCount = Math.max(...currentData.counts, ...baseData.counts);

    const labels = binEdges
      .slice(0, -1)
      .map((_, i) => formatBinRange(binEdges, i));
    const dataTypeLabel = isDatetime
      ? "Date Range"
      : dataType === "string"
        ? "Text Length"
        : "Value Range";

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: animate ? undefined : false,
      grouped: false,
      plugins: {
        legend: {
          reverse: true,
          labels: {
            color: themeColors.textColor,
          },
        },
        title: {
          display: true,
          text: title,
          font: { size: 20 },
          color: themeColors.textColor,
        },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: themeColors.tooltipBackgroundColor,
          titleColor: themeColors.tooltipTextColor,
          bodyColor: themeColors.tooltipTextColor,
          borderColor: themeColors.borderColor,
          borderWidth: 1,
          callbacks: {
            title([{ dataIndex }]) {
              const range = formatBinRange(binEdges, dataIndex);
              return `${dataTypeLabel}\n${range}`;
            },
            label({ datasetIndex, dataIndex, dataset }) {
              const counts =
                datasetIndex === 0 ? currentData.counts : baseData.counts;
              const count = counts[dataIndex];
              const percent =
                samples > 0 ? formatPercentage(count / samples) : "";
              return `${dataset.label}: ${count}${percent ? ` (${percent})` : ""}`;
            },
          },
        },
      },
      scales: {
        x: isDatetime
          ? {
              display: !hideAxis,
              type: "timeseries",
              min,
              max,
              time: {
                unit: "month",
                displayFormats: {
                  month: "MMM yyyy",
                },
              },
              grid: {
                display: false,
                drawOnChartArea: false,
              },
              ticks: {
                minRotation: 30,
                maxRotation: 30,
                maxTicksLimit: 8,
                color: themeColors.textColor,
              },
            }
          : {
              display: !hideAxis,
              type: "category",
              grid: {
                display: false,
                drawOnChartArea: false,
              },
              ticks: {
                callback(_val, index) {
                  return labels[index];
                },
                color: themeColors.textColor,
              },
            },
        y: {
          display: !hideAxis,
          type: "linear",
          max: maxCount,
          border: { dash: [2, 2], color: themeColors.borderColor },
          grid: { color: themeColors.gridColor },
          ticks: {
            maxTicksLimit: 8,
            color: themeColors.textColor,
            callback(val) {
              return formatAbbreviatedNumber(val as number);
            },
          },
          beginAtZero: true,
        },
      },
    };
  }, [
    title,
    dataType,
    isDatetime,
    samples,
    min,
    max,
    binEdges,
    baseData,
    currentData,
    hideAxis,
    animate,
    themeColors,
  ]);

  return (
    <div className={className} style={{ height }}>
      <Chart type="bar" options={chartOptions} data={chartData} />
    </div>
  );
}

export const HistogramChart = memo(HistogramChartComponent);
HistogramChart.displayName = "HistogramChart";
