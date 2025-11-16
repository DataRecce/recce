import {
  AnimationOptions,
  BarElement,
  CategoryScale,
  ChartData,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  ScaleOptions,
  TimeSeriesScale,
  Title,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { HistogramResult } from "@/lib/api/profile";
import {
  formatAsAbbreviatedNumber,
  formatIntervalMinMax,
} from "@/utils/formatters";
import {
  BASE_BAR_COLOR_WITH_ALPHA,
  CURRENT_BAR_COLOR_WITH_ALPHA,
} from "./SquareIcon";

export const INFO_VAL_COLOR = "#63B3ED";
export const DATE_RANGE = "Date Range";
export const TEXTLENGTH = "Text Length";
export const VALUE_RANGE = "Value Range";

/**
 * Histogram Chart that can display generic data types such as Numeric, Datetime, Integer
 * X: The Min/Max of the labels range is the scaled width of charting area
 * Y: The Min/Max of the counts range is the scaled height of charting area
 * Counts: Abbreviated based on K, Mn, Bn, Tr (see formatters)
 */

interface HistogramChartProps {
  data: {
    title: string;
    type: string;
    samples?: number;
    min?: string | number;
    max?: string | number;
    binEdges: number[];
    datasets: HistogramResult[];
  };
  animation?: AnimationOptions<"bar">["animation"];
  hideAxis?: boolean;
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
    Title,
    Legend,
    Tooltip,
  );

  const chartOptions = getHistogramChartOptions(data, hideAxis, { animation });

  // Histograms are a mix between bar and scatter options (union)
  // uses cartesian x,y coordinates to plot and infer labels
  const chartData = getHistogramChartData(data);

  //infer `any` to allow for union data configurations & options
  return (
    <Chart type="bar" options={chartOptions} data={chartData} plugins={[]} />
  );
}

function getHistogramChartDataset(
  type: string,
  binEdges: number[],
  label: string,
  color: string,
  data: HistogramResult,
) {
  const isDatetime = type === "datetime";
  const { counts = [] } = data;
  const newData: (number | [number, number])[] = isDatetime
    ? counts.map((v, i) => [binEdges[i], v] as [number, number])
    : counts;
  return {
    label,
    data: newData,
    backgroundColor: color,
    borderColor: color,
    hoverBackgroundColor: color,
    borderWidth: 0,
    categoryPercentage: 1, // tells bar to fill "bin area"
    barPercentage: 1, //tells bar to fill "bar area"
    xAxisID: "x",
  };
}

export function getHistogramChartData(
  data: HistogramChartProps["data"],
): ChartData<"bar"> {
  const { datasets, type, binEdges } = data;
  const [base, current] = datasets;
  const currentDataset = getHistogramChartDataset(
    type,
    binEdges,
    "Current",
    CURRENT_BAR_COLOR_WITH_ALPHA,
    current,
  );
  const baseDataset = getHistogramChartDataset(
    type,
    binEdges,
    "Base",
    BASE_BAR_COLOR_WITH_ALPHA,
    base,
  );

  const newLabels = binEdges
    .map((v, i) => formatDisplayedBinItem(binEdges, i))
    .slice(0, -1); // exclude last

  return {
    labels: newLabels,
    datasets: [currentDataset, baseDataset],
  };
}

export function getHistogramChartOptions(
  data: HistogramChartProps["data"],
  hideAxis = false,
  { ...configOverrides }: ChartOptions<"bar"> = {},
): ChartOptions<"bar"> {
  const { title, datasets, type, samples = 0, binEdges } = data;
  const [base, current] = datasets;
  const isDatetime = type === "datetime";
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        reverse: true,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 20,
        },
      },
      tooltip: {
        mode: "index",
        // position: 'nearest',
        intersect: false,
        callbacks: {
          title([{ dataIndex, datasetIndex }]) {
            const result = formatDisplayedBinItem(binEdges, dataIndex);

            const prefix = isDatetime
              ? DATE_RANGE
              : type === "string"
                ? TEXTLENGTH
                : VALUE_RANGE;

            return `${prefix}\n${result}`;
          },
          label({ datasetIndex, dataIndex, dataset: { label } }) {
            const counts = datasetIndex === 0 ? current.counts : base.counts;
            const percentOfTotal = formatIntervalMinMax(
              counts[dataIndex] / samples,
            );
            const count = counts[dataIndex];
            return `${label}: ${count} (${percentOfTotal})`;
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
  { datasets, min = 0, max = 0, type, binEdges }: HistogramChartProps["data"],
  hideAxis = false,
) {
  const isDatetime = type === "datetime";
  const [base, current] = datasets;
  const maxCount = Math.max(...current.counts, ...base.counts);

  const newLabels = binEdges
    .map((v, i) => formatDisplayedBinItem(binEdges, i))
    .slice(0, -1); // exclude last

  //swap x-scale when histogram is datetime
  const xScaleDate: ScaleOptions = {
    display: !hideAxis,
    type: "timeseries", // each datum is spread w/ equal distance
    min,
    max,
    adapters: {
      date: {},
    },
    time: {
      minUnit: "day",
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
    display: !hideAxis,
    type: "category", //Linear doesn't understand bins!
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
    display: !hideAxis,
    type: "linear",
    max: maxCount, //NOTE: do not add `min` since if they are equal nothing gets displayed sometimes
    border: { dash: [2, 2] },
    grid: {
      color: "lightgray",
    },
    ticks: {
      maxTicksLimit: 8,
      callback: function (val) {
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
function formatDisplayedBinItem(binEdges: number[], currentIndex: number) {
  const startEdge = binEdges[currentIndex];
  const endEdge = binEdges[currentIndex + 1];

  const formattedStart = formatAsAbbreviatedNumber(startEdge);
  const formattedEnd = formatAsAbbreviatedNumber(endEdge);

  return `${formattedStart} - ${formattedEnd}`;
}
