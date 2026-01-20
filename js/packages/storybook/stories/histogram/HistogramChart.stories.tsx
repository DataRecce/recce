// packages/storybook/stories/histogram/HistogramChart.stories.tsx
import { HistogramChart } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createHistogramDataset,
  createSkewedHistogram,
  createUniformHistogram,
  sampleBinEdges,
  sampleDatetimeBinEdges,
} from "../data/fixtures";

const meta: Meta<typeof HistogramChart> = {
  title: "Visualizations/Histogram/HistogramChart",
  component: HistogramChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays histogram charts comparing base and current data distributions using Chart.js. Supports numeric, datetime, and string data types with theme-aware styling.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    title: {
      description: "Chart title displayed at the top",
      control: "text",
    },
    dataType: {
      description: "Type of data being visualized",
      control: "select",
      options: ["numeric", "datetime", "string"],
    },
    samples: {
      description: "Total sample count for percentage calculations",
      control: "number",
    },
    binEdges: {
      description: "Bin edge values defining histogram buckets",
      control: "object",
    },
    baseData: {
      description: "Base environment histogram dataset",
      control: "object",
    },
    currentData: {
      description: "Current environment histogram dataset",
      control: "object",
    },
    animate: {
      description: "Enable chart animation",
      control: "boolean",
    },
    hideAxis: {
      description: "Hide axis labels and ticks",
      control: "boolean",
    },
    theme: {
      description: "Theme mode (light or dark)",
      control: "select",
      options: ["light", "dark"],
    },
    height: {
      description: "Chart height in pixels",
      control: "number",
    },
  },
};

export default meta;
type Story = StoryObj<typeof HistogramChart>;

// ============================================
// Primary Use Cases
// ============================================

export const Default: Story = {
  args: {
    title: "Age Distribution",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: createHistogramDataset({
      label: "Base",
      counts: [5, 15, 30, 50, 60, 50, 30, 15, 5, 2],
    }),
    currentData: createHistogramDataset({
      label: "Current",
      counts: [10, 25, 45, 60, 50, 35, 20, 10, 5, 2],
    }),
    samples: 262,
    height: 300,
  },
};

export const WithDateTime: Story = {
  name: "Datetime Scale",
  args: {
    title: "Events Over Time",
    dataType: "datetime",
    binEdges: sampleDatetimeBinEdges,
    baseData: {
      counts: [50, 60, 70, 80, 90, 100, 95, 85, 75, 65],
      label: "Base",
    },
    currentData: {
      counts: [55, 65, 75, 85, 95, 105, 100, 90, 80, 70],
      label: "Current",
    },
    samples: 820,
    min: sampleDatetimeBinEdges[0],
    max: sampleDatetimeBinEdges[sampleDatetimeBinEdges.length - 1],
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Histogram with datetime x-axis showing time-series data distribution.",
      },
    },
  },
};

export const SkewedDistribution: Story = {
  name: "Skewed Distribution",
  args: {
    title: "Revenue Distribution (Skewed)",
    dataType: "numeric",
    binEdges: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
    baseData: createSkewedHistogram(),
    currentData: {
      counts: [95, 75, 48, 28, 14, 7, 3, 1, 0, 0],
      label: "Current",
    },
    samples: 271,
    height: 300,
  },
};

export const UniformDistribution: Story = {
  name: "Uniform Distribution",
  args: {
    title: "Dice Roll Distribution",
    dataType: "numeric",
    binEdges: [1, 2, 3, 4, 5, 6, 7],
    baseData: createUniformHistogram(),
    currentData: createUniformHistogram(),
    samples: 300,
    height: 300,
  },
};

// ============================================
// Theme Variants
// ============================================

export const DarkTheme: Story = {
  name: "Dark Theme",
  args: {
    title: "Temperature Distribution",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: createHistogramDataset({ label: "Base" }),
    currentData: createHistogramDataset({ label: "Current" }),
    samples: 262,
    theme: "dark",
    height: 300,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// ============================================
// Interactive Variants
// ============================================

export const WithAnimation: Story = {
  name: "With Animation",
  args: {
    title: "Animated Chart",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: createHistogramDataset(),
    currentData: createHistogramDataset(),
    samples: 262,
    animate: true,
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story: "Chart with animation enabled for smooth transitions.",
      },
    },
  },
};

export const HiddenAxis: Story = {
  name: "Hidden Axis",
  args: {
    title: "Compact View",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: createHistogramDataset(),
    currentData: createHistogramDataset(),
    samples: 262,
    hideAxis: true,
    height: 200,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Compact histogram with hidden axis labels, useful for dashboard views.",
      },
    },
  },
};

// ============================================
// Size Variants
// ============================================

export const TallChart: Story = {
  name: "Tall Chart",
  args: {
    title: "Extra Tall Distribution",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: createHistogramDataset(),
    currentData: createHistogramDataset(),
    samples: 262,
    height: 500,
  },
};

export const ShortChart: Story = {
  name: "Short Chart",
  args: {
    title: "Compact Distribution",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: createHistogramDataset(),
    currentData: createHistogramDataset(),
    samples: 262,
    height: 180,
  },
};

// ============================================
// Edge Cases
// ============================================

export const EmptyData: Story = {
  name: "Empty Dataset",
  args: {
    title: "No Data",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: { counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], label: "Base" },
    currentData: { counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], label: "Current" },
    samples: 0,
    height: 300,
  },
};

export const SingleBin: Story = {
  name: "Single Bin",
  args: {
    title: "Single Value Distribution",
    dataType: "numeric",
    binEdges: [0, 100],
    baseData: { counts: [500], label: "Base" },
    currentData: { counts: [600], label: "Current" },
    samples: 1100,
    height: 300,
  },
};

export const LargeCounts: Story = {
  name: "Large Count Values",
  args: {
    title: "Million-Scale Distribution",
    dataType: "numeric",
    binEdges: sampleBinEdges,
    baseData: {
      counts: [
        1000000, 2500000, 4500000, 6000000, 5000000, 3500000, 2000000, 1000000,
        500000, 200000,
      ],
      label: "Base",
    },
    currentData: {
      counts: [
        1100000, 2600000, 4600000, 6100000, 5100000, 3600000, 2100000, 1100000,
        550000, 220000,
      ],
      label: "Current",
    },
    samples: 26220000,
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Histogram with large count values using abbreviated number formatting (K, M, B).",
      },
    },
  },
};
