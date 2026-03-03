import { ToggleSwitch } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

const meta: Meta<typeof ToggleSwitch> = {
  title: "UI/ToggleSwitch",
  component: ToggleSwitch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A toggle switch component that allows switching between two values. Uses a button group to present two mutually exclusive options.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    value: {
      description: "Current toggle state (true = on, false = off)",
      control: "boolean",
    },
    onChange: {
      description: "Callback when toggle state changes",
      action: "changed",
    },
    textOff: {
      description: 'Label for the "off" state (defaults to "Off")',
      control: "text",
    },
    textOn: {
      description: 'Label for the "on" state (defaults to "On")',
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToggleSwitch>;

// ============================================
// Basic States
// ============================================

export const Off: Story = {
  name: "Off State",
  args: {
    value: false,
    onChange: fn(),
  },
};

export const On: Story = {
  name: "On State",
  args: {
    value: true,
    onChange: fn(),
  },
};

// ============================================
// Custom Labels
// ============================================

export const CustomLabels: Story = {
  name: "Custom Labels",
  parameters: {
    docs: {
      description: {
        story:
          "Toggle switches can have custom labels to indicate the meaning of each state.",
      },
    },
  },
  args: {
    value: false,
    onChange: fn(),
    textOff: "Inline",
    textOn: "Side by side",
  },
};

export const DiffModeLabels: Story = {
  name: "Diff Mode Labels",
  args: {
    value: true,
    onChange: fn(),
    textOff: "Unified",
    textOn: "Split",
  },
};

export const ViewModeLabels: Story = {
  name: "View Mode Labels",
  args: {
    value: false,
    onChange: fn(),
    textOff: "List",
    textOn: "Grid",
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
          "Fully interactive toggle switch. Click either button to change the state.",
      },
    },
  },
  render: function InteractiveToggle() {
    const [value, setValue] = useState(false);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <ToggleSwitch
          value={value}
          onChange={setValue}
          textOff="Disabled"
          textOn="Enabled"
        />
        <div style={{ fontSize: "14px", color: "#666" }}>
          Current state: <strong>{value ? "On" : "Off"}</strong>
        </div>
      </div>
    );
  },
};

// ============================================
// Interactive Tests
// ============================================

export const ToggleOffToOn: Story = {
  name: "Toggle Off to On",
  parameters: {
    docs: {
      description: {
        story: "Demonstrates clicking the 'On' button to change state.",
      },
    },
  },
  args: {
    value: false,
    onChange: fn(),
    textOff: "Off",
    textOn: "On",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the "On" button
    const onButton = canvas.getByRole("button", { name: /^On$/i });
    await userEvent.click(onButton);

    // Verify callback was called with true
    expect(args.onChange).toHaveBeenCalledWith(true);
  },
};

export const ToggleOnToOff: Story = {
  name: "Toggle On to Off",
  parameters: {
    docs: {
      description: {
        story: "Demonstrates clicking the 'Off' button to change state.",
      },
    },
  },
  args: {
    value: true,
    onChange: fn(),
    textOff: "Off",
    textOn: "On",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the "Off" button
    const offButton = canvas.getByRole("button", { name: /^Off$/i });
    await userEvent.click(offButton);

    // Verify callback was called with false
    expect(args.onChange).toHaveBeenCalledWith(false);
  },
};

// ============================================
// Edge Cases
// ============================================

export const LongLabels: Story = {
  name: "Long Labels",
  parameters: {
    docs: {
      description: {
        story:
          "Shows how the toggle switch handles longer text labels. The buttons expand to fit the content.",
      },
    },
  },
  args: {
    value: false,
    onChange: fn(),
    textOff: "Show All Items",
    textOn: "Changed Items Only",
  },
};

export const SingleCharacterLabels: Story = {
  name: "Single Character Labels",
  args: {
    value: true,
    onChange: fn(),
    textOff: "A",
    textOn: "B",
  },
};

export const EmptyStringLabels: Story = {
  name: "Empty String Labels (Fallback)",
  parameters: {
    docs: {
      description: {
        story:
          'When labels are undefined, the component falls back to default "Off" and "On" labels.',
      },
    },
  },
  args: {
    value: false,
    onChange: fn(),
  },
};
