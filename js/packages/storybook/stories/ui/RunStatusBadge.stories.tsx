import { RunStatusBadge } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof RunStatusBadge> = {
  title: "UI/RunStatusBadge",
  component: RunStatusBadge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A pure presentation component for displaying run status with color coding. Shows the status of a data validation check run with appropriate visual indicators.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    status: {
      description: "Run status to display",
      control: "select",
      options: ["Running", "Finished", "Failed", "Cancelled"],
    },
    showSpinner: {
      description:
        "Whether to show the spinner for running state (default: true)",
      control: "boolean",
    },
    size: {
      description: 'Text size variant ("small" or "medium")',
      control: "select",
      options: ["small", "medium"],
    },
    className: {
      description: "Optional CSS class name",
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof RunStatusBadge>;

// ============================================
// Status Variants
// ============================================

export const Running: Story = {
  name: "Running",
  args: {
    status: "Running",
    showSpinner: true,
  },
};

export const Finished: Story = {
  name: "Finished",
  args: {
    status: "Finished",
  },
};

export const Failed: Story = {
  name: "Failed",
  args: {
    status: "Failed",
  },
};

export const Cancelled: Story = {
  name: "Cancelled",
  args: {
    status: "Cancelled",
  },
};

// ============================================
// Running State Variants
// ============================================

export const RunningWithSpinner: Story = {
  name: "Running with Spinner",
  parameters: {
    docs: {
      description: {
        story:
          "Default running state shows an animated spinner to indicate progress.",
      },
    },
  },
  args: {
    status: "Running",
    showSpinner: true,
  },
};

export const RunningWithoutSpinner: Story = {
  name: "Running without Spinner",
  parameters: {
    docs: {
      description: {
        story: "Running state can be displayed without the spinner if desired.",
      },
    },
  },
  args: {
    status: "Running",
    showSpinner: false,
  },
};

// ============================================
// Size Variants
// ============================================

export const SmallSize: Story = {
  name: "Small Size",
  args: {
    status: "Finished",
    size: "small",
  },
};

export const MediumSize: Story = {
  name: "Medium Size",
  args: {
    status: "Finished",
    size: "medium",
  },
};

export const SizeComparison: Story = {
  name: "Size Comparison",
  parameters: {
    docs: {
      description: {
        story: "Side-by-side comparison of small and medium sizes.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "60px", fontSize: "12px", color: "#666" }}>
          Small:
        </span>
        <RunStatusBadge status="Finished" size="small" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "60px", fontSize: "12px", color: "#666" }}>
          Medium:
        </span>
        <RunStatusBadge status="Finished" size="medium" />
      </div>
    </div>
  ),
};

// ============================================
// All Statuses Overview
// ============================================

export const AllStatuses: Story = {
  name: "All Statuses",
  parameters: {
    docs: {
      description: {
        story: "Overview of all available status types with their colors.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Running" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Blue - In Progress
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Finished" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Green - Completed Successfully
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Failed" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Red - Error Occurred
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Cancelled" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Grey - User Cancelled
        </span>
      </div>
    </div>
  ),
};

// ============================================
// Real-World Context Examples
// ============================================

export const InRunList: Story = {
  name: "In Run List Context",
  parameters: {
    docs: {
      description: {
        story:
          "Example showing how badges are typically used in a list of check runs.",
      },
    },
  },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "400px",
      }}
    >
      {[
        { name: "Schema Validation", status: "Finished" as const },
        { name: "Row Count Check", status: "Running" as const },
        { name: "Data Quality Audit", status: "Failed" as const },
        { name: "Performance Test", status: "Cancelled" as const },
      ].map((run) => (
        <div
          key={run.name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: "4px",
          }}
        >
          <span style={{ fontSize: "14px" }}>{run.name}</span>
          <RunStatusBadge status={run.status} />
        </div>
      ))}
    </div>
  ),
};

// ============================================
// Edge Cases
// ============================================

export const AllSizesAllStatuses: Story = {
  name: "All Sizes and Statuses",
  parameters: {
    docs: {
      description: {
        story: "Complete matrix of all size and status combinations.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: "12px" }}>Small Size</div>
        <div style={{ display: "flex", gap: "16px" }}>
          <RunStatusBadge status="Running" size="small" />
          <RunStatusBadge status="Finished" size="small" />
          <RunStatusBadge status="Failed" size="small" />
          <RunStatusBadge status="Cancelled" size="small" />
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: "12px" }}>Medium Size</div>
        <div style={{ display: "flex", gap: "16px" }}>
          <RunStatusBadge status="Running" size="medium" />
          <RunStatusBadge status="Finished" size="medium" />
          <RunStatusBadge status="Failed" size="medium" />
          <RunStatusBadge status="Cancelled" size="medium" />
        </div>
      </div>
    </div>
  ),
};
