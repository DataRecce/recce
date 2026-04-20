import type { ColumnLineageData } from "../../../api/cll";
import type { MergedLineageResponse } from "../../../api/info";
import { patchLineageFromCll } from "../patchLineageDiffFromCll";

describe("patchLineageFromCll", () => {
  const NODE_ID = "model.test.orders";

  function makeLineage(
    nodes: MergedLineageResponse["nodes"] = {},
  ): MergedLineageResponse {
    return {
      nodes,
      edges: [],
      metadata: { base: {}, current: {} },
    };
  }

  it("patches node with change_status and change from CLL", () => {
    const lineage = makeLineage({
      [NODE_ID]: {
        name: "orders",
        resource_type: "model",
        package_name: "test",
      },
    });
    const cllData: ColumnLineageData = {
      current: {
        nodes: {
          [NODE_ID]: {
            id: NODE_ID,
            name: "orders",
            source_name: "",
            resource_type: "model",
            change_status: "modified",
            change_category: "breaking",
            columns: {
              "model.test.orders.order_id": {
                name: "order_id",
                type: "INTEGER",
                change_status: "modified",
              },
              "model.test.orders.amount": {
                name: "amount",
                type: "FLOAT",
              },
            },
          },
        },
        columns: {},
        parent_map: {},
        child_map: {},
      },
    };

    const result = patchLineageFromCll(lineage, cllData);

    expect(result.nodes[NODE_ID]).toEqual({
      name: "orders",
      resource_type: "model",
      package_name: "test",
      change_status: "modified",
      change: {
        category: "breaking",
        columns: {
          order_id: "modified",
        },
      },
    });
  });

  it("preserves existing nodes not in CLL", () => {
    const OTHER_NODE = "model.test.customers";
    const lineage = makeLineage({
      [NODE_ID]: {
        name: "orders",
        resource_type: "model",
        package_name: "test",
      },
      [OTHER_NODE]: {
        name: "customers",
        resource_type: "model",
        package_name: "test",
        change_status: "added",
      },
    });
    const cllData: ColumnLineageData = {
      current: {
        nodes: {
          [NODE_ID]: {
            id: NODE_ID,
            name: "orders",
            source_name: "",
            resource_type: "model",
            change_status: "modified",
            change_category: "non_breaking",
          },
        },
        columns: {},
        parent_map: {},
        child_map: {},
      },
    };

    const result = patchLineageFromCll(lineage, cllData);

    expect(result.nodes[OTHER_NODE]).toEqual({
      name: "customers",
      resource_type: "model",
      package_name: "test",
      change_status: "added",
    });
    expect(result.nodes[NODE_ID].change_status).toBe("modified");
  });

  it("skips CLL nodes without change_status", () => {
    const lineage = makeLineage({
      [NODE_ID]: {
        name: "orders",
        resource_type: "model",
        package_name: "test",
      },
    });
    const cllData: ColumnLineageData = {
      current: {
        nodes: {
          [NODE_ID]: {
            id: NODE_ID,
            name: "orders",
            source_name: "",
            resource_type: "model",
          },
        },
        columns: {},
        parent_map: {},
        child_map: {},
      },
    };

    const result = patchLineageFromCll(lineage, cllData);

    // Node should be unchanged
    expect(result.nodes[NODE_ID].change_status).toBeUndefined();
  });

  it("handles multiple nodes in CLL response (impact radius)", () => {
    const NODE_A = "model.test.orders";
    const NODE_B = "model.test.line_items";
    const lineage = makeLineage({
      [NODE_A]: {
        name: "orders",
        resource_type: "model",
        package_name: "test",
      },
      [NODE_B]: {
        name: "line_items",
        resource_type: "model",
        package_name: "test",
      },
    });
    const cllData: ColumnLineageData = {
      current: {
        nodes: {
          [NODE_A]: {
            id: NODE_A,
            name: "orders",
            source_name: "",
            resource_type: "model",
            change_status: "modified",
            change_category: "breaking",
          },
          [NODE_B]: {
            id: NODE_B,
            name: "line_items",
            source_name: "",
            resource_type: "model",
            change_status: "added",
          },
        },
        columns: {},
        parent_map: {},
        child_map: {},
      },
    };

    const result = patchLineageFromCll(lineage, cllData);

    expect(result.nodes[NODE_A]?.change_status).toBe("modified");
    expect(result.nodes[NODE_B]?.change_status).toBe("added");
  });

  it("preserves existing change when change_category is absent", () => {
    const lineage = makeLineage({
      [NODE_ID]: {
        name: "orders",
        resource_type: "model",
        package_name: "test",
        change: {
          category: "unknown",
          columns: null,
        },
      },
    });
    const cllData: ColumnLineageData = {
      current: {
        nodes: {
          [NODE_ID]: {
            id: NODE_ID,
            name: "orders",
            source_name: "",
            resource_type: "model",
            change_status: "added",
          },
        },
        columns: {},
        parent_map: {},
        child_map: {},
      },
    };

    const result = patchLineageFromCll(lineage, cllData);

    expect(result.nodes[NODE_ID].change_status).toBe("added");
    // Preserves existing change when CLL has no change_category
    expect(result.nodes[NODE_ID].change).toEqual({
      category: "unknown",
      columns: null,
    });
  });
});
