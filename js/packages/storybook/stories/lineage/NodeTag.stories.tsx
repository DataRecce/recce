import { NodeTag } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof NodeTag> = {
  title: "Lineage/NodeTag",
  component: NodeTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays the dbt resource type or materialization strategy as a pill-shaped tag with an icon. For model nodes with a materialization, shows the materialization (table, view, incremental, etc.). For all other resource types, shows the resource type.",
      },
    },
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof NodeTag>;

// ============================================
// Resource Types
// ============================================

export const Model: Story = {
  args: { resourceType: "model" },
};

export const Source: Story = {
  args: { resourceType: "source" },
};

export const Seed: Story = {
  args: { resourceType: "seed" },
};

export const Snapshot: Story = {
  args: { resourceType: "snapshot" },
};

export const Metric: Story = {
  args: { resourceType: "metric" },
};

export const Exposure: Story = {
  args: { resourceType: "exposure" },
};

export const SemanticModel: Story = {
  name: "Semantic Model",
  args: { resourceType: "semantic_model" },
};

// ============================================
// Model with Materialization
// ============================================

export const ModelTable: Story = {
  name: "Model — table",
  args: { resourceType: "model", materialized: "table" },
};

export const ModelView: Story = {
  name: "Model — view",
  args: { resourceType: "model", materialized: "view" },
};

export const ModelIncremental: Story = {
  name: "Model — incremental",
  args: { resourceType: "model", materialized: "incremental" },
};

export const ModelEphemeral: Story = {
  name: "Model — ephemeral",
  args: { resourceType: "model", materialized: "ephemeral" },
};

export const ModelMaterializedView: Story = {
  name: "Model — materialized view",
  args: { resourceType: "model", materialized: "materialized_view" },
};

// ============================================
// Edge Cases
// ============================================

export const UnknownResourceType: Story = {
  name: "Unknown Resource Type",
  args: { resourceType: "unknown_type" },
};

export const UnknownMaterialization: Story = {
  name: "Unknown Materialization",
  args: { resourceType: "model", materialized: "custom_materialization" },
};

export const Undefined: Story = {
  name: "Undefined",
  args: {},
};

// ============================================
// All Types Overview
// ============================================

export const AllResourceTypes: Story = {
  name: "All Resource Types",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[
        "model",
        "source",
        "seed",
        "snapshot",
        "metric",
        "exposure",
        "semantic_model",
      ].map((type) => (
        <div
          key={type}
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
        >
          <NodeTag resourceType={type} />
        </div>
      ))}
    </div>
  ),
};

export const AllMaterializations: Story = {
  name: "All Materializations (model)",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {["table", "view", "incremental", "ephemeral", "materialized_view"].map(
        (type) => (
          <div
            key={type}
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <NodeTag resourceType="model" materialized={type} />
          </div>
        ),
      )}
    </div>
  ),
};
