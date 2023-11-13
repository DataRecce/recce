import { buildLineageGraph, lineageGraph } from "./lineagediff";
import { queryDiff } from "./querydiff";

test("lineage diff", () => {
  const base = {
    parent_map: {
      a: [],
      b: ["a"],
      c: ["a"],
      d: ["b"],
    },
  };

  const current = {
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
    parent_map: {
      a: [],
      b: ["a"],
      c: ["b"],
    },
  };

  const current = {
    parent_map: {
      a2: [],
      b: ["a2"],
      c: ["b"],
    },
  };

  const { nodes, edges } = buildLineageGraph(base, current);

  expect(Object.keys(nodes).length).toBe(4);
  expect(Object.keys(edges).length).toBe(3);
  expect(nodes["a"].from).toBe("base");
  expect(nodes["b"].from).toBe("both");

  expect(nodes["b"].parents["a"].from).toBe("base");
  expect(nodes["b"].parents["a2"].from).toBe("current");
  expect(nodes["b"].children["c"].from).toBe("both");
});
