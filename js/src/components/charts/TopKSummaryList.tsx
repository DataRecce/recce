import { TopKDiffResult, TopKResult } from "@/lib/api/profile";
import {
  formatAsAbbreviatedNumber,
  formatIntervalMinMax,
} from "@/utils/formatters";
import { Box, Divider, Flex, Spacer, Text, Tooltip } from "@chakra-ui/react";
import { Fragment } from "react";
import {
  ChartOptions,
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartData,
  AnimationOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { BASE_BAR_COLOR, CURRENT_BAR_COLOR, SquareIcon } from "./SquareIcon";
import { is } from "date-fns/locale";

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
  isDisplayTopTen: boolean
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
    } else if (v === undefined || v === null) {
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
      displayRatio: formatIntervalMinMax(count / topK.valids) || "N/A",
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
      label={
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
      placement="auto"
      hasArrow
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
    <Box w={"100%"} px={20} py={4}>
      <Flex alignItems={"center"} direction={"row"}>
        <Spacer />
        <Text as="h3" size="sm" p="2" color="gray">
          <SquareIcon color={BASE_BAR_COLOR} /> Base
        </Text>
        <Text as="h3" size="sm" p="2" color="gray">
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
          <Fragment key={index}>
            <TopKChartTooltip base={base} current={current}>
              <Flex
                alignItems={"center"}
                width={"100%"}
                _hover={{ bg: "blackAlpha.300" }}
                px={4}
              >
                <Text
                  noOfLines={1}
                  width={"10em"}
                  fontSize={"sm"}
                  color={current.isSpecialLabel ? "gray.400" : "inherit"}
                >
                  {current.label}
                </Text>
                <Flex width={"70%"} direction={"column"}>
                  {/* Current Top-K */}
                  <Flex height={"1em"}>
                    <CategoricalBarChart
                      topkCount={current.count}
                      topkLabel={current.label}
                      valids={topKDiff.current.valids}
                      color={CURRENT_BAR_COLOR}
                    />
                    <Text
                      ml={5}
                      mr={2}
                      fontSize={"sm"}
                      width={"6em"}
                      // noOfLines={1}
                    >
                      {current.displayCount}
                    </Text>
                    <Text color={"gray.400"} fontSize={"sm"} width={"4em"}>
                      {current.displayRatio}
                    </Text>
                  </Flex>
                  {/* Base Top-K */}
                  <Flex height={"1em"}>
                    <CategoricalBarChart
                      topkCount={base.count}
                      topkLabel={base.label}
                      valids={topKDiff.base.valids}
                      color={BASE_BAR_COLOR}
                    />
                    <Text
                      ml={5}
                      mr={2}
                      fontSize={"sm"}
                      width={"6em"}
                      // noOfLines={1}
                    >
                      {base.displayCount}
                    </Text>
                    <Text color={"gray.400"} fontSize={"sm"} width={"4em"}>
                      {base.displayRatio}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
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
    <Box w={"100%"}>
      {displayList.concat([remainingSumCount]).map((v, index) => {
        const isLastItemOthers = index === displayList.length;
        const topkCount = isLastItemOthers ? remainingSumCount : v;
        const catName = String(topk.values[index]);
        const topkLabel = isLastItemOthers ? "(others)" : catName || "(empty)";
        const displayTopkCount = formatAsAbbreviatedNumber(topkCount);
        const displayTopkRatio = formatIntervalMinMax(topkCount / valids);
        return (
          <Fragment key={index}>
            {!isLastItemOthers || (isLastItemOthers && topkCount > 0) ? (
              <>
                <Flex
                  alignItems={"center"}
                  width={"100%"}
                  _hover={{ bg: "blackAlpha.300" }}
                  px={3}
                >
                  <Tooltip label={topkLabel} placement="start">
                    <Text
                      noOfLines={1}
                      width={"14em"}
                      fontSize={"sm"}
                      color={
                        isLastItemOthers || catName.length === 0
                          ? "gray.400"
                          : "inherit"
                      }
                    >
                      {topkLabel}
                    </Text>
                  </Tooltip>
                  <Flex height={"2em"} width={"10em"}>
                    <CategoricalBarChart
                      topkCount={topkCount}
                      topkLabel={topkLabel}
                      valids={valids}
                    />
                  </Flex>
                  <Tooltip label={displayTopkCount} placement="start">
                    <Text
                      ml={5}
                      mr={2}
                      fontSize={"sm"}
                      width={"4em"}
                      noOfLines={1}
                    >
                      {displayTopkCount}
                    </Text>
                  </Tooltip>
                  <Tooltip label={displayTopkRatio} placement="start">
                    <Text color={"gray.400"} fontSize={"sm"} width={"4em"}>
                      {displayTopkRatio}
                    </Text>
                  </Tooltip>
                </Flex>
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
  { ...configOverrides }: ChartOptions<"bar"> = {}
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
