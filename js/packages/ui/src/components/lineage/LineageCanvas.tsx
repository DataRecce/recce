"use client";

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Box from "@mui/material/Box";
import { useCallback } from "react";

import { LineageEdge, type LineageEdgeData } from "./edges";
import { LineageNode, type LineageNodeData } from "./nodes";

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
}

const nodeTypes = {
  lineageNode: LineageNode,
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
              switch (data.changeStatus) {
                case "added":
                  return "#22c55e";
                case "removed":
                  return "#ef4444";
                case "modified":
                  return "#f59e0b";
                default:
                  return "#94a3b8";
              }
            }}
          />
        )}
      </ReactFlow>
    </Box>
  );
}
