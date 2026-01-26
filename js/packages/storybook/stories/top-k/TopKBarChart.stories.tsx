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
