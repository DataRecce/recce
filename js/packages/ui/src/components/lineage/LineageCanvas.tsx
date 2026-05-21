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
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

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

const defaultNodeTypes = {
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

  // Wrap LineageNode so the context-menu callback flows through ReactFlow's
  // node-type registry to every node instance. ReactFlow re-mounts all nodes
  // whenever the `nodeTypes` map changes identity, so we route the caller's
  // callback through a ref-backed stable wrapper: the wrapper component is
  // created at most twice in a component's lifetime (once when the prop
  // transitions from absent to present), regardless of caller stability.
  const onNodeContextMenuRef = useRef(onNodeContextMenu);
  useEffect(() => {
    onNodeContextMenuRef.current = onNodeContextMenu;
  }, [onNodeContextMenu]);
  const hasContextMenu = onNodeContextMenu != null;
  const nodeTypes = useMemo(() => {
    if (!hasContextMenu) return defaultNodeTypes;
    const LineageNodeWithContextMenu = (
      props: React.ComponentProps<typeof LineageNode>,
    ) => (
      <LineageNode
        {...props}
        onContextMenu={(event, nodeId) =>
          onNodeContextMenuRef.current?.(event, nodeId)
        }
      />
    );
    LineageNodeWithContextMenu.displayName = "LineageNodeWithContextMenu";
    return {
      ...defaultNodeTypes,
      lineageNode: LineageNodeWithContextMenu,
    };
  }, [hasContextMenu]);

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
