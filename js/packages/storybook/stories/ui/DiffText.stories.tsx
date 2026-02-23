import { DiffText } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

const meta: Meta<typeof DiffText> = {
  title: "UI/DiffText",
  component: DiffText,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays a text value with diff styling (orange for base, blue for current). Includes an optional copy-to-clipboard button that appears on hover.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    value: {
      description: "The text value to display",
      control: "text",
    },
    colorPalette: {
      description:
        'Color palette for the diff indicator ("orange" for base, "iochmara" for current)',
      control: "select",
      options: ["orange", "iochmara"],
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
      description:
        "Callback when copy button is clicked. If not provided, uses navigator.clipboard.writeText",
      action: "copied",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DiffText>;

// ============================================
// Color Variants
// ============================================

export const Blue: Story = {
  name: "Blue (Added/Current)",
  parameters: {
    docs: {
      description: {
        story:
          "Blue styling indicates an added value or the current state in a diff.",
      },
    },
  },
  args: {
    value: "current_value",
    colorPalette: "iochmara",
  },
};

export const Orange: Story = {
  name: "Orange (Removed/Base)",
  parameters: {
    docs: {
      description: {
        story:
          "Orange styling indicates a removed value or the base state in a diff.",
      },
    },
  },
  args: {
    value: "base_value",
    colorPalette: "orange",
  },
};

// ============================================
// Copy Functionality
// ============================================

export const WithCopyButton: Story = {
  name: "With Copy Button",
  parameters: {
    docs: {
      description: {
        story:
          "Hover over the component to see the copy button appear. Click to copy the value.",
      },
    },
  },
  args: {
    value: "click_to_copy",
    colorPalette: "iochmara",
    noCopy: false,
  },
};

export const NoCopyButton: Story = {
  name: "No Copy Button",
  args: {
    value: "cannot_copy",
    colorPalette: "iochmara",
    noCopy: true,
  },
};

export const CustomCopyCallback: Story = {
  name: "Custom Copy Callback",
  parameters: {
    docs: {
      description: {
        story:
          "Example with a custom onCopy callback for custom copy behavior (e.g., showing a toast).",
      },
    },
  },
  args: {
    value: "custom_copy",
    colorPalette: "iochmara",
    onCopy: fn((value) => {
      console.log(`Copied: ${value}`);
    }),
  },
};

// ============================================
// Gray Out State
// ============================================

export const GrayedOut: Story = {
  name: "Grayed Out (Null Value)",
  parameters: {
    docs: {
      description: {
        story:
          "Used for null or missing values. Text is grayed out and copy button is hidden.",
      },
    },
  },
  args: {
    value: "null",
    colorPalette: "orange",
    grayOut: true,
  },
};

export const GrayedOutCurrent: Story = {
  name: "Grayed Out Current",
  args: {
    value: "None",
    colorPalette: "iochmara",
    grayOut: true,
  },
};

// ============================================
// Font Size Variants
// ============================================

export const SmallFont: Story = {
  name: "Small Font",
  args: {
    value: "small_text",
    colorPalette: "iochmara",
    fontSize: "8pt",
  },
};

export const MediumFont: Story = {
  name: "Medium Font",
  args: {
    value: "medium_text",
    colorPalette: "iochmara",
    fontSize: "10pt",
  },
};

export const LargeFont: Story = {
  name: "Large Font",
  args: {
    value: "large_text",
    colorPalette: "iochmara",
    fontSize: "14pt",
  },
};

// ============================================
// Value Length Examples
// ============================================

export const ShortValue: Story = {
  name: "Short Value",
  args: {
    value: "OK",
    colorPalette: "iochmara",
  },
};

export const MediumValue: Story = {
  name: "Medium Value",
  args: {
    value: "customer_segment",
    colorPalette: "iochmara",
  },
};

export const LongValue: Story = {
  name: "Long Value (Truncated)",
  parameters: {
    docs: {
      description: {
        story:
          "Long values are truncated with ellipsis. Hover to see the copy button.",
      },
    },
  },
  args: {
    value: "very_long_column_name_that_will_be_truncated",
    colorPalette: "orange",
  },
};

// ============================================
// Interactive Tests
// ============================================

export const CopyInteraction: Story = {
  name: "Copy Interaction Test",
  args: {
    value: "test_value",
    colorPalette: "iochmara",
    onCopy: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Hover to reveal copy button
    const container = canvas.getByText("test_value");
    await userEvent.hover(container);

    // Wait for button to appear
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find and click the copy button
    const copyButton = canvas.getByRole("button", { name: /copy/i });
    await userEvent.click(copyButton);

    // Verify callback was called with the value
    expect(args.onCopy).toHaveBeenCalledWith("test_value");
  },
};

// ============================================
// Real-World Context Examples
// ============================================

export const DiffComparison: Story = {
  name: "Diff Comparison Example",
  parameters: {
    docs: {
      description: {
        story:
          "Typical usage showing base and current values side by side in a diff view.",
      },
    },
  },
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
          <DiffText value="VARCHAR(50)" colorPalette="orange" />
          <span style={{ color: "#999" }}>→</span>
          <DiffText value="VARCHAR(100)" colorPalette="iochmara" />
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
          <DiffText value="null" colorPalette="orange" grayOut />
          <span style={{ color: "#999" }}>→</span>
          <DiffText value="'active'" colorPalette="iochmara" />
        </div>
      </div>
    </div>
  ),
};

export const InlineLabels: Story = {
  name: "Inline Labels (Legend)",
  parameters: {
    docs: {
      description: {
        story:
          "Used as inline labels in diff mode switchers to show color coding.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <DiffText value="Base" colorPalette="orange" fontSize="10pt" noCopy />
      <DiffText
        value="Current"
        colorPalette="iochmara"
        fontSize="10pt"
        noCopy
      />
      <div
        style={{
          marginLeft: "8px",
          fontSize: "12px",
          color: "#666",
        }}
      >
        Color legend
      </div>
    </div>
  ),
};

export const DataGridCell: Story = {
  name: "Data Grid Cell Example",
  parameters: {
    docs: {
      description: {
        story: "Example showing how DiffText appears in a data grid context.",
      },
    },
  },
  render: () => (
    <div
      style={{
        width: "400px",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{
              backgroundColor: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <th style={{ padding: "8px", textAlign: "left", fontSize: "12px" }}>
              Column
            </th>
            <th style={{ padding: "8px", textAlign: "left", fontSize: "12px" }}>
              Base
            </th>
            <th style={{ padding: "8px", textAlign: "left", fontSize: "12px" }}>
              Current
            </th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ padding: "8px", fontSize: "13px" }}>status</td>
            <td style={{ padding: "8px" }}>
              <DiffText value="active" colorPalette="orange" />
            </td>
            <td style={{ padding: "8px" }}>
              <DiffText value="pending" colorPalette="iochmara" />
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px", fontSize: "13px" }}>count</td>
            <td style={{ padding: "8px" }}>
              <DiffText value="42" colorPalette="orange" />
            </td>
            <td style={{ padding: "8px" }}>
              <DiffText value="45" colorPalette="iochmara" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
};
