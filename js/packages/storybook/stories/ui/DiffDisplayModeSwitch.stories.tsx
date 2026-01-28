import {
  type DiffDisplayMode,
  DiffDisplayModeSwitch,
} from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

const meta: Meta<typeof DiffDisplayModeSwitch> = {
  title: "UI/DiffDisplayModeSwitch",
  component: DiffDisplayModeSwitch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A switch component for toggling between inline and side-by-side diff display modes. When in inline mode, also shows a color legend (Base = red, Current = green).",
      },
    },
    layout: "centered",
  },
  argTypes: {
    displayMode: {
      description: 'Current display mode ("inline" or "side_by_side")',
      control: "select",
      options: ["inline", "side_by_side"],
    },
    onDisplayModeChanged: {
      description: "Callback when display mode changes",
      action: "modeChanged",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DiffDisplayModeSwitch>;

// ============================================
// Display Modes
// ============================================

export const InlineMode: Story = {
  name: "Inline Mode",
  parameters: {
    docs: {
      description: {
        story:
          "Inline mode shows the color legend (Base in red, Current in green) alongside the toggle switch.",
      },
    },
  },
  args: {
    displayMode: "inline",
    onDisplayModeChanged: fn(),
  },
};

export const SideBySideMode: Story = {
  name: "Side by Side Mode",
  parameters: {
    docs: {
      description: {
        story:
          "Side by side mode hides the color legend and only shows the toggle switch.",
      },
    },
  },
  args: {
    displayMode: "side_by_side",
    onDisplayModeChanged: fn(),
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
          "Fully interactive mode switcher. Toggle between modes to see the color legend appear and disappear.",
      },
    },
  },
  render: function InteractiveSwitch() {
    const [mode, setMode] = useState<DiffDisplayMode>("inline");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <DiffDisplayModeSwitch
            displayMode={mode}
            onDisplayModeChanged={setMode}
          />
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          Current mode:{" "}
          <strong>{mode === "inline" ? "Inline" : "Side by Side"}</strong>
        </div>
      </div>
    );
  },
};

// ============================================
// Interactive Tests
// ============================================

export const SwitchToSideBySide: Story = {
  name: "Switch to Side by Side",
  parameters: {
    docs: {
      description: {
        story: "Demonstrates switching from inline to side by side mode.",
      },
    },
  },
  args: {
    displayMode: "inline",
    onDisplayModeChanged: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the "Side by side" button
    const sideBySideButton = canvas.getByRole("button", {
      name: /side by side/i,
    });
    await userEvent.click(sideBySideButton);

    // Verify callback was called with "side_by_side"
    expect(args.onDisplayModeChanged).toHaveBeenCalledWith("side_by_side");
  },
};

export const SwitchToInline: Story = {
  name: "Switch to Inline",
  parameters: {
    docs: {
      description: {
        story: "Demonstrates switching from side by side to inline mode.",
      },
    },
  },
  args: {
    displayMode: "side_by_side",
    onDisplayModeChanged: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the "Inline" button
    const inlineButton = canvas.getByRole("button", { name: /^inline$/i });
    await userEvent.click(inlineButton);

    // Verify callback was called with "inline"
    expect(args.onDisplayModeChanged).toHaveBeenCalledWith("inline");
  },
};

// ============================================
// Visual Comparison
// ============================================

export const ModeComparison: Story = {
  name: "Mode Comparison",
  parameters: {
    docs: {
      description: {
        story:
          "Side-by-side visual comparison showing the difference between inline and side by side modes.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: "8px", fontSize: "14px" }}>
          Inline Mode (with legend):
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <DiffDisplayModeSwitch
            displayMode="inline"
            onDisplayModeChanged={fn()}
          />
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: "8px", fontSize: "14px" }}>
          Side by Side Mode (no legend):
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <DiffDisplayModeSwitch
            displayMode="side_by_side"
            onDisplayModeChanged={fn()}
          />
        </div>
      </div>
    </div>
  ),
};
