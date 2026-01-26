// packages/storybook/stories/rowcount/RowCountDiffResultView.stories.tsx
import { RowCountDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRowCountDiffRun, rowCountDiffWithChanges } from "./fixtures";

// ============================================
// RowCountDiffResultView (Base vs Current)
// ============================================

const meta: Meta<typeof RowCountDiffResultView> = {
  title: "Visualizations/RowCount/RowCountDiffResultView",
  component: RowCountDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Result view for comparing row counts between base and current environments. Displays a grid with model names, base counts, current counts, and delta. Cells are styled to indicate added or removed rows.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Row count diff run data",
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
type Story = StoryObj<typeof RowCountDiffResultView>;

export const Default: Story = {
  name: "Default Diff",
  args: {
    run: createRowCountDiffRun(),
  },
};

export const WithChanges: Story = {
  name: "With Significant Changes",
  args: {
    run: createRowCountDiffRun({
      result: rowCountDiffWithChanges,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Row count diff showing added models (green), removed models (red), and significant increases/decreases.",
      },
    },
  },
};

export const NoChanges: Story = {
  name: "No Changes",
  args: {
    run: createRowCountDiffRun({
      result: {
        "model.orders": { base: 1000, curr: 1000 },
        "model.customers": { base: 500, curr: 500 },
        "model.products": { base: 250, curr: 250 },
      },
    }),
  },
};

export const LargeCounts: Story = {
  name: "Large Count Values",
  args: {
    run: createRowCountDiffRun({
      result: {
        "model.transactions": { base: 150000000, curr: 160000000 },
        "model.events": { base: 85000000, curr: 90000000 },
        "model.logs": { base: 42000000, curr: 45000000 },
      },
    }),
  },
};

export const ManyModels: Story = {
  name: "Many Models (50+)",
  args: {
    run: createRowCountDiffRun({
      result: Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [
          `model.table_${i}`,
          {
            base: Math.floor(Math.random() * 1000000),
            curr: Math.floor(Math.random() * 1000000),
          },
        ]),
      ),
    }),
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: createRowCountDiffRun({
      result: {},
    }),
  },
};
