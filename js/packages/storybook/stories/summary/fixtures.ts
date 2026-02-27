// packages/storybook/stories/summary/fixtures.ts
import type { LineageGraph } from "@datarecce/ui";

/**
 * Helper to create a lineage graph node
 */
function createNode(
  id: string,
  name: string,
  options: {
    from?: "both" | "base" | "current";
    changeStatus?: "added" | "removed" | "modified";
    baseColumns?: Record<string, { name: string; type: string }>;
    currentColumns?: Record<string, { name: string; type: string }>;
  } = {},
) {
  const {
    from = "both",
    changeStatus,
    baseColumns = {},
    currentColumns = {},
  } = options;

  return {
    id,
    type: "lineageGraphNode" as const,
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      from,
      data: {
        base:
          from !== "current"
            ? {
                id,
                unique_id: id,
                name,
                schema: "analytics",
                columns: baseColumns,
              }
            : undefined,
        current:
          from !== "base"
            ? {
                id,
                unique_id: id,
                name,
                schema: "analytics",
                columns: currentColumns,
              }
            : undefined,
      },
      changeStatus,
      resourceType: "model",
      packageName: "myproject",
      parents: {},
      children: {},
    },
  };
}

/**
 * Create a lineage graph with various change types
 */
export const createChangeSummaryGraph = (
  overrides: Partial<LineageGraph> = {},
): LineageGraph => {
  const nodes = {
    "model.myproject.customers": createNode(
      "model.myproject.customers",
      "customers",
      {
        changeStatus: "modified",
        baseColumns: {
          id: { name: "id", type: "integer" },
          name: { name: "name", type: "text" },
          email: { name: "email", type: "text" },
        },
        currentColumns: {
          id: { name: "id", type: "integer" },
          name: { name: "name", type: "varchar" }, // type changed
          email: { name: "email", type: "text" },
          phone: { name: "phone", type: "text" }, // column added
        },
      },
    ),
    "model.myproject.orders": createNode("model.myproject.orders", "orders", {
      changeStatus: "modified",
      baseColumns: {
        id: { name: "id", type: "integer" },
        total: { name: "total", type: "number" },
        discount: { name: "discount", type: "number" }, // will be removed
      },
      currentColumns: {
        id: { name: "id", type: "integer" },
        total: { name: "total", type: "number" },
      },
    }),
    "model.myproject.new_analytics": createNode(
      "model.myproject.new_analytics",
      "new_analytics",
      {
        from: "current",
        changeStatus: "added",
        currentColumns: {
          id: { name: "id", type: "integer" },
          metric: { name: "metric", type: "number" },
        },
      },
    ),
    "model.myproject.legacy_report": createNode(
      "model.myproject.legacy_report",
      "legacy_report",
      {
        from: "base",
        changeStatus: "removed",
        baseColumns: {
          id: { name: "id", type: "integer" },
          value: { name: "value", type: "number" },
        },
      },
    ),
  };

  return {
    nodes,
    edges: {},
    modifiedSet: [
      "model.myproject.customers",
      "model.myproject.orders",
      "model.myproject.new_analytics",
      "model.myproject.legacy_report",
    ],
    manifestMetadata: { base: undefined, current: undefined },
    catalogMetadata: { base: undefined, current: undefined },
    ...overrides,
  };
};

/**
 * Lineage graph with no changes
 */
export const noChangesGraph: LineageGraph = {
  nodes: {
    "model.myproject.stable": createNode("model.myproject.stable", "stable"),
  },
  edges: {},
  modifiedSet: [],
  manifestMetadata: { base: undefined, current: undefined },
  catalogMetadata: { base: undefined, current: undefined },
};

/**
 * Lineage graph with only additions
 */
export const additionsOnlyGraph: LineageGraph = {
  nodes: {
    "model.myproject.new_model_1": createNode(
      "model.myproject.new_model_1",
      "new_model_1",
      { from: "current", changeStatus: "added" },
    ),
    "model.myproject.new_model_2": createNode(
      "model.myproject.new_model_2",
      "new_model_2",
      { from: "current", changeStatus: "added" },
    ),
    "model.myproject.new_model_3": createNode(
      "model.myproject.new_model_3",
      "new_model_3",
      { from: "current", changeStatus: "added" },
    ),
  },
  edges: {},
  modifiedSet: [
    "model.myproject.new_model_1",
    "model.myproject.new_model_2",
    "model.myproject.new_model_3",
  ],
  manifestMetadata: { base: undefined, current: undefined },
  catalogMetadata: { base: undefined, current: undefined },
};

/**
 * Lineage graph with many changes (large project)
 */
export const manyChangesGraph: LineageGraph = (() => {
  const nodes: Record<string, ReturnType<typeof createNode>> = {};
  const modifiedSet: string[] = [];
  const statuses = ["added", "removed", "modified"] as const;

  for (let i = 0; i < 15; i++) {
    const id = `model.myproject.model_${i}`;
    const status = statuses[i % 3];
    const from =
      status === "added" ? "current" : status === "removed" ? "base" : "both";

    nodes[id] = createNode(id, `model_${i}`, {
      from,
      changeStatus: status,
      baseColumns:
        from !== "current"
          ? {
              id: { name: "id", type: "integer" },
              col_a: { name: "col_a", type: "text" },
            }
          : undefined,
      currentColumns:
        from !== "base"
          ? {
              id: { name: "id", type: "integer" },
              col_a: { name: "col_a", type: "varchar" },
              col_b: { name: "col_b", type: "number" },
            }
          : undefined,
    });
    modifiedSet.push(id);
  }

  return {
    nodes,
    edges: {},
    modifiedSet,
    manifestMetadata: { base: undefined, current: undefined },
    catalogMetadata: { base: undefined, current: undefined },
  };
})();
