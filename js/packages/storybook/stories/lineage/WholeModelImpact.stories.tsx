import type {
  NodeViewNodeData,
  NodeViewProps,
  SchemaViewProps,
} from "@datarecce/ui/advanced";
import { NodeView } from "@datarecce/ui/advanced";
import { LineageNode, NodeTag } from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReactFlowProvider } from "@xyflow/react";
import { fn } from "storybook/test";

/**
 * @file WholeModelImpact.stories.tsx
 * @description Visual smoke for the DRC-3341 whole-model treatment.
 *
 * Six stories, one dimension of variation each:
 * - NodeView: changed, impacted, additive title chip + badge + stripe
 * - LineageNode: changed, impacted, additive graph badge
 */

// =============================================================================
// STUB COMPONENTS for NodeView stories
// =============================================================================

function StubSchemaView({ base, current }: SchemaViewProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Schema diff view — base has{" "}
        {base?.columns ? Object.keys(base.columns).length : 0} columns, current
        has {current?.columns ? Object.keys(current.columns).length : 0} columns
      </Typography>
    </Box>
  );
}

function StubNodeSqlView({
  modelDetail,
}: {
  node: NodeViewNodeData;
  modelDetail?: NodeViewProps["modelDetail"];
}) {
  const base = modelDetail?.base?.raw_code ?? "(none)";
  const current = modelDetail?.current?.raw_code ?? "(none)";
  return (
    <Box sx={{ p: 2, fontFamily: "monospace", fontSize: "0.85rem" }}>
      <Typography variant="subtitle2" gutterBottom>
        Base
      </Typography>
      <pre style={{ margin: 0 }}>{base}</pre>
      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
        Current
      </Typography>
      <pre style={{ margin: 0 }}>{current}</pre>
    </Box>
  );
}

function ResourceTypeTag({ node }: { node: NodeViewNodeData }) {
  return (
    <NodeTag
      resourceType={node.data.resourceType}
      materialized={node.data.materialized}
    />
  );
}

// =============================================================================
// NODEVIEW FIXTURE
// =============================================================================

const nodeViewNode: NodeViewNodeData = {
  id: "model.jaffle_shop.stg_orders",
  data: {
    name: "stg_orders",
    resourceType: "model",
    changeStatus: "modified",
    materialized: "table",
  },
};

const nodeViewModelDetail: NodeViewProps["modelDetail"] = {
  base: {
    id: "stg_orders",
    unique_id: "model.jaffle_shop.stg_orders",
    name: "stg_orders",
    raw_code: "SELECT * FROM raw.orders",
    columns: {
      order_id: { name: "order_id", type: "integer" },
      customer_id: { name: "customer_id", type: "integer" },
      order_date: { name: "order_date", type: "date" },
    },
    config: { materialized: "table" },
  },
  current: {
    id: "stg_orders",
    unique_id: "model.jaffle_shop.stg_orders",
    name: "stg_orders",
    raw_code: "SELECT * FROM raw.orders WHERE status != 'deleted'",
    columns: {
      order_id: { name: "order_id", type: "integer" },
      customer_id: { name: "customer_id", type: "integer" },
      order_date: { name: "order_date", type: "date" },
    },
    config: { materialized: "table" },
  },
};

// =============================================================================
// LINEAGENODE FIXTURE
// =============================================================================

const lineageNodeBaseProps = {
  id: "model.jaffle_shop.stg_orders",
  data: {
    label: "stg_orders",
    resourceType: "model",
    materialized: "table",
    changeStatus: "modified" as const,
  },
  hasParents: true,
  hasChildren: true,
  showContent: true,
  wholeModelImpact: true,
};

// =============================================================================
// META
// =============================================================================

const meta: Meta = {
  title: "Lineage/WholeModelImpact",
  parameters: {
    docs: {
      description: {
        component:
          "Visual smoke for the DRC-3341 whole-model treatment across two surfaces: NodeView (title chip + left stripe for whole-model kinds) and LineageNode (ADD / COLUMN graph badge for per-column kinds).",
      },
    },
  },
};

export default meta;

// =============================================================================
// NODEVIEW STORIES — Layer 4.3 surfaces (title chip + badge + stripe)
// =============================================================================

type NodeViewStory = StoryObj<typeof NodeView>;

const nodeViewDecorator: Meta["decorators"] = [
  (Story) => (
    <Box sx={{ width: 400, height: 500, border: 1, borderColor: "divider" }}>
      <Story />
    </Box>
  ),
];

const baseNodeViewArgs: Partial<NodeViewProps<NodeViewNodeData>> = {
  node: nodeViewNode,
  modelDetail: nodeViewModelDetail,
  onCloseNode: fn(),
  isSingleEnv: false,
  SchemaView: StubSchemaView,
  NodeSqlView: StubNodeSqlView,
  ResourceTypeTag,
  wholeModelImpact: true,
};

/** Brown title chip + brown left stripe for a whole-model-changed model. */
export const NodeView_ChangedTitleChip: NodeViewStory = {
  render: (args) => <NodeView {...(args as NodeViewProps<NodeViewNodeData>)} />,
  args: {
    ...baseNodeViewArgs,
    isWholeModelChanged: true,
  },
  decorators: nodeViewDecorator,
};

/** Amber title chip + amber left stripe for a whole-model-impacted model. */
export const NodeView_ImpactedTitleChip: NodeViewStory = {
  render: (args) => <NodeView {...(args as NodeViewProps<NodeViewNodeData>)} />,
  args: {
    ...baseNodeViewArgs,
    isWholeModelImpacted: true,
  },
  decorators: nodeViewDecorator,
};

// Additive (non_breaking) changes don't get a NodeView treatment — they
// are per-column, not whole-table. The [ADD] badge still appears on the
// LineageNode graph (see LineageNode_AdditiveBadge below).

// =============================================================================
// LINEAGENODE STORIES — Layer 4.1 surface (graph badge)
// =============================================================================

type LineageNodeStory = StoryObj<typeof LineageNode>;

const lineageNodeDecorator: Meta["decorators"] = [
  (Story) => (
    <ReactFlowProvider>
      <Box
        sx={{
          width: 320,
          p: 2,
          "& .react-flow__handle": { display: "none" },
        }}
      >
        <Story />
      </Box>
    </ReactFlowProvider>
  ),
];

// Whole-model kinds (isWholeModelChanged / isWholeModelImpacted) intentionally
// render no graph badge on LineageNode — that signal lives on NodeView's
// title chip + stripe (see NodeView_ChangedTitleChip / NodeView_ImpactedTitleChip).

/** Green ADD badge for an additive-only model (change_category === "non_breaking"). */
export const LineageNode_AdditiveBadge: LineageNodeStory = {
  render: (args) => <LineageNode {...args} />,
  args: {
    ...lineageNodeBaseProps,
    changeCategory: "non_breaking",
  },
  decorators: lineageNodeDecorator,
};

/** Brown COLUMN badge for a model with its own column-only change (change_category === "partial_breaking"). */
export const LineageNode_ColumnChangedBadge: LineageNodeStory = {
  render: (args) => <LineageNode {...args} />,
  args: {
    ...lineageNodeBaseProps,
    changeCategory: "partial_breaking",
  },
  decorators: lineageNodeDecorator,
};

/** Amber COLUMN badge for a model downstream of a column-only change (isImpacted, no own change). */
export const LineageNode_ColumnImpactedBadge: LineageNodeStory = {
  render: (args) => <LineageNode {...args} />,
  args: {
    ...lineageNodeBaseProps,
    isImpacted: true,
  },
  decorators: lineageNodeDecorator,
};
