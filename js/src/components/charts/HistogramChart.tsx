
import { HistogramDiffResult, HistogramResult } from '@/lib/api/profile';
import {
  ChartOptions,
  Chart as ChartJS,
  BarElement,
  Tooltip,
  ChartData,
  TimeSeriesScale,
  CategoryScale,
  LinearScale,
  AnimationOptions,
  ScaleOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { formatAsAbbreviatedNumber, formatIntervalMinMax } from "@/utils/formatters";
import { Box, Flex, Spacer, Text } from '@chakra-ui/react';

export const INFO_VAL_COLOR = '#63B3ED';
export const DATE_RANGE = 'Date Range';
export const TEXTLENGTH = 'Text Length';
export const VALUE_RANGE = 'Value Range';

export const CURRENT_BAR_COLOR = '#63B3EDCC';
export const BASE_BAR_COLOR = '#F6AD55CC';

/**
 * Histogram Chart that can display generic data types such as Numeric, Datetime, Integer
 * X: The Min/Max of the labels range is the scaled width of charting area
 * Y: The Min/Max of the counts range is the scaled height of charting area
 * Counts: Abbreviated based on K, Mn, Bn, Tr (see formatters)
 */

type HistogramChartProps = {
  data: {
    type: string,
    samples?: number;
    min?: string | number;
    max?: string | number;
    binEdges: number[];
    datasets: HistogramResult[];
  },
  animation?: AnimationOptions<'bar'>['animation'];
  hideAxis?: boolean;
};

function SquareIcon({ color }: { color: string }) {
  return (<Box display="inline-block" w="10px" h="10px" bgColor={color} mr="2" borderRadius="sm"></Box>);
}

export function HistogramChart({
  data,
  hideAxis = false,
  animation = false,
}: HistogramChartProps) {
  ChartJS.register(
    BarElement,
    TimeSeriesScale,
    LinearScale,
    CategoryScale,
    Tooltip,
  );

  const chartOptions = getHistogramChartOptions(data, hideAxis, { animation });

  // Histograms are a mix between bar and scatter options (union)
  // uses cartesian x,y coordinates to plot and infer labels
  const chartData = getHistogramChartData(data);

  //infer `any` to allow for union data configurations & options
  return (
    <>
      <Flex
        alignItems={'center'}
        direction={'row'}
      >
        <Spacer />
        <Text as='h3' size='sm' p='2' color='gray'>
          <SquareIcon color={BASE_BAR_COLOR}/> Base
        </Text>
        <Text as='h3' size='sm' p='2' color='gray'>
          <SquareIcon color={CURRENT_BAR_COLOR}/> Current
        </Text>
        <Spacer />
      </Flex>
      <Chart
        type="bar"
        options={chartOptions}
        data={chartData as any}
        plugins={[]}
      />
    </>
  );
}

function getHistogramChartDataset(type: string, binEdges: number[], label: string, color: string, data: HistogramResult) {
  const isDatetime = type === 'datetime';
  const { counts = [] } = data;
  const newData = isDatetime
    ? counts.map((v, i) => ({ x: binEdges[i], y: v }))
    : counts;
  return {
    label,
    data: newData,
    backgroundColor: color,
    borderColor: color,//'#4299E1',
    hoverBackgroundColor: '#002A53',
    borderWidth: 1,
    categoryPercentage: 1, // tells bar to fill "bin area"
    barPercentage: 1, //tells bar to fill "bar area"
    xAxisID: 'x',
  };
}

export function getHistogramChartData(
  data: HistogramChartProps['data'],
): ChartData<'bar' | 'scatter'> {
  const { datasets, type, binEdges } = data;
  const [base, current] = datasets;
  const currentDataset = getHistogramChartDataset(type, binEdges, 'Current', CURRENT_BAR_COLOR, current);
  const baseDataset = getHistogramChartDataset(type, binEdges, 'Base', BASE_BAR_COLOR, base);

  const newLabels = binEdges
    .map((v, i) => formatDisplayedBinItem(binEdges, i))
    .slice(0, -1); // exclude last

  return {
    labels: newLabels,
    datasets: [
      currentDataset, baseDataset,
    ],
  };
}

export function getHistogramChartOptions(
  data: HistogramChartProps['data'],
  hideAxis = false,
  { ...configOverrides }: ChartOptions<'bar'> = {},
): ChartOptions<'bar'> {
  const { datasets, type, samples = 0, binEdges } = data;
  const [base, current] = datasets;
  const isDatetime = type === 'datetime';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        mode: 'index',
        position: 'nearest',
        intersect: false,
        callbacks: {
          title([{ dataIndex, datasetIndex }]) {
            const result = formatDisplayedBinItem(binEdges, dataIndex);

            const percentOfTotal = formatIntervalMinMax(
              current.counts[dataIndex] / samples,
            );

            const prefix = isDatetime
              ? DATE_RANGE
              : type === 'string'
              ? TEXTLENGTH
              : VALUE_RANGE;

            return `${prefix}\n${result}\n(${percentOfTotal})`;
          },
        },
      },
    },
    scales: getScales(data, hideAxis),
    ...configOverrides,
  };
}
/**
 * get x, y scales for histogram (dynamic based on datetime or not)
 */
function getScales(
  { datasets, min = 0, max = 0, type, binEdges }: HistogramChartProps['data'],
  hideAxis = false,
) {
  const isDatetime = type === 'datetime';
  const [base, current] = datasets;
  const maxCount = Math.max(...current.counts, ...base.counts);

  const newLabels = binEdges
    .map((v, i) => formatDisplayedBinItem(binEdges, i))
    .slice(0, -1); // exclude last

  //swap x-scale when histogram is datetime
  const xScaleDate: ScaleOptions = {
    display: hideAxis ? false : true,
    type: 'timeseries', // each datum is spread w/ equal distance
    min,
    max,
    adapters: {
      date: {},
    },
    time: {
      minUnit: 'day',
    },
    grid: { display: false },
    ticks: {
      minRotation: 30,
      maxRotation: 30,
      maxTicksLimit: 8,
    },
  };
  /**
   * NOTE: Category doesn't accept (min/max) -- will distort scales!
   */
  const xScaleCategory: ScaleOptions = {
    display: hideAxis ? false : true,
    type: 'category', //Linear doesn't understand bins!
    grid: { display: false },
    ticks: {
      callback(val, index) {
        return newLabels[index];
      },
    },
    stacked: true,
  };
  const xScaleBase = isDatetime ? xScaleDate : xScaleCategory;

  const yScaleBase: ScaleOptions = {
    display: hideAxis ? false : true,
    type: 'linear',
    max: maxCount, //NOTE: do not add `min` since if they are equal nothing gets displayed sometimes
    border: { dash: [2, 2] },
    grid: {
      color: 'lightgray',
    },
    ticks: {
      maxTicksLimit: 8,
      callback: function (val, index) {
        //slow, but necessary since chart-data is a number and can be hard to display
        return formatAsAbbreviatedNumber(val);
      },
    },
    beginAtZero: true,
  };
  return { x: xScaleBase, y: yScaleBase };
}
/**
 * @returns a formatted, abbreviated, histogram bin display text
 */
function formatDisplayedBinItem(
  binEdges: number[],
  currentIndex: number,
) {
  const startEdge = binEdges[currentIndex];
  const endEdge = binEdges[currentIndex + 1];

  const formattedStart = formatAsAbbreviatedNumber(startEdge);
  const formattedEnd = formatAsAbbreviatedNumber(endEdge);

  const result = `${formattedStart} - ${formattedEnd}`;
  return result;
}
