import { HistogramDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createHistogramDiffResult, createHistogramDiffRun } from "./fixtures";

const meta: Meta<typeof HistogramDiffResultView> = {
  title: "Visualizations/Histogram/HistogramResultView",
  component: HistogramDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Result view for histogram diff comparison between base and current environments. Displays a chart comparing histogram distributions.

## Usage

\`\`\`tsx
import { HistogramDiffResultView } from '@datarecce/ui/components';

<HistogramDiffResultView
  run={{
    run_id: '1',
    type: 'histogram_diff',
    run_at: '2024-01-01T00:00:00Z',
    params: {
      model: 'orders',
      column_name: 'total_amount',
      column_type: 'numeric'
    },
    result: {
      min: 5,
      max: 10100,
      bin_edges: [5, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10100],
      base: {
        counts: [115, 86, 55, 73, 65, 34, 29, 28, 26, 40],
        total: 551
      },
      current: {
        counts: [181, 96, 57, 42, 52, 53, 82, 76, 80, 70],
        total: 789
      }
    }
  }}
/>
\`\`\``,
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Histogram diff run data",
      control: "object",
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          height: "100vh",
          minHeight: "600px",
          width: "100%",
          padding: "20px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HistogramDiffResultView>;

// ============================================
// Primary Use Cases
// ============================================

export const Default: Story = {
  args: {
    run: createHistogramDiffRun({
      params: {
        model: "orders",
        column_name: "total_amount",
        column_type: "numeric",
      },
      result: createHistogramDiffResult({
        min: 5,
        max: 10100,
        bin_edges: [
          5, 207, 409, 611, 813, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400,
          2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400, 4700,
          4900, 5100, 5300, 5500, 5700, 5900, 6100, 6300, 6500, 6700, 6900,
          7100, 7300, 7500, 7700, 7900, 8100, 8300, 8500, 8700, 8900, 9100,
          9300, 9500, 9700, 9900, 10100,
        ],
        base: {
          counts: [
            115, 127, 113, 119, 128, 86, 55, 73, 65, 34, 29, 28, 26, 40, 46, 48,
            53, 56, 64, 42, 45, 55, 37, 38, 28, 37, 21, 20, 18, 17, 17, 15, 9,
            13, 24, 26, 18, 6, 6, 4, 8, 5, 6, 7, 7, 3, 6, 3, 4, 6,
          ],
          total: 2000,
        },
        current: {
          counts: [
            181, 162, 175, 156, 92, 96, 57, 42, 52, 53, 82, 76, 80, 70, 82, 46,
            49, 40, 31, 25, 29, 26, 21, 28, 23, 13, 12, 11, 4, 11, 6, 7, 6, 7,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          ],
          total: 2020,
        },
      }),
    }),
  },
};

export const SkewedDistribution: Story = {
  name: "Skewed Distribution",
  args: {
    run: createHistogramDiffRun({
      params: {
        model: "revenue",
        column_name: "amount",
        column_type: "numeric",
      },
      result: createHistogramDiffResult({
        base: {
          counts: [100, 80, 50, 30, 15, 8, 4, 2, 1, 0],
          total: 290,
        },
        current: {
          counts: [110, 85, 55, 32, 17, 9, 5, 2, 1, 0],
          total: 316,
        },
      }),
    }),
  },
};

export const DatetimeColumn: Story = {
  name: "Datetime Column",
  args: {
    run: createHistogramDiffRun({
      params: {
        model: "events",
        column_name: "event_time",
        column_type: "datetime",
      },
      result: createHistogramDiffResult({
        min: 1609459200000,
        max: 1635724800000,
        bin_edges: [
          1609459200000, 1612137600000, 1614556800000, 1617235200000,
          1619827200000, 1622505600000, 1625097600000, 1627776000000,
          1630454400000, 1633046400000, 1635724800000,
        ],
      }),
    }),
  },
};

// ============================================
// Edge Cases
// ============================================

export const LoadingState: Story = {
  name: "Loading State",
  args: {
    run: createHistogramDiffRun({
      result: undefined,
    }),
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: createHistogramDiffRun({
      result: createHistogramDiffResult({
        base: { counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], total: 0 },
        current: { counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], total: 0 },
      }),
    }),
  },
};

export const LargeCounts: Story = {
  name: "Large Count Values",
  args: {
    run: createHistogramDiffRun({
      params: {
        model: "transactions",
        column_name: "total_volume",
        column_type: "numeric",
      },
      result: createHistogramDiffResult({
        base: {
          counts: [
            1000000, 2500000, 4500000, 6000000, 5000000, 3500000, 2000000,
            1000000, 500000, 200000,
          ],
          total: 26200000,
        },
        current: {
          counts: [
            1100000, 2600000, 4600000, 6100000, 5100000, 3600000, 2100000,
            1100000, 550000, 220000,
          ],
          total: 27070000,
        },
      }),
    }),
  },
};
