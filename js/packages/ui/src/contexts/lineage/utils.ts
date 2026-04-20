import type { Position } from "@xyflow/react";
import type { MergedLineageResponse } from "../../api/info";
import type {
  LineageGraph,
  LineageGraphColumnNode,
  LineageGraphEdge,
  LineageGraphNode,
  LineageGraphNodes,
} from "./types";
import { isLineageGraphNode } from "./types";

/**
 * Height of a column node in pixels
 * Must match COLUMN_NODE_HEIGHT in columns/LineageColumnNode.tsx
 */
export const COLUMN_HEIGHT = 24;

/**
 * Map of node IDs to their column sets
 */
export type NodeColumnSetMap = Record<string, Set<string>>;

// =============================================================================
// Set Utilities
// =============================================================================

/**
 * Get the union of multiple sets
 */
export function union<T>(...sets: Set<T>[]): Set<T> {
  const unionSet = new Set<T>();
  for (const set of sets) {
    for (const key of set) {
      unionSet.add(key);
    }
  }
  return unionSet;
}

/**
 * Get the intersection of multiple sets
 */
export function intersect<T>(...sets: Set<T>[]): Set<T> {
  if (sets.length === 0) {
    return new Set<T>();
  }

  let intersection = new Set<T>(sets[0]);

  for (const set of sets) {
    intersection = new Set([...intersection].filter((x) => set.has(x)));
  }

  return intersection;
}

/**
 * Get a set of neighbor nodes up to a certain degree
 */
export function getNeighborSet(
  nodeIds: string[],
  getNeighbors: (id: string) => string[],
  degree = 1000,
): Set<string> {
  const neighborSet = new Set<string>();
  const visited: Record<string, number | undefined> = {};

  const dfs = (id: string, currentDegree: number) => {
    if (currentDegree < 0) {
      return;
    }
    if (visited[id] != null && visited[id] >= currentDegree) {
      return;
    }
    visited[id] = currentDegree;

    const neighbors = getNeighbors(id);

    for (const neighborId of neighbors) {
      dfs(neighborId, currentDegree - 1);
    }

    neighborSet.add(id);
  };

  for (const nodeId of nodeIds) {
    dfs(nodeId, degree);
  }

  return neighborSet;
}

// =============================================================================
// Lineage Graph Building
// =============================================================================

/**
 * Build a LineageGraph from a merged lineage response.
 *
 * The server merges base + current and bakes in diff data (DRC-3258),
 * so this is now a trivial mapping — no client-side diffing.
 *
 * @param lineage - Merged lineage from /api/info
 * @returns Processed LineageGraph structure
 */
export function buildLineageGraph(
  lineage: MergedLineageResponse,
): LineageGraph {
  const nodes: Record<string, LineageGraphNode> = {};
  const edges: Record<string, LineageGraphEdge> = {};
  const modifiedSet: string[] = [];

  // 1. Map nodes
  for (const [id, merged] of Object.entries(lineage.nodes)) {
    nodes[id] = {
      id,
      data: {
        id,
        name: merged.name,
        resourceType: merged.resource_type,
        packageName: merged.package_name,
        schema: merged.schema,
        materialized: merged.materialized,
        changeStatus: merged.change_status,
        change: merged.change ?? undefined,
        parents: {},
        children: {},
      },
      type: "lineageGraphNode",
    } as LineageGraphNode;

    if (merged.change_status) {
      modifiedSet.push(id);
    }
  }

  // 2. Map edges and build bidirectional parent/child refs
  for (const edge of lineage.edges) {
    const id = `${edge.source}_${edge.target}`;
    const parentNode = nodes[edge.source];
    const childNode = nodes[edge.target];

    if (!parentNode || !childNode) continue;

    edges[id] = {
      id,
      source: edge.source,
      target: edge.target,
      data: {
        changeStatus: edge.change_status ?? undefined,
      },
    };

    childNode.data.parents[edge.source] = edges[id];
    parentNode.data.children[edge.target] = edges[id];
  }

  // 3. Extract metadata
  const baseMeta = lineage.metadata?.base;
  const currentMeta = lineage.metadata?.current;

  return {
    nodes,
    edges,
    modifiedSet,
    manifestMetadata: {
      base: baseMeta?.manifest_metadata ?? undefined,
      current: currentMeta?.manifest_metadata ?? undefined,
    },
    catalogMetadata: {
      base: baseMeta?.catalog_metadata ?? undefined,
      current: currentMeta?.catalog_metadata ?? undefined,
    },
  };
}

// =============================================================================
// Selection Utilities
// =============================================================================

/**
 * Select upstream nodes from the given node IDs
 *
 * @param lineageGraph - The lineage graph
 * @param nodeIds - Starting node IDs
 * @param degree - Maximum degree of separation (default: 1000)
 * @returns Set of upstream node IDs
 */
export function selectUpstream(
  lineageGraph: LineageGraph,
  nodeIds: string[],
  degree = 1000,
): Set<string> {
  return getNeighborSet(
    nodeIds,
    (key) => {
      const maybeNodes = lineageGraph.nodes as unknown as Record<
        string,
        LineageGraphNode | undefined
      >;
      if (maybeNodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].data.parents);
    },
    degree,
  );
}

/**
 * Select downstream nodes from the given node IDs
 *
 * @param lineageGraph - The lineage graph
 * @param nodeIds - Starting node IDs
 * @param degree - Maximum degree of separation (default: 1000)
 * @returns Set of downstream node IDs
 */
export function selectDownstream(
  lineageGraph: LineageGraph,
  nodeIds: string[],
  degree = 1000,
): Set<string> {
  return getNeighborSet(
    nodeIds,
    (key) => {
      if (
        (lineageGraph.nodes[key] as LineageGraphNode | undefined) === undefined
      ) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].data.children);
    },
    degree,
  );
}

// =============================================================================
// React Flow Conversion
// =============================================================================

/**
 * Convert a LineageGraph to React Flow nodes and edges
 *
 * This is a simplified version that converts the graph structure.
 * For full column-level lineage support, use the OSS implementation.
 *
 * @param lineageGraph - The lineage graph to convert
 * @param selectedNodes - Optional filter for which nodes to include
 * @returns Tuple of [nodes, edges]
 */
export function toReactFlowBasic(
  lineageGraph: LineageGraph,
  selectedNodes?: string[],
): [LineageGraphNode[], LineageGraphEdge[]] {
  const nodes: LineageGraphNode[] = [];
  const edges: LineageGraphEdge[] = [];

  function getWeight(changeStatus?: string) {
    if (changeStatus === "removed") {
      return 0;
    } else if (changeStatus === "added") {
      return 2;
    }
    return 1;
  }

  function compareFn(
    a: LineageGraphNode | LineageGraphEdge,
    b: LineageGraphNode | LineageGraphEdge,
  ) {
    const weightA = getWeight(a.data?.changeStatus);
    const weightB = getWeight(b.data?.changeStatus);
    return weightA - weightB;
  }

  const filterSet =
    selectedNodes !== undefined ? new Set(selectedNodes) : undefined;
  const sortedNodes = Object.values(lineageGraph.nodes).sort(compareFn);

  for (const node of sortedNodes) {
    if (filterSet && !filterSet.has(node.id)) {
      continue;
    }

    nodes.push({
      id: node.id,
      position: { x: 0, y: 0 },
      width: 300,
      height: 60,
      className: "no-track-pii-safe",
      data: {
        ...node.data,
      },
      type: "lineageGraphNode",
      targetPosition: "left" as Position,
      sourcePosition: "right" as Position,
      style: {
        width: 300,
        height: 60,
      },
    } as LineageGraphNode);
  }

  const sortedEdges = Object.values(lineageGraph.edges).sort(compareFn);
  for (const edge of sortedEdges) {
    if (
      filterSet &&
      (!filterSet.has(edge.source) || !filterSet.has(edge.target))
    ) {
      continue;
    }

    edges.push({
      id: edge.id,
      type: "lineageGraphEdge",
      source: edge.source,
      target: edge.target,
      data: {
        ...edge.data,
      },
    } as LineageGraphEdge);
  }

  return [nodes, edges];
}

/**
 * Apply dagre layout to nodes and edges
 *
 * NOTE: This function requires @dagrejs/dagre to be installed.
 * Import and call it as follows:
 *
 * @example
 * ```tsx
 * import dagre from '@dagrejs/dagre';
 * import { layoutWithDagre } from '@datarecce/ui';
 *
 * const [nodes, edges] = toReactFlowBasic(lineageGraph);
 * layoutWithDagre(dagre, nodes, edges);
 * ```
 *
 * @param dagre - The dagre library instance
 * @param nodes - Nodes to layout
 * @param edges - Edges for layout
 * @param direction - Layout direction (default: "LR" for left-to-right)
 */
export function layoutWithDagre(
  // biome-ignore lint/suspicious/noExplicitAny: dagre library is external, consumers provide their own instance
  dagre: any,
  nodes: LineageGraphNodes[],
  edges: LineageGraphEdge[],
  direction = "LR",
): void {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 50, nodesep: 30 });

  for (const node of nodes) {
    if (!isLineageGraphNode(node)) {
      continue;
    }
    let width = 300;
    let height = 60;
    if (node.style?.height && node.style.width) {
      width = parseInt(String(node.style.width), 10);
      height = parseInt(String(node.style.height), 10);
    }
    dagreGraph.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(dagreGraph);

  for (const node of nodes) {
    if (!isLineageGraphNode(node)) {
      continue;
    }

    const nodeWidth = node.style?.width ?? 300;
    const nodeHeight = node.style?.height ?? 60;
    const nodeWithPosition = dagreGraph.node(node.id);

    // Shift from center anchor to top-left anchor
    node.position = {
      x: nodeWithPosition.x - Number(nodeWidth) / 2,
      y: nodeWithPosition.y - Number(nodeHeight) / 2,
    };
  }
}
