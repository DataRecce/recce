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
import { getChartThemeColors, getSemanticColorTheme } from "../../theme";
import {
  formatAsAbbreviatedNumber,
  formatIntervalMinMax,
} from "../../utils/formatters";
import { histogramBinGeometryPlugin } from "./histogramBinGeometry";
import {
  createHistogramLegendLabels,
  handleHistogramLegendClick,
  histogramOverlapPlugin,
} from "./histogramOverlap";

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
 * Format bin range display
 */
function formatBinRange(binEdges: number[], index: number): string {
  const start = binEdges[index];
  const end = binEdges[index + 1];
  return `${formatAsAbbreviatedNumber(start)} - ${formatAsAbbreviatedNumber(end)}`;
}

const MAX_EDGE_TICK_LABELS = 8;

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
  const semanticColors = getSemanticColorTheme(isDark);
  const comparisonColors = semanticColors.comparison;
  const isDatetime = dataType === "datetime";
  const isNumeric = dataType === "numeric";
  const accessibleDescription = `${title}. Histogram comparing Base and Current series. Overlap marks their shared distribution.`;
  const overlapPalette = useMemo(
    () => ({
      base: comparisonColors.base,
      canvasBackground: semanticColors.structural.neutral.background,
      current: comparisonColors.current,
      legendText: themeColors.textColor,
      overlap: semanticColors.categorical.overlap,
    }),
    [
      comparisonColors,
      semanticColors.categorical.overlap,
      semanticColors.structural.neutral.background,
      themeColors.textColor,
    ],
  );

  // Build chart data
  const chartData = useMemo<ChartData<"bar">>(() => {
    const labels = binEdges
      .slice(0, -1)
      .map((_, i) => formatBinRange(binEdges, i));

    const buildDataset = (
      data: HistogramDataset,
      label: string,
      colors: (typeof comparisonColors)["base"],
    ) => {
      const counts = data.counts ?? [];
      const chartValues = isDatetime
        ? counts.map((v, i) => [binEdges[i], v] as [number, number])
        : isNumeric
          ? counts.map((v, i) => ({
              x: (binEdges[i] + binEdges[i + 1]) / 2,
              y: v,
            }))
          : counts;

      return {
        label,
        data: chartValues as number[],
        backgroundColor: colors.chartFill,
        borderColor: colors.border,
        hoverBackgroundColor: colors.chartFill,
        borderWidth: 2,
        categoryPercentage: 1,
        barPercentage: 1,
        grouped: false,
        xAxisID: "x",
      };
    };

    return {
      labels: isNumeric ? [] : labels,
      datasets: [
        buildDataset(
          currentData,
          currentData.label ?? "Current",
          comparisonColors.current,
        ),
        buildDataset(baseData, baseData.label ?? "Base", comparisonColors.base),
      ],
    };
  }, [
    binEdges,
    baseData,
    comparisonColors,
    currentData,
    isDatetime,
    isNumeric,
  ]);

  // Build chart options
  const chartOptions = useMemo<ChartOptions<"bar">>(() => {
    const maxCount = Math.max(...currentData.counts, ...baseData.counts);
    const edgeTickInterval = Math.max(
      1,
      Math.ceil((binEdges.length - 1) / (MAX_EDGE_TICK_LABELS - 1)),
    );
    const firstEdge = binEdges[0] ?? 0;
    const terminalEdge = binEdges[binEdges.length - 1] ?? firstEdge;
    const dataTypeLabel = isDatetime
      ? "Date Range"
      : dataType === "string"
        ? "Text Length"
        : "Value Range";

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: animate ? undefined : false,
      plugins: {
        histogramBinGeometry: isNumeric ? { binEdges } : undefined,
        // The overlap painter reads its palette from here, not from a closure,
        // so a light/dark switch repaints the crosshatch along with the bars.
        histogramOverlap: { palette: overlapPalette },
        legend: {
          onClick: handleHistogramLegendClick,
          labels: {
            color: themeColors.textColor,
            generateLabels: (chart) =>
              createHistogramLegendLabels(
                chart,
                {
                  base: baseData.label ?? "Base",
                  current: currentData.label ?? "Current",
                },
                overlapPalette,
              ),
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
                samples > 0 ? formatIntervalMinMax(count / samples) : "";
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
              adapters: { date: {} },
              time: { minUnit: "day" },
              grid: { display: false },
              ticks: {
                minRotation: 30,
                maxRotation: 30,
                maxTicksLimit: 8,
                color: themeColors.textColor,
              },
            }
          : isNumeric
            ? {
                display: !hideAxis,
                type: "linear",
                min: firstEdge,
                max: terminalEdge,
                grid: { display: false },
                afterBuildTicks(axis) {
                  axis.ticks = binEdges.map((value) => ({ value }));
                },
                ticks: {
                  autoSkip: false,
                  callback(value, index) {
                    if (
                      index % edgeTickInterval !== 0 &&
                      index !== binEdges.length - 1
                    ) {
                      return undefined;
                    }
                    return formatAsAbbreviatedNumber(value as number);
                  },
                  color: themeColors.textColor,
                },
              }
            : {
                display: !hideAxis,
                type: "category",
                grid: { display: false },
                ticks: {
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
              return formatAsAbbreviatedNumber(val as number);
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
    isNumeric,
    samples,
    min,
    max,
    binEdges,
    baseData,
    currentData,
    hideAxis,
    animate,
    themeColors,
    overlapPalette,
  ]);

  return (
    <div className={className} style={{ height }}>
      <Chart
        type="bar"
        options={chartOptions}
        data={chartData}
        role="img"
        aria-label={accessibleDescription}
        fallbackContent={accessibleDescription}
        plugins={[histogramOverlapPlugin, histogramBinGeometryPlugin]}
      />
    </div>
  );
}

export const HistogramChart = memo(HistogramChartComponent);
HistogramChart.displayName = "HistogramChart";
