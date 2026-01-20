import { HistogramDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createHistogramDiffResult, createHistogramDiffRun } from "./fixtures";

const meta: Meta<typeof HistogramDiffResultView> = {
  title: "Histogram/HistogramResultView",
  component: HistogramDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Result view for histogram diff comparison between base and current environments. Displays a chart comparing histogram distributions.",
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
      <div style={{ height: "600px", width: "100%", padding: "20px" }}>
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
    run: createHistogramDiffRun(),
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
