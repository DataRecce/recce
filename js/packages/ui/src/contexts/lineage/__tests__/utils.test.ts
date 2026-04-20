import type { MergedLineageResponse } from "../../../api/info";
import { buildLineageGraph } from "../utils";

describe("buildLineageGraph", () => {
  test("builds graph with correct node and edge counts", () => {
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

    expect(Object.keys(nodes)).toHaveLength(4);
    expect(Object.keys(edges)).toHaveLength(4);
    expect(edges.c_d.data?.changeStatus).toBe("added");
    expect(Object.keys(nodes.d.data.parents)).toEqual(
      expect.arrayContaining(["b", "c"]),
    );
    expect(Object.keys(nodes.b.data.children)).toContain("d");
  });

  test("maps node fields from merged response", () => {
    const lineage: MergedLineageResponse = {
      nodes: {
        "model.proj.orders": {
          name: "orders",
          resource_type: "model",
          package_name: "proj",
          schema: "public",
          materialized: "table",
          tags: ["finance"],
        },
      },
      edges: [],
      metadata: { base: {}, current: {} },
    };

    const { nodes } = buildLineageGraph(lineage);
    const node = nodes["model.proj.orders"];

    expect(node.data.name).toBe("orders");
    expect(node.data.resourceType).toBe("model");
    expect(node.data.packageName).toBe("proj");
    expect(node.data.schema).toBe("public");
    expect(node.data.materialized).toBe("table");
  });

  test("detects added, removed, and modified nodes via change_status", () => {
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
          change: { category: "breaking", columns: { col1: "added" } },
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

    const { nodes, edges, modifiedSet } = buildLineageGraph(lineage);

    expect(Object.keys(nodes)).toHaveLength(5);
    expect(nodes.a.data.changeStatus).toBe("removed");
    expect(nodes.a2.data.changeStatus).toBe("added");
    expect(nodes.b.data.changeStatus).toBeUndefined();
    expect(nodes.c.data.changeStatus).toBe("modified");
    expect(nodes.c.data.change?.columns).toEqual({ col1: "added" });
    expect(nodes.d.data.changeStatus).toBeUndefined();

    expect(edges.a_b.data?.changeStatus).toBe("removed");
    expect(edges.a2_b.data?.changeStatus).toBe("added");
    expect(edges.b_c.data?.changeStatus).toBeUndefined();

    expect(modifiedSet).toEqual(
      expect.arrayContaining(["a", "a2", "c"]),
    );
    expect(modifiedSet).not.toContain("b");
    expect(modifiedSet).not.toContain("d");
  });

  test("extracts metadata from merged response", () => {
    const lineage: MergedLineageResponse = {
      nodes: {},
      edges: [],
      metadata: {
        base: {
          manifest_metadata: {
            dbt_version: "1.7.0",
            project_name: "test",
          } as any,
        },
        current: {
          manifest_metadata: {
            dbt_version: "1.8.0",
            project_name: "test",
          } as any,
        },
      },
    };

    const { manifestMetadata, catalogMetadata } = buildLineageGraph(lineage);

    expect(manifestMetadata.base?.dbt_version).toBe("1.7.0");
    expect(manifestMetadata.current?.dbt_version).toBe("1.8.0");
    expect(catalogMetadata.base).toBeUndefined();
  });
});
