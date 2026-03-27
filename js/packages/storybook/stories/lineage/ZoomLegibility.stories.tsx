/**
 * @file ZoomLegibility.stories.tsx
 * @description Stories for DRC-3094: Starting view should be zoomed in enough to show value
 *
 * These stories demonstrate the zoom legibility improvements:
 * 1. Zoom floor (LEGIBLE_MIN_ZOOM) prevents fitView from zooming out past readable
 * 2. Fit-to-changed-nodes centers on what matters
 * 3. Softer dim filter keeps graph structure visible
 *
 * Compare "Before" and "After" stories side-by-side to see the improvement.
 */

import type {
  LineageGraphEdge,
  LineageGraphNodes,
} from "@datarecce/ui/advanced";
import {
  EXPLORE_MIN_ZOOM,
  FIT_VIEW_PADDING,
  LEGIBLE_MIN_ZOOM,
  LineageCanvas,
  type LineageCanvasProps,
  toReactFlow,
} from "@datarecce/ui/advanced";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Node } from "@xyflow/react";
import { useMemo } from "react";
import { jaffleShopLineageGraph, largeGraph } from "./fixtures";

// =============================================================================
// HELPERS
// =============================================================================

/** Adapt toReactFlow output for LineageCanvas (graph node → canvas node types) */
function adaptForCanvas(
  rawNodes: LineageGraphNodes[],
  rawEdges: LineageGraphEdge[],
) {
  const nodes = rawNodes.map((node: LineageGraphNodes) => {
    if (node.type === "lineageGraphNode") {
      const d = node.data as {
        name: string;
        resourceType?: string;
        changeStatus?: string;
        packageName?: string;
      };
      return {
        ...node,
        type: "lineageNode" as const,
        data: {
          label: d.name,
          resourceType: d.resourceType,
          changeStatus: d.changeStatus,
          packageName: d.packageName,
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

function lineageGraphToCanvas(
  graph: Parameters<typeof toReactFlow>[0],
  options?: Parameters<typeof toReactFlow>[1],
) {
  const [nodes, edges] = toReactFlow(graph, options);
  return adaptForCanvas(nodes, edges);
}

// =============================================================================
// META
// =============================================================================

const meta: Meta<typeof LineageCanvas> = {
  title: "Lineage/ZoomLegibility",
  component: LineageCanvas,
  parameters: {
    docs: {
      description: {
        component: `
**DRC-3094: Starting view should be zoomed in enough to show value**

These stories demonstrate the zoom legibility improvements for large lineage graphs.
Compare "Before" and "After" variants to see the difference.

Key changes:
- \`LEGIBLE_MIN_ZOOM = ${LEGIBLE_MIN_ZOOM}\` — fitView never zooms past this floor
- \`EXPLORE_MIN_ZOOM = ${EXPLORE_MIN_ZOOM}\` — manual zoom can still go lower
- \`FIT_VIEW_PADDING = ${FIT_VIEW_PADDING}\` — breathing room around nodes
- Softer dim filter: \`opacity(0.4) grayscale(40%)\` instead of \`opacity(0.2) grayscale(50%)\`
        `,
      },
    },
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof LineageCanvas>;

// =============================================================================
// 70-NODE GRAPH: BEFORE vs AFTER
// =============================================================================

export const LargeGraphBefore: Story = {
  name: "70 Nodes — Before (No Zoom Floor)",
  parameters: {
    docs: {
      description: {
        story:
          "**BEFORE fix:** The 70-node graph with no zoom floor. fitView zooms out to fit everything, making labels tiny and hard to read. This is the old behavior.",
      },
    },
  },
  args: {
    ...largeGraph(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
    // No minZoom or fitViewOptions — old behavior
  },
};

export const LargeGraphAfter: Story = {
  name: "70 Nodes — After (With Zoom Floor)",
  parameters: {
    docs: {
      description: {
        story: `**AFTER fix:** Same 70-node graph with \`LEGIBLE_MIN_ZOOM = ${LEGIBLE_MIN_ZOOM}\` applied via fitViewOptions. The initial view is capped at a readable zoom level — user pans to explore but can immediately read labels. Manual zoom-out to ${EXPLORE_MIN_ZOOM} still works.`,
      },
    },
  },
  args: {
    ...largeGraph(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
    minZoom: EXPLORE_MIN_ZOOM,
    maxZoom: 1,
    fitViewOptions: {
      minZoom: LEGIBLE_MIN_ZOOM,
      maxZoom: 1,
      padding: FIT_VIEW_PADDING,
    },
  },
};

// =============================================================================
// JAFFLE SHOP MEGA: BEFORE vs AFTER
// =============================================================================

export const JaffleShopBefore: Story = {
  name: "Jaffle Shop (~99 Nodes) — Before",
  parameters: {
    docs: {
      description: {
        story:
          "**BEFORE fix:** The Jaffle Shop graph (~99 nodes, 142 edges) with no zoom floor. fitView shrinks everything to a tiny, hard-to-read cluster.",
      },
    },
  },
  args: {
    ...lineageGraphToCanvas(jaffleShopLineageGraph()),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const JaffleShopAfter: Story = {
  name: "Jaffle Shop (~99 Nodes) — After",
  parameters: {
    docs: {
      description: {
        story: `**AFTER fix:** Same Jaffle Shop graph with zoom floor. Initial view is legible. Pan to explore the full graph, or manually zoom out to ${EXPLORE_MIN_ZOOM} for the full overview.`,
      },
    },
  },
  args: {
    ...lineageGraphToCanvas(jaffleShopLineageGraph()),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
    minZoom: EXPLORE_MIN_ZOOM,
    maxZoom: 1,
    fitViewOptions: {
      minZoom: LEGIBLE_MIN_ZOOM,
      maxZoom: 1,
      padding: FIT_VIEW_PADDING,
    },
  },
};

// =============================================================================
// FIT TO CHANGED NODES
// =============================================================================

/**
 * Demonstrates fit-to-changed-nodes behavior.
 * In the real app, onInit filters nodes with changeStatus and fits to those.
 * Here we simulate by providing fitViewOptions.nodes with only changed nodes.
 */
function FitToChangedDemo() {
  const graph = useMemo(() => jaffleShopLineageGraph(), []);
  const { nodes, edges } = useMemo(() => lineageGraphToCanvas(graph), [graph]);

  // Identify changed nodes (those with a changeStatus that isn't "unchanged")
  const changedNodes = useMemo(
    () =>
      nodes.filter(
        (n) => n.data.changeStatus && n.data.changeStatus !== "unchanged",
      ),
    [nodes],
  );

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h6">Fit to Changed Nodes</Typography>
        <Chip
          label={`${changedNodes.length} changed of ${nodes.length} total`}
          color="warning"
          size="small"
        />
        <Typography variant="body2" color="text.secondary">
          Initial view centers on changed (modified/added/removed) nodes only,
          not the full graph. Labels are readable immediately.
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LineageCanvas
          nodes={nodes}
          edges={edges}
          showMiniMap
          showControls
          showBackground
          height="100%"
          interactive
          minZoom={EXPLORE_MIN_ZOOM}
          maxZoom={1}
          fitViewOptions={{
            nodes: changedNodes as Node[],
            minZoom: LEGIBLE_MIN_ZOOM,
            maxZoom: 1,
            padding: FIT_VIEW_PADDING,
          }}
        />
      </Box>
    </Box>
  );
}

export const FitToChanged: Story = {
  name: "Fit to Changed Nodes",
  parameters: {
    docs: {
      description: {
        story: `
**Fit-to-changed-nodes:** When the lineage has changed models, the initial view fits to only the changed subset rather than the entire graph.

This gives users immediate context about what matters — the models that changed — without forcing them to see the entire graph at an unreadable zoom level.

In the real app, \`onInit\` filters nodes with \`changeStatus !== undefined\` and passes them to \`fitView({ nodes: changedNodes })\`.
        `,
      },
    },
    layout: "fullscreen",
  },
  render: () => <FitToChangedDemo />,
};

// =============================================================================
// SIDE-BY-SIDE COMPARISON
// =============================================================================

function SideBySideDemo() {
  const { nodes, edges } = useMemo(
    () => lineageGraphToCanvas(jaffleShopLineageGraph()),
    [],
  );

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="h6">Side-by-Side: Before vs After</Typography>
        <Typography variant="body2" color="text.secondary">
          Left: old behavior (no zoom floor). Right: new behavior (minZoom =
          {LEGIBLE_MIN_ZOOM}).
        </Typography>
      </Box>
      <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* BEFORE */}
        <Box
          sx={{
            flex: 1,
            borderRight: 2,
            borderColor: "error.main",
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 10,
            }}
          >
            <Chip label="BEFORE" color="error" size="small" />
          </Box>
          <LineageCanvas
            nodes={nodes}
            edges={edges}
            showMiniMap={false}
            showControls
            showBackground
            height="100%"
            interactive
          />
        </Box>
        {/* AFTER */}
        <Box sx={{ flex: 1, position: "relative" }}>
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 10,
            }}
          >
            <Chip label="AFTER" color="success" size="small" />
          </Box>
          <LineageCanvas
            nodes={nodes}
            edges={edges}
            showMiniMap={false}
            showControls
            showBackground
            height="100%"
            interactive
            minZoom={EXPLORE_MIN_ZOOM}
            maxZoom={1}
            fitViewOptions={{
              minZoom: LEGIBLE_MIN_ZOOM,
              maxZoom: 1,
              padding: FIT_VIEW_PADDING,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

export const SideBySide: Story = {
  name: "Side-by-Side Comparison",
  parameters: {
    docs: {
      description: {
        story: `
**Direct comparison.** Left panel shows old behavior (no zoom floor), right panel shows new behavior with \`LEGIBLE_MIN_ZOOM = ${LEGIBLE_MIN_ZOOM}\`.

Both panels show the same Jaffle Shop graph (~99 nodes). Notice:
- **Left (BEFORE):** All nodes fit in view but labels are tiny
- **Right (AFTER):** Labels are readable; use minimap or pan to explore
        `,
      },
    },
    layout: "fullscreen",
  },
  render: () => <SideBySideDemo />,
};
