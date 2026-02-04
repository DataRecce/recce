import type {
  LineageCanvasProps,
  LineageGraphEdge,
  LineageGraphNodes,
} from "@datarecce/ui/advanced";
import { LineageCanvas, toReactFlow } from "@datarecce/ui/advanced";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  createCllData,
  createCllLineageGraph,
  diamondLayout,
  largeGraph,
  simpleLinearLayout,
} from "./fixtures";

/**
 * @file LineageCanvas.stories.tsx
 * @description Storybook stories for the LineageCanvas component
 *
 * These stories demonstrate various lineage graph layouts and features,
 * including change status visualization, interactive controls, and
 * Column-Level Lineage (CLL) visualization.
 */

const meta: Meta<typeof LineageCanvas> = {
  title: "Lineage/LineageCanvas",
  component: LineageCanvas,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Interactive lineage graph visualization using React Flow. Displays nodes and edges with change status indicators, supports zoom/pan navigation.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    nodes: {
      description: "Array of nodes to display in the graph",
      control: false,
    },
    edges: {
      description: "Array of edges connecting nodes",
      control: false,
    },
    onNodeSelect: {
      description: "Callback when node selection changes",
      action: "nodeSelected",
    },
    onNodeDoubleClick: {
      description: "Callback when node is double-clicked",
      action: "nodeDoubleClicked",
    },
    showMiniMap: {
      description: "Whether to show the minimap",
      control: "boolean",
    },
    showControls: {
      description: "Whether to show zoom/pan controls",
      control: "boolean",
    },
    showBackground: {
      description: "Whether to show the background grid",
      control: "boolean",
    },
    height: {
      description: "Height of the graph container",
      control: "number",
    },
    interactive: {
      description: "Whether the graph is interactive (draggable, selectable)",
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof LineageCanvas>;

// =============================================================================
// LAYOUTS
// =============================================================================

export const SimpleLinear: Story = {
  name: "Simple Linear Layout",
  parameters: {
    docs: {
      description: {
        story:
          "Basic 3-node linear layout demonstrating change status visualization (unchanged, modified, added).",
      },
    },
  },
  args: {
    ...simpleLinearLayout(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const DiamondLayout: Story = {
  name: "Diamond Layout",
  parameters: {
    docs: {
      description: {
        story:
          "Diamond-shaped graph with multiple parents and children, demonstrating edge routing and node relationships.",
      },
    },
  },
  args: {
    ...diamondLayout(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const LargeGraph: Story = {
  name: "Large Graph (~70 nodes)",
  parameters: {
    docs: {
      description: {
        story:
          "Large graph with ~70 nodes arranged in a realistic dbt project structure: sources → staging → intermediate → facts → dimensions → marts. Tests performance and navigation with minimap.",
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
  },
};

// =============================================================================
// COLUMN-LEVEL LINEAGE (CLL)
// =============================================================================

/**
 * Helper to generate CLL nodes and edges using toReactFlow
 *
 * toReactFlow produces LineageGraphNode (type: "lineageGraphNode") and
 * LineageGraphColumnNode (type: "lineageGraphColumnNode").
 *
 * LineageCanvas expects:
 * - lineageNode (for model nodes) with data.label
 * - lineageGraphColumnNode (for column nodes) - already compatible
 *
 * This adapter converts the output to be compatible with LineageCanvas.
 */
function createCllLayout() {
  const lineageGraph = createCllLineageGraph();
  const cllData = createCllData();
  const [rawNodes, rawEdges] = toReactFlow(lineageGraph, { cll: cllData });

  // Adapt nodes: convert lineageGraphNode -> lineageNode with label
  const nodes = rawNodes.map((node: LineageGraphNodes) => {
    if (node.type === "lineageGraphNode") {
      // Extract data from LineageGraphNode and convert to LineageNodeData
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
        },
      };
    }
    // Column nodes are already compatible
    return node;
  });

  // Adapt edges: convert lineageGraphEdge -> lineageEdge
  const edges = rawEdges.map((edge: LineageGraphEdge) => ({
    ...edge,
    type: edge.type === "lineageGraphEdge" ? "lineageEdge" : edge.type,
  }));

  return {
    nodes: nodes as LineageCanvasProps["nodes"],
    edges: edges as LineageCanvasProps["edges"],
  };
}

export const ColumnLevelLineage: Story = {
  name: "Column-Level Lineage (CLL)",
  parameters: {
    docs: {
      description: {
        story: `
Demonstrates **Column-Level Lineage (CLL)** - showing how data flows at the column level through a data pipeline.

**Pipeline Structure:**
- \`raw_users\` → \`stg_users\` → \`dim_users\` → \`mart_customer_orders\`
- \`raw_orders\` → \`stg_orders\` → \`fct_orders\` → \`mart_customer_orders\`

**Column Features:**
- **Transformation Types**: Source (S), Passthrough (P), Renamed (R), Derived (D)
- **Change Status**: Modified columns shown with change indicators
- **Column-to-Column Edges**: Shows data lineage between columns

Zoom in to see column details. Each model node expands to show its columns.
        `,
      },
    },
  },
  args: {
    ...createCllLayout(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 700,
    interactive: true,
  },
};

// =============================================================================
// CLL TOGGLE DEMO
// =============================================================================

/**
 * Interactive wrapper component for CLL toggle demonstration.
 *
 * This component demonstrates the position preservation fix:
 * - When CLL is toggled OFF, node positions should be preserved
 * - The graph should NOT reflow/jump when disabling CLL
 */
function CllToggleDemo() {
  const [cllEnabled, setCllEnabled] = useState(true);
  const lineageGraph = useMemo(() => createCllLineageGraph(), []);
  const cllData = useMemo(() => createCllData(), []);

  // Store positions when CLL is enabled to preserve them when disabled
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Generate nodes/edges based on CLL state
  const { nodes, edges } = useMemo(() => {
    const existingPositions = cllEnabled ? undefined : positionsRef.current;

    const [rawNodes, rawEdges] = toReactFlow(lineageGraph, {
      cll: cllEnabled ? cllData : undefined,
      existingPositions,
    });

    // Store current positions for later use
    if (cllEnabled) {
      positionsRef.current = new Map();
      for (const node of rawNodes) {
        if (node.type === "lineageGraphNode") {
          positionsRef.current.set(node.id, { ...node.position });
        }
      }
    }

    // Adapt nodes for LineageCanvas
    const adaptedNodes = rawNodes.map((node: LineageGraphNodes) => {
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
          },
        };
      }
      return node;
    });

    const adaptedEdges = rawEdges.map((edge: LineageGraphEdge) => ({
      ...edge,
      type: edge.type === "lineageGraphEdge" ? "lineageEdge" : edge.type,
    }));

    return {
      nodes: adaptedNodes as LineageCanvasProps["nodes"],
      edges: adaptedEdges as LineageCanvasProps["edges"],
    };
  }, [cllEnabled, lineageGraph, cllData]);

  const handleToggle = useCallback(() => {
    setCllEnabled((prev) => !prev);
  }, []);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 2,
          bgcolor: "background.paper",
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={cllEnabled}
              onChange={handleToggle}
              color="primary"
            />
          }
          label="Column-Level Lineage"
        />
        <Typography variant="body2" color="text.secondary">
          {cllEnabled
            ? "CLL enabled - columns visible inside nodes"
            : "CLL disabled - positions should be preserved"}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LineageCanvas
          key={cllEnabled ? "cll-on" : "cll-off"}
          nodes={nodes}
          edges={edges}
          showMiniMap={true}
          showControls={true}
          showBackground={true}
          height={650}
          interactive={true}
        />
      </Box>
    </Box>
  );
}

export const CllToggle: Story = {
  name: "CLL Toggle",
  parameters: {
    docs: {
      description: {
        story: `
Use this story to verify that toggling Column-Level Lineage (CLL) does NOT cause the graph to reflow.

**How to test:**
1. With CLL enabled, zoom and pan to position the graph as desired
2. Toggle CLL OFF using the switch
3. ✅ **Expected**: Node positions remain stable, no jumping/reflowing
4. ❌ **Bug behavior**: Graph would jump to new positions when CLL disabled

**Technical details:**
- When CLL is disabled, the \`existingPositions\` map preserves node positions
- The \`toReactFlow\` function skips dagre layout when positions are provided
- This prevents the jarring UX of graph reflow on toggle
        `,
      },
    },
    layout: "fullscreen",
  },
  render: () => <CllToggleDemo />,
};
