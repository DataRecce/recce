import type {
  LineageCanvasProps,
  LineageGraphEdge,
  LineageGraphNodes,
} from "@datarecce/ui/advanced";
import {
  buildLineageGraph,
  computeIsImpacted,
  LineageCanvas,
  selectDownstream,
  toReactFlow,
} from "@datarecce/ui/advanced";
import type { LineageNodeProps } from "@datarecce/ui/primitives";
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
  const cllColumns: Record<string, { name: string; change_status: string | null }> = {};
  for (const id of impactedNodeIds) {
    if (id in graph.nodes) {
      cllColumns[`${id}_ordered_at`] = { name: "ordered_at", change_status: "modified" };
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
            cll as any,
            graphData.changeStatus as any,
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
  const { nodes, edges, impactedCount, totalCount, modifiedNames } = useMemo(() => {
    const graph = buildRealLineageGraph();
    const { selectedIds, cll } = buildMockCllData(graph);

    const [rawNodes, rawEdges] = toReactFlow(graph, {
      selectedNodes: selectedIds,
    });
    const adapted = adaptForCanvas(rawNodes, rawEdges, cll);

    const impactedCount = adapted.nodes.filter(
      (n) => (n.data as any)?.isImpacted,
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
