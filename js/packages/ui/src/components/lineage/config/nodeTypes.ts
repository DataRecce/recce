import type { LineageGraphNode } from "../../../contexts/lineage/types";
import { colors } from "../../../theme";
import { GraphColumnNode } from "../GraphColumnNodeOss";
import GraphEdge from "../GraphEdgeOss";
import { GraphNode } from "../GraphNodeOss";
import { getIconForChangeStatus } from "../styles";

/**
 * Node types configuration for ReactFlow.
 * Maps custom node type names to their React components.
 */
export const nodeTypes = {
  lineageGraphNode: GraphNode,
  lineageGraphColumnNode: GraphColumnNode,
} as const;

/**
 * Edge types configuration for ReactFlow.
 * Maps custom edge type names to their React components.
 */
export const edgeTypes = {
  lineageGraphEdge: GraphEdge,
} as const;

/**
 * Initial empty nodes array for ReactFlow initialization.
 */
export const initialNodes: LineageGraphNode[] = [];

/**
 * Get the color for a node based on its change status.
 * Used by MiniMap for node coloring.
 *
 * @param node - The lineage graph node
 * @returns Hex color string
 */
export const getNodeColor = (node: LineageGraphNode): string => {
  return node.data.changeStatus
    ? getIconForChangeStatus(node.data.changeStatus).hexColor
    : colors.neutral[400];
};
