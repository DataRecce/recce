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
import { useCallback } from "react";

import { LineageColumnNode } from "./columns";
import { LineageEdge, type LineageEdgeData } from "./edges";
import { LineageNode, type LineageNodeData } from "./nodes";
import { cllChangeStatusColors } from "./styles";

export interface LineageCanvasProps {
  /** Nodes to display */
  nodes: Node<LineageNodeData>[];
  /** Edges connecting nodes */
  edges: Edge<LineageEdgeData>[];
  /** Callback when node selection changes */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
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

const nodeTypes = {
  lineageNode: LineageNode,
  lineageGraphColumnNode: LineageColumnNode,
};

const edgeTypes = {
  lineageEdge: LineageEdge,
};

export function LineageCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeSelect,
  onNodeDoubleClick,
  showMiniMap = true,
  showControls = true,
  showBackground = true,
  height = 600,
  interactive = true,
  minZoom,
  maxZoom,
  fitViewOptions,
}: LineageCanvasProps) {
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

  return (
    <Box sx={{ width: "100%", height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={interactive ? onNodesChange : undefined}
        onEdgesChange={interactive ? onEdgesChange : undefined}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as LineageNodeData;
              return cllChangeStatusColors[data.changeStatus ?? "unchanged"];
            }}
          />
        )}
      </ReactFlow>
    </Box>
  );
}
