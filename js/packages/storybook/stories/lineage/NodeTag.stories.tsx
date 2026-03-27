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
// All Types Overview
// ============================================

export const AllTypes: Story = {
  name: "All Types",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Resource Types</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            "model",
            "source",
            "seed",
            "snapshot",
            "metric",
            "exposure",
            "semantic_model",
          ].map((type) => (
            <div key={type}>
              <NodeTag resourceType={type} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>
          Materializations (model)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            "table",
            "view",
            "incremental",
            "ephemeral",
            "materialized_view",
            "dynamic_table",
            "streaming_table",
          ].map((type) => (
            <div key={type}>
              <NodeTag resourceType="model" materialized={type} />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
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
