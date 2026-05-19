/**
 * @file NodeView.stories.tsx
 * @description Stories for the NodeView component — the node detail sidebar
 * rendered when a user focuses a lineage graph node.
 *
 * Renders the real NodeView and the real SchemaView (ag-grid). SchemaView is
 * wrapped in QueryClientProvider + MockLineageProvider so its server-flag
 * query and lineage context lookups resolve against MSW fixtures. The
 * RowCountDiffTag / RowCountTag / SandboxDialog injection slots take light
 * inline stubs (chips and an empty dialog) so the layout demonstrates the
 * sidebar at parity with production without depending on app-level contexts.
 */

import type {
  NodeViewActionCallbacks,
  NodeViewNodeData,
  NodeViewProps,
  RunTypeIconMap,
} from "@datarecce/ui/advanced";
import { NodeView } from "@datarecce/ui/advanced";
import type { RowCount, RowCountDiff } from "@datarecce/ui/api";
import {
  findByRunType,
  SchemaView,
  SingleEnvSchemaView,
} from "@datarecce/ui/components";
import { NodeTag } from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { FiArrowRight } from "react-icons/fi";
import { RiArrowDownSFill, RiArrowUpSFill, RiSwapLine } from "react-icons/ri";
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

// =============================================================================
// ROW-COUNT TAG STUB FACTORIES
// =============================================================================
// Production RowCountDiffTag / RowCountTag read from runsAggregated context.
// In stories we close over fixture data so the chip renders without wiring up
// a real run-results context.

function makeRowCountDiffTag(
  rowCount?: RowCountDiff,
): ComponentType<{ node: NodeViewNodeData; onRefresh?: () => void }> {
  return function StubRowCountDiffTag() {
    if (!rowCount) {
      return <Chip size="small" variant="outlined" label="row count" />;
    }
    const { base, curr } = rowCount;
    const baseLabel = base === null ? "N/A" : `${base} rows`;
    const currLabel = curr === null ? "N/A" : `${curr} rows`;

    let content: React.ReactNode;
    if (base === null && curr === null) {
      content = <span>Failed to load</span>;
    } else if (base === null || curr === null) {
      content = (
        <Stack
          component="span"
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center" }}
        >
          <span>{baseLabel}</span>
          <FiArrowRight />
          <span>{currLabel}</span>
        </Stack>
      );
    } else if (base === curr) {
      content = (
        <Stack
          component="span"
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center" }}
        >
          <span>{currLabel}</span>
          <Box component="span" sx={{ color: "grey.500", display: "flex" }}>
            <RiSwapLine />
          </Box>
        </Stack>
      );
    } else {
      const Arrow = base < curr ? RiArrowUpSFill : RiArrowDownSFill;
      const tone = base < curr ? "success.main" : "error.main";
      const pct = Math.round(((curr - base) / base) * 100);
      content = (
        <Stack
          component="span"
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center" }}
        >
          <span>{currLabel}</span>
          <Box component="span" sx={{ color: tone, display: "flex" }}>
            <Arrow />
          </Box>
          <Box component="span" sx={{ color: tone }}>
            {pct > 0 ? "+" : ""}
            {pct}%
          </Box>
        </Stack>
      );
    }
    return <Chip size="small" variant="outlined" label={content} />;
  };
}

function makeRowCountTag(
  rowCount?: RowCount,
): ComponentType<{ node: NodeViewNodeData; onRefresh?: () => void }> {
  return function StubRowCountTag() {
    if (!rowCount) {
      return <Chip size="small" variant="outlined" label="row count" />;
    }
    const label = rowCount.curr === null ? "N/A" : `${rowCount.curr} rows`;
    return <Chip size="small" variant="outlined" label={label} />;
  };
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
  RowCountDiffTag: ComponentType<{
    node: NodeViewNodeData;
    onRefresh?: () => void;
  }>;
  RowCountTag: ComponentType<{
    node: NodeViewNodeData;
    onRefresh?: () => void;
  }>;
} {
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

  return {
    node,
    modelDetail,
    RowCountDiffTag: makeRowCountDiffTag(overrides.rowCountDiff),
    RowCountTag: makeRowCountTag(overrides.rowCount),
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
          "Node detail sidebar — header row (name, action buttons, close), tags row (resource type, row count), action buttons for diffs/queries, and tabbed Columns/Code content. Renders the real NodeView and real SchemaView. Story is wrapped in QueryClientProvider + MockLineageProvider so SchemaView's server-flag query and lineage lookups resolve against MSW fixtures.",
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

/** No row count data yet — Row Count tag shows just "row count". */
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
