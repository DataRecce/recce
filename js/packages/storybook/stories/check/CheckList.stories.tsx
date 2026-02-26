// packages/storybook/stories/check/CheckList.stories.tsx
import { CheckList } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { manyChecks, sampleChecks } from "./fixtures";

const meta: Meta<typeof CheckList> = {
  title: "Check/CheckList",
  component: CheckList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `A presentation component for displaying a scrollable list of checks. Each check is rendered as a \`CheckCard\` with selection and approval controls.

## Usage

\`\`\`tsx
import { CheckList } from '@datarecce/ui/components';

<CheckList
  checks={checks.map(c => ({
    id: c.check_id,
    name: c.name,
    type: c.type,
    isApproved: c.is_checked,
    runStatus: 'success',
  }))}
  selectedId={selectedId}
  onCheckSelect={setSelectedId}
  onApprovalChange={(id, approved) => updateCheck(id, approved)}
/>
\`\`\``,
      },
    },
    layout: "centered",
  },
  argTypes: {
    checks: {
      description: "Array of check card data to display",
      control: "object",
    },
    selectedId: {
      description: "Currently selected check ID",
      control: "text",
    },
    onCheckSelect: {
      description: "Callback when a check is selected",
      action: "checkSelected",
    },
    onApprovalChange: {
      description: "Callback when approval status changes",
      action: "approvalChanged",
    },
    isLoading: {
      description: "Whether the list is in loading state",
      control: "boolean",
    },
    disableApproval: {
      description: "Whether approval checkboxes are disabled",
      control: "boolean",
    },
    title: {
      description: "Optional title above the list",
      control: "text",
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: "350px",
          height: "600px",
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

export default meta;
type Story = StoryObj<typeof CheckList>;

export const Default: Story = {
  args: {
    checks: sampleChecks,
    selectedId: "check-001",
    onCheckSelect: fn(),
    onApprovalChange: fn(),
  },
};

export const WithTitle: Story = {
  name: "With Title",
  args: {
    checks: sampleChecks,
    title: "Review Checklist",
    onCheckSelect: fn(),
    onApprovalChange: fn(),
  },
};

export const ManyChecks: Story = {
  name: "Many Checks (30)",
  args: {
    checks: manyChecks,
    selectedId: "check-005",
    onCheckSelect: fn(),
    onApprovalChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: "List with 30 checks to test vertical scrolling.",
      },
    },
  },
};

export const ApprovalDisabled: Story = {
  name: "Approval Disabled",
  args: {
    checks: sampleChecks,
    disableApproval: true,
    disabledApprovalTooltip: "You need write access to approve checks",
    onCheckSelect: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Approval checkboxes are disabled with a tooltip explaining why.",
      },
    },
  },
};

export const Loading: Story = {
  args: {
    checks: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    checks: [],
  },
};

export const EmptyWithTitle: Story = {
  name: "Empty with Title",
  args: {
    checks: [],
    title: "Review Checklist",
  },
};

export const EmptyWithCustomContent: Story = {
  name: "Empty with Custom Content",
  args: {
    checks: [],
    emptyContent: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          gap: "8px",
        }}
      >
        <p style={{ color: "#999", margin: 0 }}>No checks yet</p>
        <button
          type="button"
          style={{
            padding: "6px 16px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          Create your first check
        </button>
      </div>
    ),
  },
};
