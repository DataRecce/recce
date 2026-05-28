import type { LineageGraphNode } from "../../../contexts/lineage/types";
import { GraphColumnNode } from "../GraphColumnNodeOss";
import GraphEdge from "../GraphEdgeOss";
import { GraphNode } from "../GraphNodeOss";
import { getNodeChangeStyle } from "../styles";

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
 * Inputs that let the MiniMap mirror the canvas's CLL coloring. Both come
 * from the lineage view context (`usePublishedImpactSets` + the
 * `new_cll_experience` server flag).
 */
export interface NodeColorOptions {
  /**
   * Node IDs that are impacted by an upstream change (the amber nodes in the
   * new CLL experience). Matches `LineageViewContextType.impactedNodeIds`.
   */
  impactedNodeIds?: Set<string>;
  /** Whether the new CLL experience is active (`new_cll_experience` flag). */
  newCllExperience?: boolean;
}

/**
 * Build a MiniMap node-color function that copies the canvas node card's color.
 *
 * The color decision (impacted-amber vs change-status, muted "cll" palette in
 * the new experience) lives in one place — `getNodeChangeStyle`, which
 * `LineageNode` also renders from — so the minimap can't drift from the graph.
 * The only thing the minimap can't read off the node is its impact state
 * (`GraphNodeOss` pulls that from context, not `node.data`), so the impacted
 * set is threaded in here (DRC-3250).
 *
 * @param options - Impacted-node set and CLL-experience flag from context.
 * @returns A `nodeColor` callback for `<MiniMap>`.
 */
export const makeGetNodeColor =
  (options: NodeColorOptions = {}) =>
  (node: LineageGraphNode): string => {
    const { impactedNodeIds, newCllExperience } = options;
    return getNodeChangeStyle({
      changeStatus: node.data.changeStatus,
      isImpacted: newCllExperience ? impactedNodeIds?.has(node.id) : false,
      newCllExperience,
    }).color;
  };

/**
 * Default impact-agnostic node color. Kept for callers that don't have the
 * CLL impacted set; equivalent to the original change-status-only coloring.
 * Used by MiniMap for node coloring.
 *
 * @param node - The lineage graph node
 * @returns Hex color string
 */
export const getNodeColor = makeGetNodeColor();
