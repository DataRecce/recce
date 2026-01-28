import { ChangedOnlyCheckbox } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

const meta: Meta<typeof ChangedOnlyCheckbox> = {
  title: "UI/ChangedOnlyCheckbox",
  component: ChangedOnlyCheckbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A checkbox component for filtering diff results to show only changed rows. Commonly used in data comparison views to hide unchanged data.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    changedOnly: {
      description: "Whether the changed-only filter is enabled",
      control: "boolean",
    },
    onChange: {
      description: "Callback when the checkbox state changes",
      action: "changed",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChangedOnlyCheckbox>;

// ============================================
// Basic States
// ============================================

export const Unchecked: Story = {
  name: "Unchecked",
  args: {
    changedOnly: false,
    onChange: fn(),
  },
};

export const Checked: Story = {
  name: "Checked",
  args: {
    changedOnly: true,
    onChange: fn(),
  },
};

export const DefaultUnchecked: Story = {
  name: "Default (Undefined)",
  parameters: {
    docs: {
      description: {
        story:
          "When changedOnly is undefined, the checkbox defaults to unchecked.",
      },
    },
  },
  args: {
    changedOnly: undefined,
    onChange: fn(),
  },
};

// ============================================
// Interactive Example
// ============================================

export const Interactive: Story = {
  name: "Interactive",
  parameters: {
    docs: {
      description: {
        story:
          "Fully interactive checkbox. Click to toggle the changed-only filter.",
      },
    },
  },
  render: function InteractiveCheckbox() {
    const [checked, setChecked] = useState(false);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <ChangedOnlyCheckbox
          changedOnly={checked}
          onChange={() => setChecked(!checked)}
        />
        <div style={{ fontSize: "12px", color: "#666" }}>
          Filter active: <strong>{checked ? "Yes" : "No"}</strong>
        </div>
        <div style={{ fontSize: "12px", color: "#999", fontStyle: "italic" }}>
          {checked
            ? "Showing only rows with differences"
            : "Showing all rows including unchanged"}
        </div>
      </div>
    );
  },
};

// ============================================
// Interactive Tests
// ============================================

export const CheckInteraction: Story = {
  name: "Check Interaction",
  parameters: {
    docs: {
      description: {
        story: "Demonstrates checking the checkbox.",
      },
    },
  },
  args: {
    changedOnly: false,
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the checkbox
    const checkbox = canvas.getByRole("checkbox");
    await userEvent.click(checkbox);

    // Verify callback was called
    expect(args.onChange).toHaveBeenCalled();
  },
};

export const UncheckInteraction: Story = {
  name: "Uncheck Interaction",
  parameters: {
    docs: {
      description: {
        story: "Demonstrates unchecking the checkbox.",
      },
    },
  },
  args: {
    changedOnly: true,
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the checkbox
    const checkbox = canvas.getByRole("checkbox");
    await userEvent.click(checkbox);

    // Verify callback was called
    expect(args.onChange).toHaveBeenCalled();
  },
};

// ============================================
// Context Examples
// ============================================

export const InToolbar: Story = {
  name: "In Toolbar Context",
  parameters: {
    docs: {
      description: {
        story:
          "Example showing how the checkbox is typically used in a toolbar alongside other controls.",
      },
    },
  },
  render: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "12px 16px",
        backgroundColor: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
      }}
    >
      <ChangedOnlyCheckbox changedOnly={false} onChange={fn()} />
      <div style={{ borderLeft: "1px solid #d1d5db", height: "24px" }} />
      <button
        style={{
          padding: "4px 12px",
          fontSize: "13px",
          border: "1px solid #d1d5db",
          borderRadius: "4px",
          background: "white",
        }}
      >
        Export
      </button>
    </div>
  ),
};

export const WithDescription: Story = {
  name: "With Explanation",
  parameters: {
    docs: {
      description: {
        story:
          "Example with contextual help text explaining what the filter does.",
      },
    },
  },
  render: function CheckboxWithDescription() {
    const [checked, setChecked] = useState(false);
    return (
      <div
        style={{
          padding: "16px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          maxWidth: "400px",
        }}
      >
        <ChangedOnlyCheckbox
          changedOnly={checked}
          onChange={() => setChecked(!checked)}
        />
        <p
          style={{
            fontSize: "12px",
            color: "#6b7280",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          When enabled, only rows with differences between base and current will
          be displayed. Unchanged rows will be hidden.
        </p>
      </div>
    );
  },
};
