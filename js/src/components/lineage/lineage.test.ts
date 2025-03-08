import {
  LineageGraphEdge,
  LineageGraphNode,
  buildLineageGraph,
  highlightNodes,
  selectDownstream,
  selectUpstream,
  toReactflow,
} from "./lineage";
import { Node, Edge } from "reactflow";

import { find } from "lodash";
import { union } from "./graph";
import { LineageData } from "@/lib/api/info";

test("lineage diff", () => {
  const base: LineageData = {
    metadata: { pr_url: "" },
    nodes: {
      a: {
        id: "a",
        unique_id: "a",
        name: "a",
      },
      b: {
        id: "b",
        unique_id: "b",
        name: "b",
      },
      c: {
        id: "c",
        unique_id: "c",
        name: "c",
      },
      d: {
        id: "d",
        unique_id: "d",
        name: "d",
      },
    },
    parent_map: {
      a: [],
      b: ["a"],
      c: ["a"],
      d: ["b"],
    },
    catalog_metadata: null,
  };

  const current: LineageData = {
    metadata: { pr_url: "" },
    nodes: {
      a: {
        id: "a",
        unique_id: "a",
        name: "a",
      },
      b: {
        id: "b",
        unique_id: "b",
        name: "b",
      },
      c: {
        id: "c",
        unique_id: "c",
        name: "c",
      },
      d: {
        id: "d",
        unique_id: "d",
        name: "d",
      },
    },
    parent_map: {
      a: [],
      b: ["a"],
      c: ["a"],
      d: ["b", "c"],
    },
    catalog_metadata: null,
  };

  const { nodes, edges } = buildLineageGraph(base, current);

  expect(Object.keys(nodes).length).toBe(4);
  expect(Object.keys(edges).length).toBe(4);
  expect(nodes.d.from).toBe("both");
  expect(nodes.c.children.d.from).toBe("current");
  expect(nodes.d.parents.c.from).toBe("current");
  expect(edges.c_d.from).toBe("current");
});

test("lineage diff 2", () => {
  const base: LineageData = {
    metadata: { pr_url: "" },
    nodes: {
      a: {
        id: "a",
        unique_id: "a",
        name: "a",
      },
      b: {
        id: "b",
        unique_id: "b",
        name: "b",
      },
      c: {
        id: "c",
        unique_id: "c",
        name: "c",
        checksum: {
          name: "sha1",
          checksum: "c#v1",
        },
      },
      d: {
        id: "d",
        unique_id: "d",
        name: "d",
      },
    },
    parent_map: {
      a: [],
      b: ["a"],
      c: ["b"],
      d: ["c"],
    },
    catalog_metadata: null,
  };

  const current: LineageData = {
    metadata: { pr_url: "" },
    nodes: {
      a2: {
        id: "a2",
        unique_id: "a2",
        name: "a2",
      },
      b: {
        id: "b",
        unique_id: "b",
        name: "b",
      },
      c: {
        id: "c",
        unique_id: "c",
        name: "c",
        checksum: {
          name: "sha1",
          checksum: "c#v2",
        },
      },
      d: {
        id: "d",
        unique_id: "d",
        name: "d",
      },
    },
    parent_map: {
      a2: [],
      b: ["a2"],
      c: ["b"],
      d: ["c"],
    },
    catalog_metadata: null,
  };

  const { nodes, edges } = buildLineageGraph(base, current);

  expect(Object.keys(nodes).length).toBe(5);
  expect(Object.keys(edges).length).toBe(4);
  expect(nodes.a.changeStatus).toBe("removed");
  expect(nodes.a2.changeStatus).toBe("added");
  expect(nodes.b.changeStatus).toBeUndefined();
  expect(nodes.c.changeStatus).toBe("modified");
  expect(nodes.d.changeStatus).toBeUndefined();

  expect(nodes.b.parents.a.changeStatus).toBe("removed");
  expect(nodes.b.parents.a2.changeStatus).toBe("added");
  expect(nodes.b.children.c.changeStatus).toBeUndefined();
});

test("hightlight", () => {
  const base: LineageData = {
    metadata: { pr_url: "" },
    nodes: {
      a: {
        id: "a",
        unique_id: "a",
        name: "a",
      },
      b: {
        id: "b",
        unique_id: "b",
        name: "b",
      },
      c: {
        id: "c",
        unique_id: "c",
        name: "c",
      },
      d: {
        id: "d",
        unique_id: "d",
        name: "d",
      },
    },
    parent_map: {
      a: [],
      b: ["a"],
      c: ["b"],
      d: ["c"],
    },
    catalog_metadata: null,
  };

  const current: LineageData = {
    metadata: { pr_url: "" },
    nodes: {
      a2: {
        id: "a2",
        unique_id: "a2",
        name: "a2",
      },
      b: {
        id: "b",
        unique_id: "b",
        name: "b",
      },
      c: {
        id: "c",
        unique_id: "c",
        name: "c",
      },
      d: {
        id: "d",
        unique_id: "d",
        name: "d",
      },
    },
    parent_map: {
      a2: [],
      b: ["a2"],
      c: ["b"],
      d: ["c"],
    },
    catalog_metadata: null,
  };

  const lineageGraph = buildLineageGraph(base, current);
  const [nodes, edges] = toReactflow(lineageGraph);
  const relatedNodes = union(
    selectUpstream(lineageGraph, ["a"]),
    selectDownstream(lineageGraph, ["a"]),
  );
  const [nodes2, edges2] = highlightNodes(Array.from(relatedNodes), nodes, edges);

  expect(nodes.length).toBe(nodes2.length);
  expect(edges.length).toBe(edges2.length);

  const n = (nodes: Node<LineageGraphNode>[], id: string) =>
    find(nodes, (node) => node.id === id)?.data;
  const e = (edges: Edge<LineageGraphEdge>[], id: string) =>
    find(edges, (edge) => edge.id === id)?.data;

  expect(n(nodes2, "a")?.isHighlighted).toBe(true);
  expect(n(nodes2, "a2")?.isHighlighted).toBe(false);
  expect(e(edges2, "a_b")?.isHighlighted).toBe(true);
  expect(e(edges2, "a2_b")?.isHighlighted).toBe(false);
});
