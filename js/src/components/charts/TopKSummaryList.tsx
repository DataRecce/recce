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
import { Box, Flex, Separator, Spacer, Text } from "@/components/ui/mui";
import { Tooltip } from "@/components/ui/tooltip";
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
    <Tooltip
      content={
        <Box>
          <Text>
            <SquareIcon color={CURRENT_BAR_COLOR} />
            Current: {current.count} ({current.displayRatio})
          </Text>
          <Text>
            <SquareIcon color={BASE_BAR_COLOR} />
            Base: {base.count} ({base.displayRatio})
          </Text>
        </Box>
      }
      showArrow
    >
      {children}
    </Tooltip>
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
      <Flex sx={{ alignItems: "center", flexDirection: "row" }}>
        <Spacer />
        <Text component="h3" sx={{ fontSize: "sm", p: 1, color: "gray" }}>
          <SquareIcon color={BASE_BAR_COLOR} /> Base
        </Text>
        <Text component="h3" sx={{ fontSize: "sm", p: 1, color: "gray" }}>
          <SquareIcon color={CURRENT_BAR_COLOR} /> Current
        </Text>
        <Spacer />
      </Flex>
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
              <Flex
                sx={{
                  alignItems: "center",
                  width: "100%",
                  "&:hover": { bgcolor: "action.hover" },
                  px: 2,
                }}
              >
                <Text
                  sx={{
                    width: "10em",
                    fontSize: "sm",
                    color: current.isSpecialLabel ? "grey.400" : "inherit",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {current.label}
                </Text>
                <Flex sx={{ width: "70%", flexDirection: "column" }}>
                  {/* Current Top-K */}
                  <Flex sx={{ height: "1em" }}>
                    <CategoricalBarChart
                      topkCount={current.count}
                      topkLabel={current.label}
                      valids={topKDiff.current.valids}
                      color={CURRENT_BAR_COLOR}
                    />
                    <Text sx={{ ml: 2.5, mr: 1, fontSize: "sm", width: "6em" }}>
                      {current.displayCount}
                    </Text>
                    <Text
                      sx={{ color: "grey.400", fontSize: "sm", width: "4em" }}
                    >
                      {current.displayRatio}
                    </Text>
                  </Flex>
                  {/* Base Top-K */}
                  <Flex sx={{ height: "1em" }}>
                    <CategoricalBarChart
                      topkCount={base.count}
                      topkLabel={base.label}
                      valids={topKDiff.base.valids}
                      color={BASE_BAR_COLOR}
                    />
                    <Text sx={{ ml: 2.5, mr: 1, fontSize: "sm", width: "6em" }}>
                      {base.displayCount}
                    </Text>
                    <Text
                      sx={{ color: "grey.400", fontSize: "sm", width: "4em" }}
                    >
                      {base.displayRatio}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
            </TopKChartTooltip>
            <Separator />
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
                <Flex
                  sx={{
                    alignItems: "center",
                    width: "100%",
                    "&:hover": { bgcolor: "action.hover" },
                    px: 1.5,
                  }}
                >
                  <Tooltip
                    content={topkLabel}
                    positioning={{ placement: "top-start" }}
                  >
                    <Text
                      sx={{
                        width: "14em",
                        fontSize: "sm",
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
                    </Text>
                  </Tooltip>
                  <Flex sx={{ height: "2em", width: "10em" }}>
                    <CategoricalBarChart
                      topkCount={topkCount}
                      topkLabel={topkLabel}
                      valids={valids}
                    />
                  </Flex>
                  <Tooltip
                    content={displayTopkCount}
                    positioning={{ placement: "top-start" }}
                  >
                    <Text
                      sx={{
                        ml: 2.5,
                        mr: 1,
                        fontSize: "sm",
                        width: "4em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayTopkCount}
                    </Text>
                  </Tooltip>
                  <Tooltip
                    content={displayTopkRatio}
                    positioning={{ placement: "top-start" }}
                  >
                    <Text
                      sx={{ color: "grey.400", fontSize: "sm", width: "4em" }}
                    >
                      {displayTopkRatio}
                    </Text>
                  </Tooltip>
                </Flex>
                <Separator />
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
