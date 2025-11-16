import { LineageData } from "@/lib/api/info";
import { buildLineageGraph } from "./lineage";

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
  expect(nodes.d.data.from).toBe("both");
  expect(nodes.c.data.children.d.data?.from).toBe("current");
  expect(nodes.d.data.parents.c.data?.from).toBe("current");
  expect(edges.c_d.data?.from).toBe("current");
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
  expect(nodes.a.data.changeStatus).toBe("removed");
  expect(nodes.a2.data.changeStatus).toBe("added");
  expect(nodes.b.data.changeStatus).toBeUndefined();
  expect(nodes.c.data.changeStatus).toBe("modified");
  expect(nodes.d.data.changeStatus).toBeUndefined();

  expect(nodes.b.data.parents.a.data?.changeStatus).toBe("removed");
  expect(nodes.b.data.parents.a2.data?.changeStatus).toBe("added");
  expect(nodes.b.data.children.c.data?.changeStatus).toBeUndefined();
});
