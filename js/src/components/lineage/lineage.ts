import { Node, Edge, Position } from "reactflow";
import { getNeighborSet } from "./graph";

/**
 * The data from the API
 */
export interface NodeColumnData {
  name: string;
  type: string;
}
export interface NodeData {
  unique_id: string;
  name: string;
  checksum?: {
    name: string;
    checksum: string;
  };
  raw_code?: string;
  resource_type?: string;
  package_name?: string;
  columns?: { [key: string]: NodeColumnData };
}

interface CatalogMetadata {
  dbt_schema_version: string;
  dbt_version: string;
  generated_at: string;
  invocation_id: string;
  env: Record<string, any>;
}

export interface LineageData {
  nodes?: {
    [key: string]: NodeData;
  };
  parent_map: {
    [key: string]: string[];
  };
  catalog_metadata: CatalogMetadata | null;
}

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
  parents: {
    [key: string]: LineageGraphEdge;
  };
  children: {
    [key: string]: LineageGraphEdge;
  };

  isSelected: boolean;
  isHighlighted?: boolean;
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
  nodes: {
    [key: string]: LineageGraphNode;
  };

  edges: {
    [key: string]: LineageGraphEdge;
  };
}

export interface CatalogExistence {
  base: boolean;
  current: boolean;
}

export interface DefaultLineageGraphSets {
  all: LineageGraph;
  changed: LineageGraph;
  modifiedSet: string[];
  catalogExistence: CatalogExistence;
}

export function buildDefaultLineageGraphSets(
  base: LineageData,
  current: LineageData
): DefaultLineageGraphSets {
  function buildAllLineageGraph(base: LineageData, current: LineageData): LineageGraph {
    const nodes: { [key: string]: LineageGraphNode } = {};
    const edges: { [key: string]: LineageGraphEdge } = {};
    const buildNode = (
      key: string,
      from: "base" | "current"
    ): LineageGraphNode => {
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

    for (const [key, parents] of Object.entries(base.parent_map)) {
      nodes[key] = buildNode(key, "base");
      const nodeData = base.nodes && base.nodes[key];
      if (nodeData) {
        nodes[key].data.base = nodeData;
        nodes[key].name = nodeData?.name;
        nodes[key].resourceType = nodeData?.resource_type;
        nodes[key].packageName = nodeData?.package_name;
      }
    }

    for (const [key, parents] of Object.entries(current.parent_map)) {
      if (nodes[key]) {
        nodes[key].from = "both";
      } else {
        nodes[key] = buildNode(key, "current");
      }
      const nodeData = current.nodes && current.nodes[key];
      if (nodeData) {
        nodes[key].data.current = current.nodes && current.nodes[key];
        nodes[key].name = nodeData?.name;
        nodes[key].resourceType = nodeData?.resource_type;
        nodes[key].packageName = nodeData?.package_name;
      }
    }

    for (const [child, parents] of Object.entries(base.parent_map)) {
      for (const parent of parents) {
        const childNode = nodes[child];
        const parentNode = nodes[parent];
        const id = `${parent}_${child}`;
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

    return { edges, nodes };
  }
  function buildChangedOnlyLineageGraph(all: LineageGraph, modifiedSet: string[]): LineageGraph {
    const nodes: { [key: string]: LineageGraphNode } = {};
    const edges: { [key: string]: LineageGraphEdge } = {};
    function union(...sets: Set<string>[]) {
      const unionSet = new Set<string>();

      sets.forEach((set) => {
        set.forEach((key) => {
          unionSet.add(key);
        });
      });
      return unionSet;
    }


    // Select all downstream sets of modified nodes
    const downstreamSet = selectDownstream(all, modifiedSet);

    // Select a single upstream layer of modified nodes
    const upstreamSet = selectUpstream(all, modifiedSet, 1);

    // Union of upstream and downstream nodes
    const modifiedSets = union(downstreamSet, upstreamSet);

    Object.entries(all.nodes).forEach(([key, node]) => {
      if (modifiedSets.has(key)) {
        nodes[key] = node;
      }
    });

    Object.entries(all.edges).forEach(([key, edge]) => {
      if (modifiedSets.has(edge.parent.id) && modifiedSets.has(edge.child.id)) {
        edges[key] = edge;
      }
    });

    return { nodes, edges }
  }

  const { nodes, edges } = buildAllLineageGraph(base, current);

  const modifiedSet: string[] = [];
  for (const [key, node] of Object.entries(nodes)) {
    if (node.from === "base") {
      node.changeStatus = "removed";
      modifiedSet.push(node.id);
    } else if (node.from === "current") {
      node.changeStatus = "added";
      modifiedSet.push(node.id);
    } else {
      const checksum1 = node?.data?.base?.checksum?.checksum;
      const checksum2 = node?.data?.current?.checksum?.checksum;

      if (checksum1 && checksum2 && checksum1 !== checksum2) {
        node.changeStatus = "modified";
        modifiedSet.push(node.id);
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

  return {
    all: {
      nodes,
      edges,
    },
    changed: buildChangedOnlyLineageGraph({ nodes, edges }, modifiedSet),
    modifiedSet,
    catalogExistence: {
      base: !!base.catalog_metadata,
      current: !!current.catalog_metadata,
    },
  };


}

export function selectUpstream(lineageGraph: LineageGraph, nodeIds: string[], degree: number = 1000) {
  return getNeighborSet(nodeIds, (key) => {
      if (lineageGraph.nodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].parents);
    }, degree);
}

export function selectDownstream(lineageGraph: LineageGraph, nodeIds: string[], degree: number = 1000) {
  return getNeighborSet(nodeIds, (key) => {
      if (lineageGraph.nodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].children)
    }, degree);
}

export function toReactflow(lineageGraph: LineageGraph, modifiedSet: string[]): [Node[], Edge[]] {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const backgroundColorMap = {
    removed: "red",
    added: "green",
    modified: "orange",
  };
  const strokeColorMap = {
    removed: "red",
    added: "green",
  };

  for (const [key, node] of Object.entries(lineageGraph.nodes)) {
    nodes.push({
      id: node.id,
      position: { x: 0, y: 0 },
      data: node,
      type: "customNode",
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });
  }

  for (const [key, edge] of Object.entries(lineageGraph.edges)) {
    edges.push({
      id: edge.id,
      type: "customEdge",
      source: edge.parent.id,
      target: edge.child.id,
      data: edge,
    });
  }

  return highlightPath(lineageGraph, modifiedSet, nodes, edges, null);
}

export function highlightPath(
  lineageGraph: LineageGraph,
  modifiedSet: string[],
  nodes: Node<LineageGraphNode>[],
  edges: Edge[],
  id: string | null,
): [Node<LineageGraphNode>[], Edge[]] {
  function union(...sets: Set<string>[]) {
    const unionSet = new Set<string>();

    sets.forEach((set) => {
      set.forEach((key) => {
        unionSet.add(key);
      });
    });

    return unionSet;
  }

  const relatedNodes =
    id !== null
      ? union(
          selectUpstream(lineageGraph, [id]),
          selectDownstream(lineageGraph, [id]),
        )
      : getNeighborSet(modifiedSet, (key) => {
          if (lineageGraph.nodes[key] === undefined) return [];
          return Object.keys(lineageGraph.nodes[key].children)
        }
        );

  const relatedEdges = new Set(
    edges
      .filter((edge) => {
        return relatedNodes.has(edge.source) && relatedNodes.has(edge.target);
      })
      .map((edge) => edge.id)
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

export function selectSingleNode(
  nodeId: string,
  nodes: Node<LineageGraphNode>[],
) {
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

export function selectNode(
  nodeId: string,
  nodes: Node<LineageGraphNode>[],
) {
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

export function selectNodes(
  nodeIds: string[],
  nodes: Node<LineageGraphNode>[],
) {
  const newNodes = nodes.map((n) => {
    const isMatch = nodeIds.includes(n.id);
    return {
      ...n,
      data: {
        ...n.data,
        isSelected: n.data.isSelected || isMatch,
      },
    };
  });
  return newNodes;
}

export function cleanUpSelectedNodes(
  nodes: Node<LineageGraphNode>[],
) {
  const newNodes = nodes.map((n) => {
    return {
      ...n,
      data: {
        ...n.data,
        isSelected: false,
      },
    };
  });
  return newNodes;
}

export function getSelectedNodes(
  nodes: Node<LineageGraphNode>[],
) {
  const selectedNodes = nodes.filter((n) => n.data.isSelected);
  return selectedNodes;
}
