import { TopKDiffResult, TopKResult } from "@/lib/api/profile";
import { formatAsAbbreviatedNumber, formatIntervalMinMax } from "@/utils/formatters";
import { Box, Divider, Flex, Link, Text, Tooltip } from "@chakra-ui/react";
import { Fragment, useState } from "react";
import {
  ChartOptions,
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartData,
  AnimationOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import zIndex from "@mui/material/styles/zIndex";

export const INFO_VAL_COLOR = '#63B3ED';

interface BarChartProps {
  topKDiff: TopKDiffResult;
  valids: number;
}

export function TopKSummaryBarChart({ topKDiff, valids }: BarChartProps) {
  // const [isDisplayTopTen, setIsDisplayTopTen] = useState<boolean>(true);
  const base = topKDiff.base;
  const current = topKDiff.current;

  return (
    <Flex>
      <BarChart
        layout="horizontal"
        yAxis={[
          {
            scaleType: 'band',
            data: base.values,
          },
          {
            scaleType: 'band',
            data: current.values,
          }
        ]}
        series={[
          {
            data: base.counts,
            label: 'Base',
          },
          {
            data: current.counts,
            label: 'Current',
          }
        ]}
        width={800}
        height={400}
      />
    </Flex>
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
    <Box w={'100%'}>
      {displayList.concat([remainingSumCount]).map((v, index) => {
        const isLastItemOthers = index === displayList.length;
        const topkCount = isLastItemOthers ? remainingSumCount : v;
        const catName = String(topk.values[index]);

        const topkLabel = isLastItemOthers ? '(others)' : catName || '(empty)';
        const displayTopkCount = formatAsAbbreviatedNumber(topkCount);
        const displayTopkRatio = formatIntervalMinMax(topkCount / valids);
        return (
          <Fragment key={index}>
            {!isLastItemOthers || (isLastItemOthers && topkCount > 0) ? (
              <>
                <Flex
                  alignItems={'center'}
                  width={'100%'}
                  _hover={{ bg: 'blackAlpha.300' }}
                  px={3}
                >
                  <Tooltip label={topkLabel} placement="start">
                    <Text
                      noOfLines={1}
                      width={'14em'}
                      fontSize={'sm'}
                      color={
                        isLastItemOthers || catName.length === 0
                          ? 'gray.400'
                          : 'inherit'
                      }
                    >
                      {topkLabel}
                    </Text>
                  </Tooltip>
                  <Flex height={'2em'} width={'10em'}>
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
                      fontSize={'sm'}
                      width={'4em'}
                      noOfLines={1}
                    >
                      {displayTopkCount}
                    </Text>
                  </Tooltip>
                  <Tooltip label={displayTopkRatio} placement="start">
                    <Text color={'gray.400'} fontSize={'sm'} width={'4em'}>
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
  animation?: AnimationOptions<'bar'>['animation'];
}
/**
 * A Singular horizontal progress bar chart that visualizes categorical dataset, plotted 1:1 category group
 */
export function CategoricalBarChart({
  topkCount,
  topkLabel,
  valids,
  animation = false,
}: CategoricalBarChartProps) {
  ChartJS.register(CategoryScale, BarElement, LinearScale);
  const chartOptions = getCatBarChartOptions(topkCount, valids, { animation });
  const chartData = getCatBarChartData({
    topkCount,
    topkLabel,
  });

  return <Bar data={chartData} options={chartOptions} plugins={[]} />;
}

/**
 * @returns merged Chart.js option object for categorical 'bar'
 */
export function getCatBarChartOptions(
  count: CategoricalBarChartProps['topkCount'],
  valids: number,
  { ...configOverrides }: ChartOptions<'bar'> = {},
): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
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
}: Omit<CategoricalBarChartProps, 'animation' | 'valids'>): ChartData<'bar'> {
  return {
    labels: [topkLabel], // showing top cats
    datasets: [
      {
        indexAxis: 'y',
        data: [topkCount], // showing top cats
        backgroundColor: INFO_VAL_COLOR,
        hoverBackgroundColor: '#002a53',
        borderWidth: 1,
        borderColor: '#002a53',
        barPercentage: 1,
        categoryPercentage: 0.6,
      },
    ],
  };
}
