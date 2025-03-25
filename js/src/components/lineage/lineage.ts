import { Node, Edge, Position } from "reactflow";
import { getNeighborSet, union } from "./graph";
import { Run } from "@/lib/api/types";
import dagre from "dagre";
import {
  CatalogMetadata,
  LineageData,
  LineageDiffData,
  ManifestMetadata,
  NodeData,
} from "@/lib/api/info";
import { CllResponse, ColumnLineageData } from "@/lib/api/cll";

/**
 * THe types for internal data structures.
 */

export interface LineageGraphNode {
  id: string;
  name: string;
  from: "both" | "base" | "current";
  data: {
    base?: NodeData;
    current?: NodeData;
  };
  changeStatus?: "added" | "removed" | "modified";
  resourceType?: string;
  packageName?: string;
  parents: Record<string, LineageGraphEdge>;
  children: Record<string, LineageGraphEdge>;

  isSelected: boolean;
  isHighlighted?: boolean;

  /**
   * The action status for the node which is trigger by action for multiple nodes
   */
  isActionMode?: boolean;
  action?: {
    mode: "per_node" | "multi_nodes";
    status?: "pending" | "running" | "success" | "failure" | "skipped";
    skipReason?: string;
    run?: Run;
  };

  /**
   * Column Level Linage. Only show the column in the set
   */
  columnSet?: Set<string>;
}

export interface LinageGraphColumnNode {
  node: LineageGraphNode;
  column: string;
  type: string;
  transformationType: string;
}

export interface LineageGraphEdge {
  id: string;
  from: "both" | "base" | "current";
  changeStatus?: "added" | "removed";
  parent: LineageGraphNode;
  child: LineageGraphNode;
  isHighlighted?: boolean;
}

export interface LineageGraph {
  nodes: Record<string, LineageGraphNode>;

  edges: Record<string, LineageGraphEdge>;
  modifiedSet: string[];
  nonBreakingSet: Set<string>;
  impactedSet: Set<string>;

  manifestMetadata: {
    base?: ManifestMetadata;
    current?: ManifestMetadata;
  };
  catalogMetadata: {
    base?: CatalogMetadata;
    current?: CatalogMetadata;
  };
}

export function _selectColumnLevelLineage(node: string, column: string, cll: ColumnLineageData) {
  const parentMap: Record<string, string[]> = {};
  const childMap: Record<string, string[]> = {};
  const selectedColumn = `${node}_${column}`;

  for (const modelNode of Object.values(cll.current.nodes)) {
    const nodeId = modelNode.id;
    if (!nodeId) {
      continue;
    }
    for (const columnNode of Object.values(modelNode.columns ?? {})) {
      const target = `${nodeId}_${columnNode.name}`;
      parentMap[target] = [];

      for (const parent of columnNode.depends_on || []) {
        const source = `${parent.node}_${parent.column}`;
        parentMap[target].push(source);
        if (!(source in childMap)) {
          childMap[source] = [];
        }
        childMap[source].push(target);
      }
    }
  }

  const selectColumnUpstream = (nodeIds: string[], degree = 1000) => {
    return getNeighborSet(
      nodeIds,
      (key) => {
        if (!(key in parentMap)) {
          return [];
        }
        return parentMap[key];
      },
      degree,
    );
  };

  const selectColumnDownstream = (nodeIds: string[], degree = 1000) => {
    return getNeighborSet(
      nodeIds,
      (key) => {
        if (!(key in childMap)) {
          return [];
        }
        return childMap[key];
      },
      degree,
    );
  };

  const columnSet = union(
    selectColumnDownstream([selectedColumn]),
    selectColumnUpstream([selectedColumn]),
  );
  return columnSet;
}

export function buildLineageGraph(
  base: LineageData,
  current: LineageData,
  diff?: LineageDiffData,
): LineageGraph {
  const nodes: Record<string, LineageGraphNode> = {};
  const edges: Record<string, LineageGraphEdge> = {};
  const buildNode = (key: string, from: "base" | "current"): LineageGraphNode => {
    return {
      id: key,
      name: key,
      data: {},
      from,
      parents: {},
      children: {},
      isSelected: false,
    };
  };

  for (const [key, nodeData] of Object.entries(base.nodes)) {
    nodes[key] = buildNode(key, "base");
    if (nodeData) {
      nodes[key].data.base = nodeData;
      nodes[key].name = nodeData.name;
      nodes[key].resourceType = nodeData.resource_type;
      nodes[key].packageName = nodeData.package_name;
    }
  }

  for (const [key, nodeData] of Object.entries(current.nodes)) {
    if (nodes[key]) {
      nodes[key].from = "both";
    } else {
      nodes[key] = buildNode(key, "current");
    }
    if (nodeData) {
      // TODO `current.nodes` is treated as potentially falsy here
      //  this means either that a) the typing needs to be adjusted
      //  on `current.nodes` or b) the input to `current.nodes`
      //  should default to a value
      nodes[key].data.current = current.nodes?.[key];
      nodes[key].name = nodeData.name;
      nodes[key].resourceType = nodeData.resource_type;
      nodes[key].packageName = nodeData.package_name;
    }
  }

  for (const [child, parents] of Object.entries(base.parent_map)) {
    for (const parent of parents) {
      const childNode = nodes[child];
      const parentNode = nodes[parent];
      const id = `${parent}_${child}`;

      if (!childNode || !parentNode) {
        // Skip the edge if the node is not found
        continue;
      }
      edges[id] = {
        id,
        from: "base",
        parent: parentNode,
        child: childNode,
      };
      const edge = edges[id];

      childNode.parents[parent] = edge;
      parentNode.children[child] = edge;
    }
  }

  for (const [child, parents] of Object.entries(current.parent_map)) {
    for (const parent of parents) {
      const childNode = nodes[child];
      const parentNode = nodes[parent];
      const id = `${parent}_${child}`;

      if (!childNode || !parentNode) {
        // Skip the edge if the node is not found
        continue;
      }
      if (edges[id]) {
        edges[id].from = "both";
      } else {
        edges[id] = {
          id,
          from: "current",
          parent: parentNode,
          child: childNode,
        };
      }
      const edge = edges[id];

      childNode.parents[parent] = edge;
      parentNode.children[child] = edge;
    }
  }

  const modifiedSet: string[] = [];
  const nonBreakingSet: string[] = [];
  const breakingSet: string[] = [];

  for (const [key, node] of Object.entries(nodes)) {
    if (diff) {
      const diffNode = diff[key];
      if (diffNode) {
        node.changeStatus = diffNode.change_status;
        modifiedSet.push(key);

        if (diffNode.change_category === "non-breaking") {
          nonBreakingSet.push(key);
        } else {
          breakingSet.push(key);
        }
      }
    } else if (node.from === "base") {
      node.changeStatus = "removed";
      modifiedSet.push(node.id);
    } else if (node.from === "current") {
      node.changeStatus = "added";
      modifiedSet.push(node.id);
    } else {
      const checksum1 = node.data.base?.checksum?.checksum;
      const checksum2 = node.data.current?.checksum?.checksum;

      if (checksum1 && checksum2 && checksum1 !== checksum2) {
        node.changeStatus = "modified";
        modifiedSet.push(node.id);
        breakingSet.push(key);
      }
    }
  }

  for (const [key, edge] of Object.entries(edges)) {
    if (edge.from === "base") {
      edge.changeStatus = "removed";
    } else if (edge.from === "current") {
      edge.changeStatus = "added";
    }
  }

  const impactedSet = union(
    new Set(modifiedSet),
    getNeighborSet(breakingSet, (key) => {
      if (nodes[key] === undefined) {
        return [];
      }
      return Object.keys(nodes[key].children);
    }),
  );

  return {
    nodes,
    edges,
    modifiedSet,
    nonBreakingSet: new Set(nonBreakingSet),
    impactedSet,
    manifestMetadata: {
      base: base.manifest_metadata || undefined,
      current: current.manifest_metadata || undefined,
    },
    catalogMetadata: {
      base: base.catalog_metadata || undefined,
      current: current.catalog_metadata || undefined,
    },
  };
}

export function selectUpstream(lineageGraph: LineageGraph, nodeIds: string[], degree = 1000) {
  return getNeighborSet(
    nodeIds,
    (key) => {
      if (lineageGraph.nodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].parents);
    },
    degree,
  );
}

export function selectDownstream(lineageGraph: LineageGraph, nodeIds: string[], degree = 1000) {
  return getNeighborSet(
    nodeIds,
    (key) => {
      if (lineageGraph.nodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].children);
    },
    degree,
  );
}

export function selectAllNodes(lineageGraph: LineageGraph) {
  return new Set(Object.values(lineageGraph.nodes).map((node) => node.id));
}

export function selectImpactRadius(lineageGraph: LineageGraph, breakingChangeEnabled: boolean) {
  if (!breakingChangeEnabled) {
    return selectDownstream(lineageGraph, lineageGraph.modifiedSet);
  } else {
    return lineageGraph.impactedSet;
  }
}

export function toReactflow(
  lineageGraph: LineageGraph,
  selectedNodes?: string[],
  columnLevelLineage?: {
    node: string;
    column: string;
  },
  cll?: CllResponse,
): [Node[], Edge[]] {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const columnSet =
    columnLevelLineage &&
    cll?.status === "finished" &&
    cll.params.node_id === columnLevelLineage.node
      ? _selectColumnLevelLineage(columnLevelLineage.node, columnLevelLineage.column, cll.result)
      : new Set<string>();

  function getWeight(from: string) {
    if (from === "base") {
      return 0;
    } else if (from === "current") {
      return 2;
    } else {
      return 1;
    }
  }

  function compareFn(
    a: LineageGraphNode | LineageGraphEdge,
    b: LineageGraphNode | LineageGraphEdge,
  ) {
    const weightA = getWeight(a.from);
    const weightB = getWeight(b.from);

    if (weightA < weightB) {
      return -1;
    } else if (weightA > weightB) {
      return 1;
    }
    return 0;
  }

  const filterSet = selectedNodes !== undefined ? new Set(selectedNodes) : undefined;
  const sortedNodes = Object.values(lineageGraph.nodes).sort(compareFn);
  for (const node of sortedNodes) {
    if (filterSet && !filterSet.has(node.id)) {
      continue;
    }

    // add column nodes
    const nodeColumnSet = new Set<string>();
    let columnIndex = 0;
    if (cll?.result.current.nodes && node.id in cll.result.current.nodes) {
      for (const column of Object.values(cll.result.current.nodes[node.id].columns ?? {})) {
        const columnKey = `${node.id}_${column.name}`;
        if (!columnSet.has(columnKey)) {
          continue;
        }

        nodes.push({
          id: columnKey,
          position: { x: 10, y: 70 + columnIndex * 15 },
          parentId: node.id,
          extent: "parent",
          draggable: false,
          data: {
            node,
            column: column.name,
            type: column.type,
            transformationType: column.transformation_type,
          },
          style: {
            zIndex: 9999,
          },
          type: "customColumnNode",
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        });

        for (const parentColumn of column.depends_on || []) {
          const source = `${parentColumn.node}_${parentColumn.column}`;
          const target = columnKey;

          if (!columnSet.has(source)) {
            continue;
          }

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
        nodeColumnSet.add(columnKey);
      }
    }

    nodes.push({
      id: node.id,
      position: { x: 0, y: 0 },
      width: 300,
      height: 36 + columnIndex * 15,
      data: {
        ...node,
        columnSet: nodeColumnSet,
      },
      type: "customNode",
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });
  }

  const sortedEdges = Object.values(lineageGraph.edges).sort(compareFn);
  for (const edge of sortedEdges) {
    if (filterSet && (!filterSet.has(edge.parent.id) || !filterSet.has(edge.child.id))) {
      continue;
    }

    edges.push({
      id: edge.id,
      type: "customEdge",
      source: edge.parent.id,
      target: edge.child.id,
      data: edge,
    });
  }

  layout(nodes, edges);

  // return highlightChanged(lineageGraph, nodes, edges);
  return [nodes, edges];
}

export function filterNodes(nodes: Node[], edges: Edge[], nodeIds: Set<string>): [Node[], Edge[]] {
  const newNodes = nodes.filter((node) => nodeIds.has(node.id));
  const newEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return [newNodes, newEdges];
}

export function hideNodes(nodes: Node[], edges: Edge[], nodeIds: Set<string>): [Node[], Edge[]] {
  const newNodes = nodes.map((node) => {
    return {
      ...node,
      hidden: !nodeIds.has(node.id),
    };
  });

  const newEdges = edges.map((edge) => {
    return {
      ...edge,
      hidden: !nodeIds.has(edge.source) || !nodeIds.has(edge.target),
    };
  });

  layout(newNodes, newEdges);
  return [newNodes, newEdges];
}

export const layout = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    if (node.type !== "customNode") {
      return;
    }
    dagreGraph.setNode(node.id, { width: node.width, height: node.height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    if (node.type !== "customNode") {
      return;
    }
    const nodeWidth = node.width || 300;
    const nodeHeight = node.height || 36;

    const nodeWithPosition = dagreGraph.node(node.id);

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });
};

export function highlightNodes(
  nodesIds: string[],
  nodes: Node<LineageGraphNode>[],
  edges: Edge[],
): [Node<LineageGraphNode>[], Edge[]] {
  const relatedNodes = new Set(nodesIds);
  const relatedEdges = new Set(
    edges
      .filter((edge) => {
        return relatedNodes.has(edge.source) && relatedNodes.has(edge.target);
      })
      .map((edge) => edge.id),
  );

  const newNodes = nodes.map((node) => {
    return {
      ...node,
      data: {
        ...node.data,
        isHighlighted: relatedNodes.has(node.id),
      },
    };
  });
  const newEdges = edges.map((edge) => {
    return {
      ...edge,
      data: {
        ...edge.data,
        isHighlighted: relatedEdges.has(edge.id),
      },
    };
  });

  return [newNodes, newEdges];
}

export function highlightChanged(
  lineageGraph: LineageGraph,
  nodes: Node<LineageGraphNode>[],
  edges: Edge[],
) {
  const modifiedDownstream = selectDownstream(lineageGraph, lineageGraph.modifiedSet);

  return highlightNodes(Array.from(modifiedDownstream), nodes, edges);
}

export function selectSingleNode(nodeId: string, nodes: Node<LineageGraphNode>[]) {
  const newNodes = nodes.map((n) => {
    const isMatch = n.id === nodeId;
    return {
      ...n,
      data: {
        ...n.data,
        isSelected: isMatch,
      },
    };
  });
  return newNodes;
}

export function selectNode(nodeId: string, nodes: Node<LineageGraphNode>[]) {
  const newNodes = nodes.map((n) => {
    const isMatch = n.id === nodeId;
    return {
      ...n,
      data: {
        ...n.data,
        isSelected: n.data.isSelected !== isMatch,
      },
    };
  });
  return newNodes;
}

export function selectNodes(nodeIds: string[], nodes: Node<LineageGraphNode>[], reset = false) {
  const newNodes = nodes.map((n) => {
    const isMatch = nodeIds.includes(n.id);
    return {
      ...n,
      data: {
        ...n.data,
        isSelected: reset ? isMatch : n.data.isSelected || isMatch,
      },
    };
  });
  return newNodes;
}

export function deselectNodes(nodes: Node<LineageGraphNode>[]) {
  return nodes.map((n) => {
    return {
      ...n,
      data: {
        ...n.data,
        isSelected: false,
      },
    };
  });
}

export function cleanUpNodes(nodes: Node<LineageGraphNode>[], isActionMode?: boolean) {
  const newNodes = nodes.map((n) => {
    return {
      ...n,
      data: {
        ...n.data,
        // isSelected: false,
        isActionMode,
        action: undefined,
      },
    };
  });
  return newNodes;
}

export function getSelectedNodes(nodes: Node<LineageGraphNode>[]) {
  const selectedNodes = nodes.filter((n) => n.data.isSelected);
  return selectedNodes;
}
