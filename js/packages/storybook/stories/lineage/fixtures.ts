import type { ColumnLineageData } from "@datarecce/ui/api";
import type { LineageGraph, LineageGraphNode } from "@datarecce/ui/contexts";
import type { Edge, Node } from "@xyflow/react";

/**
 * @file fixtures.ts
 * @description Fixture factories for creating lineage graph nodes and edges for Storybook
 *
 * These factories provide consistent test data for lineage visualization stories,
 * including various change statuses, node types, layout configurations, and
 * Column-Level Lineage (CLL) data.
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
 * Large graph (~70 nodes) for performance testing with horizontal and vertical spread
 * Creates a realistic dbt project structure with sources, staging, intermediate, and mart layers
 */
export function largeGraph() {
  const nodes: Node<LineageNodeData>[] = [];
  const edges: Edge<LineageEdgeData>[] = [];

  const statuses: NodeChangeStatus[] = [
    "unchanged",
    "modified",
    "added",
    "unchanged",
    "unchanged",
  ];

  // Layer configuration: x position, node count, prefix
  const layers = [
    { x: 0, count: 8, prefix: "src", resourceType: "source" },
    { x: 400, count: 12, prefix: "stg", resourceType: "model" },
    { x: 800, count: 15, prefix: "int", resourceType: "model" },
    { x: 1200, count: 18, prefix: "fct", resourceType: "model" },
    { x: 1600, count: 12, prefix: "dim", resourceType: "model" },
    { x: 2000, count: 5, prefix: "mart", resourceType: "model" },
  ];

  let nodeIndex = 0;

  // Create nodes for each layer
  for (const layer of layers) {
    const verticalSpacing = 80;
    const startY = -(layer.count * verticalSpacing) / 2 + 400;

    for (let i = 0; i < layer.count; i++) {
      const id = `${layer.prefix}_${i}`;
      nodes.push(
        createNode({
          id,
          label: `${layer.prefix}_${String(i).padStart(2, "0")}`,
          position: { x: layer.x, y: startY + i * verticalSpacing },
          changeStatus: statuses[nodeIndex % statuses.length],
          resourceType: layer.resourceType,
        }),
      );
      nodeIndex++;
    }
  }

  // Create edges between layers (each node connects to 1-3 nodes in next layer)
  let edgeIndex = 0;
  for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
    const currentLayer = layers[layerIdx];
    const nextLayer = layers[layerIdx + 1];

    for (let i = 0; i < currentLayer.count; i++) {
      const sourceId = `${currentLayer.prefix}_${i}`;
      // Connect to 1-3 nodes in next layer based on position
      const targetCount = Math.min(
        3,
        Math.ceil(nextLayer.count / currentLayer.count),
      );
      const startTarget = Math.floor(
        (i / currentLayer.count) * nextLayer.count,
      );

      for (let j = 0; j < targetCount; j++) {
        const targetIdx = (startTarget + j) % nextLayer.count;
        const targetId = `${nextLayer.prefix}_${targetIdx}`;
        const edgeStatuses: EdgeChangeStatus[] = [
          "unchanged",
          "modified",
          "unchanged",
          "unchanged",
        ];

        edges.push(
          createEdge({
            id: `edge_${edgeIndex}`,
            source: sourceId,
            target: targetId,
            changeStatus: edgeStatuses[edgeIndex % edgeStatuses.length],
          }),
        );
        edgeIndex++;
      }
    }
  }

  return { nodes, edges };
}

// =============================================================================
// COLUMN-LEVEL LINEAGE (CLL) FIXTURES
// =============================================================================

/**
 * Column definition for CLL fixtures
 */
interface ColumnDef {
  name: string;
  type: string;
  changeStatus?: "added" | "removed" | "modified";
  transformationType?: "passthrough" | "renamed" | "derived" | "source";
}

/**
 * Create a LineageGraph node with columns for CLL
 */
function createLineageGraphNode(
  id: string,
  name: string,
  resourceType: string,
  columns: ColumnDef[],
  changeStatus?: "added" | "removed" | "modified",
): LineageGraphNode {
  const columnData: Record<string, { name: string; type: string }> = {};
  for (const col of columns) {
    columnData[col.name] = { name: col.name, type: col.type };
  }

  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      from: "both",
      changeStatus,
      resourceType,
      packageName: "demo",
      data: {
        base: {
          id,
          name,
          unique_id: id,
          resource_type: resourceType,
          package_name: "demo",
          columns: columnData,
        },
        current: {
          id,
          name,
          unique_id: id,
          resource_type: resourceType,
          package_name: "demo",
          columns: columnData,
        },
      },
      parents: {},
      children: {},
    },
  };
}

/**
 * Create a LineageGraph with CLL data for demonstrating column-level lineage
 *
 * This creates a realistic data pipeline:
 * - raw_users (source) -> stg_users (staging) -> dim_users (dimension)
 * - raw_orders (source) -> stg_orders (staging) -> fct_orders (fact)
 * - dim_users + fct_orders -> mart_customer_orders (mart)
 */
export function createCllLineageGraph(): LineageGraph {
  const nodes: Record<string, LineageGraphNode> = {
    // Sources
    "source.demo.raw_users": createLineageGraphNode(
      "source.demo.raw_users",
      "raw_users",
      "source",
      [
        { name: "id", type: "INTEGER", transformationType: "source" },
        { name: "email", type: "VARCHAR", transformationType: "source" },
        { name: "name", type: "VARCHAR", transformationType: "source" },
        { name: "created_at", type: "TIMESTAMP", transformationType: "source" },
      ],
    ),
    "source.demo.raw_orders": createLineageGraphNode(
      "source.demo.raw_orders",
      "raw_orders",
      "source",
      [
        { name: "order_id", type: "INTEGER", transformationType: "source" },
        { name: "user_id", type: "INTEGER", transformationType: "source" },
        { name: "amount", type: "DECIMAL", transformationType: "source" },
        { name: "status", type: "VARCHAR", transformationType: "source" },
        {
          name: "ordered_at",
          type: "TIMESTAMP",
          transformationType: "source",
        },
      ],
    ),

    // Staging
    "model.demo.stg_users": createLineageGraphNode(
      "model.demo.stg_users",
      "stg_users",
      "model",
      [
        { name: "user_id", type: "INTEGER", transformationType: "renamed" },
        { name: "email", type: "VARCHAR", transformationType: "passthrough" },
        {
          name: "full_name",
          type: "VARCHAR",
          transformationType: "renamed",
          changeStatus: "modified",
        },
        {
          name: "created_at",
          type: "TIMESTAMP",
          transformationType: "passthrough",
        },
      ],
      "modified",
    ),
    "model.demo.stg_orders": createLineageGraphNode(
      "model.demo.stg_orders",
      "stg_orders",
      "model",
      [
        {
          name: "order_id",
          type: "INTEGER",
          transformationType: "passthrough",
        },
        { name: "user_id", type: "INTEGER", transformationType: "passthrough" },
        {
          name: "order_amount",
          type: "DECIMAL",
          transformationType: "renamed",
        },
        {
          name: "order_status",
          type: "VARCHAR",
          transformationType: "renamed",
        },
        {
          name: "ordered_at",
          type: "TIMESTAMP",
          transformationType: "passthrough",
        },
      ],
    ),

    // Dimension
    "model.demo.dim_users": createLineageGraphNode(
      "model.demo.dim_users",
      "dim_users",
      "model",
      [
        { name: "user_key", type: "INTEGER", transformationType: "derived" },
        { name: "user_id", type: "INTEGER", transformationType: "passthrough" },
        { name: "email", type: "VARCHAR", transformationType: "passthrough" },
        {
          name: "full_name",
          type: "VARCHAR",
          transformationType: "passthrough",
        },
        {
          name: "is_active",
          type: "BOOLEAN",
          transformationType: "derived",
          changeStatus: "added",
        },
      ],
    ),

    // Fact
    "model.demo.fct_orders": createLineageGraphNode(
      "model.demo.fct_orders",
      "fct_orders",
      "model",
      [
        { name: "order_key", type: "INTEGER", transformationType: "derived" },
        {
          name: "order_id",
          type: "INTEGER",
          transformationType: "passthrough",
        },
        { name: "user_key", type: "INTEGER", transformationType: "derived" },
        {
          name: "order_amount",
          type: "DECIMAL",
          transformationType: "passthrough",
        },
        {
          name: "order_status",
          type: "VARCHAR",
          transformationType: "passthrough",
        },
        {
          name: "ordered_at",
          type: "TIMESTAMP",
          transformationType: "passthrough",
        },
      ],
    ),

    // Mart
    "model.demo.mart_customer_orders": createLineageGraphNode(
      "model.demo.mart_customer_orders",
      "mart_customer_orders",
      "model",
      [
        {
          name: "user_key",
          type: "INTEGER",
          transformationType: "passthrough",
        },
        { name: "email", type: "VARCHAR", transformationType: "passthrough" },
        {
          name: "full_name",
          type: "VARCHAR",
          transformationType: "passthrough",
        },
        {
          name: "total_orders",
          type: "INTEGER",
          transformationType: "derived",
        },
        {
          name: "total_amount",
          type: "DECIMAL",
          transformationType: "derived",
        },
        {
          name: "last_order_date",
          type: "TIMESTAMP",
          transformationType: "derived",
        },
      ],
    ),
  };

  // Set up parent/child relationships
  nodes["model.demo.stg_users"].data.parents = {
    "source.demo.raw_users": {} as never,
  };
  nodes["model.demo.stg_orders"].data.parents = {
    "source.demo.raw_orders": {} as never,
  };
  nodes["model.demo.dim_users"].data.parents = {
    "model.demo.stg_users": {} as never,
  };
  nodes["model.demo.fct_orders"].data.parents = {
    "model.demo.stg_orders": {} as never,
    "model.demo.dim_users": {} as never,
  };
  nodes["model.demo.mart_customer_orders"].data.parents = {
    "model.demo.dim_users": {} as never,
    "model.demo.fct_orders": {} as never,
  };

  const edges: LineageGraph["edges"] = {
    "source.demo.raw_users->model.demo.stg_users": {
      id: "source.demo.raw_users->model.demo.stg_users",
      type: "lineageGraphEdge",
      source: "source.demo.raw_users",
      target: "model.demo.stg_users",
      data: { from: "both" },
    },
    "source.demo.raw_orders->model.demo.stg_orders": {
      id: "source.demo.raw_orders->model.demo.stg_orders",
      type: "lineageGraphEdge",
      source: "source.demo.raw_orders",
      target: "model.demo.stg_orders",
      data: { from: "both" },
    },
    "model.demo.stg_users->model.demo.dim_users": {
      id: "model.demo.stg_users->model.demo.dim_users",
      type: "lineageGraphEdge",
      source: "model.demo.stg_users",
      target: "model.demo.dim_users",
      data: { from: "both" },
    },
    "model.demo.stg_orders->model.demo.fct_orders": {
      id: "model.demo.stg_orders->model.demo.fct_orders",
      type: "lineageGraphEdge",
      source: "model.demo.stg_orders",
      target: "model.demo.fct_orders",
      data: { from: "both" },
    },
    "model.demo.dim_users->model.demo.fct_orders": {
      id: "model.demo.dim_users->model.demo.fct_orders",
      type: "lineageGraphEdge",
      source: "model.demo.dim_users",
      target: "model.demo.fct_orders",
      data: { from: "both" },
    },
    "model.demo.dim_users->model.demo.mart_customer_orders": {
      id: "model.demo.dim_users->model.demo.mart_customer_orders",
      type: "lineageGraphEdge",
      source: "model.demo.dim_users",
      target: "model.demo.mart_customer_orders",
      data: { from: "both" },
    },
    "model.demo.fct_orders->model.demo.mart_customer_orders": {
      id: "model.demo.fct_orders->model.demo.mart_customer_orders",
      type: "lineageGraphEdge",
      source: "model.demo.fct_orders",
      target: "model.demo.mart_customer_orders",
      data: { from: "both" },
    },
  };

  return {
    nodes,
    edges,
    modifiedSet: ["model.demo.stg_users"],
    manifestMetadata: {},
    catalogMetadata: {},
  };
}

/**
 * Create ColumnLineageData for CLL demonstration
 *
 * This maps columns from source -> staging -> dimension/fact -> mart
 * showing how data flows through the pipeline at the column level.
 */
export function createCllData(): ColumnLineageData {
  const nodes: ColumnLineageData["current"]["nodes"] = {
    "source.demo.raw_users": {
      id: "source.demo.raw_users",
      name: "raw_users",
      source_name: "demo",
      resource_type: "source",
    },
    "source.demo.raw_orders": {
      id: "source.demo.raw_orders",
      name: "raw_orders",
      source_name: "demo",
      resource_type: "source",
    },
    "model.demo.stg_users": {
      id: "model.demo.stg_users",
      name: "stg_users",
      source_name: "demo",
      resource_type: "model",
      change_status: "modified",
    },
    "model.demo.stg_orders": {
      id: "model.demo.stg_orders",
      name: "stg_orders",
      source_name: "demo",
      resource_type: "model",
    },
    "model.demo.dim_users": {
      id: "model.demo.dim_users",
      name: "dim_users",
      source_name: "demo",
      resource_type: "model",
    },
    "model.demo.fct_orders": {
      id: "model.demo.fct_orders",
      name: "fct_orders",
      source_name: "demo",
      resource_type: "model",
    },
    "model.demo.mart_customer_orders": {
      id: "model.demo.mart_customer_orders",
      name: "mart_customer_orders",
      source_name: "demo",
      resource_type: "model",
    },
  };

  // Column definitions with transformation types
  const columns: ColumnLineageData["current"]["columns"] = {
    // raw_users columns
    "source.demo.raw_users_id": {
      name: "id",
      type: "INTEGER",
      transformation_type: "source",
    },
    "source.demo.raw_users_email": {
      name: "email",
      type: "VARCHAR",
      transformation_type: "source",
    },
    "source.demo.raw_users_name": {
      name: "name",
      type: "VARCHAR",
      transformation_type: "source",
    },
    "source.demo.raw_users_created_at": {
      name: "created_at",
      type: "TIMESTAMP",
      transformation_type: "source",
    },

    // stg_users columns
    "model.demo.stg_users_user_id": {
      name: "user_id",
      type: "INTEGER",
      transformation_type: "renamed",
    },
    "model.demo.stg_users_email": {
      name: "email",
      type: "VARCHAR",
      transformation_type: "passthrough",
    },
    "model.demo.stg_users_full_name": {
      name: "full_name",
      type: "VARCHAR",
      transformation_type: "renamed",
      change_status: "modified",
    },
    "model.demo.stg_users_created_at": {
      name: "created_at",
      type: "TIMESTAMP",
      transformation_type: "passthrough",
    },

    // dim_users columns
    "model.demo.dim_users_user_key": {
      name: "user_key",
      type: "INTEGER",
      transformation_type: "derived",
    },
    "model.demo.dim_users_user_id": {
      name: "user_id",
      type: "INTEGER",
      transformation_type: "passthrough",
    },
    "model.demo.dim_users_email": {
      name: "email",
      type: "VARCHAR",
      transformation_type: "passthrough",
    },
    "model.demo.dim_users_full_name": {
      name: "full_name",
      type: "VARCHAR",
      transformation_type: "passthrough",
    },
    "model.demo.dim_users_is_active": {
      name: "is_active",
      type: "BOOLEAN",
      transformation_type: "derived",
      change_status: "added",
    },

    // raw_orders columns
    "source.demo.raw_orders_order_id": {
      name: "order_id",
      type: "INTEGER",
      transformation_type: "source",
    },
    "source.demo.raw_orders_user_id": {
      name: "user_id",
      type: "INTEGER",
      transformation_type: "source",
    },
    "source.demo.raw_orders_amount": {
      name: "amount",
      type: "DECIMAL",
      transformation_type: "source",
    },
    "source.demo.raw_orders_status": {
      name: "status",
      type: "VARCHAR",
      transformation_type: "source",
    },
    "source.demo.raw_orders_ordered_at": {
      name: "ordered_at",
      type: "TIMESTAMP",
      transformation_type: "source",
    },

    // stg_orders columns
    "model.demo.stg_orders_order_id": {
      name: "order_id",
      type: "INTEGER",
      transformation_type: "passthrough",
    },
    "model.demo.stg_orders_user_id": {
      name: "user_id",
      type: "INTEGER",
      transformation_type: "passthrough",
    },
    "model.demo.stg_orders_order_amount": {
      name: "order_amount",
      type: "DECIMAL",
      transformation_type: "renamed",
    },
    "model.demo.stg_orders_order_status": {
      name: "order_status",
      type: "VARCHAR",
      transformation_type: "renamed",
    },
    "model.demo.stg_orders_ordered_at": {
      name: "ordered_at",
      type: "TIMESTAMP",
      transformation_type: "passthrough",
    },

    // fct_orders columns
    "model.demo.fct_orders_order_key": {
      name: "order_key",
      type: "INTEGER",
      transformation_type: "derived",
    },
    "model.demo.fct_orders_order_id": {
      name: "order_id",
      type: "INTEGER",
      transformation_type: "passthrough",
    },
    "model.demo.fct_orders_user_key": {
      name: "user_key",
      type: "INTEGER",
      transformation_type: "derived",
    },
    "model.demo.fct_orders_order_amount": {
      name: "order_amount",
      type: "DECIMAL",
      transformation_type: "passthrough",
    },
    "model.demo.fct_orders_order_status": {
      name: "order_status",
      type: "VARCHAR",
      transformation_type: "passthrough",
    },
    "model.demo.fct_orders_ordered_at": {
      name: "ordered_at",
      type: "TIMESTAMP",
      transformation_type: "passthrough",
    },

    // mart_customer_orders columns
    "model.demo.mart_customer_orders_user_key": {
      name: "user_key",
      type: "INTEGER",
      transformation_type: "passthrough",
    },
    "model.demo.mart_customer_orders_email": {
      name: "email",
      type: "VARCHAR",
      transformation_type: "passthrough",
    },
    "model.demo.mart_customer_orders_full_name": {
      name: "full_name",
      type: "VARCHAR",
      transformation_type: "passthrough",
    },
    "model.demo.mart_customer_orders_total_orders": {
      name: "total_orders",
      type: "INTEGER",
      transformation_type: "derived",
    },
    "model.demo.mart_customer_orders_total_amount": {
      name: "total_amount",
      type: "DECIMAL",
      transformation_type: "derived",
    },
    "model.demo.mart_customer_orders_last_order_date": {
      name: "last_order_date",
      type: "TIMESTAMP",
      transformation_type: "derived",
    },
  };

  // Parent map - which columns feed into each column
  const parent_map: ColumnLineageData["current"]["parent_map"] = {
    // Node-level parents
    "model.demo.stg_users": ["source.demo.raw_users"],
    "model.demo.stg_orders": ["source.demo.raw_orders"],
    "model.demo.dim_users": ["model.demo.stg_users"],
    "model.demo.fct_orders": ["model.demo.stg_orders", "model.demo.dim_users"],
    "model.demo.mart_customer_orders": [
      "model.demo.dim_users",
      "model.demo.fct_orders",
    ],

    // Column-level parents (stg_users <- raw_users)
    "model.demo.stg_users_user_id": ["source.demo.raw_users_id"],
    "model.demo.stg_users_email": ["source.demo.raw_users_email"],
    "model.demo.stg_users_full_name": ["source.demo.raw_users_name"],
    "model.demo.stg_users_created_at": ["source.demo.raw_users_created_at"],

    // Column-level parents (dim_users <- stg_users)
    "model.demo.dim_users_user_key": ["model.demo.stg_users_user_id"],
    "model.demo.dim_users_user_id": ["model.demo.stg_users_user_id"],
    "model.demo.dim_users_email": ["model.demo.stg_users_email"],
    "model.demo.dim_users_full_name": ["model.demo.stg_users_full_name"],
    "model.demo.dim_users_is_active": [], // Derived, no direct parent

    // Column-level parents (stg_orders <- raw_orders)
    "model.demo.stg_orders_order_id": ["source.demo.raw_orders_order_id"],
    "model.demo.stg_orders_user_id": ["source.demo.raw_orders_user_id"],
    "model.demo.stg_orders_order_amount": ["source.demo.raw_orders_amount"],
    "model.demo.stg_orders_order_status": ["source.demo.raw_orders_status"],
    "model.demo.stg_orders_ordered_at": ["source.demo.raw_orders_ordered_at"],

    // Column-level parents (fct_orders <- stg_orders + dim_users)
    "model.demo.fct_orders_order_key": ["model.demo.stg_orders_order_id"],
    "model.demo.fct_orders_order_id": ["model.demo.stg_orders_order_id"],
    "model.demo.fct_orders_user_key": ["model.demo.dim_users_user_key"],
    "model.demo.fct_orders_order_amount": [
      "model.demo.stg_orders_order_amount",
    ],
    "model.demo.fct_orders_order_status": [
      "model.demo.stg_orders_order_status",
    ],
    "model.demo.fct_orders_ordered_at": ["model.demo.stg_orders_ordered_at"],

    // Column-level parents (mart_customer_orders <- dim_users + fct_orders)
    "model.demo.mart_customer_orders_user_key": [
      "model.demo.dim_users_user_key",
    ],
    "model.demo.mart_customer_orders_email": ["model.demo.dim_users_email"],
    "model.demo.mart_customer_orders_full_name": [
      "model.demo.dim_users_full_name",
    ],
    "model.demo.mart_customer_orders_total_orders": [
      "model.demo.fct_orders_order_id",
    ],
    "model.demo.mart_customer_orders_total_amount": [
      "model.demo.fct_orders_order_amount",
    ],
    "model.demo.mart_customer_orders_last_order_date": [
      "model.demo.fct_orders_ordered_at",
    ],
  };

  // Child map - inverse of parent map
  const child_map: ColumnLineageData["current"]["child_map"] = {
    // Node-level children
    "source.demo.raw_users": ["model.demo.stg_users"],
    "source.demo.raw_orders": ["model.demo.stg_orders"],
    "model.demo.stg_users": ["model.demo.dim_users"],
    "model.demo.stg_orders": ["model.demo.fct_orders"],
    "model.demo.dim_users": [
      "model.demo.fct_orders",
      "model.demo.mart_customer_orders",
    ],
    "model.demo.fct_orders": ["model.demo.mart_customer_orders"],

    // Column-level children
    "source.demo.raw_users_id": ["model.demo.stg_users_user_id"],
    "source.demo.raw_users_email": ["model.demo.stg_users_email"],
    "source.demo.raw_users_name": ["model.demo.stg_users_full_name"],
    "source.demo.raw_users_created_at": ["model.demo.stg_users_created_at"],

    "model.demo.stg_users_user_id": [
      "model.demo.dim_users_user_key",
      "model.demo.dim_users_user_id",
    ],
    "model.demo.stg_users_email": ["model.demo.dim_users_email"],
    "model.demo.stg_users_full_name": ["model.demo.dim_users_full_name"],

    "model.demo.dim_users_user_key": [
      "model.demo.fct_orders_user_key",
      "model.demo.mart_customer_orders_user_key",
    ],
    "model.demo.dim_users_email": ["model.demo.mart_customer_orders_email"],
    "model.demo.dim_users_full_name": [
      "model.demo.mart_customer_orders_full_name",
    ],

    "source.demo.raw_orders_order_id": ["model.demo.stg_orders_order_id"],
    "source.demo.raw_orders_user_id": ["model.demo.stg_orders_user_id"],
    "source.demo.raw_orders_amount": ["model.demo.stg_orders_order_amount"],
    "source.demo.raw_orders_status": ["model.demo.stg_orders_order_status"],
    "source.demo.raw_orders_ordered_at": ["model.demo.stg_orders_ordered_at"],

    "model.demo.stg_orders_order_id": [
      "model.demo.fct_orders_order_key",
      "model.demo.fct_orders_order_id",
    ],
    "model.demo.stg_orders_order_amount": [
      "model.demo.fct_orders_order_amount",
    ],
    "model.demo.stg_orders_order_status": [
      "model.demo.fct_orders_order_status",
    ],
    "model.demo.stg_orders_ordered_at": ["model.demo.fct_orders_ordered_at"],

    "model.demo.fct_orders_order_id": [
      "model.demo.mart_customer_orders_total_orders",
    ],
    "model.demo.fct_orders_order_amount": [
      "model.demo.mart_customer_orders_total_amount",
    ],
    "model.demo.fct_orders_ordered_at": [
      "model.demo.mart_customer_orders_last_order_date",
    ],
  };

  return {
    current: {
      nodes,
      columns,
      parent_map,
      child_map,
    },
  };
}
