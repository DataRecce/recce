// packages/storybook/stories/rowcount/RowCountResultView.stories.tsx
import { RowCountResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createRowCountResult,
  createRowCountRun,
  largeRowCountResult,
} from "./fixtures";

// ============================================
// RowCountResultView (Single Environment)
// ============================================

const meta: Meta<typeof RowCountResultView> = {
  title: "Visualizations/RowCount/RowCountResultView",
  component: RowCountResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Result view for single environment row counts. Displays a grid with model names and their row counts.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Row count run data",
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
type Story = StoryObj<typeof RowCountResultView>;

export const Default: Story = {
  args: {
    run: createRowCountRun(),
  },
};

export const ManyModels: Story = {
  name: "Many Models (50+)",
  args: {
    run: createRowCountRun({
      result: largeRowCountResult,
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Row count view with 50+ models to test scrolling.",
      },
    },
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: createRowCountRun({
      result: createRowCountResult({}),
    }),
  },
};

export const LargeCounts: Story = {
  name: "Large Count Values",
  args: {
    run: createRowCountRun({
      result: {
        "model.transactions": { curr: 150000000 },
        "model.events": { curr: 85000000 },
        "model.logs": { curr: 42000000 },
        "model.users": { curr: 18000000 },
      },
    }),
  },
};
