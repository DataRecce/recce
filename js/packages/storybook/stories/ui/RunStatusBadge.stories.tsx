import { RunStatusBadge } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof RunStatusBadge> = {
  title: "Primitives/RunStatusBadge",
  component: RunStatusBadge,
  parameters: {
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
  },
};

export default meta;
type Story = StoryObj<typeof RunStatusBadge>;

export const Default: Story = {
  args: {
    status: "Running",
    showSpinner: true,
  },
};

export const AllStatuses: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Running" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Blue — In Progress
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Finished" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Green — Completed Successfully
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Failed" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Red — Error Occurred
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Cancelled" />
        <span style={{ fontSize: "12px", color: "#666" }}>
          Grey — User Cancelled
        </span>
      </div>
    </div>
  ),
};

export const InRunList: Story = {
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
