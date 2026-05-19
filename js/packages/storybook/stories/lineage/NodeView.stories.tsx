/**
 * @file NodeView.stories.tsx
 * @description Stories for the NodeView component — the node detail sidebar
 * rendered when a user focuses a lineage graph node.
 *
 * Renders the real NodeView and the real SchemaView (ag-grid), wrapped in
 * QueryClientProvider + MockLineageProvider so the server-flag query and
 * lineage context lookups resolve against MSW fixtures. Each story supplies
 * row-count fixture data via `parameters.mockRunsAggregated`, which the
 * meta-level decorator threads into `MockLineageProvider` so the production
 * `RowCountDiffTag` / `RowCountTag` render with realistic values (no
 * story-side reimplementation of tag visuals).
 */

import type {
  NodeViewActionCallbacks,
  NodeViewNodeData,
  NodeViewProps,
  RunTypeIconMap,
} from "@datarecce/ui/advanced";
import { NodeView, RowCountDiffTag, RowCountTag } from "@datarecce/ui/advanced";
import type { RowCount, RowCountDiff, RunsAggregated } from "@datarecce/ui/api";
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
import type { ComponentType } from "react";
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
  sandbox: findByRunType("sandbox").icon,
};

// =============================================================================
// STUB COMPONENTS
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

/** Empty Sandbox dialog stub. Story never opens the sandbox. */
function StubSandboxDialog() {
  return null;
}

// Real `RowCountDiffTag` / `RowCountTag` are typed against `LineageGraphNode`
// (full lineage shape). The story uses the lighter `NodeViewNodeData` for its
// fixture nodes. The real components only read `node.id`, so this cast is
// sound — the runtime contract is satisfied by the story fixtures.
type NodeTagComponent = ComponentType<{
  node: NodeViewNodeData;
  onRefresh?: () => void;
}>;
const RealRowCountDiffTag = RowCountDiffTag as unknown as NodeTagComponent;
const RealRowCountTag = RowCountTag as unknown as NodeTagComponent;

// =============================================================================
// FIXTURE FACTORY
// =============================================================================

interface FixtureOverrides {
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
}

interface Fixture {
  node: NodeViewNodeData;
  modelDetail: NodeViewProps["modelDetail"];
  runsAggregated?: RunsAggregated;
}

function buildFixture(overrides: FixtureOverrides = {}): Fixture {
  const baseMat = overrides.baseMaterialized ?? overrides.materialized;
  const baseConfig = baseMat ? { materialized: baseMat } : undefined;
  const currentConfig = overrides.materialized
    ? { materialized: overrides.materialized }
    : undefined;
  const resourceType = overrides.resourceType ?? "model";

  const node: NodeViewNodeData = {
    id: `model.jaffle_shop.${overrides.name ?? "stg_orders"}`,
    data: {
      name: overrides.name ?? "stg_orders",
      resourceType,
      changeStatus: overrides.changeStatus,
      materialized: overrides.materialized,
    },
  };

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

  // Build the runsAggregated entry keyed by node.id only if the story
  // supplied row-count fixture data. The real RowCountDiffTag / RowCountTag
  // read these slots directly from LineageGraphProvider's `runsAggregated`.
  // `value_diff` is required by the RunsAggregated type but the row-count tags
  // never read it — pass an empty result.
  let runsAggregated: RunsAggregated | undefined;
  if (overrides.rowCountDiff || overrides.rowCount) {
    runsAggregated = {
      [node.id]: {
        row_count_diff: {
          run_id: "story-row-count-diff",
          result: overrides.rowCountDiff,
        },
        row_count: {
          run_id: "story-row-count",
          result: overrides.rowCount,
        },
        value_diff: {
          run_id: "story-value-diff",
          result: undefined,
        },
      },
    };
  }

  return { node, modelDetail, runsAggregated };
}

/**
 * Build a complete Story from fixture overrides and optional NodeView arg
 * overrides. Splits row-count data into `parameters.mockRunsAggregated` so
 * the meta-level decorator can plumb it into `MockLineageProvider`.
 */
function makeStory(
  overrides: FixtureOverrides,
  argOverrides: Partial<NodeViewProps> = {},
): Story {
  const { node, modelDetail, runsAggregated } = buildFixture(overrides);
  return {
    args: { node, modelDetail, ...argOverrides },
    parameters: { mockRunsAggregated: runsAggregated },
  };
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
  onSandboxClick: fn(),
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
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Node detail sidebar — header row (name, action buttons, close), tags row (resource type, row count), action buttons for diffs/queries, and tabbed Columns/Code content. Renders the real NodeView, SchemaView, RowCountDiffTag, and RowCountTag. Story is wrapped in QueryClientProvider + MockLineageProvider so SchemaView's server-flag query and the row-count tags' lineage lookups resolve against MSW fixtures.",
      },
    },
  },
  decorators: [
    (Story, context) => {
      const runsAggregated = context.parameters.mockRunsAggregated as
        | RunsAggregated
        | undefined;
      return (
        <QueryClientProvider client={queryClient}>
          <MockLineageProvider runsAggregated={runsAggregated}>
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
      );
    },
  ],
  args: {
    onCloseNode: fn(),
    isSingleEnv: false,
    SchemaView,
    SingleEnvSchemaView,
    NodeSqlView: StubNodeSqlView,
    ResourceTypeTag,
    RowCountDiffTag: RealRowCountDiffTag,
    RowCountTag: RealRowCountTag,
    SandboxDialog: StubSandboxDialog,
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
 * multi-env mode with row-count data available.
 */
export const Default: Story = makeStory({
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
});

/** No row count data yet — Row Count tag shows just "row count". */
export const NoRowCountData: Story = makeStory({
  name: "finance_revenue",
  materialized: "table",
});

/** View materialization (instead of table). */
export const ViewMaterialization: Story = makeStory({
  name: "stg_customers",
  materialized: "view",
  rowCountDiff: { base: 1000, curr: 1200 },
});

/** Single env mode — fewer buttons, no "Diff" section. */
export const SingleEnvMode: Story = makeStory(
  {
    name: "stg_orders",
    materialized: "table",
    rowCount: { curr: 99231 },
    baseCode: "SELECT 1",
    currentCode: "SELECT 2",
  },
  { isSingleEnv: true },
);

/** Schema changed — dot indicator on Columns tab, added/removed rows highlighted. */
export const SchemaChanged: Story = makeStory({
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
});

/** Code changed — dot indicator on Code tab. */
export const CodeChanged: Story = makeStory({
  name: "stg_orders",
  materialized: "table",
  changeStatus: "modified",
  rowCountDiff: { base: 99000, curr: 99231 },
  baseCode: "SELECT * FROM raw.orders",
  currentCode: "SELECT * FROM raw.orders WHERE status != 'deleted'",
});

/** Materialization changed (view → table). */
export const MaterializationChanged: Story = makeStory({
  name: "stg_orders",
  baseMaterialized: "view",
  materialized: "table",
  changeStatus: "modified",
  rowCountDiff: { base: 1000, curr: 1200 },
});
