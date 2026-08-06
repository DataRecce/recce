import { DiffTextWithToast } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof DiffTextWithToast> = {
  title: "Primitives/DiffTextWithToast",
  component: DiffTextWithToast,
  parameters: {
    docs: {
      description: {
        component:
          "A convenience wrapper around DiffText that automatically shows a toast notification when the copy button is clicked. This is the 'batteries included' version with built-in copy feedback.",
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
  },
};

export default meta;
type Story = StoryObj<typeof DiffTextWithToast>;

// ============================================
// Basic Examples
// ============================================

export const Green: Story = {
  name: "Green (Current)",
  parameters: {
    docs: {
      description: {
        story:
          "Hover and click the copy button to see a toast notification appear.",
      },
    },
  },
  args: {
    value: "current_value",
    comparisonRole: "current",
  },
};

export const Red: Story = {
  name: "Red (Base)",
  parameters: {
    docs: {
      description: {
        story:
          "Hover and click the copy button to see a toast notification appear.",
      },
    },
  },
  args: {
    value: "base_value",
    comparisonRole: "base",
  },
};

// ============================================
// Comparison with DiffText
// ============================================

export const WithToastNotification: Story = {
  name: "With Toast Notification",
  parameters: {
    docs: {
      description: {
        story:
          "This component automatically shows a toast when you copy a value. Try hovering and clicking the copy button.",
      },
    },
  },
  args: {
    value: "copy_me_to_see_toast",
    comparisonRole: "current",
  },
};

// ============================================
// Real-World Usage
// ============================================

export const InDiffComparison: Story = {
  name: "In Diff Comparison",
  parameters: {
    docs: {
      description: {
        story:
          "Example showing base and current values. Copy either value to see the toast notification.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <DiffTextWithToast value="old_status" comparisonRole="base" />
      <span style={{ color: "#999" }}>→</span>
      <DiffTextWithToast value="new_status" comparisonRole="current" />
    </div>
  ),
};

export const MultipleValues: Story = {
  name: "Multiple Values",
  parameters: {
    docs: {
      description: {
        story:
          "Example with multiple diff values. Each can be copied independently with toast feedback.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[
        { label: "Column Type", base: "VARCHAR(50)", current: "VARCHAR(100)" },
        { label: "Nullable", base: "false", current: "true" },
        { label: "Default", base: "null", current: "'active'" },
      ].map((row) => (
        <div key={row.label}>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "4px",
              fontWeight: 500,
            }}
          >
            {row.label}:
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <DiffTextWithToast value={row.base} comparisonRole="base" />
            <span style={{ color: "#999" }}>→</span>
            <DiffTextWithToast value={row.current} comparisonRole="current" />
          </div>
        </div>
      ))}
    </div>
  ),
};

// ============================================
// States
// ============================================

export const GrayedOut: Story = {
  name: "Grayed Out (No Copy)",
  parameters: {
    docs: {
      description: {
        story:
          "Grayed out values (for null/missing data) don't show the copy button.",
      },
    },
  },
  args: {
    value: "null",
    comparisonRole: "base",
    grayOut: true,
  },
};

export const NoCopyButton: Story = {
  name: "No Copy Button",
  args: {
    value: "no_copy",
    comparisonRole: "current",
    noCopy: true,
  },
};

// ============================================
// Size Variants
// ============================================

export const SmallFont: Story = {
  name: "Small Font",
  args: {
    value: "small_text",
    comparisonRole: "current",
    fontSize: "8pt",
  },
};

export const LargeFont: Story = {
  name: "Large Font",
  args: {
    value: "large_text",
    comparisonRole: "current",
    fontSize: "14pt",
  },
};
