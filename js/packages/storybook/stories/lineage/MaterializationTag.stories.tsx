import { MaterializationTag } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof MaterializationTag> = {
  title: "Lineage/MaterializationTag",
  component: MaterializationTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays the dbt materialization strategy as a pill-shaped tag with an icon. Used on model nodes to indicate whether a model is materialized as a table, view, incremental, ephemeral, or materialized view.",
      },
    },
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof MaterializationTag>;

// ============================================
// Individual Materialization Types
// ============================================

export const Table: Story = {
  args: { data: { materialized: "table" } },
};

export const View: Story = {
  args: { data: { materialized: "view" } },
};

export const Incremental: Story = {
  args: { data: { materialized: "incremental" } },
};

export const Ephemeral: Story = {
  args: { data: { materialized: "ephemeral" } },
};

export const MaterializedView: Story = {
  name: "Materialized View",
  args: { data: { materialized: "materialized_view" } },
};

// ============================================
// Edge Cases
// ============================================

export const Unknown: Story = {
  name: "Unknown Type",
  args: { data: { materialized: "custom_materialization" } },
};

export const Undefined: Story = {
  name: "Undefined",
  args: { data: {} },
};

// ============================================
// All Types Overview
// ============================================

export const AllTypes: Story = {
  name: "All Materialization Types",
  parameters: {
    docs: {
      description: {
        story:
          "Side-by-side comparison of all supported materialization types.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {["table", "view", "incremental", "ephemeral", "materialized_view"].map(
        (type) => (
          <div
            key={type}
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <MaterializationTag data={{ materialized: type }} />
          </div>
        ),
      )}
    </div>
  ),
};
