import type { NodeViewNodeData, NodeViewProps } from "@datarecce/ui/advanced";
import { NodeView } from "@datarecce/ui/advanced";
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

function StubSchemaView({
  base,
  current,
}: {
  base?: Record<string, unknown>;
  current?: Record<string, unknown>;
}) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Schema diff view — base has {base ? Object.keys(base).length : 0}{" "}
        columns, current has {current ? Object.keys(current).length : 0} columns
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
  } = {},
): NodeViewNodeData {
  return {
    id: "model.jaffle_shop.stg_orders",
    data: {
      name: overrides.name ?? "stg_orders",
      resourceType: overrides.resourceType ?? "model",
      changeStatus: overrides.changeStatus,
      data: {
        base: {
          name: "stg_orders",
          raw_code: overrides.baseCode ?? "SELECT * FROM raw.orders",
          columns: overrides.baseColumns ?? {
            order_id: { name: "order_id", type: "integer" },
            customer_id: { name: "customer_id", type: "integer" },
            order_date: { name: "order_date", type: "date" },
          },
        },
        current: {
          name: "stg_orders",
          raw_code: overrides.currentCode ?? "SELECT * FROM raw.orders",
          columns: overrides.currentColumns ?? {
            order_id: { name: "order_id", type: "integer" },
            customer_id: { name: "customer_id", type: "integer" },
            order_date: { name: "order_date", type: "date" },
          },
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
    node: createNode(),
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
