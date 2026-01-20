import { TopKDiffForm } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MockLineageProvider } from "../mocks/MockProviders";
import { createTopKDiffParams } from "./fixtures";

const meta: Meta<typeof TopKDiffForm> = {
  title: "Visualizations/Top-K/TopKDiffForm",
  component: TopKDiffForm,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Form component for configuring Top-K diff parameters. Allows users to select a column for top-K value distribution analysis.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    params: {
      description: "Top-K diff parameters",
      control: "object",
    },
    onParamsChanged: {
      description: "Callback when parameters change",
      action: "paramsChanged",
    },
    setIsReadyToExecute: {
      description: "Callback to set execution readiness",
      action: "readyToExecute",
    },
  },
  decorators: [
    (Story) => (
      <MockLineageProvider>
        <div style={{ width: "500px" }}>
          <Story />
        </div>
      </MockLineageProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TopKDiffForm>;

// Note: These stories will show loading/error states since they rely on useModelColumns hook
// In actual Storybook, you'd need to mock the API responses

export const Default: Story = {
  args: {
    params: createTopKDiffParams({ model: "users", column_name: "" }),
    onParamsChanged: fn(),
    setIsReadyToExecute: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default form state with no column selected. In production, this would load columns from the model via API.",
      },
    },
  },
};

export const WithSelectedColumn: Story = {
  name: "With Selected Column",
  args: {
    params: createTopKDiffParams({ model: "users", column_name: "status" }),
    onParamsChanged: fn(),
    setIsReadyToExecute: fn(),
  },
};

export const DifferentModel: Story = {
  name: "Different Model",
  args: {
    params: createTopKDiffParams({
      model: "orders",
      column_name: "product_category",
    }),
    onParamsChanged: fn(),
    setIsReadyToExecute: fn(),
  },
};
