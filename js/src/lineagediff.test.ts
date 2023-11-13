import { LineageData, LineageGraph, buildLineageGraph } from "./lineagediff";
import { queryDiff } from "./querydiff";

test("lineage diff", () => {
  const base = {
    nodes: {},
    parent_map: {
      a: [],
      b: ["a"],
      c: ["a"],
      d: ["b"],
    },
  };

  const current = {
    nodes: {},
    parent_map: {
      a: [],
      b: ["a"],
      c: ["a"],
      d: ["b", "c"],
    },
  };

  const { nodes, edges } = buildLineageGraph(base, current);

  expect(Object.keys(nodes).length).toBe(4);
  expect(Object.keys(edges).length).toBe(4);
  expect(nodes["d"].from).toBe("both");
  expect(nodes["c"].children["d"].from).toBe("current");
  expect(nodes["d"].parents["c"].from).toBe("current");
  expect(edges["c_d"].from).toBe("current");
});

test("lineage diff 2", () => {
  const base = {
    nodes: {
      c: {
        unique_id: "c",
        name: "c",
        checksum: {
          name: "sha1",
          checksum: "c#v1",
        },
      },
    },
    parent_map: {
      a: [],
      b: ["a"],
      c: ["b"],
    },
  };

  const current: LineageData = {
    nodes: {
      c: {
        unique_id: "c",
        name: "c",
        checksum: {
          name: "sha1",
          checksum: "c#v2",
        },
      },
    },
    parent_map: {
      a2: [],
      b: ["a2"],
      c: ["b"],
    },
  };

  const { nodes, edges } = buildLineageGraph(base, current);

  expect(Object.keys(nodes).length).toBe(4);
  expect(Object.keys(edges).length).toBe(3);
  expect(nodes["a"].changeStatus).toBe("removed");
  expect(nodes["b"].changeStatus).toBeUndefined;
  expect(nodes["c"].changeStatus).toBe("modified");

  expect(nodes["b"].parents["a"].changeStatus).toBe("removed");
  expect(nodes["b"].parents["a2"].changeStatus).toBe("added");
  expect(nodes["b"].children["c"].changeStatus).toBeUndefined;
});
