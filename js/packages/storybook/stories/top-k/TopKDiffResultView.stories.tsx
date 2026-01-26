import { TopKDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  createTopKDiffResult,
  createTopKDiffRun,
  topKResultManyValues,
} from "./fixtures";

const meta: Meta<typeof TopKDiffResultView> = {
  title: "Visualizations/Top-K/TopKDiffResultView",
  component: TopKDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Result view for Top-K value distribution comparison. Displays horizontal bar charts comparing base vs current top-K values with an optional 'View More Items' toggle.

## Usage

\`\`\`tsx
import { TopKDiffResultView } from '@datarecce/ui/components';

const [viewOptions, setViewOptions] = useState({ show_all: false });

<TopKDiffResultView
  run={{
    run_id: '1',
    run_type: 'top_k_diff',
    params: {
      model: 'users',
      column_name: 'status',
      k: 10
    },
    result: {
      base: {
        values: ['active', 'inactive', 'pending'],
        counts: [100, 80, 60],
        valids: 240
      },
      current: {
        values: ['active', 'inactive', 'pending'],
        counts: [120, 85, 55],
        valids: 260
      }
    }
  }}
  viewOptions={viewOptions}
  onViewOptionsChanged={setViewOptions}
/>
\`\`\``,
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Top-K diff run data",
      control: "object",
    },
    viewOptions: {
      description: "View options (show_all toggle)",
      control: "object",
    },
    onViewOptionsChanged: {
      description: "Callback when view options change",
      action: "viewOptionsChanged",
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
type Story = StoryObj<typeof TopKDiffResultView>;

// ============================================
// Primary Use Cases
// ============================================

export const Default: Story = {
  args: {
    run: createTopKDiffRun(),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
};

export const ShowAllItems: Story = {
  name: "Show All Items",
  args: {
    run: createTopKDiffRun({ result: topKResultManyValues }),
    viewOptions: { show_all: true },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: "When show_all is true, displays all values (not just top 10).",
      },
    },
  },
};

export const WithViewToggle: Story = {
  name: "With View Toggle (>10 items)",
  args: {
    run: createTopKDiffRun({ result: topKResultManyValues }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "When there are more than 10 items, a 'View More Items' toggle link appears at the bottom.",
      },
    },
  },
};

export const WithSpecialValues: Story = {
  name: "With Special Values (undefined, empty)",
  args: {
    run: createTopKDiffRun({
      params: { model: "orders", column_name: "notes", k: 10 },
      result: createTopKDiffResult({
        base: {
          values: [undefined, "", "pending_review", "approved", "rejected"],
          counts: [500, 300, 200, 150, 100],
          valids: 1250,
        },
        current: {
          values: [undefined, "", "pending_review", "approved", "rejected"],
          counts: [550, 320, 220, 160, 110],
          valids: 1360,
        },
      }),
    }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Handles special values: undefined shown as '(null)', empty strings as '(empty)'.",
      },
    },
  },
};

// ============================================
// Edge Cases
// ============================================

export const NoResult: Story = {
  name: "No Result",
  args: {
    run: createTopKDiffRun({
      result: undefined,
    }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
};

export const SingleValue: Story = {
  name: "Single Value",
  args: {
    run: createTopKDiffRun({
      result: createTopKDiffResult({
        base: { values: ["only_value"], counts: [1000], valids: 1000 },
        current: { values: ["only_value"], counts: [1100], valids: 1100 },
      }),
    }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
};

export const LargeCounts: Story = {
  name: "Large Count Values",
  args: {
    run: createTopKDiffRun({
      params: { model: "transactions", column_name: "country", k: 10 },
      result: createTopKDiffResult({
        base: {
          values: ["US", "UK", "CA", "AU", "DE"],
          counts: [15000000, 8500000, 4200000, 1800000, 750000],
          valids: 30250000,
        },
        current: {
          values: ["US", "UK", "CA", "AU", "DE"],
          counts: [16000000, 9000000, 4500000, 2000000, 800000],
          valids: 32300000,
        },
      }),
    }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
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

export const DifferentValuesInBaseAndCurrent: Story = {
  name: "Different Values in Base and Current",
  args: {
    run: createTopKDiffRun({
      result: createTopKDiffResult({
        base: {
          values: [
            "old_value_1",
            "old_value_2",
            "shared_value",
            "old_value_3",
            "old_value_4",
          ],
          counts: [500, 400, 300, 200, 100],
          valids: 1500,
        },
        current: {
          values: [
            "new_value_1",
            "new_value_2",
            "shared_value",
            "new_value_3",
            "new_value_4",
          ],
          counts: [600, 450, 350, 250, 150],
          valids: 1800,
        },
      }),
    }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "When base and current have different top values, the chart shows both sets.",
      },
    },
  },
};
