import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  AnimationOptions,
  BarElement,
  CategoryScale,
  ChartData,
  Chart as ChartJS,
  ChartOptions,
  LinearScale,
} from "chart.js";
import { Fragment } from "react";
import { Bar } from "react-chartjs-2";
import { TopKDiffResult, TopKResult } from "@/lib/api/profile";
import {
  formatAsAbbreviatedNumber,
  formatIntervalMinMax,
} from "@/utils/formatters";
import { BASE_BAR_COLOR, CURRENT_BAR_COLOR, SquareIcon } from "./SquareIcon";

export const INFO_VAL_COLOR = "#63B3ED";

interface BarChartProps {
  topKDiff: TopKDiffResult;
  valids: number;
  isDisplayTopTen: boolean;
}

interface Summary {
  label: string;
  count: number;
  displayCount: string;
  displayRatio: string;
  isLastItemOthers: boolean;
  isSpecialLabel: boolean;
}

function prepareSummaryList(
  topK: TopKResult,
  isDisplayTopTen: boolean,
): Summary[] {
  const endAtIndex = isDisplayTopTen ? 10 : topK.counts.length;
  const counts = topK.counts.slice(0, endAtIndex);
  const remainingSumCount =
    topK.valids - counts.reduce((accum, curr) => accum + curr, 0);
  const values = topK.values.slice(0, endAtIndex);

  return values.concat([remainingSumCount]).map((v, index) => {
    const isLastItemOthers = index === counts.length;
    const count = isLastItemOthers ? remainingSumCount : counts[index];

    let label: string;
    let isSpecialLabel = false;

    if (isLastItemOthers) {
      label = "(others)";
      isSpecialLabel = true;
    } else if (v == null) {
      label = "(null)";
      isSpecialLabel = true;
    } else if (typeof v === "string" && v.length === 0) {
      label = "(empty)";
      isSpecialLabel = true;
    } else {
      label = String(v);
    }

    return {
      isLastItemOthers,
      isSpecialLabel,
      label,
      count: count,
      displayCount: formatAsAbbreviatedNumber(count),
      displayRatio: formatIntervalMinMax(count / topK.valids) ?? "N/A",
    };
  });
}

function TopKChartTooltip({
  base,
  current,
  children,
}: {
  base: Summary;
  current: Summary;
  children?: React.ReactNode;
}) {
  return (
    <MuiTooltip
      title={
        <Box>
          <Typography>
            <SquareIcon color={CURRENT_BAR_COLOR} />
            Current: {current.count} ({current.displayRatio})
          </Typography>
          <Typography>
            <SquareIcon color={BASE_BAR_COLOR} />
            Base: {base.count} ({base.displayRatio})
          </Typography>
        </Box>
      }
      arrow
    >
      <span>{children}</span>
    </MuiTooltip>
  );
}

export function TopKSummaryBarChart({
  topKDiff,
  isDisplayTopTen,
}: BarChartProps) {
  // const [isDisplayTopTen, setIsDisplayTopTen] = useState<boolean>(true);
  const currents = prepareSummaryList(topKDiff.current, isDisplayTopTen);
  const bases = prepareSummaryList(topKDiff.base, isDisplayTopTen);

  return (
    <Box sx={{ width: "100%", px: 20, py: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", flexDirection: "row" }}>
        <Box sx={{ flex: 1 }} />
        <Typography
          component="h3"
          sx={{ fontSize: "0.875rem", p: 1, color: "gray" }}
        >
          <SquareIcon color={BASE_BAR_COLOR} /> Base
        </Typography>
        <Typography
          component="h3"
          sx={{ fontSize: "0.875rem", p: 1, color: "gray" }}
        >
          <SquareIcon color={CURRENT_BAR_COLOR} /> Current
        </Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      {currents.map((current, index) => {
        const base = bases[index];
        if (
          current.isLastItemOthers &&
          current.count === 0 &&
          base.count === 0
        ) {
          // skip rendering the others if both are empty
          return <></>;
        }
        return (
          <Fragment key={current.label}>
            <TopKChartTooltip base={base} current={current}>
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
                    color: current.isSpecialLabel ? "grey.400" : "inherit",
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
                  }}
                >
                  {/* Current Top-K */}
                  <Box sx={{ display: "flex", height: "1em" }}>
                    <CategoricalBarChart
                      topkCount={current.count}
                      topkLabel={current.label}
                      valids={topKDiff.current.valids}
                      color={CURRENT_BAR_COLOR}
                    />
                    <Typography
                      sx={{
                        ml: 2.5,
                        mr: 1,
                        fontSize: "0.875rem",
                        width: "6em",
                      }}
                    >
                      {current.displayCount}
                    </Typography>
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: "0.875rem",
                        width: "4em",
                      }}
                    >
                      {current.displayRatio}
                    </Typography>
                  </Box>
                  {/* Base Top-K */}
                  <Box sx={{ display: "flex", height: "1em" }}>
                    <CategoricalBarChart
                      topkCount={base.count}
                      topkLabel={base.label}
                      valids={topKDiff.base.valids}
                      color={BASE_BAR_COLOR}
                    />
                    <Typography
                      sx={{
                        ml: 2.5,
                        mr: 1,
                        fontSize: "0.875rem",
                        width: "6em",
                      }}
                    >
                      {base.displayCount}
                    </Typography>
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: "0.875rem",
                        width: "4em",
                      }}
                    >
                      {base.displayRatio}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </TopKChartTooltip>
            <Divider />
          </Fragment>
        );
      })}
    </Box>
  );
}

interface Props {
  topk: TopKResult;
  valids: number;
  isDisplayTopTen: boolean;
}

/**
 * A list of each topk summary item (categorical)
 * Last list item will show 'others' when there are leftover values, which is the count difference of valids and displayed topk items
 */
export function TopKSummaryList({ topk, valids, isDisplayTopTen }: Props) {
  const endAtIndex = isDisplayTopTen ? 10 : topk.counts.length;
  const displayList = topk.counts.slice(0, endAtIndex);
  const remainingSumCount =
    valids - displayList.reduce((accum, curr) => accum + curr, 0);

  return (
    <Box sx={{ width: "100%" }}>
      {displayList.concat([remainingSumCount]).map((v, index) => {
        const isLastItemOthers = index === displayList.length;
        const topkCount = isLastItemOthers ? remainingSumCount : v;
        const catName = String(topk.values[index]);
        const topkLabel = isLastItemOthers ? "(others)" : catName || "(empty)";
        const displayTopkCount = formatAsAbbreviatedNumber(topkCount);
        const displayTopkRatio = formatIntervalMinMax(topkCount / valids);
        return (
          <Fragment key={topkLabel}>
            {!isLastItemOthers || topkCount > 0 ? (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    "&:hover": { bgcolor: "action.hover" },
                    px: 1.5,
                  }}
                >
                  <MuiTooltip title={topkLabel} placement="top-start">
                    <Typography
                      sx={{
                        width: "14em",
                        fontSize: "0.875rem",
                        color:
                          isLastItemOthers || catName.length === 0
                            ? "grey.400"
                            : "inherit",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {topkLabel}
                    </Typography>
                  </MuiTooltip>
                  <Box sx={{ display: "flex", height: "2em", width: "10em" }}>
                    <CategoricalBarChart
                      topkCount={topkCount}
                      topkLabel={topkLabel}
                      valids={valids}
                    />
                  </Box>
                  <MuiTooltip title={displayTopkCount} placement="top-start">
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
                      {displayTopkCount}
                    </Typography>
                  </MuiTooltip>
                  <MuiTooltip title={displayTopkRatio} placement="top-start">
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: "0.875rem",
                        width: "4em",
                      }}
                    >
                      {displayTopkRatio}
                    </Typography>
                  </MuiTooltip>
                </Box>
                <Divider />
              </>
            ) : (
              <></>
            )}
          </Fragment>
        );
      })}
    </Box>
  );
}

/**
 * Props for creating a CategoricalBarChart Component
 */
export interface CategoricalBarChartProps {
  topkCount: number;
  topkLabel: number | string;
  valids: number;
  animation?: AnimationOptions<"bar">["animation"];
  color?: string;
}
/**
 * A Singular horizontal progress bar chart that visualizes categorical dataset, plotted 1:1 category group
 */
export function CategoricalBarChart({
  topkCount,
  topkLabel,
  valids,
  animation = false,
  color = INFO_VAL_COLOR,
}: CategoricalBarChartProps) {
  ChartJS.register(CategoryScale, BarElement, LinearScale);
  const chartOptions = getCatBarChartOptions(topkCount, valids, { animation });
  const chartData = getCatBarChartData({
    topkCount,
    topkLabel,
    color,
  });

  return <Bar data={chartData} options={chartOptions} plugins={[]} />;
}

/**
 * @returns merged Chart.js option object for categorical 'bar'
 */
export function getCatBarChartOptions(
  count: CategoricalBarChartProps["topkCount"],
  valids: number,
  { ...configOverrides }: ChartOptions<"bar"> = {},
): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    scales: {
      x: {
        display: false,
        max: valids,
        grid: { display: false },
      },
      y: {
        display: false,
      },
    },
    plugins: {
      tooltip: {
        enabled: false,
      },
    },
    ...configOverrides,
  };
}
/**
 * @returns merged Chart.js data object for categorical 'bar'
 */
export function getCatBarChartData({
  topkLabel,
  topkCount,
  color = INFO_VAL_COLOR,
}: Omit<CategoricalBarChartProps, "animation" | "valids">): ChartData<"bar"> {
  return {
    labels: [topkLabel], // showing top cats
    datasets: [
      {
        indexAxis: "y",
        data: [topkCount], // showing top cats
        backgroundColor: color,
        hoverBackgroundColor: color,
        borderWidth: 0,
        borderColor: color,
        barPercentage: 1,
        categoryPercentage: 0.6,
      },
    ],
  };
}
