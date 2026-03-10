import type { ColumnLineageData } from "../../../api/cll";
import type { LineageDiffData } from "../../../api/info";
import { patchLineageDiffFromCll } from "../patchLineageDiffFromCll";

describe("patchLineageDiffFromCll", () => {
  const NODE_ID = "model.test.orders";

  it("patches diff with change_status and change_category from CLL node", () => {
    const existingDiff: LineageDiffData = {};
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

    const result = patchLineageDiffFromCll(existingDiff, cllData);

    expect(result[NODE_ID]).toEqual({
      change_status: "modified",
      change: {
        category: "breaking",
        columns: {
          order_id: "modified",
        },
      },
    });
  });

  it("preserves existing diff entries for nodes not in CLL", () => {
    const OTHER_NODE = "model.test.customers";
    const existingDiff: LineageDiffData = {
      [OTHER_NODE]: {
        change_status: "added",
        change: null,
      },
    };
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

    const result = patchLineageDiffFromCll(existingDiff, cllData);

    expect(result[OTHER_NODE]).toEqual({
      change_status: "added",
      change: null,
    });
    expect(result[NODE_ID]).toBeDefined();
  });

  it("skips CLL nodes without change_status", () => {
    const existingDiff: LineageDiffData = {};
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

    const result = patchLineageDiffFromCll(existingDiff, cllData);

    expect(result[NODE_ID]).toBeUndefined();
  });

  it("merges existing diff entry with CLL change data (preserves, then overlays)", () => {
    const existingDiff: LineageDiffData = {
      [NODE_ID]: {
        change_status: "modified",
        change: null,
      },
    };
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
                change_status: "added",
              },
            },
          },
        },
        columns: {},
        parent_map: {},
        child_map: {},
      },
    };

    const result = patchLineageDiffFromCll(existingDiff, cllData);

    expect(result[NODE_ID]).toEqual({
      change_status: "modified",
      change: {
        category: "breaking",
        columns: { order_id: "added" },
      },
    });
  });

  it("handles multiple nodes in CLL response (impact radius)", () => {
    const NODE_A = "model.test.orders";
    const NODE_B = "model.test.line_items";
    const existingDiff: LineageDiffData = {};
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

    const result = patchLineageDiffFromCll(existingDiff, cllData);

    expect(result[NODE_A]?.change_status).toBe("modified");
    expect(result[NODE_B]?.change_status).toBe("added");
  });

  it("sets change to null when change_category is absent", () => {
    const existingDiff: LineageDiffData = {};
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

    const result = patchLineageDiffFromCll(existingDiff, cllData);

    expect(result[NODE_ID]).toEqual({
      change_status: "added",
      change: null,
    });
  });
});
