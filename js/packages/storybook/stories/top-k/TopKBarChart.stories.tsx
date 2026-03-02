// packages/storybook/stories/top-k/TopKBarChart.stories.tsx
import { TopKBarChart } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createTopKDataset,
  sampleTopKDataset,
  topKWithSpecialValues,
} from "../data/fixtures";

const meta: Meta<typeof TopKBarChart> = {
  title: "Visualizations/Top-K/TopKBarChart",
  component: TopKBarChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Displays top-K value distributions with horizontal bar charts. Supports base/current comparison and handles special values (null, empty strings).

## Usage

\`\`\`tsx
import { TopKBarChart } from '@datarecce/ui/primitives';

// Basic usage
<TopKBarChart
  currentData={{
    values: ['apple', 'banana', 'orange'],
    counts: [100, 80, 60],
    valids: 240
  }}
  maxItems={10}
/>

// With comparison
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
  title="Product Categories"
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
// Primary Use Cases
// ============================================

export const Default: Story = {
  args: {
    currentData: createTopKDataset(),
    maxItems: 10,
  },
};

export const WithComparison: Story = {
  name: "With Base Comparison",
  args: {
    baseData: createTopKDataset({
      values: ["apple", "banana", "orange", "grape", "melon"],
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
          "Shows base vs current comparison with dual horizontal bars for each value.",
      },
    },
  },
};

export const WithTitle: Story = {
  name: "With Title",
  args: {
    currentData: createTopKDataset(),
    title: "Top Product Categories",
    maxItems: 10,
  },
};

export const ManyValues: Story = {
  name: "Many Values (12 items)",
  args: {
    currentData: sampleTopKDataset,
    maxItems: 12,
  },
};

// ============================================
// Special Values
// ============================================

export const WithNullValues: Story = {
  name: "With Null Values",
  args: {
    currentData: topKWithSpecialValues,
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Handles special values like null (shown as '(null)') and empty strings (shown as '(empty)').",
      },
    },
  },
};

export const WithOthers: Story = {
  name: "With Others Row",
  args: {
    currentData: sampleTopKDataset,
    maxItems: 5,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When maxItems is less than total values, remaining values are grouped as '(others)'.",
      },
    },
  },
};

// ============================================
// Edge Cases
// ============================================

export const EmptyDataset: Story = {
  name: "Empty Dataset",
  args: {
    currentData: { values: [], counts: [], valids: 0 },
    maxItems: 10,
  },
};

export const SingleValue: Story = {
  name: "Single Value",
  args: {
    currentData: {
      values: ["single_value"],
      counts: [1000],
      valids: 1000,
    },
    maxItems: 10,
  },
};

export const LargeCounts: Story = {
  name: "Large Count Values",
  args: {
    currentData: {
      values: ["value_a", "value_b", "value_c", "value_d", "value_e"],
      counts: [15000000, 8500000, 4200000, 1800000, 750000],
      valids: 30250000,
    },
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Top-K chart with large count values using abbreviated number formatting (K, M, B).",
      },
    },
  },
};

export const AllSameCount: Story = {
  name: "All Same Count",
  args: {
    currentData: {
      values: ["value_1", "value_2", "value_3", "value_4", "value_5"],
      counts: [100, 100, 100, 100, 100],
      valids: 500,
    },
    maxItems: 10,
  },
};

export const LongValueNames: Story = {
  name: "Long Value Names",
  args: {
    currentData: {
      values: [
        "very_long_value_name_that_needs_to_be_truncated_in_the_display",
        "another_extremely_long_value_name_for_testing_ellipsis",
        "short",
        "medium_length_value",
        "y",
      ],
      counts: [100, 80, 60, 40, 20],
      valids: 300,
    },
    maxItems: 10,
  },
  parameters: {
    docs: {
      description: {
        story: "Tests tooltip and ellipsis handling for long value names.",
      },
    },
  },
};

// ============================================
// Percentage Scaling
// ============================================

export const VolumeGrowthSameDistribution: Story = {
  name: "10x Volume Growth, Same Distribution",
  args: {
    baseData: {
      values: ["apple", "banana", "orange", "grape", "melon"],
      counts: [100, 80, 60, 40, 20],
      valids: 300,
    },
    currentData: {
      values: ["apple", "banana", "orange", "grape", "melon"],
      counts: [1000, 800, 600, 400, 200],
      valids: 3000,
    },
    showComparison: true,
    maxItems: 10,
    title: "10x Volume Growth — Same Distribution",
  },
  parameters: {
    docs: {
      description: {
        story: `Bars are scaled by percentage of each dataset's total. Both datasets have
identical distributions (33/27/20/13/7%), so the base and current bars are
the same length — the 10x volume difference is visible in the count labels
(100 vs 1,000) but doesn't distort the visual comparison. This is the key
advantage of percentage scaling: distribution changes are what matter in
top-K analysis, not absolute volume.`,
      },
    },
  },
};

export const DistributionShift: Story = {
  name: "Distribution Shift (Same Volume)",
  args: {
    baseData: {
      values: ["apple", "banana", "orange", "grape", "melon"],
      counts: [500, 400, 300, 200, 100],
      valids: 1500,
    },
    currentData: {
      values: ["apple", "banana", "orange", "grape", "melon"],
      counts: [200, 200, 500, 300, 300],
      valids: 1500,
    },
    showComparison: true,
    maxItems: 10,
    title: "Distribution Shift — Same Total Volume",
  },
  parameters: {
    docs: {
      description: {
        story: `Both datasets have the same total (1,500 valids) but the distribution
shifted — apple and banana shrank while orange, grape, and melon grew.
Percentage scaling makes this immediately visible: bar lengths directly
represent share-of-total, so you can see exactly which categories gained
or lost share.`,
      },
    },
  },
};

export const TinyBar: Story = {
  name: "Tiny Bar (~1.7%)",
  args: {
    currentData: {
      values: ["apple", "banana", "orange", "grape", "melon"],
      counts: [150, 100, 40, 5, 5],
      valids: 300,
    },
    maxItems: 10,
    title: "Tiny Bar Edge Case",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows how very small percentages render — melon at 5/300 (~1.7%) still gets a visible bar thanks to the 40px minimum width.",
      },
    },
  },
};

// ============================================
// Theme Testing
// ============================================

export const LightTheme: Story = {
  name: "Light Theme",
  args: {
    baseData: createTopKDataset({
      values: ["apple", "banana", "orange", "grape", "melon"],
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
        story: "Top-K bar chart in light theme with comparison.",
      },
    },
    backgrounds: { default: "light" },
  },
  globals: {
    theme: "light",
  },
};

export const DarkTheme: Story = {
  name: "Dark Theme",
  args: {
    baseData: createTopKDataset({
      values: ["apple", "banana", "orange", "grape", "melon"],
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
        story: "Top-K bar chart in dark theme with comparison.",
      },
    },
    backgrounds: { default: "dark" },
  },
  globals: {
    theme: "dark",
  },
};
