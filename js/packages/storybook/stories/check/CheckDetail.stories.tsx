// packages/storybook/stories/check/CheckDetail.stories.tsx
import { CheckDetail } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  createSampleTabs,
  samplePrimaryActions,
  sampleSecondaryActions,
  sampleSidebarContent,
} from "./fixtures";

const meta: Meta<typeof CheckDetail> = {
  title: "Check/CheckDetail",
  component: CheckDetail,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Detailed view for a single check with editable name/description, action buttons, tabs for result/query views, and an optional sidebar.

## Layout
- **Header:** Editable name (click to edit), type caption, approval indicator, and action buttons
- **Description:** Editable description section
- **Tabs:** Configurable tabs for result views, queries, lineage, etc.
- **Sidebar:** Optional 350px right panel (e.g., for timeline)

## Usage

\`\`\`tsx
import { CheckDetail } from '@datarecce/ui/components';

<CheckDetail
  checkId={check.id}
  name={check.name}
  type={check.type}
  description={check.description}
  isApproved={check.is_checked}
  tabs={[
    { id: 'result', label: 'Result', content: <ResultView run={run} /> },
    { id: 'query', label: 'Query', content: <CodeEditor value={sql} /> },
  ]}
  primaryActions={[
    { type: 'run', label: 'Run' },
    { type: 'approve', label: 'Approve' },
  ]}
  secondaryActions={[
    { type: 'delete', label: 'Delete', destructive: true },
  ]}
  onAction={(id, action) => handleAction(id, action)}
  onDescriptionChange={(desc) => updateCheck({ description: desc })}
  onNameChange={(name) => updateCheck({ name })}
/>
\`\`\``,
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    checkId: { description: "Unique check identifier", control: "text" },
    name: { description: "Check name (click to edit)", control: "text" },
    type: { description: "Check type label", control: "text" },
    description: {
      description: "Check description (editable)",
      control: "text",
    },
    isApproved: {
      description: 'Whether the check is approved (shows "Approved" badge)',
      control: "boolean",
    },
    disabled: {
      description: "Whether editing is disabled",
      control: "boolean",
    },
    onAction: {
      description: "Callback when an action button is clicked",
      action: "action",
    },
    onDescriptionChange: {
      description: "Callback when description is edited",
      action: "descriptionChanged",
    },
    onNameChange: {
      description: "Callback when name is edited",
      action: "nameChanged",
    },
  },
  args: {
    onAction: fn(),
    onDescriptionChange: fn(),
    onNameChange: fn(),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          height: "100vh",
          minHeight: "600px",
          width: "100%",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CheckDetail>;

export const Default: Story = {
  args: {
    checkId: "check-001",
    name: "Validate order totals match",
    type: "query_diff",
    description:
      "Ensures that order totals in the base and current environments match within acceptable tolerance.",
    tabs: createSampleTabs(),
    primaryActions: samplePrimaryActions,
    secondaryActions: sampleSecondaryActions,
  },
};

export const Approved: Story = {
  args: {
    checkId: "check-002",
    name: "Row count validation",
    type: "row_count_diff",
    description: "Checks that row counts are consistent across environments.",
    isApproved: true,
    tabs: createSampleTabs(),
    primaryActions: samplePrimaryActions,
    secondaryActions: sampleSecondaryActions,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the "Approved" indicator next to the type caption.',
      },
    },
  },
};

export const WithSidebar: Story = {
  name: "With Sidebar",
  args: {
    checkId: "check-003",
    name: "Customer profile diff",
    type: "profile_diff",
    description: "Compare statistical profiles between environments.",
    tabs: createSampleTabs(),
    primaryActions: samplePrimaryActions,
    secondaryActions: sampleSecondaryActions,
    sidebarContent: sampleSidebarContent,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Includes a 350px sidebar panel on the right (e.g., for a check timeline).",
      },
    },
  },
};

export const WithHeaderContent: Story = {
  name: "With Header Content",
  args: {
    checkId: "check-004",
    name: "Revenue histogram check",
    type: "histogram_diff",
    description: "Compare revenue distributions across environments.",
    tabs: createSampleTabs(),
    primaryActions: samplePrimaryActions,
    headerContent: (
      <div
        style={{
          fontSize: "0.875rem",
          color: "#999",
          marginBottom: "8px",
        }}
      >
        Checks &gt; Revenue histogram check
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows optional header content above the name (e.g., breadcrumbs).",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    checkId: "check-005",
    name: "Read-only check",
    type: "schema_diff",
    description: "This check is in read-only mode.",
    disabled: true,
    tabs: createSampleTabs(),
    primaryActions: [{ type: "run" as const, label: "Run", disabled: true }],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Disabled mode — name and description are not editable, cursor changes to default.",
      },
    },
  },
};

export const NoTabs: Story = {
  name: "No Tabs",
  args: {
    checkId: "check-006",
    name: "Simple check",
    type: "simple",
    description: "A check with no tab content.",
    primaryActions: samplePrimaryActions,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Check detail with no tabs — only header and description sections are shown.",
      },
    },
  },
};

export const NoDescription: Story = {
  name: "No Description",
  args: {
    checkId: "check-007",
    name: "Check without description",
    type: "query_diff",
    tabs: createSampleTabs(),
    primaryActions: samplePrimaryActions,
    secondaryActions: sampleSecondaryActions,
  },
  parameters: {
    docs: {
      description: {
        story: "Check with no initial description — shows placeholder text.",
      },
    },
  },
};
