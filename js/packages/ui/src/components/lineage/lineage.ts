import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import {
  COLUMN_HEIGHT,
  type LineageGraph,
  type LineageGraphColumnNode,
  type LineageGraphEdge,
  type LineageGraphNode,
  type LineageGraphNodes,
  layoutWithDagre,
  type NodeColumnSetMap,
} from "../..";
import type { ColumnLineageData } from "../../api";
import type { ColumnAnnotation } from "./computeColumnLineage";
import { cllChangeStatusColors } from "./styles";

/**
 * Convert a LineageGraph to React Flow nodes and edges with column-level lineage support
 *
 * This OSS-specific function extends the basic toReactFlow functionality with:
 * - Column-level lineage (CLL) visualization
 * - Dynamic node heights based on column count
 * - Column nodes as child nodes within parent model nodes
 *
 * @param lineageGraph - The lineage graph to convert
 * @param options - Conversion options
 * @param options.selectedNodes - Optional filter for which nodes to include
 * @param options.cll - Column-level lineage data for adding column nodes
 * @param options.existingPositions - Map of node IDs to their existing positions. If provided, nodes will preserve their positions and layout will be skipped if all nodes have positions.
 * @returns Tuple of [nodes, edges, nodeColumnSetMap] where nodeColumnSetMap tracks columns per node
 *
 * @example
 * ```tsx
 * const [nodes, edges, columnSetMap] = toReactFlow(lineageGraph, {
 *   selectedNodes: ["model.project.orders"],
 *   cll: columnLineageData,
 * });
 * ```
 */
export function toReactFlow(
  lineageGraph: LineageGraph,
  options?: {
    selectedNodes?: string[];
    cll?: ColumnLineageData;
    existingPositions?: Map<string, { x: number; y: number }>;
    newCllExperience?: boolean;
    columnAncestry?: Map<string, ColumnAnnotation[]>;
  },
): [LineageGraphNodes[], LineageGraphEdge[], NodeColumnSetMap] {
  const nodes: LineageGraphNodes[] = [];
  const edges: LineageGraphEdge[] = [];
  const {
    selectedNodes,
    cll,
    existingPositions,
    newCllExperience,
    columnAncestry,
  } = options ?? {};

  const nodeColumnSetMap: NodeColumnSetMap = {};

  function getWeight(changeStatus?: string) {
    if (changeStatus === "removed") {
      return 0;
    } else if (changeStatus === "added") {
      return 2;
    } else {
      return 1;
    }
  }

  function compareFn(
    a: LineageGraphNode | LineageGraphEdge,
    b: LineageGraphNode | LineageGraphEdge,
  ) {
    const weightA = getWeight(a.data?.changeStatus);
    const weightB = getWeight(b.data?.changeStatus);

    if (weightA < weightB) {
      return -1;
    } else if (weightA > weightB) {
      return 1;
    }
    return 0;
  }

  const filterSet =
    selectedNodes !== undefined ? new Set(selectedNodes) : undefined;
  const sortedNodes = Object.values(lineageGraph.nodes).sort(compareFn);
  for (const node of sortedNodes) {
    if (filterSet && !filterSet.has(node.id)) {
      continue;
    }

    // add column nodes
    const nodeColumnSet = new Set<string>();
    let columnIndex = 0;
    if (cll && !newCllExperience) {
      const maybeCurrent = cll.current as unknown as
        | ColumnLineageData["current"]
        | undefined;
      const parentMap = maybeCurrent?.parent_map[node.id] ?? new Set<string>();

      for (const parentKey of parentMap) {
        const source = parentKey;
        const target = node.id;

        edges.push({
          id: `m2c_${source}_${target}`,
          source,
          target,
          style: {
            zIndex: 9999,
          },
        });
      }

      const cllColumnNames = Object.entries(maybeCurrent?.columns ?? {})
        .filter(([key]) => key.startsWith(`${node.id}_`))
        .map(([key]) => key.slice(node.id.length + 1));

      for (const columnName of cllColumnNames) {
        const columnKey = `${node.id}_${columnName}`;
        const maybeCurrent = cll.current as unknown as
          | ColumnLineageData["current"]
          | undefined;
        const column = maybeCurrent?.columns[columnKey];
        const parentMap =
          maybeCurrent?.parent_map[columnKey] ?? new Set<string>();

        if (column == null) {
          continue;
        }

        nodes.push({
          id: columnKey,
          position: { x: 10, y: 70 + columnIndex * COLUMN_HEIGHT },
          parentId: node.id,
          extent: "parent",
          draggable: false,
          className: "no-track-pii-safe",
          data: {
            node: node.data,
            column: column.name,
            type: column.type,
            transformationType: column.transformation_type,
            changeStatus: column.change_status,
          },
          style: {
            zIndex: 9999,
          },
          type: "lineageGraphColumnNode",
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        } as LineageGraphColumnNode);

        for (const parentColumn of parentMap) {
          const source = parentColumn;
          const target = columnKey;

          edges.push({
            id: `${source}_${target}`,
            source,
            target,
            style: {
              zIndex: 9999,
            },
          });
        }

        columnIndex++;
        nodeColumnSet.add(column.name);
      }
    }

    nodeColumnSetMap[node.id] = nodeColumnSet;

    let height = 60;
    if (columnIndex > 0) {
      height += 20 + columnIndex * COLUMN_HEIGHT;
    }

    const existingPosition = existingPositions?.get(node.id);
    nodes.unshift({
      id: node.id,
      position: existingPosition ?? { x: 0, y: 0 },
      width: 300,
      height: height,
      className: "no-track-pii-safe",
      data: {
        ...node.data,
      },
      type: "lineageGraphNode",
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      style: {
        width: 300,
        height: height,
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

  // Add column ancestry annotation nodes for new CLL experience column mode
  if (newCllExperience && columnAncestry && cll) {
    addColumnAncestryNodes(nodes, edges, columnAncestry, cll, filterSet);
  }

  // Only run layout if any parent node is missing a position
  const needsLayout = nodes.some(
    (node) =>
      node.type === "lineageGraphNode" && !existingPositions?.has(node.id),
  );

  if (needsLayout) {
    layout(nodes, edges);
  }

  return [nodes, edges, nodeColumnSetMap];
}

/**
 * Add column ancestry annotation nodes and edges to the graph.
 *
 * For each model in the ancestry map, creates child column nodes positioned
 * inside the model node, edges between ancestor columns that follow the
 * parent_map, and expands model node heights to fit their columns.
 */
function addColumnAncestryNodes(
  nodes: LineageGraphNodes[],
  edges: LineageGraphEdge[],
  columnAncestry: Map<string, ColumnAnnotation[]>,
  cll: ColumnLineageData,
  filterSet: Set<string> | undefined,
) {
  // Build columnId -> annotation lookup and set of ancestry column IDs
  const ancestryColumnIds = new Set<string>();
  const columnIdToAnnotation = new Map<
    string,
    { modelId: string; isImpacted: boolean }
  >();
  for (const [modelId, annotations] of columnAncestry) {
    // Skip columns whose model isn't in the current graph view
    if (filterSet && !filterSet.has(modelId)) continue;

    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      const columnKey = `${modelId}_${annotation.column}`;
      ancestryColumnIds.add(columnKey);
      columnIdToAnnotation.set(columnKey, {
        modelId,
        isImpacted: annotation.isImpacted,
      });
      const col = cll.current.columns[columnKey];

      nodes.push({
        id: columnKey,
        position: { x: 10, y: 64 + i * COLUMN_HEIGHT },
        parentId: modelId,
        draggable: false,
        className: "no-track-pii-safe",
        data: {
          node: { id: modelId } as never,
          column: annotation.column,
          type: col?.type,
          transformationType: annotation.transformationType,
          changeStatus: annotation.changeStatus,
          isHighlighted: true,
          isFocused: false,
          isImpacted: annotation.isImpacted,
        },
        style: {
          zIndex: 9999,
        },
        type: "lineageGraphColumnNode",
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
      } as LineageGraphColumnNode);
    }

    // Expand model node to fit its ancestry columns
    if (annotations.length > 0) {
      const modelNode = nodes.find(
        (n) => n.id === modelId && n.type === "lineageGraphNode",
      );
      if (modelNode) {
        modelNode.height = 60 + 20 + annotations.length * COLUMN_HEIGHT;
      }
    }
  }

  // Add edges between ancestry column nodes
  for (const columnId of ancestryColumnIds) {
    const parents = cll.current.parent_map[columnId] ?? [];
    for (const parentColumnId of parents) {
      if (ancestryColumnIds.has(parentColumnId)) {
        const sourceInfo = columnIdToAnnotation.get(parentColumnId);
        // Amber edge if source column is impacted
        const isSourceImpacted = sourceInfo?.isImpacted ?? false;
        edges.push({
          id: `ancestry_${parentColumnId}_${columnId}`,
          source: parentColumnId,
          target: columnId,
          style: {
            zIndex: 9999,
            strokeWidth: 2,
            stroke: isSourceImpacted
              ? cllChangeStatusColors.impacted
              : cllChangeStatusColors.unchanged,
          },
        });
      }
    }
  }
}

/**
 * Apply dagre layout to lineage graph nodes and edges
 *
 * This is a thin wrapper around layoutWithDagre from @datarecce/ui
 * that provides the dagre library instance.
 *
 * @param nodes - Array of lineage graph nodes
 * @param edges - Array of lineage graph edges
 * @param direction - Layout direction ("LR" for left-to-right, "TB" for top-to-bottom)
 */
export const layout = (
  nodes: LineageGraphNodes[],
  edges: LineageGraphEdge[],
  direction = "LR",
): void => {
  layoutWithDagre(dagre, nodes, edges, direction);
};
