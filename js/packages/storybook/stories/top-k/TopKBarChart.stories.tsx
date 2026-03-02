// packages/storybook/stories/top-k/TopKBarChart.stories.tsx
import { TopKBarChart } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createTopKDataset, topKWithSpecialValues } from "../data/fixtures";

const meta: Meta<typeof TopKBarChart> = {
  title: "Visualizations/Top-K/TopKBarChart",
  component: TopKBarChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Displays top-K value distributions with horizontal bar charts. Primarily used for base/current comparison in data validation workflows.

## Usage

\`\`\`tsx
import { TopKBarChart } from '@datarecce/ui/primitives';

<TopKBarChart
  baseData={{
    values: ['apple', 'banana', 'orange'],
    counts: [90, 85, 55],
    valids: 230
  }}
  currentData={{
    values: ['apple', 'banana', 'orange'],
    counts: [100, 80, 60],
    valids: 240
  }}
  showComparison={true}
  maxItems={10}
/>
\`\`\``,
      },
    },
    layout: "centered",
  },
  argTypes: {
    currentData: {
      description: "Current environment top-K dataset",
      control: "object",
    },
    baseData: {
      description: "Base environment top-K dataset (optional)",
      control: "object",
    },
    maxItems: {
      description: "Maximum items to display",
      control: "number",
    },
    showComparison: {
      description: "Show comparison with base data",
      control: "boolean",
    },
    title: {
      description: "Chart title",
      control: "text",
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || "light";
      return (
        <div style={{ width: "800px", padding: "20px" }}>
          <Story args={{ ...context.args, theme }} />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof TopKBarChart>;

// ============================================
// Comparison (primary use case)
// ============================================

export const Default: Story = {
  name: "Comparison",
  args: {
    baseData: createTopKDataset({
      values: ["apple", "banana", "orange", "grape", "melon"],
      counts: [90, 85, 55, 0, 25],
      valids: 300,
    }),
    currentData: createTopKDataset(),
    showComparison: true,
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default comparison view — the primary way TopKBarChart is used.",
      },
    },
  },
};

export const VolumeGrowth: Story = {
  name: "10x Volume Growth",
  args: {
    baseData: createTopKDataset({
      counts: [100, 80, 60, 40, 20],
      valids: 300,
    }),
    currentData: createTopKDataset({
      counts: [1000, 800, 600, 400, 200],
      valids: 3000,
    }),
    showComparison: true,
    title: "10x Volume Growth — Same Distribution",
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Volume increased 10x but distribution is unchanged. Base bars are much shorter than current.",
      },
    },
  },
};

export const DistributionShift: Story = {
  name: "Distribution Shift",
  args: {
    baseData: createTopKDataset({
      counts: [200, 150, 80, 40, 30],
      valids: 500,
    }),
    currentData: createTopKDataset({
      counts: [50, 60, 180, 120, 90],
      valids: 500,
    }),
    showComparison: true,
    title: "Distribution Shift — Same Volume",
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Total volume unchanged but distribution shifted from top values to bottom values.",
      },
    },
  },
};

export const LargeCounts: Story = {
  name: "Large Counts",
  args: {
    baseData: {
      values: ["value_a", "value_b", "value_c", "value_d", "value_e"],
      counts: [12000000, 7200000, 3800000, 1500000, 600000],
      valids: 25100000,
    },
    currentData: {
      values: ["value_a", "value_b", "value_c", "value_d", "value_e"],
      counts: [15000000, 8500000, 4200000, 1800000, 750000],
      valids: 30250000,
    },
    showComparison: true,
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Abbreviated number formatting (K, M, B) with comparison. Tests label fitting inside wide vs narrow bars.",
      },
    },
  },
};

export const WithSpecialValues: Story = {
  name: "Special Values (null, empty)",
  args: {
    baseData: topKWithSpecialValues,
    currentData: {
      ...topKWithSpecialValues,
      counts: topKWithSpecialValues.counts.map((c) =>
        Math.round(c * (0.8 + Math.random() * 0.4)),
      ),
    },
    showComparison: true,
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Handles null (shown as '(null)') and empty strings (shown as '(empty)') in comparison mode.",
      },
    },
  },
};

// ============================================
// Theme
// ============================================

export const DarkTheme: Story = {
  name: "Dark Theme",
  args: {
    baseData: createTopKDataset({
      counts: [90, 85, 55, 45, 25],
      valids: 300,
    }),
    currentData: createTopKDataset(),
    showComparison: true,
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Comparison in dark theme — verifies label contrast on dark background.",
      },
    },
    backgrounds: { default: "dark" },
  },
  globals: {
    theme: "dark",
  },
};

// ============================================
// Single Dataset (fallback)
// ============================================

export const SingleDataset: Story = {
  name: "Single Dataset (no comparison)",
  args: {
    currentData: createTopKDataset(),
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story: "Fallback view when only current data is available.",
      },
    },
  },
};
