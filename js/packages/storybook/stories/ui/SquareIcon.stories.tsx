import { SquareIcon } from "@datarecce/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SquareIcon> = {
  title: "Primitives/SquareIcon",
  component: SquareIcon,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    color: {
      description: "The background color of the square icon (CSS color value)",
      control: "color",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SquareIcon>;

export const Default: Story = {
  args: { color: "#3b82f6" },
};

export const ChartLegendExample: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <SquareIcon color="#3b82f6" />
        <span>Base Environment</span>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <SquareIcon color="#10b981" />
        <span>Current Environment</span>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <SquareIcon color="#ef4444" />
        <span>Difference</span>
      </div>
    </div>
  ),
};

export const ColorPalette: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      {[
        { name: "Blue", color: "#3b82f6" },
        { name: "Green", color: "#10b981" },
        { name: "Red", color: "#ef4444" },
        { name: "Amber", color: "#f59e0b" },
        { name: "Purple", color: "#8b5cf6" },
        { name: "Gray", color: "#6b7280" },
      ].map(({ name, color }) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <SquareIcon color={color} />
          <span style={{ fontSize: "11px", color: "#6b7280" }}>{name}</span>
        </div>
      ))}
    </div>
  ),
};
