import { ResourceTypeTag } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ResourceTypeTag> = {
  title: "Lineage/ResourceTypeTag",
  component: ResourceTypeTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays the dbt resource type as a pill-shaped tag with an icon. Used in lineage graph nodes to indicate whether a node is a model, source, seed, snapshot, etc.",
      },
    },
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ResourceTypeTag>;

// ============================================
// Individual Resource Types
// ============================================

export const Model: Story = {
  args: { data: { resourceType: "model" } },
};

export const Source: Story = {
  args: { data: { resourceType: "source" } },
};

export const Seed: Story = {
  args: { data: { resourceType: "seed" } },
};

export const Snapshot: Story = {
  args: { data: { resourceType: "snapshot" } },
};

export const Metric: Story = {
  args: { data: { resourceType: "metric" } },
};

export const Exposure: Story = {
  args: { data: { resourceType: "exposure" } },
};

export const SemanticModel: Story = {
  name: "Semantic Model",
  args: { data: { resourceType: "semantic_model" } },
};

// ============================================
// Edge Cases
// ============================================

export const Unknown: Story = {
  name: "Unknown Type",
  args: { data: { resourceType: "unknown_type" } },
};

export const Undefined: Story = {
  name: "Undefined",
  args: { data: {} },
};

// ============================================
// All Types Overview
// ============================================

export const AllTypes: Story = {
  name: "All Resource Types",
  parameters: {
    docs: {
      description: {
        story: "Side-by-side comparison of all supported resource types.",
      },
    },
  },
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
          <ResourceTypeTag data={{ resourceType: type }} />
        </div>
      ))}
    </div>
  ),
};
