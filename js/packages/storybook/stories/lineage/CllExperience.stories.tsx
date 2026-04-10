import type {
  ColumnAnnotation,
  LineageCanvasProps,
  LineageGraphEdge,
  LineageGraphNodes,
} from "@datarecce/ui/advanced";
import {
  buildLineageGraph,
  computeImpactedColumns,
  computeIsImpacted,
  LineageCanvas,
  selectDownstream,
  toReactFlow,
} from "@datarecce/ui/advanced";
import type { ColumnLineageData } from "@datarecce/ui/api";
import type {
  LineageNodeProps,
  NodeChangeStatus,
} from "@datarecce/ui/primitives";
import { LineageNode } from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import lineageData from "./jaffle-shop-expand-lineage.json";

/**
 * @file CllExperience.stories.tsx
 * @description Stories for the new CLL (Column-Level Lineage) experience.
 *
 * The new CLL experience highlights impacted nodes with an amber background
 * instead of dimming non-impacted nodes. These stories allow visual
 * verification and tuning of the amber highlight color.
 *
 * Variant A: Node-level rendering for direct color tuning.
 * Variant B: Full lineage canvas with the jaffle-shop-expand fixture.
 */

const meta: Meta = {
  title: "Lineage/CLL Experience",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `New CLL experience visual verification.

The new CLL experience replaces the "dim non-impacted" approach with an "amber highlight on impacted" approach. Modified nodes keep their standard change-status border color, while impacted (downstream) nodes get an amber background to draw attention.

- **Light mode:** amber[200] background
- **Dark mode:** amber[900] background`,
      },
    },
  },
};

export default meta;

// =============================================================================
// VARIANT A: Node-level stories for color tuning
// =============================================================================

/**
 * Wrapper to render a LineageNode outside of a full ReactFlow graph.
 * ReactFlowProvider is required because LineageNode uses Handle components.
 */
function StandaloneNode(props: LineageNodeProps) {
  return (
    <ReactFlowProvider>
      <Box
        sx={{
          position: "relative",
          width: 320,
          // Hide the handles since they render as dots outside a flow
          "& .react-flow__handle": { display: "none" },
        }}
      >
        <LineageNode {...props} />
      </Box>
    </ReactFlowProvider>
  );
}

/**
 * Side-by-side comparison of impacted vs non-impacted nodes.
 * Useful for tuning the amber highlight color.
 */
function NodeComparisonDemo() {
  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 4 }}>
      <Typography variant="h6">Light Mode</Typography>
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Impacted + Modified (amber bg)
          </Typography>
          <StandaloneNode
            id="model.impacted_modified"
            data={{
              label: "int_order_metrics",
              resourceType: "model",
              changeStatus: "modified",
            }}
            newCllExperience
            isImpacted
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Impacted + Added (amber bg)
          </Typography>
          <StandaloneNode
            id="model.impacted_added"
            data={{
              label: "stg_new_payments",
              resourceType: "model",
              changeStatus: "added",
            }}
            newCllExperience
            isImpacted
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Not Impacted (normal)
          </Typography>
          <StandaloneNode
            id="model.not_impacted"
            data={{
              label: "dim_customers",
              resourceType: "model",
              changeStatus: "unchanged",
            }}
            newCllExperience
            isImpacted={false}
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Impacted + Unchanged (amber bg, no change icon)
          </Typography>
          <StandaloneNode
            id="model.impacted_unchanged"
            data={{
              label: "fct_orders",
              resourceType: "model",
              changeStatus: "unchanged",
            }}
            newCllExperience
            isImpacted
          />
        </Box>
      </Box>

      <Typography variant="h6" sx={{ mt: 2 }}>
        Dark Mode
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          bgcolor: "#121212",
          p: 3,
          borderRadius: 2,
        }}
      >
        <Box>
          <Typography variant="caption" sx={{ color: "#aaa" }} gutterBottom>
            Impacted + Modified (dark amber)
          </Typography>
          <StandaloneNode
            id="model.dark_impacted"
            data={{
              label: "int_order_metrics",
              resourceType: "model",
              changeStatus: "modified",
            }}
            newCllExperience
            isImpacted
            isDark
          />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: "#aaa" }} gutterBottom>
            Not Impacted (dark normal)
          </Typography>
          <StandaloneNode
            id="model.dark_not_impacted"
            data={{
              label: "dim_customers",
              resourceType: "model",
              changeStatus: "unchanged",
            }}
            newCllExperience
            isImpacted={false}
            isDark
          />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: "#aaa" }} gutterBottom>
            Impacted + Unchanged (dark amber)
          </Typography>
          <StandaloneNode
            id="model.dark_impacted_unchanged"
            data={{
              label: "fct_orders",
              resourceType: "model",
              changeStatus: "unchanged",
            }}
            newCllExperience
            isImpacted
            isDark
          />
        </Box>
      </Box>
    </Box>
  );
}

type NodeComparisonStory = StoryObj;

export const NodeComparison: NodeComparisonStory = {
  name: "Node Comparison (Color Tuning)",
  parameters: {
    docs: {
      description: {
        story: `Side-by-side comparison of nodes with and without the amber impacted highlight.

Use this story to tune the amber color intensity. The highlight uses:
- Light mode: \`colors.amber[200]\` — a soft warm background
- Dark mode: \`colors.amber[900]\` — a deep amber tint

Nodes shown: impacted+modified, impacted+added, not-impacted, impacted+unchanged, and dark mode variants.`,
      },
    },
  },
  render: () => <NodeComparisonDemo />,
};

// =============================================================================
// VARIANT B: Full lineage canvas
// =============================================================================

function buildRealLineageGraph() {
  const { base, current_delta: delta, diff } = lineageData;

  const current = {
    nodes: { ...base.nodes, ...delta.nodes },
    parent_map: { ...base.parent_map, ...delta.parent_map },
    manifest_metadata: delta.manifest_metadata,
    catalog_metadata: delta.catalog_metadata,
  };

  return buildLineageGraph(
    base as unknown as Parameters<typeof buildLineageGraph>[0],
    current as unknown as Parameters<typeof buildLineageGraph>[1],
    diff as unknown as Parameters<typeof buildLineageGraph>[2],
  );
}

/**
 * Build mock CLL data simulating a column change in stg_orders.
 *
 * Scenario: the `ordered_at` column in stg_orders was fixed (date_trunc removed).
 * - stg_orders itself is modified (changeStatus handles this via signal 3)
 * - Downstream time-based models are marked impacted (signal 1: node.impacted)
 * - Downstream models that only use amount/product columns have columns but
 *   none with change_status (signal 2 does NOT fire → not impacted)
 * - Unrelated models aren't in the CLL data at all
 */
function buildMockCllData(graph: ReturnType<typeof buildRealLineageGraph>) {
  const modified = "model.jaffle_shop.stg_orders";
  const downstreamSet = selectDownstream(graph, [modified]);

  // Time-based models that would touch ordered_at → CLL marks them impacted
  const impactedNodeIds = new Set([
    "model.jaffle_shop.orders",
    "model.jaffle_shop.int_daily_revenue",
    "model.jaffle_shop.int_daily_orders_by_store",
    "model.jaffle_shop.int_daily_orders_by_product",
    "model.jaffle_shop.int_store_daily_summary",
    "model.jaffle_shop.inc_met_daily_orders",
    "model.jaffle_shop.int_daily_customer_activity",
    "model.jaffle_shop.rpt_daily_revenue_kpis",
  ]);

  // Amount/product models that are downstream but don't touch ordered_at
  const notImpactedNodeIds = new Set([
    "model.jaffle_shop.cmp_weekday_vs_weekend",
    "model.jaffle_shop.dist_basket_size",
    "model.jaffle_shop.dist_order_value",
    "model.jaffle_shop.kpi_avg_basket_size",
    "model.jaffle_shop.kpi_refund_rate",
    "model.jaffle_shop.prod_daypart_product_mix",
  ]);

  // Build CLL nodes: impacted nodes get impacted=true, non-impacted get impacted=false
  const cllNodes: Record<string, { impacted: boolean }> = {};
  for (const id of impactedNodeIds) {
    if (id in graph.nodes) cllNodes[id] = { impacted: true };
  }
  for (const id of notImpactedNodeIds) {
    if (id in graph.nodes) cllNodes[id] = { impacted: false };
  }
  // Modified node is in CLL but impacted is driven by changeStatus (signal 3)
  cllNodes[modified] = { impacted: false };

  // Build CLL columns: impacted nodes have columns with change_status,
  // non-impacted nodes have columns but no change_status
  const cllColumns: Record<
    string,
    { name: string; change_status: string | null }
  > = {};
  for (const id of impactedNodeIds) {
    if (id in graph.nodes) {
      cllColumns[`${id}_ordered_at`] = {
        name: "ordered_at",
        change_status: "modified",
      };
    }
  }
  for (const id of notImpactedNodeIds) {
    if (id in graph.nodes) {
      cllColumns[`${id}_amount`] = { name: "amount", change_status: null };
    }
  }

  // Select ~25 nodes: modified + impacted + not-impacted + unrelated
  const allNodeIds = Object.keys(graph.nodes);
  const unrelated: string[] = [];
  for (const id of allNodeIds) {
    if (unrelated.length >= 8) break;
    if (!downstreamSet.has(id) && id !== modified) {
      unrelated.push(id);
    }
  }

  const selectedIds = [
    modified,
    ...[...impactedNodeIds].filter((id) => id in graph.nodes),
    ...[...notImpactedNodeIds].filter((id) => id in graph.nodes),
    ...unrelated,
  ];

  const cll = {
    current: {
      nodes: cllNodes,
      columns: cllColumns,
      parent_map: {},
    },
  };

  return { selectedIds, cll };
}

/**
 * Convert toReactFlow output to LineageCanvas format, using computeIsImpacted
 * to determine amber highlight per node.
 */
function adaptForCanvas(
  rawNodes: LineageGraphNodes[],
  rawEdges: LineageGraphEdge[],
  cll: ReturnType<typeof buildMockCllData>["cll"],
): { nodes: LineageCanvasProps["nodes"]; edges: LineageCanvasProps["edges"] } {
  const impactedCols = computeImpactedColumns(
    cll as unknown as ColumnLineageData,
  );
  const nodes = rawNodes.map((node: LineageGraphNodes) => {
    if (node.type === "lineageGraphNode") {
      const graphData = node.data as {
        name: string;
        resourceType?: string;
        changeStatus?: string;
        packageName?: string;
      };
      return {
        ...node,
        type: "lineageNode" as const,
        data: {
          label: graphData.name,
          resourceType: graphData.resourceType,
          changeStatus: graphData.changeStatus,
          packageName: graphData.packageName,
          newCllExperience: true,
          isImpacted: computeIsImpacted(
            node.id,
            cll as unknown as ColumnLineageData,
            graphData.changeStatus as NodeChangeStatus | undefined,
            impactedCols,
          ),
        },
      };
    }
    return node;
  });

  const edges = rawEdges.map((edge: LineageGraphEdge) => ({
    ...edge,
    type: edge.type === "lineageGraphEdge" ? "lineageEdge" : edge.type,
  }));

  return {
    nodes: nodes as LineageCanvasProps["nodes"],
    edges: edges as LineageCanvasProps["edges"],
  };
}

function FullCanvasDemo() {
  const { nodes, edges, impactedCount, totalCount, modifiedNames } =
    useMemo(() => {
      const graph = buildRealLineageGraph();
      const { selectedIds, cll } = buildMockCllData(graph);

      const [rawNodes, rawEdges] = toReactFlow(graph, {
        selectedNodes: selectedIds,
      });
      const adapted = adaptForCanvas(rawNodes, rawEdges, cll);

      const impactedCount = adapted.nodes.filter(
        (n) => (n.data as Record<string, unknown>)?.isImpacted,
      ).length;

      return {
        ...adapted,
        impactedCount,
        totalCount: selectedIds.length,
        modifiedNames: graph.modifiedSet.map(
          (id) => graph.nodes[id]?.data.name ?? id,
        ),
      };
    }, []);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Typography variant="subtitle2">
          New CLL Experience — jaffle-shop-expand
        </Typography>
        <Chip
          label={`${impactedCount}/${totalCount} nodes impacted`}
          size="small"
          color="warning"
          variant="outlined"
        />
        {modifiedNames.map((name) => (
          <Chip
            key={name}
            label={name}
            size="small"
            color="warning"
            variant="outlined"
          />
        ))}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LineageCanvas
          nodes={nodes}
          edges={edges}
          showMiniMap
          showControls
          showBackground
          height={800}
          interactive
        />
      </Box>
    </Box>
  );
}

type CanvasStory = StoryObj;

export const FullCanvas: CanvasStory = {
  name: "Full Lineage Canvas",
  parameters: {
    docs: {
      description: {
        story: `Full lineage canvas using the jaffle-shop-expand fixture with impacted subgraph selected.

This shows the same layout as the real Recce UI for the CLL experience. The amber highlighting
is applied at the app level (via GraphNodeOss), so individual nodes here use standard rendering.
Use the **Node Comparison** story for color tuning.`,
      },
    },
    layout: "fullscreen",
  },
  render: () => <FullCanvasDemo />,
};

// =============================================================================
// VARIANT C: Column ancestry on full canvas (columns hanging off models)
// =============================================================================

/**
 * Build mock CLL data demonstrating multi-parent column ancestry scenarios.
 *
 * All column edges follow real model-level parent_map relationships:
 *   stg_orders → orders → customers → wide_order_detail
 *                orders ─────────────→ wide_order_detail
 *                          stg_locations → wide_order_detail
 *
 * Scenarios demonstrated:
 *   A) Same model, mixed impact:
 *      customers.first_order_date ← orders.ordered_at [impacted]
 *                                  + orders.customer_id [NOT impacted]
 *   B) Different models, both impacted:
 *      wide_order_detail.customer_order_date ← customers.first_order_date [impacted]
 *                                             + orders.ordered_at [impacted]
 *   C) Different models, mixed impact:
 *      wide_order_detail.delivery_summary ← customers.first_order_date [impacted]
 *                                          + stg_locations.location_name [NOT impacted]
 */
function buildMockCllDataWithAncestry(
  graph: ReturnType<typeof buildRealLineageGraph>,
) {
  const modified = "model.jaffle_shop.stg_orders";
  const orders = "model.jaffle_shop.orders";
  const customers = "model.jaffle_shop.customers";
  const wideOrderDetail = "model.jaffle_shop.wide_order_detail";
  const stgLocations = "model.jaffle_shop.stg_locations";
  const downstreamSet = selectDownstream(graph, [modified]);

  // Column IDs (all follow real model edges)
  const stgOrderedAt = `${modified}_ordered_at`;
  const ordersOrderedAt = `${orders}_ordered_at`;
  const ordersCustomerId = `${orders}_customer_id`;
  const customersFirstOrder = `${customers}_first_order_date`;
  const stgLocationsName = `${stgLocations}_location_name`;
  const wodCustomerOrderDate = `${wideOrderDetail}_customer_order_date`;
  const wodDeliverySummary = `${wideOrderDetail}_delivery_summary`;

  // CLL columns
  const cllColumns: Record<
    string,
    {
      name: string;
      change_status: string | null;
      type?: string;
      transformation_type?: string;
    }
  > = {
    // stg_orders: modified source column + unchanged sibling
    [stgOrderedAt]: {
      name: "ordered_at",
      change_status: "modified",
      type: "TIMESTAMP",
    },
    // orders: impacted passthrough + non-impacted sibling
    [ordersOrderedAt]: {
      name: "ordered_at",
      change_status: null,
      type: "TIMESTAMP",
      transformation_type: "passthrough",
    },
    [ordersCustomerId]: {
      name: "customer_id",
      change_status: null,
      type: "INTEGER",
      transformation_type: "passthrough",
    },
    // customers: derived from both orders columns (scenario A)
    [customersFirstOrder]: {
      name: "first_order_date",
      change_status: null,
      type: "DATE",
      transformation_type: "derived",
    },
    // stg_locations: unchanged column (scenario C counterpart)
    [stgLocationsName]: {
      name: "location_name",
      change_status: null,
      type: "VARCHAR",
      transformation_type: "passthrough",
    },
    // wide_order_detail: two columns showing scenarios B and C
    [wodCustomerOrderDate]: {
      name: "customer_order_date",
      change_status: null,
      type: "DATE",
      transformation_type: "derived",
    },
    [wodDeliverySummary]: {
      name: "delivery_summary",
      change_status: null,
      type: "VARCHAR",
      transformation_type: "derived",
    },
  };

  // Column parent_map (each entry = real model-level edge exists)
  const parentMap: Record<string, string[]> = {
    // stg_orders → orders
    [ordersOrderedAt]: [stgOrderedAt],
    // orders → customers (scenario A: impacted + non-impacted, same model)
    [customersFirstOrder]: [ordersOrderedAt, ordersCustomerId],
    // customers + orders → wide_order_detail (scenario B: both impacted, different models)
    [wodCustomerOrderDate]: [customersFirstOrder, ordersOrderedAt],
    // customers + stg_locations → wide_order_detail (scenario C: mixed impact, different models)
    [wodDeliverySummary]: [customersFirstOrder, stgLocationsName],
  };

  // CLL nodes
  const impactedNodeIds = new Set([
    orders,
    customers,
    wideOrderDetail,
    "model.jaffle_shop.inc_met_daily_orders",
    "model.jaffle_shop.rpt_daily_revenue_kpis",
  ]);

  const notImpactedNodeIds = new Set([
    stgLocations,
    "model.jaffle_shop.cmp_weekday_vs_weekend",
    "model.jaffle_shop.dist_basket_size",
    "model.jaffle_shop.dist_order_value",
  ]);

  const cllNodes: Record<string, { impacted: boolean }> = {};
  for (const id of impactedNodeIds) {
    if (id in graph.nodes) cllNodes[id] = { impacted: true };
  }
  for (const id of notImpactedNodeIds) {
    if (id in graph.nodes) cllNodes[id] = { impacted: false };
  }
  cllNodes[modified] = { impacted: false };

  // Select nodes for the graph
  const allNodeIds = Object.keys(graph.nodes);
  const unrelated: string[] = [];
  for (const id of allNodeIds) {
    if (unrelated.length >= 5) break;
    if (!downstreamSet.has(id) && id !== modified && id !== stgLocations) {
      unrelated.push(id);
    }
  }

  const selectedIds = [
    modified,
    ...[...impactedNodeIds].filter((id) => id in graph.nodes),
    ...[...notImpactedNodeIds].filter((id) => id in graph.nodes),
    ...unrelated,
  ];

  const cll = {
    current: {
      nodes: cllNodes,
      columns: cllColumns,
      parent_map: parentMap,
    },
  };

  // columnAncestry: all models with ancestry columns
  const columnAncestry = new Map<string, ColumnAnnotation[]>();

  columnAncestry.set(modified, [
    { column: "ordered_at", isImpacted: true, changeStatus: "modified" },
  ]);
  // Scenario A visible here: orders expands with BOTH columns —
  // ordered_at is amber, customer_id is not
  columnAncestry.set(orders, [
    {
      column: "ordered_at",
      isImpacted: true,
      transformationType: "passthrough",
    },
    {
      column: "customer_id",
      isImpacted: false,
      transformationType: "passthrough",
    },
  ]);
  columnAncestry.set(customers, [
    {
      column: "first_order_date",
      isImpacted: true,
      transformationType: "derived",
    },
  ]);
  // stg_locations: not impacted (no upstream change)
  columnAncestry.set(stgLocations, [
    {
      column: "location_name",
      isImpacted: false,
      transformationType: "passthrough",
    },
  ]);
  // wide_order_detail: scenarios B and C
  columnAncestry.set(wideOrderDetail, [
    {
      column: "customer_order_date",
      isImpacted: true,
      transformationType: "derived",
    },
    {
      column: "delivery_summary",
      isImpacted: true,
      transformationType: "derived",
    },
  ]);

  return { selectedIds, cll, columnAncestry };
}

function ColumnAncestryCanvasDemo() {
  const { nodes, edges, impactedCount, totalCount } = useMemo(() => {
    const graph = buildRealLineageGraph();
    const { selectedIds, cll, columnAncestry } =
      buildMockCllDataWithAncestry(graph);

    // Two-pass approach matching real app behavior:
    // 1. Layout pass without ancestry (Dagre positions model nodes)
    // 2. Second pass with ancestry + existing positions (skips Dagre,
    //    adds column child nodes and ancestry edges)
    const [layoutNodes] = toReactFlow(graph, {
      selectedNodes: selectedIds,
    });
    const existingPositions = new Map(
      layoutNodes
        .filter((n) => n.type === "lineageGraphNode")
        .map((n) => [n.id, n.position]),
    );

    const [rawNodes, rawEdges] = toReactFlow(graph, {
      selectedNodes: selectedIds,
      cll: cll as unknown as ColumnLineageData,
      newCllExperience: true,
      columnAncestry,
      existingPositions,
    });

    // Adapt for LineageCanvas: remap node types
    const impactedCols = computeImpactedColumns(
      cll as unknown as ColumnLineageData,
    );
    const nodes = rawNodes.map((node: LineageGraphNodes) => {
      if (node.type === "lineageGraphNode") {
        const graphData = node.data as {
          name: string;
          resourceType?: string;
          changeStatus?: string;
          packageName?: string;
        };
        return {
          ...node,
          type: "lineageNode" as const,
          data: {
            label: graphData.name,
            resourceType: graphData.resourceType,
            changeStatus: graphData.changeStatus,
            packageName: graphData.packageName,
            newCllExperience: true,
            isImpacted: computeIsImpacted(
              node.id,
              cll as unknown as ColumnLineageData,
              graphData.changeStatus as NodeChangeStatus | undefined,
              impactedCols,
            ),
          },
        };
      }
      // lineageGraphColumnNode nodes pass through — LineageCanvas handles them
      return node;
    });

    const edges = rawEdges.map((edge: LineageGraphEdge) => ({
      ...edge,
      type: edge.type === "lineageGraphEdge" ? "lineageEdge" : edge.type,
    }));

    const impactedCount = nodes.filter(
      (n) => (n.data as Record<string, unknown>)?.isImpacted,
    ).length;

    return {
      nodes: nodes as LineageCanvasProps["nodes"],
      edges: edges as LineageCanvasProps["edges"],
      impactedCount,
      totalCount: selectedIds.length,
    };
  }, []);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Typography variant="subtitle2">
          Column Ancestry — Multi-Parent Scenarios
        </Typography>
        <Chip
          label={`${impactedCount}/${totalCount} nodes impacted`}
          size="small"
          color="warning"
          variant="outlined"
        />
        <Chip label="A: mixed impact, same model" size="small" color="info" />
        <Chip
          label="B: both impacted, diff models"
          size="small"
          color="warning"
        />
        <Chip
          label="C: mixed impact, diff models"
          size="small"
          color="default"
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LineageCanvas
          nodes={nodes}
          edges={edges}
          showMiniMap
          showControls
          showBackground
          height={800}
          interactive
        />
      </Box>
    </Box>
  );
}

type ColumnAncestryStory = StoryObj;

export const ColumnAncestry: ColumnAncestryStory = {
  name: "Column Ancestry (Expanded Models)",
  parameters: {
    docs: {
      description: {
        story: `Full lineage canvas demonstrating multi-parent column ancestry scenarios.

All edges follow real model-level relationships in the jaffle-shop-expand fixture:
\`stg_orders → orders → customers → wide_order_detail\` (plus \`stg_locations → wide_order_detail\`).

**Scenario A** — Same model, mixed impact (look at \`orders\` node):
\`customers.first_order_date\` ← \`orders.ordered_at\` [amber] + \`orders.customer_id\` [neutral]

**Scenario B** — Different models, both impacted (look at \`wide_order_detail\`):
\`wide_order_detail.customer_order_date\` ← \`customers.first_order_date\` [amber] + \`orders.ordered_at\` [amber]

**Scenario C** — Different models, mixed impact (look at \`wide_order_detail\` + \`stg_locations\`):
\`wide_order_detail.delivery_summary\` ← \`customers.first_order_date\` [amber] + \`stg_locations.location_name\` [neutral]`,
      },
    },
    layout: "fullscreen",
  },
  render: () => <ColumnAncestryCanvasDemo />,
};
