import type {
  NodeViewNodeData,
  NodeViewProps,
  SchemaViewProps,
} from "@datarecce/ui/advanced";
import { NodeView } from "@datarecce/ui/advanced";
import { NodeTag } from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

/**
 * @file NodeView.stories.tsx
 * @description Stories for the NodeView component, focusing on the
 * tab change indicators (blue dot on Columns/Code tabs when diffs exist).
 */

// =============================================================================
// STUB COMPONENTS
// =============================================================================

function StubSchemaView({ base, current }: SchemaViewProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Schema diff view — base has{" "}
        {base?.columns ? Object.keys(base.columns).length : 0} columns, current
        has {current?.columns ? Object.keys(current.columns).length : 0} columns
      </Typography>
    </Box>
  );
}

function StubNodeSqlView({ node }: { node: NodeViewNodeData }) {
  const base = node.data.data.base?.raw_code ?? "(none)";
  const current = node.data.data.current?.raw_code ?? "(none)";
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
  const materialized =
    node.data.data.current?.config?.materialized ??
    node.data.data.base?.config?.materialized;

  return (
    <NodeTag
      resourceType={node.data.resourceType}
      materialized={materialized}
    />
  );
}

// =============================================================================
// FIXTURE FACTORIES
// =============================================================================

function createNode(
  overrides: {
    baseColumns?: Record<string, { name: string; type: string }>;
    currentColumns?: Record<string, { name: string; type: string }>;
    baseCode?: string;
    currentCode?: string;
    name?: string;
    resourceType?: string;
    changeStatus?: string;
    materialized?: string;
  } = {},
): NodeViewNodeData {
  const config = overrides.materialized
    ? { materialized: overrides.materialized }
    : undefined;

  return {
    id: "model.jaffle_shop.stg_orders",
    data: {
      name: overrides.name ?? "stg_orders",
      resourceType: overrides.resourceType ?? "model",
      changeStatus: overrides.changeStatus,
      data: {
        base: {
          id: "stg_orders",
          unique_id: "model.jaffle_shop.stg_orders",
          name: "stg_orders",
          raw_code: overrides.baseCode ?? "SELECT * FROM raw.orders",
          columns: overrides.baseColumns ?? {
            order_id: { name: "order_id", type: "integer" },
            customer_id: { name: "customer_id", type: "integer" },
            order_date: { name: "order_date", type: "date" },
          },
          config,
        },
        current: {
          id: "stg_orders",
          unique_id: "model.jaffle_shop.stg_orders",
          name: "stg_orders",
          raw_code: overrides.currentCode ?? "SELECT * FROM raw.orders",
          columns: overrides.currentColumns ?? {
            order_id: { name: "order_id", type: "integer" },
            customer_id: { name: "customer_id", type: "integer" },
            order_date: { name: "order_date", type: "date" },
          },
          config,
        },
      },
    },
  };
}

// =============================================================================
// META
// =============================================================================

const meta: Meta<typeof NodeView> = {
  title: "Lineage/NodeView",
  component: NodeView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Node detail panel showing Columns and Code tabs. A blue dot indicator appears on each tab when that view has differences between base and current environments.",
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ width: 400, height: 500, border: 1, borderColor: "divider" }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    onCloseNode: fn(),
    isSingleEnv: false,
    SchemaView: StubSchemaView,
    NodeSqlView: StubNodeSqlView,
    ResourceTypeTag,
  },
};

export default meta;
type Story = StoryObj<typeof NodeView>;

// =============================================================================
// STORIES
// =============================================================================

/** No differences in schema or code — no dots shown on either tab. */
export const NoDifferences: Story = {
  args: {
    node: createNode({ materialized: "view" }),
  },
};

/** Both schema and code have changed — dots on both tabs. */
export const BothChanged: Story = {
  args: {
    node: createNode({
      baseColumns: {
        order_id: { name: "order_id", type: "integer" },
        customer_id: { name: "customer_id", type: "integer" },
      },
      currentColumns: {
        order_id: { name: "order_id", type: "integer" },
        customer_id: { name: "customer_id", type: "integer" },
        status: { name: "status", type: "varchar" },
      },
      baseCode: "SELECT id, customer_id FROM raw.orders",
      currentCode: "SELECT id, customer_id, status FROM raw.orders",
    }),
  },
};

/** Only schema changed (column added) — dot on Columns tab only. */
export const SchemaChangedOnly: Story = {
  args: {
    node: createNode({
      baseColumns: {
        order_id: { name: "order_id", type: "integer" },
      },
      currentColumns: {
        order_id: { name: "order_id", type: "integer" },
        status: { name: "status", type: "varchar" },
      },
    }),
  },
};

/** Only code changed — dot on Code tab only. */
export const CodeChangedOnly: Story = {
  args: {
    node: createNode({
      baseCode: "SELECT * FROM raw.orders",
      currentCode: "SELECT * FROM raw.orders WHERE status != 'deleted'",
    }),
  },
};

/** Column type modification — dot on Columns tab. */
export const ColumnTypeModified: Story = {
  args: {
    node: createNode({
      baseColumns: {
        order_id: { name: "order_id", type: "integer" },
        amount: { name: "amount", type: "integer" },
      },
      currentColumns: {
        order_id: { name: "order_id", type: "integer" },
        amount: { name: "amount", type: "numeric" },
      },
    }),
  },
};

/** Single env mode — no dots shown regardless of data. */
export const SingleEnvMode: Story = {
  args: {
    isSingleEnv: true,
    node: createNode({
      materialized: "table",
      baseCode: "SELECT 1",
      currentCode: "SELECT 2",
      baseColumns: {
        a: { name: "a", type: "integer" },
      },
      currentColumns: {
        a: { name: "a", type: "varchar" },
        b: { name: "b", type: "integer" },
      },
    }),
  },
};

// =============================================================================
// MATERIALIZATION TAG STORIES
// =============================================================================

/** Model materialized as incremental — shows incremental icon in tag row. */
export const IncrementalModel: Story = {
  args: {
    node: createNode({ materialized: "incremental" }),
  },
};

/** Model materialized as table — shows solid cube icon in tag row. */
export const TableModel: Story = {
  args: {
    node: createNode({ materialized: "table" }),
  },
};

/** Model materialized as ephemeral — shows dashed cube icon in tag row. */
export const EphemeralModel: Story = {
  args: {
    node: createNode({ materialized: "ephemeral" }),
  },
};

/** Model materialized as materialized_view — shows cube+eye icon in tag row. */
export const MaterializedViewModel: Story = {
  name: "Materialized View Model",
  args: {
    node: createNode({ materialized: "materialized_view" }),
  },
};

/** Source node — shows resource type tag (no materialization). */
export const SourceNode: Story = {
  args: {
    node: createNode({ resourceType: "source", name: "raw_orders" }),
  },
};
