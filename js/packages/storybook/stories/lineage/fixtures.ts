import type { Edge, Node } from "@xyflow/react";

/**
 * @file fixtures.ts
 * @description Fixture factories for creating lineage graph nodes and edges for Storybook
 *
 * These factories provide consistent test data for lineage visualization stories,
 * including various change statuses, node types, and layout configurations.
 */

// =============================================================================
// TYPES
// =============================================================================

type NodeChangeStatus = "added" | "removed" | "modified" | "unchanged";
type EdgeChangeStatus = "added" | "removed" | "modified" | "unchanged";

/**
 * Data structure for lineage node (matches @datarecce/ui LineageNodeData)
 */
export interface LineageNodeData extends Record<string, unknown> {
  label: string;
  nodeType?: string;
  changeStatus?: NodeChangeStatus;
  isSelected?: boolean;
  resourceType?: string;
  packageName?: string;
  showColumns?: boolean;
  columns?: Array<{
    name: string;
    type?: string;
    changeStatus?: NodeChangeStatus;
  }>;
}

/**
 * Data structure for lineage edge (matches @datarecce/ui LineageEdgeData)
 */
export interface LineageEdgeData extends Record<string, unknown> {
  changeStatus?: EdgeChangeStatus;
  isHighlighted?: boolean;
  label?: string;
}

interface CreateNodeOptions {
  id: string;
  label: string;
  position: { x: number; y: number };
  changeStatus?: NodeChangeStatus;
  resourceType?: string;
  showColumns?: boolean;
  columnCount?: number;
  data?: Partial<LineageNodeData>;
}

interface CreateEdgeOptions {
  id: string;
  source: string;
  target: string;
  changeStatus?: EdgeChangeStatus;
  isHighlighted?: boolean;
  label?: string;
  data?: Partial<LineageEdgeData>;
}

// =============================================================================
// NODE FACTORY
// =============================================================================

/**
 * Create a lineage node with standard defaults
 */
export function createNode({
  id,
  label,
  position,
  changeStatus = "unchanged",
  resourceType = "model",
  showColumns = false,
  columnCount = 0,
  data = {},
}: CreateNodeOptions): Node<LineageNodeData> {
  return {
    id,
    type: "lineageNode",
    position,
    data: {
      label,
      nodeType: resourceType,
      changeStatus,
      resourceType,
      showColumns,
      ...data,
    },
  };
}

/**
 * Create multiple nodes in a linear sequence
 */
export function createLinearNodes(
  count: number,
  spacing = 400,
): Node<LineageNodeData>[] {
  return Array.from({ length: count }, (_, i) => {
    const statuses: NodeChangeStatus[] = [
      "unchanged",
      "modified",
      "added",
      "removed",
    ];
    const changeStatus = statuses[i % statuses.length];

    return createNode({
      id: `node_${i}`,
      label: `Model ${i}`,
      position: { x: i * spacing, y: 250 },
      changeStatus,
    });
  });
}

/**
 * Create nodes in a diamond layout (1 -> 2 -> 1)
 */
export function createDiamondNodes(): Node<LineageNodeData>[] {
  return [
    createNode({
      id: "source",
      label: "Source",
      position: { x: 0, y: 250 },
      changeStatus: "unchanged",
      resourceType: "source",
    }),
    createNode({
      id: "model_a",
      label: "Model A",
      position: { x: 400, y: 150 },
      changeStatus: "modified",
    }),
    createNode({
      id: "model_b",
      label: "Model B",
      position: { x: 400, y: 350 },
      changeStatus: "added",
    }),
    createNode({
      id: "final",
      label: "Final Model",
      position: { x: 800, y: 250 },
      changeStatus: "unchanged",
    }),
  ];
}

// =============================================================================
// EDGE FACTORY
// =============================================================================

/**
 * Create a lineage edge with standard defaults
 */
export function createEdge({
  id,
  source,
  target,
  changeStatus = "unchanged",
  isHighlighted = false,
  label,
  data = {},
}: CreateEdgeOptions): Edge<LineageEdgeData> {
  return {
    id,
    type: "lineageEdge",
    source,
    target,
    data: {
      changeStatus,
      isHighlighted,
      label,
      ...data,
    },
  };
}

/**
 * Create edges connecting nodes in sequence
 */
export function createLinearEdges(nodeCount: number): Edge<LineageEdgeData>[] {
  return Array.from({ length: nodeCount - 1 }, (_, i) => {
    const statuses: EdgeChangeStatus[] = [
      "unchanged",
      "modified",
      "added",
      "removed",
    ];
    const changeStatus = statuses[i % statuses.length];

    return createEdge({
      id: `edge_${i}`,
      source: `node_${i}`,
      target: `node_${i + 1}`,
      changeStatus,
    });
  });
}

/**
 * Create edges for diamond layout
 */
export function createDiamondEdges(): Edge<LineageEdgeData>[] {
  return [
    createEdge({
      id: "edge_source_a",
      source: "source",
      target: "model_a",
      changeStatus: "unchanged",
    }),
    createEdge({
      id: "edge_source_b",
      source: "source",
      target: "model_b",
      changeStatus: "added",
    }),
    createEdge({
      id: "edge_a_final",
      source: "model_a",
      target: "final",
      changeStatus: "modified",
    }),
    createEdge({
      id: "edge_b_final",
      source: "model_b",
      target: "final",
      changeStatus: "added",
    }),
  ];
}

// =============================================================================
// PRESET LAYOUTS
// =============================================================================

/**
 * Simple 3-node linear layout
 */
export function simpleLinearLayout() {
  const nodes = createLinearNodes(3);
  const edges = createLinearEdges(3);
  return { nodes, edges };
}

/**
 * Diamond layout for testing multi-parent/child relationships
 */
export function diamondLayout() {
  const nodes = createDiamondNodes();
  const edges = createDiamondEdges();
  return { nodes, edges };
}

/**
 * Nodes with columns expanded
 */
export function withColumnsExpanded() {
  const nodes = createLinearNodes(3).map((node) => ({
    ...node,
    data: {
      ...node.data,
      showColumns: true,
      columns: [
        { name: "id", type: "integer", changeStatus: "unchanged" as const },
        { name: "name", type: "varchar", changeStatus: "unchanged" as const },
        { name: "email", type: "varchar", changeStatus: "modified" as const },
        {
          name: "created_at",
          type: "timestamp",
          changeStatus: "unchanged" as const,
        },
      ],
    },
  }));

  const edges = createLinearEdges(3);
  return { nodes, edges };
}

/**
 * Large graph for performance testing
 */
export function largeGraph() {
  const nodes = createLinearNodes(10);
  const edges = createLinearEdges(10);
  return { nodes, edges };
}
