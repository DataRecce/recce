import { buildLineageGraph } from "@datarecce/ui";
import type { MergedLineageResponse } from "@datarecce/ui/api";

test("lineage diff - edge added between existing nodes", () => {
  // Scenario: nodes a, b, c, d exist in both envs
  // In base: d depends on [b] only
  // In current: d depends on [b, c] — edge c->d was added
  const lineage: MergedLineageResponse = {
    nodes: {
      a: { name: "a", resource_type: "model", package_name: "test" },
      b: { name: "b", resource_type: "model", package_name: "test" },
      c: { name: "c", resource_type: "model", package_name: "test" },
      d: { name: "d", resource_type: "model", package_name: "test" },
    },
    edges: [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "d" },
      { source: "c", target: "d", change_status: "added" },
    ],
    metadata: { base: {}, current: {} },
  };

  const { nodes, edges } = buildLineageGraph(lineage);

  expect(Object.keys(nodes).length).toBe(4);
  expect(Object.keys(edges).length).toBe(4);
  // The c->d edge was added
  expect(edges.c_d.data?.changeStatus).toBe("added");
  // The a->b edge has no change
  expect(edges.a_b.data?.changeStatus).toBeUndefined();
});

test("lineage diff 2 - node renamed, node modified", () => {
  // Scenario: a was removed, a2 was added, c was modified
  const lineage: MergedLineageResponse = {
    nodes: {
      a: {
        name: "a",
        resource_type: "model",
        package_name: "test",
        change_status: "removed",
      },
      a2: {
        name: "a2",
        resource_type: "model",
        package_name: "test",
        change_status: "added",
      },
      b: { name: "b", resource_type: "model", package_name: "test" },
      c: {
        name: "c",
        resource_type: "model",
        package_name: "test",
        change_status: "modified",
      },
      d: { name: "d", resource_type: "model", package_name: "test" },
    },
    edges: [
      { source: "a", target: "b", change_status: "removed" },
      { source: "a2", target: "b", change_status: "added" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
    ],
    metadata: { base: {}, current: {} },
  };

  const { nodes, edges } = buildLineageGraph(lineage);

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
