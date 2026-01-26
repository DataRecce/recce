import { HistogramDiffForm } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MockLineageProvider } from "../mocks/MockProviders";
import { createHistogramDiffParams } from "./fixtures";

const meta: Meta<typeof HistogramDiffForm> = {
  title: "Visualizations/Histogram/HistogramDiffForm",
  component: HistogramDiffForm,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Form component for configuring histogram diff parameters. Allows users to select a numeric column for histogram comparison. Filters out string, boolean, and datetime columns.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    params: {
      description: "Histogram diff parameters",
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
type Story = StoryObj<typeof HistogramDiffForm>;

// Note: These stories will show loading/error states since they rely on useModelColumns hook
// In actual Storybook, you'd need to mock the API responses

export const Default: Story = {
  args: {
    params: createHistogramDiffParams({ model: "orders", column_name: "" }),
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
    params: createHistogramDiffParams({
      model: "orders",
      column_name: "total_amount",
    }),
    onParamsChanged: fn(),
    setIsReadyToExecute: fn(),
  },
};

export const DifferentModel: Story = {
  name: "Different Model",
  args: {
    params: createHistogramDiffParams({
      model: "customers",
      column_name: "age",
    }),
    onParamsChanged: fn(),
    setIsReadyToExecute: fn(),
  },
};
