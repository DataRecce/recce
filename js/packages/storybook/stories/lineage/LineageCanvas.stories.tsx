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
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createCllData,
  createCllLineageGraph,
  diamondLayout,
  largeGraph,
  simpleLinearLayout,
} from "./fixtures";
import {
  createReflowLineageGraph,
  customer_idSelectedCLL,
  order_dateSelectedCLL,
} from "./reflowReproducer";

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

// =============================================================================
// COLUMN CLICKING REFLOW REPRODUCER (DRC-2623)
// =============================================================================

// Available columns that have actual CLL data
const AVAILABLE_COLUMNS = ["order_id", "customer_id", "order_date", "status"];
const CLICKABLE_COLUMNS = ["customer_id", "order_date"];

// Map column names to their CLL data from API responses
const CLL_DATA_MAP: Record<string, { current: unknown }> = {
  customer_id: { current: customer_idSelectedCLL },
  order_date: { current: order_dateSelectedCLL },
};

/**
 * Interactive wrapper to demonstrate the column-clicking reflow bug.
 *
 * This reproduces the exact scenario from DRC-2623:
 * - Shows the lineage graph with a selected node (stg_orders)
 * - Right panel shows the column list (like NodeView)
 * - Clicking between columns should trigger CLL for that column
 * - BUG: The graph reflows when switching between columns
 */
function ColumnClickingReflowDemo() {
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [previousColumn, setPreviousColumn] = useState<string | null>(null);
  const lineageGraph = useMemo(() => createReflowLineageGraph(), []);

  // Store positions to detect reflow
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [reflowDetected, setReflowDetected] = useState(false);
  const [reflowCount, setReflowCount] = useState(0);

  // Generate nodes/edges based on selected column
  const { nodes, edges } = useMemo(() => {
    // Get CLL data for selected column from actual API responses
    const cllData = selectedColumn ? CLL_DATA_MAP[selectedColumn] : undefined;

    // Only preserve positions when switching BETWEEN columns (not on first selection)
    // This is the bug behavior we want to demonstrate:
    // - First column selection: nodes should reflow to make room for columns
    // - Switching columns: nodes should preserve positions (the bug is they don't)
    const shouldPreservePositions =
      previousColumn !== null && selectedColumn !== null;
    const existingPositions =
      shouldPreservePositions && positionsRef.current.size > 0
        ? positionsRef.current
        : undefined;

    const [rawNodes, rawEdges] = toReactFlow(lineageGraph, {
      // biome-ignore lint/suspicious/noExplicitAny: CLL data structure from API
      cll: cllData as any,
      existingPositions,
    });

    // Check for reflow by comparing positions (only when switching between columns)
    let hasReflowed = false;
    if (
      previousColumn !== null &&
      selectedColumn !== null &&
      positionsRef.current.size > 0
    ) {
      for (const node of rawNodes) {
        if (node.type === "lineageGraphNode") {
          const oldPos = positionsRef.current.get(node.id);
          if (oldPos) {
            const dx = Math.abs(node.position.x - oldPos.x);
            const dy = Math.abs(node.position.y - oldPos.y);
            if (dx > 5 || dy > 5) {
              hasReflowed = true;
              break;
            }
          }
        }
      }
    }

    // Update positions reference
    const newPositions = new Map<string, { x: number; y: number }>();
    for (const node of rawNodes) {
      if (node.type === "lineageGraphNode") {
        newPositions.set(node.id, { ...node.position });
      }
    }
    positionsRef.current = newPositions;

    if (hasReflowed) {
      setReflowDetected(true);
      setReflowCount((c) => c + 1);
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
  }, [selectedColumn, previousColumn, lineageGraph]);

  const handleColumnClick = useCallback(
    (columnName: string) => {
      if (!CLICKABLE_COLUMNS.includes(columnName)) return;
      setPreviousColumn(selectedColumn);
      setSelectedColumn(columnName);
    },
    [selectedColumn],
  );

  const handleClearSelection = useCallback(() => {
    setPreviousColumn(selectedColumn);
    setSelectedColumn(null);
    setReflowDetected(false);
  }, [selectedColumn]);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header with status */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: reflowDetected ? "error.light" : "background.paper",
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography variant="h6">
          Column Clicking Reflow Reproducer (DRC-2623)
        </Typography>
        {reflowDetected && (
          <Typography variant="body2" color="error.contrastText">
            ⚠️ REFLOW DETECTED! Count: {reflowCount}
          </Typography>
        )}
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Lineage Canvas */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <LineageCanvas
            key={`column-${selectedColumn}`}
            nodes={nodes}
            edges={edges}
            showMiniMap={true}
            showControls={true}
            showBackground={true}
            height={600}
            interactive={true}
          />
        </Box>

        {/* Column Panel (simulates NodeView) */}
        <Box
          sx={{
            width: 300,
            borderLeft: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            overflow: "auto",
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle1" fontWeight="bold">
              stg_orders
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click columns to view their lineage
            </Typography>
          </Box>

          {/* Column list */}
          <Box sx={{ p: 1 }}>
            <Box
              sx={{ mb: 1, p: 1, bgcolor: "grey.100", borderRadius: 1 }}
              onClick={handleClearSelection}
              style={{ cursor: "pointer" }}
            >
              <Typography variant="body2" color="text.secondary">
                Clear selection
              </Typography>
            </Box>

            {AVAILABLE_COLUMNS.map((columnName, index) => {
              const isClickable = CLICKABLE_COLUMNS.includes(columnName);
              const isSelected = selectedColumn === columnName;

              return (
                <Box
                  key={columnName}
                  sx={{
                    p: 1.5,
                    mb: 0.5,
                    borderRadius: 1,
                    cursor: isClickable ? "pointer" : "not-allowed",
                    opacity: isClickable ? 1 : 0.5,
                    bgcolor: isSelected ? "primary.light" : "transparent",
                    "&:hover": {
                      bgcolor: isClickable
                        ? isSelected
                          ? "primary.light"
                          : "action.hover"
                        : "transparent",
                    },
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onClick={() => handleColumnClick(columnName)}
                >
                  <Box>
                    <Typography
                      variant="body2"
                      fontWeight={isSelected ? "bold" : "normal"}
                    >
                      {index + 1}. {columnName}
                      {!isClickable && " (no CLL data)"}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {columnName === "order_id"
                      ? "BIGINT"
                      : columnName === "customer_id"
                        ? "BIGINT"
                        : columnName === "order_date"
                          ? "DATE"
                          : "VARCHAR"}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Instructions */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="body2" color="text.secondary">
              <strong>How to reproduce:</strong>
              <br />
              1. Click on &quot;customer_id&quot; column
              <br />
              2. Note the node positions
              <br />
              3. Click on &quot;order_date&quot; column
              <br />
              4. ❌ BUG: Nodes jump to new positions
              <br />
              <br />
              <strong>Expected:</strong> Nodes should stay in place when
              switching columns
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export const ColumnClickingReflow: Story = {
  name: "Column Clicking Reflow (DRC-2623)",
  parameters: {
    docs: {
      description: {
        story: `
**Bug Reproducer for DRC-2623**

This story reproduces the exact scenario where clicking between columns in the NodeView table causes the lineage graph to reflow unexpectedly.

**Steps to reproduce:**
1. Click on the "customer_id" column in the right panel (nodes will reflow to show CLL - this is expected)
2. Observe the node positions
3. Click on the "order_date" column
4. ❌ **Bug**: The nodes jump to completely different positions

**Expected behavior:**
When switching between column lineages, nodes should maintain their positions (only the column-level details change).

**Note:** Only "customer_id" and "order_date" columns have actual CLL data from the API.
        `,
      },
    },
    layout: "fullscreen",
  },
  render: () => <ColumnClickingReflowDemo />,
};
