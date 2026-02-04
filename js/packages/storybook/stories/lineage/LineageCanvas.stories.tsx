import { LineageCanvas } from "@datarecce/ui";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Edge, Node } from "@xyflow/react";
import { useState } from "react";
import {
  createEdge,
  createNode,
  diamondLayout,
  type LineageEdgeData,
  type LineageNodeData,
  largeGraph,
  simpleLinearLayout,
  withColumnsExpanded,
} from "./fixtures";

/**
 * @file LineageCanvas.stories.tsx
 * @description Storybook stories for the LineageCanvas component
 *
 * These stories demonstrate various lineage graph layouts and features,
 * including change status visualization, interactive controls, and
 * position preservation during layout updates.
 */

const meta: Meta<typeof LineageCanvas> = {
  title: "Lineage/LineageCanvas",
  component: LineageCanvas,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Interactive lineage graph visualization using React Flow. Displays nodes and edges with change status indicators, supports zoom/pan, and preserves node positions during layout updates.",
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
// BASIC LAYOUTS
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
  name: "Large Graph",
  parameters: {
    docs: {
      description: {
        story:
          "Larger graph with 10 nodes to test performance and navigation. Use minimap and controls to navigate.",
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
// COLUMN-LEVEL LINEAGE STATES
// =============================================================================

export const WithColumnsExpanded: Story = {
  name: "With Columns Expanded",
  parameters: {
    docs: {
      description: {
        story:
          "Nodes with column-level details expanded, showing column names, types, and change status.",
      },
    },
  },
  args: {
    ...withColumnsExpanded(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const WithColumnsCollapsed: Story = {
  name: "With Columns Collapsed",
  parameters: {
    docs: {
      description: {
        story:
          "Nodes in compact view without column details, showing only model names and change status.",
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

// =============================================================================
// DISPLAY OPTIONS VARIATIONS
// =============================================================================

export const WithoutMiniMap: Story = {
  name: "Without MiniMap",
  args: {
    ...simpleLinearLayout(),
    showMiniMap: false,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const WithoutControls: Story = {
  name: "Without Controls",
  args: {
    ...simpleLinearLayout(),
    showMiniMap: true,
    showControls: false,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const WithoutBackground: Story = {
  name: "Without Background",
  args: {
    ...simpleLinearLayout(),
    showMiniMap: true,
    showControls: true,
    showBackground: false,
    height: 600,
    interactive: true,
  },
};

export const NonInteractive: Story = {
  name: "Non-Interactive Mode",
  parameters: {
    docs: {
      description: {
        story:
          "Read-only graph that cannot be dragged or modified. Useful for static reports or presentations.",
      },
    },
  },
  args: {
    ...simpleLinearLayout(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: false,
  },
};

export const CustomHeight: Story = {
  name: "Custom Height (400px)",
  args: {
    ...simpleLinearLayout(),
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 400,
    interactive: true,
  },
};

// =============================================================================
// CHANGE STATUS VARIATIONS
// =============================================================================

export const AllAdded: Story = {
  name: "All Added Status",
  parameters: {
    docs: {
      description: {
        story: "All nodes and edges marked as added (green).",
      },
    },
  },
  args: {
    nodes: [
      createNode({
        id: "node_0",
        label: "Model 0",
        position: { x: 0, y: 250 },
        changeStatus: "added",
      }),
      createNode({
        id: "node_1",
        label: "Model 1",
        position: { x: 400, y: 250 },
        changeStatus: "added",
      }),
      createNode({
        id: "node_2",
        label: "Model 2",
        position: { x: 800, y: 250 },
        changeStatus: "added",
      }),
    ],
    edges: [
      createEdge({
        id: "edge_0",
        source: "node_0",
        target: "node_1",
        changeStatus: "added",
      }),
      createEdge({
        id: "edge_1",
        source: "node_1",
        target: "node_2",
        changeStatus: "added",
      }),
    ],
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const AllRemoved: Story = {
  name: "All Removed Status",
  parameters: {
    docs: {
      description: {
        story: "All nodes and edges marked as removed (red).",
      },
    },
  },
  args: {
    nodes: [
      createNode({
        id: "node_0",
        label: "Model 0",
        position: { x: 0, y: 250 },
        changeStatus: "removed",
      }),
      createNode({
        id: "node_1",
        label: "Model 1",
        position: { x: 400, y: 250 },
        changeStatus: "removed",
      }),
      createNode({
        id: "node_2",
        label: "Model 2",
        position: { x: 800, y: 250 },
        changeStatus: "removed",
      }),
    ],
    edges: [
      createEdge({
        id: "edge_0",
        source: "node_0",
        target: "node_1",
        changeStatus: "removed",
      }),
      createEdge({
        id: "edge_1",
        source: "node_1",
        target: "node_2",
        changeStatus: "removed",
      }),
    ],
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

export const AllModified: Story = {
  name: "All Modified Status",
  parameters: {
    docs: {
      description: {
        story: "All nodes and edges marked as modified (amber).",
      },
    },
  },
  args: {
    nodes: [
      createNode({
        id: "node_0",
        label: "Model 0",
        position: { x: 0, y: 250 },
        changeStatus: "modified",
      }),
      createNode({
        id: "node_1",
        label: "Model 1",
        position: { x: 400, y: 250 },
        changeStatus: "modified",
      }),
      createNode({
        id: "node_2",
        label: "Model 2",
        position: { x: 800, y: 250 },
        changeStatus: "modified",
      }),
    ],
    edges: [
      createEdge({
        id: "edge_0",
        source: "node_0",
        target: "node_1",
        changeStatus: "modified",
      }),
      createEdge({
        id: "edge_1",
        source: "node_1",
        target: "node_2",
        changeStatus: "modified",
      }),
    ],
    showMiniMap: true,
    showControls: true,
    showBackground: true,
    height: 600,
    interactive: true,
  },
};

// =============================================================================
// POSITION PRESERVATION DEMO (DRC-2623)
// =============================================================================

/**
 * Interactive demo component for position preservation validation
 */
function PositionPreservationDemo() {
  // Track whether columns are shown
  const [showColumns, setShowColumns] = useState(false);

  // Create nodes with dynamic column visibility
  const nodes: Node<LineageNodeData>[] = [
    createNode({
      id: "node_0",
      label: "Model 0",
      position: { x: 0, y: 250 },
      changeStatus: "unchanged",
      showColumns,
      data: showColumns
        ? {
            columns: [
              { name: "id", type: "integer", changeStatus: "unchanged" },
              { name: "name", type: "varchar", changeStatus: "unchanged" },
            ],
          }
        : {},
    }),
    createNode({
      id: "node_1",
      label: "Model 1",
      position: { x: 400, y: 250 },
      changeStatus: "modified",
      showColumns,
      data: showColumns
        ? {
            columns: [
              { name: "id", type: "integer", changeStatus: "unchanged" },
              { name: "email", type: "varchar", changeStatus: "modified" },
              { name: "status", type: "varchar", changeStatus: "unchanged" },
            ],
          }
        : {},
    }),
    createNode({
      id: "node_2",
      label: "Model 2",
      position: { x: 800, y: 250 },
      changeStatus: "unchanged",
      showColumns,
      data: showColumns
        ? {
            columns: [
              { name: "id", type: "integer", changeStatus: "unchanged" },
              { name: "value", type: "decimal", changeStatus: "unchanged" },
            ],
          }
        : {},
    }),
  ];

  const edges = [
    createEdge({
      id: "edge_0",
      source: "node_0",
      target: "node_1",
      changeStatus: "unchanged",
    }),
    createEdge({
      id: "edge_1",
      source: "node_1",
      target: "node_2",
      changeStatus: "modified",
    }),
  ];

  return (
    <Box
      sx={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Control Panel */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6" gutterBottom>
            Position Preservation Demo (DRC-2623)
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This demo validates that node positions are preserved when toggling
            column visibility. Before the fix, nodes would jump to random
            positions. After the fix, nodes stay in place.
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              onClick={() => setShowColumns(!showColumns)}
              size="small"
            >
              {showColumns ? "Collapse Columns" : "Expand Columns"}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Current state:{" "}
              <strong>{showColumns ? "Expanded" : "Collapsed"}</strong>
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Expected behavior: Nodes should maintain their positions when you
            toggle columns. Drag nodes to new positions, then toggle to verify
            positions are preserved.
          </Typography>
        </Stack>
      </Box>

      {/* Canvas */}
      <Box sx={{ flex: 1 }}>
        <LineageCanvas
          nodes={nodes}
          edges={edges}
          showMiniMap={true}
          showControls={true}
          showBackground={true}
          height="100%"
          interactive={true}
        />
      </Box>
    </Box>
  );
}

export const PositionPreservation: Story = {
  name: "Position Preservation Demo (DRC-2623)",
  parameters: {
    docs: {
      description: {
        story:
          "Interactive demo for validating position preservation when toggling column visibility. " +
          "Toggle the 'Expand/Collapse Columns' button to see that node positions remain stable. " +
          "Try dragging nodes to new positions before toggling to verify the fix works correctly.",
      },
    },
    layout: "fullscreen",
  },
  render: () => <PositionPreservationDemo />,
};
