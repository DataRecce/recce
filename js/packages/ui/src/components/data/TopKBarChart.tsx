"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  BarElement,
  CategoryScale,
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  LinearScale,
} from "chart.js";
import { Fragment, memo, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { getChartBarColors, getChartThemeColors } from "./HistogramChart";

// Register Chart.js modules once
ChartJS.register(CategoryScale, BarElement, LinearScale);

/**
 * Single Top-K value item
 */
export interface TopKItem {
  /** Value label */
  label: string;
  /** Count */
  count: number;
  /** Whether this is a special label (null, empty, others) */
  isSpecial?: boolean;
}

/**
 * Top-K dataset for a single environment
 * Compatible with TopKResult from @datarecce/ui/api
 */
export interface TopKDataset {
  /** Value labels (null or undefined treated as special) */
  values: (string | number | null | undefined)[];
  /** Counts per value */
  counts: number[];
  /** Total valid count */
  valids: number;
}

/**
 * Props for single horizontal bar
 */
export interface SingleBarChartProps {
  /** Count value */
  count: number;
  /** Total count for percentage calculation */
  total: number;
  /** Bar color */
  color?: string;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Chart height in pixels */
  height?: number;
}

/**
 * Props for the TopKBarChart component
 */
export interface TopKBarChartProps {
  /** Base environment dataset */
  baseData?: TopKDataset;
  /** Current environment dataset */
  currentData: TopKDataset;
  /** Maximum items to display (default 10) */
  maxItems?: number;
  /** Show comparison with base */
  showComparison?: boolean;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Chart title */
  title?: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * Props for TopKSummaryList component
 */
export interface TopKSummaryListProps {
  /** Top-K dataset */
  data: TopKDataset;
  /** Maximum items to display */
  maxItems?: number;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Optional CSS class */
  className?: string;
}

/**
 * Format number as abbreviated (K, M, B, T)
 */
function formatAbbreviated(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/**
 * Format as percentage
 */
function formatPercent(value: number): string {
  if (value > 0 && value <= 0.001) return "<0.1%";
  if (value < 1 && value >= 0.999) return ">99.9%";
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Prepare summary list from dataset
 */
function prepareSummaryList(
  dataset: TopKDataset,
  maxItems: number,
): TopKItem[] {
  const endAt = Math.min(maxItems, dataset.counts.length);
  const displayedCounts = dataset.counts.slice(0, endAt);
  const displayedSum = displayedCounts.reduce((a, b) => a + b, 0);
  const remainingCount = dataset.valids - displayedSum;

  const items: TopKItem[] = displayedCounts.map((count, index) => {
    const value = dataset.values[index];
    let label: string;
    let isSpecial = false;

    if (value === null || value === undefined) {
      label = "(null)";
      isSpecial = true;
    } else if (typeof value === "string" && value.length === 0) {
      label = "(empty)";
      isSpecial = true;
    } else {
      label = String(value);
    }

    return { label, count, isSpecial };
  });

  // Add "others" if there's remaining count
  if (remainingCount > 0) {
    items.push({
      label: "(others)",
      count: remainingCount,
      isSpecial: true,
    });
  }

  return items;
}

/**
 * Square icon for legend
 */
function SquareIcon({ color }: { color: string }) {
  return (
    <Box
      sx={{
        display: "inline-block",
        width: "10px",
        height: "10px",
        bgcolor: color,
        mr: 1,
        borderRadius: "4px",
      }}
    />
  );
}

/**
 * SingleBarChart Component
 *
 * A horizontal progress bar for displaying a single value.
 */
function SingleBarChartComponent({
  count,
  total,
  color,
  theme = "light",
  height = 16,
}: SingleBarChartProps) {
  const isDark = theme === "dark";
  const themeColors = getChartThemeColors(isDark);
  const barColors = getChartBarColors(isDark);
  const barColor = color ?? barColors.current;

  const chartData = useMemo<ChartData<"bar">>(
    () => ({
      labels: [""],
      datasets: [
        {
          indexAxis: "y" as const,
          data: [count],
          backgroundColor: barColor,
          hoverBackgroundColor: barColor,
          borderWidth: 0,
          borderColor: barColor,
          barPercentage: 1,
          categoryPercentage: 0.6,
        },
      ],
    }),
    [count, barColor],
  );

  const chartOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y" as const,
      scales: {
        x: {
          display: false,
          max: total,
          grid: { display: false },
          ticks: { color: themeColors.textColor },
        },
        y: {
          display: false,
          ticks: { color: themeColors.textColor },
        },
      },
      plugins: {
        tooltip: { enabled: false },
      },
      animation: false,
    }),
    [total, themeColors],
  );

  return (
    <div style={{ height, width: "100%" }}>
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
}

export const SingleBarChart = memo(SingleBarChartComponent);
SingleBarChart.displayName = "SingleBarChart";

/**
 * TopKSummaryList Component
 *
 * A list displaying top-k values with horizontal bar charts.
 *
 * @example Basic usage
 * ```tsx
 * import { TopKSummaryList } from '@datarecce/ui/primitives';
 *
 * function ValueDistribution({ topKData }) {
 *   return (
 *     <TopKSummaryList
 *       data={topKData}
 *       maxItems={10}
 *     />
 *   );
 * }
 * ```
 */
function TopKSummaryListComponent({
  data,
  maxItems = 10,
  theme = "light",
  className,
}: TopKSummaryListProps) {
  const isDark = theme === "dark";
  const barColors = getChartBarColors(isDark);
  const items = useMemo(
    () => prepareSummaryList(data, maxItems),
    [data, maxItems],
  );

  return (
    <Box className={className} sx={{ width: "100%" }}>
      {items.map((item) => (
        <Fragment key={item.label}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              "&:hover": { bgcolor: "action.hover" },
              px: 1.5,
            }}
          >
            <Tooltip title={item.label} placement="top-start">
              <Typography
                sx={{
                  width: "14em",
                  fontSize: "0.875rem",
                  color: item.isSpecial ? "grey.400" : "inherit",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </Typography>
            </Tooltip>
            <Box sx={{ display: "flex", height: "2em", width: "10em" }}>
              <SingleBarChart
                count={item.count}
                total={data.valids}
                color={barColors.current}
                theme={theme}
              />
            </Box>
            <Tooltip title={String(item.count)} placement="top-start">
              <Typography
                sx={{
                  ml: 2.5,
                  mr: 1,
                  fontSize: "0.875rem",
                  width: "4em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {formatAbbreviated(item.count)}
              </Typography>
            </Tooltip>
            <Typography
              sx={{
                color: "grey.400",
                fontSize: "0.875rem",
                width: "4em",
              }}
            >
              {formatPercent(item.count / data.valids)}
            </Typography>
          </Box>
          <Divider />
        </Fragment>
      ))}
    </Box>
  );
}

export const TopKSummaryList = memo(TopKSummaryListComponent);
TopKSummaryList.displayName = "TopKSummaryList";

/**
 * TopKBarChart Component
 *
 * A pure presentation component for displaying top-k value distributions
 * with optional base/current comparison.
 *
 * @example Basic usage
 * ```tsx
 * import { TopKBarChart } from '@datarecce/ui/primitives';
 *
 * function ValueDistribution({ topKData }) {
 *   return (
 *     <TopKBarChart
 *       currentData={topKData}
 *       maxItems={10}
 *     />
 *   );
 * }
 * ```
 *
 * @example With comparison
 * ```tsx
 * <TopKBarChart
 *   baseData={baseTopK}
 *   currentData={currentTopK}
 *   showComparison
 *   maxItems={10}
 * />
 * ```
 */
function TopKBarChartComponent({
  baseData,
  currentData,
  maxItems = 10,
  showComparison = false,
  theme = "light",
  title,
  className,
}: TopKBarChartProps) {
  const isDark = theme === "dark";
  const barColors = getChartBarColors(isDark);

  const currentItems = useMemo(
    () => prepareSummaryList(currentData, maxItems),
    [currentData, maxItems],
  );

  const baseItems = useMemo(
    () => (baseData ? prepareSummaryList(baseData, maxItems) : []),
    [baseData, maxItems],
  );

  const showBase = showComparison && baseData && baseItems.length > 0;

  return (
    <Box className={className} sx={{ width: "100%", px: 2, py: 2 }}>
      {/* Title and legend */}
      {(title || showBase) && (
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          {title && (
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          {showBase && (
            <>
              <Typography
                component="span"
                sx={{ fontSize: "0.875rem", p: 1, color: "text.secondary" }}
              >
                <SquareIcon color={barColors.base} /> Base
              </Typography>
              <Typography
                component="span"
                sx={{ fontSize: "0.875rem", p: 1, color: "text.secondary" }}
              >
                <SquareIcon color={barColors.current} /> Current
              </Typography>
            </>
          )}
        </Box>
      )}

      {/* Items */}
      {currentItems.map((current, index) => {
        const base = showBase ? baseItems[index] : null;

        // Skip empty "others" rows
        if (
          current.label === "(others)" &&
          current.count === 0 &&
          (!base || base.count === 0)
        ) {
          return null;
        }

        return (
          <Fragment key={current.label}>
            <Tooltip
              title={
                showBase && base ? (
                  <Box>
                    <Typography>
                      <SquareIcon color={barColors.current} />
                      Current: {current.count} (
                      {formatPercent(current.count / currentData.valids)})
                    </Typography>
                    <Typography>
                      <SquareIcon color={barColors.base} />
                      Base: {base.count} (
                      {formatPercent(base.count / (baseData?.valids ?? 1))})
                    </Typography>
                  </Box>
                ) : (
                  `${current.count} (${formatPercent(current.count / currentData.valids)})`
                )
              }
              arrow
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  "&:hover": { bgcolor: "action.hover" },
                  px: 2,
                }}
              >
                <Typography
                  sx={{
                    width: "10em",
                    fontSize: "0.875rem",
                    color: current.isSpecial ? "grey.400" : "inherit",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {current.label}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    width: "70%",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {/* Current bar */}
                  <Box
                    sx={{
                      display: "flex",
                      height: "1em",
                      alignItems: "center",
                    }}
                  >
                    <Box sx={{ flex: 1, height: "100%" }}>
                      <SingleBarChart
                        count={current.count}
                        total={currentData.valids}
                        color={barColors.current}
                        theme={theme}
                        height={16}
                      />
                    </Box>
                    <Typography
                      sx={{
                        ml: 2.5,
                        mr: 1,
                        fontSize: "0.875rem",
                        width: "6em",
                      }}
                    >
                      {formatAbbreviated(current.count)}
                    </Typography>
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: "0.875rem",
                        width: "4em",
                      }}
                    >
                      {formatPercent(current.count / currentData.valids)}
                    </Typography>
                  </Box>

                  {/* Base bar (if comparison mode) */}
                  {showBase && base && (
                    <Box
                      sx={{
                        display: "flex",
                        height: "1em",
                        alignItems: "center",
                      }}
                    >
                      <Box sx={{ flex: 1, height: "100%" }}>
                        <SingleBarChart
                          count={base.count}
                          total={baseData?.valids ?? 1}
                          color={barColors.base}
                          theme={theme}
                          height={16}
                        />
                      </Box>
                      <Typography
                        sx={{
                          ml: 2.5,
                          mr: 1,
                          fontSize: "0.875rem",
                          width: "6em",
                        }}
                      >
                        {formatAbbreviated(base.count)}
                      </Typography>
                      <Typography
                        sx={{
                          color: "grey.400",
                          fontSize: "0.875rem",
                          width: "4em",
                        }}
                      >
                        {formatPercent(base.count / (baseData?.valids ?? 1))}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Tooltip>
            <Divider />
          </Fragment>
        );
      })}
    </Box>
  );
}

export const TopKBarChart = memo(TopKBarChartComponent);
TopKBarChart.displayName = "TopKBarChart";
