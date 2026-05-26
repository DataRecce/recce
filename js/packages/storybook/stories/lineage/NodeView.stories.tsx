/**
 * @file NodeView.stories.tsx
 * @description Stories for the NodeView component — the node detail sidebar
 * rendered when a user focuses a lineage graph node.
 *
 * Renders the real NodeView, the real SchemaView (ag-grid), the real
 * registry icons, and the real NodeTag primitive. SchemaView is wrapped in
 * QueryClientProvider + MockLineageProvider so its server-flag query and
 * lineage context lookups resolve against MSW fixtures.
 */

import type {
  NodeViewActionCallbacks,
  NodeViewNodeData,
  NodeViewProps,
  RunTypeIconMap,
} from "@datarecce/ui/advanced";
import { NodeView, RowCountSummary } from "@datarecce/ui/advanced";
import type { RowCount, RowCountDiff } from "@datarecce/ui/api";
import {
  findByRunType,
  SchemaView,
  SingleEnvSchemaView,
} from "@datarecce/ui/components";
import { NodeTag } from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fn } from "storybook/test";
import { MockLineageProvider } from "../mocks/MockProviders";

// =============================================================================
// REAL REGISTRY ICONS (no stubbing)
// =============================================================================

const runTypeIcons: RunTypeIconMap = {
  query: findByRunType("query").icon,
  row_count: findByRunType("row_count").icon,
  row_count_diff: findByRunType("row_count_diff").icon,
  profile: findByRunType("profile").icon,
  profile_diff: findByRunType("profile_diff").icon,
  query_diff: findByRunType("query_diff").icon,
  value_diff: findByRunType("value_diff").icon,
  top_k_diff: findByRunType("top_k_diff").icon,
  histogram_diff: findByRunType("histogram_diff").icon,
  schema_diff: findByRunType("schema_diff").icon,
};

// =============================================================================
// STUB COMPONENTS (minimal — only the bits that need it)
// =============================================================================

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

/** Real `NodeTag` from primitives — no stubbing. */
function ResourceTypeTag({ node }: { node: NodeViewNodeData }) {
  return (
    <NodeTag
      resourceType={node.data.resourceType}
      materialized={node.data.materialized}
    />
  );
}

// =============================================================================
// FIXTURE FACTORY
// =============================================================================

function createStoryArgs(
  overrides: {
    baseColumns?: Record<string, { name: string; type: string }>;
    currentColumns?: Record<string, { name: string; type: string }>;
    baseCode?: string;
    currentCode?: string;
    name?: string;
    resourceType?: string;
    changeStatus?: string;
    materialized?: string;
    baseMaterialized?: string;
    rowCountDiff?: RowCountDiff;
    rowCount?: RowCount;
  } = {},
): {
  node: NodeViewNodeData;
  modelDetail: NodeViewProps["modelDetail"];
  rowCountDisplay?: React.ReactNode;
} {
  const baseMat = overrides.baseMaterialized ?? overrides.materialized;
  const baseConfig = baseMat ? { materialized: baseMat } : undefined;
  const currentConfig = overrides.materialized
    ? { materialized: overrides.materialized }
    : undefined;

  const node: NodeViewNodeData = {
    id: `model.jaffle_shop.${overrides.name ?? "stg_orders"}`,
    data: {
      name: overrides.name ?? "stg_orders",
      resourceType: overrides.resourceType ?? "model",
      changeStatus: overrides.changeStatus,
      materialized: overrides.materialized,
    },
  };

  const resourceType = overrides.resourceType ?? "model";

  const modelDetail: NodeViewProps["modelDetail"] = {
    base: {
      id: node.id,
      unique_id: node.id,
      name: node.data.name,
      resource_type: resourceType,
      raw_code: overrides.baseCode ?? "SELECT * FROM raw.orders",
      columns: overrides.baseColumns ?? {
        order_id: { name: "order_id", type: "integer" },
        customer_id: { name: "customer_id", type: "integer" },
        order_date: { name: "order_date", type: "date" },
      },
      config: baseConfig,
    },
    current: {
      id: node.id,
      unique_id: node.id,
      name: node.data.name,
      resource_type: resourceType,
      raw_code: overrides.currentCode ?? "SELECT * FROM raw.orders",
      columns: overrides.currentColumns ?? {
        order_id: { name: "order_id", type: "integer" },
        customer_id: { name: "customer_id", type: "integer" },
        order_date: { name: "order_date", type: "date" },
      },
      config: currentConfig,
    },
  };

  const rc = overrides.rowCountDiff ?? overrides.rowCount;
  const rowCountDisplay: React.ReactNode | undefined = rc ? (
    <RowCountSummary rowCount={rc} />
  ) : undefined;

  return { node, modelDetail, rowCountDisplay };
}

const noopCallbacks: NodeViewActionCallbacks = {
  onQueryClick: fn(),
  onRowCountClick: fn(),
  onRowCountDiffClick: fn(),
  onProfileClick: fn(),
  onProfileDiffClick: fn(),
  onQueryDiffClick: fn(),
  onValueDiffClick: fn(),
  onTopKDiffClick: fn(),
  onHistogramDiffClick: fn(),
  onAddSchemaDiffClick: fn(),
};

// =============================================================================
// META
// =============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
  },
});

const meta: Meta<typeof NodeView> = {
  title: "Lineage/NodeView",
  component: NodeView,
  parameters: {
    docs: {
      description: {
        component:
          "Node detail sidebar — header row (name, type tag, close), action buttons for diffs/queries, and tabbed Columns/Code content. Renders the real NodeView and real SchemaView. Story is wrapped in QueryClientProvider + MockLineageProvider so SchemaView's server-flag query and lineage lookups resolve against MSW fixtures.",
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <MockLineageProvider>
          <Paper
            elevation={2}
            sx={{
              width: 560,
              height: 640,
              overflow: "hidden",
              borderRadius: 1,
            }}
          >
            <Story />
          </Paper>
        </MockLineageProvider>
      </QueryClientProvider>
    ),
  ],
  args: {
    onCloseNode: fn(),
    isSingleEnv: false,
    SchemaView,
    SingleEnvSchemaView,
    NodeSqlView: StubNodeSqlView,
    ResourceTypeTag,
    runTypeIcons,
    actionCallbacks: noopCallbacks,
  },
};

export default meta;
type Story = StoryObj<typeof NodeView>;

// =============================================================================
// STORIES
// =============================================================================

/**
 * Default: matches the production sidebar for a table-materialized model in
 * multi-env mode with row-count data available. Mirrors the reference
 * screenshot (finance_revenue, N/A → 280,844 rows, table materialization).
 */
export const Default: Story = {
  args: {
    ...createStoryArgs({
      name: "finance_revenue",
      materialized: "table",
      rowCountDiff: { base: null, curr: 280844 },
      baseColumns: {
        order_id: { name: "order_id", type: "integer" },
        customer_id: { name: "customer_id", type: "integer" },
        revenue: { name: "revenue", type: "numeric" },
      },
      currentColumns: {
        order_id: { name: "order_id", type: "integer" },
        customer_id: { name: "customer_id", type: "integer" },
        revenue: { name: "revenue", type: "numeric" },
        status: { name: "status", type: "varchar" },
      },
    }),
  },
};

/** No row count data yet — Row Count button shows just "Row Count". */
export const NoRowCountData: Story = {
  args: {
    ...createStoryArgs({ name: "finance_revenue", materialized: "table" }),
  },
};

/** View materialization (instead of table). */
export const ViewMaterialization: Story = {
  args: {
    ...createStoryArgs({
      name: "stg_customers",
      materialized: "view",
      rowCountDiff: { base: 1000, curr: 1200 },
    }),
  },
};

/** Single env mode — fewer buttons, no "Diff" section. */
export const SingleEnvMode: Story = {
  args: {
    isSingleEnv: true,
    ...createStoryArgs({
      name: "stg_orders",
      materialized: "table",
      rowCount: { curr: 99231 },
      baseCode: "SELECT 1",
      currentCode: "SELECT 2",
    }),
  },
};

/** Schema changed — dot indicator on Columns tab, added/removed rows highlighted. */
export const SchemaChanged: Story = {
  args: {
    ...createStoryArgs({
      name: "stg_orders",
      materialized: "table",
      rowCountDiff: { base: 99000, curr: 99231 },
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

/** Code changed — dot indicator on Code tab. */
export const CodeChanged: Story = {
  args: {
    ...createStoryArgs({
      name: "stg_orders",
      materialized: "table",
      changeStatus: "modified",
      rowCountDiff: { base: 99000, curr: 99231 },
      baseCode: "SELECT * FROM raw.orders",
      currentCode: "SELECT * FROM raw.orders WHERE status != 'deleted'",
    }),
  },
};

/** Materialization changed (view → table). */
export const MaterializationChanged: Story = {
  args: {
    ...createStoryArgs({
      name: "stg_orders",
      baseMaterialized: "view",
      materialized: "table",
      changeStatus: "modified",
      rowCountDiff: { base: 1000, curr: 1200 },
    }),
  },
};
