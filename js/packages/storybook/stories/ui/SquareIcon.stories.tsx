import { SquareIcon } from "@datarecce/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SquareIcon> = {
  title: "UI/SquareIcon",
  component: SquareIcon,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A small square icon used in chart legends to indicate colors. Displays a 10x10px rounded square with a configurable background color.",
      },
    },
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

// ============================================
// Color Variants
// ============================================

export const Blue: Story = {
  name: "Blue",
  args: {
    color: "#3b82f6",
  },
};

export const Green: Story = {
  name: "Green",
  args: {
    color: "#10b981",
  },
};

export const Red: Story = {
  name: "Red",
  args: {
    color: "#ef4444",
  },
};

export const Yellow: Story = {
  name: "Yellow",
  args: {
    color: "#f59e0b",
  },
};

export const Purple: Story = {
  name: "Purple",
  args: {
    color: "#8b5cf6",
  },
};

export const Orange: Story = {
  name: "Orange",
  args: {
    color: "#f97316",
  },
};

// ============================================
// Chart Legend Example
// ============================================

export const ChartLegendExample: Story = {
  name: "Chart Legend Example",
  parameters: {
    docs: {
      description: {
        story:
          "Example showing how SquareIcon is typically used in chart legends to indicate data series colors.",
      },
    },
  },
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

// ============================================
// Color Format Examples
// ============================================

export const HexColor: Story = {
  name: "Hex Color",
  args: {
    color: "#3b82f6",
  },
};

export const RgbColor: Story = {
  name: "RGB Color",
  args: {
    color: "rgb(59, 130, 246)",
  },
};

export const RgbaColor: Story = {
  name: "RGBA Color (Semi-transparent)",
  args: {
    color: "rgba(59, 130, 246, 0.5)",
  },
};

export const NamedColor: Story = {
  name: "Named Color",
  args: {
    color: "crimson",
  },
};

// ============================================
// Edge Cases
// ============================================

export const TransparentColor: Story = {
  name: "Transparent Color",
  parameters: {
    docs: {
      description: {
        story:
          "Shows what happens with a transparent color. The square is rendered but invisible.",
      },
    },
  },
  args: {
    color: "transparent",
  },
};

export const GradientColor: Story = {
  name: "Gradient Color",
  parameters: {
    docs: {
      description: {
        story:
          "CSS gradients can be used as background colors for more complex visual indicators.",
      },
    },
  },
  args: {
    color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
};
