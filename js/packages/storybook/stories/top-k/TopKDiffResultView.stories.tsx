import { TopKDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { createTopKDiffRun, topKResultManyValues } from "./fixtures";

const meta: Meta<typeof TopKDiffResultView> = {
  title: "Visualizations/Top-K/TopKDiffResultView",
  component: TopKDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Result view wrapper for Top-K diff checks. Adds title, view toggle, and empty state around TopKBarChart.

Chart rendering is covered by TopKBarChart stories — these stories focus on the result view shell behavior.`,
      },
    },
    layout: "fullscreen",
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

export const Default: Story = {
  args: {
    run: createTopKDiffRun(),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
};

export const WithViewToggle: Story = {
  name: "View Toggle (>10 items)",
  args: {
    run: createTopKDiffRun({ result: topKResultManyValues }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "When >10 items exist, a 'View More Items' toggle appears. Click it to show all values.",
      },
    },
  },
};

export const NoResult: Story = {
  name: "Empty State",
  args: {
    run: createTopKDiffRun({ result: undefined }),
    viewOptions: { show_all: false },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: "Shows 'No data' when the run has no result.",
      },
    },
  },
};
