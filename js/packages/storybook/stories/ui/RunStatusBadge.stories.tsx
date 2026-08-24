import type { Run } from "@datarecce/ui/api";
import { RunResultPane } from "@datarecce/ui/components/run";
import {
  RunListItem,
  RunProgress,
  RunStatusAndDate,
  RunStatusBadge,
} from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useState } from "react";

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
        <span style={{ fontSize: "0.75rem", color: "#666" }}>
          Blue — In Progress
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Finished" />
        <span style={{ fontSize: "0.75rem", color: "#666" }}>
          Neutral — Historical result
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Failed" />
        <span style={{ fontSize: "0.75rem", color: "#666" }}>
          Red — Error Occurred
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <RunStatusBadge status="Cancelled" />
        <span style={{ fontSize: "0.75rem", color: "#666" }}>
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
          <span style={{ fontSize: "0.875rem" }}>{run.name}</span>
          <RunStatusBadge status={run.status} />
        </div>
      ))}
    </div>
  ),
};

const finishedRun = {
  run_id: "finished-run",
  run_at: "2026-08-24T08:00:00.000Z",
  status: "Finished",
  type: "query",
  params: { sql_template: "select 1" },
  result: { columns: [], data: [] },
} as unknown as Run;

function StatusSurfaceContexts({ isDark }: { isDark: boolean }) {
  const [themeSettled, setThemeSettled] = useState(false);

  useLayoutEffect(() => {
    setThemeSettled(false);

    let settleFrame = 0;
    let remainingFrames = 2;
    const settleTheme = () => {
      document.documentElement.classList.toggle("dark", isDark);
      if (remainingFrames > 0) {
        remainingFrames -= 1;
        settleFrame = requestAnimationFrame(settleTheme);
        return;
      }
      setThemeSettled(true);
    };
    settleFrame = requestAnimationFrame(settleTheme);

    return () => cancelAnimationFrame(settleFrame);
  }, [isDark]);

  return (
    <div
      aria-busy={!themeSettled}
      data-theme={isDark ? "dark" : "light"}
      style={{
        backgroundColor: isDark ? "#171717" : "#ffffff",
        color: isDark ? "#f5f5f5" : "#171717",
        display: "grid",
        gap: "1rem",
        minWidth: "48rem",
        padding: "1rem",
        visibility: themeSettled ? "visible" : "hidden",
      }}
    >
      <section data-status-surface="run-list">
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          Run history
        </h3>
        <div style={{ border: "1px solid #a3a3a3", maxWidth: "24rem" }}>
          <RunListItem
            run={{
              id: finishedRun.run_id,
              name: "Customer profile",
              runAt: finishedRun.run_at,
              status: "Finished",
              type: finishedRun.type,
            }}
          />
        </div>
      </section>

      <section data-status-surface="run-progress">
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          Progress completion
        </h3>
        <div style={{ border: "1px solid #a3a3a3", maxWidth: "24rem" }}>
          <RunProgress message="Profile ready for review" status="Finished" />
        </div>
      </section>

      <section data-status-surface="cloud-contract">
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          Published Cloud contract
        </h3>
        <RunStatusAndDate run={finishedRun} />
      </section>

      <section data-status-surface="oss-result-pane" style={{ height: "8rem" }}>
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          OSS result header
        </h3>
        <RunResultPane
          isRunning={false}
          run={finishedRun}
          runId="finished-run"
        />
      </section>
    </div>
  );
}

export const SurfaceContexts: Story = {
  render: (_args, context) => (
    <StatusSurfaceContexts isDark={context.globals.theme === "dark"} />
  ),
};
