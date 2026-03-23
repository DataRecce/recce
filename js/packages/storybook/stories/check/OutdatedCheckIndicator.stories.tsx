// packages/storybook/stories/check/OutdatedCheckIndicator.stories.tsx
import { CheckCard, CheckList } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { createCheckCardData, outdatedChecks } from "./fixtures";

// ============================================
// CheckCard — Outdated Indicator Stories
// ============================================

const cardMeta: Meta<typeof CheckCard> = {
  title: "Check/OutdatedCheckIndicator",
  component: CheckCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Visual markers for stale/outdated checks so users know when to re-validate.

When the underlying data has changed since the last check run, the check card shows an amber **"Outdated"** badge with a tooltip showing when the check was last run.

## Usage

\`\`\`tsx
<CheckCard
  check={{
    id: "check-1",
    name: "Row count validation",
    type: "row_count_diff",
    isOutdated: true,
    lastRunAt: "2026-03-20T10:00:00Z",
  }}
/>
\`\`\`
`,
      },
    },
    layout: "centered",
  },
  argTypes: {
    check: { control: "object" },
    isSelected: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    onClick: fn(),
    onApprovalChange: fn(),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: "350px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default cardMeta;
type Story = StoryObj<typeof CheckCard>;

// ============================================
// Single Card States
// ============================================

export const Fresh: Story = {
  name: "Fresh (Not Outdated)",
  parameters: {
    docs: {
      description: {
        story: "A check that has been run recently and is up to date.",
      },
    },
  },
  args: {
    check: createCheckCardData({
      runStatus: "success",
      isApproved: true,
    }),
  },
};

export const Outdated: Story = {
  name: "Outdated",
  parameters: {
    docs: {
      description: {
        story:
          'A check whose data has changed since the last run. Shows an amber "Outdated" badge.',
      },
    },
  },
  args: {
    check: createCheckCardData({
      isOutdated: true,
      lastRunAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      runStatus: "success",
    }),
  },
};

export const OutdatedDaysAgo: Story = {
  name: "Outdated (Days Ago)",
  parameters: {
    docs: {
      description: {
        story: "An outdated check that was last run several days ago.",
      },
    },
  },
  args: {
    check: createCheckCardData({
      name: "Schema change review",
      type: "schema_diff",
      isOutdated: true,
      lastRunAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      runStatus: "success",
    }),
  },
};

export const OutdatedNeverRun: Story = {
  name: "Outdated (Never Run)",
  parameters: {
    docs: {
      description: {
        story:
          "A check marked as outdated with no last run timestamp. Tooltip shows a generic message.",
      },
    },
  },
  args: {
    check: createCheckCardData({
      name: "Revenue histogram",
      type: "histogram_diff",
      isOutdated: true,
    }),
  },
};

export const OutdatedWithPreset: Story = {
  name: "Outdated + Preset",
  parameters: {
    docs: {
      description: {
        story:
          "A preset check that is also outdated. Both badges are shown side by side.",
      },
    },
  },
  args: {
    check: createCheckCardData({
      name: "Status top-k analysis",
      type: "top_k_diff",
      isOutdated: true,
      isPreset: true,
      lastRunAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      runStatus: "success",
    }),
  },
};

export const OutdatedSelected: Story = {
  name: "Outdated + Selected",
  parameters: {
    docs: {
      description: {
        story: "An outdated check in the selected state.",
      },
    },
  },
  args: {
    isSelected: true,
    check: createCheckCardData({
      isOutdated: true,
      lastRunAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      runStatus: "success",
    }),
  },
};

// ============================================
// Comparison
// ============================================

export const SideBySide: Story = {
  name: "Fresh vs Outdated Comparison",
  parameters: {
    docs: {
      description: {
        story: "Side-by-side comparison of fresh and outdated check cards.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: "350px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div>
      <div style={{ padding: "4px 12px", fontSize: "11px", color: "#999" }}>
        Fresh
      </div>
      <CheckCard
        check={{
          id: "fresh",
          name: "Row count validation",
          type: "row_count_diff",
          runStatus: "success",
          isApproved: true,
        }}
      />
      <div
        style={{
          borderTop: "1px solid #e0e0e0",
          padding: "4px 12px",
          fontSize: "11px",
          color: "#999",
        }}
      >
        Outdated
      </div>
      <CheckCard
        check={{
          id: "outdated",
          name: "Row count validation",
          type: "row_count_diff",
          runStatus: "success",
          isApproved: true,
          isOutdated: true,
          lastRunAt: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }}
      />
    </div>
  ),
};

// ============================================
// In CheckList Context
// ============================================

export const InCheckList: Story = {
  name: "Mixed List (Fresh + Outdated)",
  parameters: {
    docs: {
      description: {
        story:
          "A CheckList containing a mix of fresh and outdated checks, showing how the outdated badge appears in context.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: "350px",
          height: "400px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Story />
      </div>
    ),
  ],
  render: () => (
    <CheckList
      checks={outdatedChecks}
      selectedId="check-outdated-001"
      title="Review Checklist"
    />
  ),
};
