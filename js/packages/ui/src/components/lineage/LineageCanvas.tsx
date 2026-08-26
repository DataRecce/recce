"use client";

import {
  Background,
  Controls,
  type Edge,
  type FitViewOptions,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Box from "@mui/material/Box";
import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  useCallback,
  useContext,
} from "react";

import { useIsDark } from "../../hooks/useIsDark";
import { LineageColumnNode } from "./columns";
import { LineageEdge, type LineageEdgeData } from "./edges";
import { LineageNode, type LineageNodeData } from "./nodes";
import { getNodeChangeStyle } from "./styles";

type NodeContextMenuHandler = (event: MouseEvent, nodeId: string) => void;

const NodeContextMenuContext = createContext<
  NodeContextMenuHandler | undefined
>(undefined);

function ThemedLineageNode(props: ComponentProps<typeof LineageNode>) {
  const isDark = useIsDark();
  const onContextMenu = useContext(NodeContextMenuContext);

  return (
    <LineageNode {...props} isDark={isDark} onContextMenu={onContextMenu} />
  );
}

function ThemedLineageColumnNode(
  props: ComponentProps<typeof LineageColumnNode>,
) {
  const isDark = useIsDark();

  return <LineageColumnNode {...props} isDark={isDark} />;
}

const NODE_TYPES = {
  lineageNode: ThemedLineageNode,
  lineageGraphColumnNode: ThemedLineageColumnNode,
};

const EDGE_TYPES = {
  lineageEdge: LineageEdge,
};

export interface LineageCanvasProps {
  /** Nodes to display */
  nodes: Node<LineageNodeData>[];
  /** Edges connecting nodes */
  edges: Edge<LineageEdgeData>[];
  /** Callback when node selection changes */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Callback when a node's kebab/context-menu icon is clicked */
  onNodeContextMenu?: (event: MouseEvent, nodeId: string) => void;
  /** Whether to show minimap */
  showMiniMap?: boolean;
  /** Whether to show controls */
  showControls?: boolean;
  /** Whether to show background grid */
  showBackground?: boolean;
  /** Height of the graph container */
  height?: number | string;
  /** Whether the graph is interactive */
  interactive?: boolean;
  /** Minimum zoom level (passed to ReactFlow) */
  minZoom?: number;
  /** Maximum zoom level (passed to ReactFlow) */
  maxZoom?: number;
  /** Options passed to fitView on initial render */
  fitViewOptions?: FitViewOptions;
}

export function LineageCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeSelect,
  onNodeDoubleClick,
  onNodeContextMenu,
  showMiniMap = true,
  showControls = true,
  showBackground = true,
  height = 600,
  interactive = true,
  minZoom,
  maxZoom,
  fitViewOptions,
}: LineageCanvasProps) {
  const isDark = useIsDark();
  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick],
  );

  // Copy the node card's accent color from the shared source of truth so the
  // minimap can't drift from the canvas. Impact lives on `node.data` in this
  // stack, so impacted-but-unchanged nodes are amber here too.
  const getMiniMapNodeColor = useCallback(
    (node: Node) => {
      const data = node.data as LineageNodeData;
      return getNodeChangeStyle(
        {
          changeStatus: data.changeStatus,
          isImpacted: data.isImpacted,
          newCllExperience: data.newCllExperience,
        },
        isDark,
      ).secondaryAccent;
    },
    [isDark],
  );

  return (
    <Box sx={{ width: "100%", height }}>
      <NodeContextMenuContext.Provider value={onNodeContextMenu}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={interactive ? onNodesChange : undefined}
          onEdgesChange={interactive ? onEdgesChange : undefined}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={minZoom}
          maxZoom={maxZoom}
          nodesDraggable={interactive}
          nodesConnectable={false}
          elementsSelectable={interactive}
        >
          {showBackground && <Background />}
          {showControls && <Controls />}
          {showMiniMap && <MiniMap nodeColor={getMiniMapNodeColor} />}
        </ReactFlow>
      </NodeContextMenuContext.Provider>
    </Box>
  );
}
