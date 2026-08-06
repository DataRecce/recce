import { DiffText } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

const meta: Meta<typeof DiffText> = {
  title: "Primitives/DiffText",
  component: DiffText,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    value: {
      description: "The text value to display",
      control: "text",
    },
    colorPalette: {
      description: "Deprecated physical color palette for legacy consumers",
      control: "select",
      options: ["red", "green"],
    },
    comparisonRole: {
      description: "Semantic comparison role",
      control: "select",
      options: ["base", "current"],
    },
    grayOut: {
      description: "Whether to gray out the text (for null/missing values)",
      control: "boolean",
    },
    noCopy: {
      description: "Hide the copy button",
      control: "boolean",
    },
    fontSize: {
      description: "Custom font size",
      control: "text",
    },
    onCopy: {
      description: "Callback when copy button is clicked",
      action: "copied",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DiffText>;

export const Default: Story = {
  args: {
    value: "current_value",
    comparisonRole: "current",
  },
};

export const DiffComparison: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#666",
            marginBottom: "4px",
            fontWeight: 500,
          }}
        >
          Column Type:
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <DiffText value="VARCHAR(50)" comparisonRole="base" />
          <span style={{ color: "#999" }}>→</span>
          <DiffText value="VARCHAR(100)" comparisonRole="current" />
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#666",
            marginBottom: "4px",
            fontWeight: 500,
          }}
        >
          Default Value:
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <DiffText value="null" comparisonRole="base" grayOut />
          <span style={{ color: "#999" }}>→</span>
          <DiffText value="'active'" comparisonRole="current" />
        </div>
      </div>
    </div>
  ),
};

export const CopyInteraction: Story = {
  args: {
    value: "test_value",
    comparisonRole: "current",
    onCopy: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByText("test_value");
    await userEvent.hover(container);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const copyButton = canvas.getByRole("button", { name: /copy/i });
    await userEvent.click(copyButton);
    expect(args.onCopy).toHaveBeenCalledWith("test_value");
  },
};

export const DeprecatedPhysicalPalette: Story = {
  args: {
    value: "legacy_current_value",
    colorPalette: "green",
  },
};
