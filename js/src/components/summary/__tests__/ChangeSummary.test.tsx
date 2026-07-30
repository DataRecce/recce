import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import { ChangeSummary } from "@datarecce/ui/components/summary";
import { render, screen, within } from "@testing-library/react";

type NodeChangeStatus = "added" | "removed" | "modified";
type ColumnChanges = Record<
  string,
  "added" | "removed" | "modified" | "unknown"
>;

function createNode(
  id: string,
  changeStatus: NodeChangeStatus,
  columnChanges?: ColumnChanges,
): LineageGraphNode {
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name: id,
      changeStatus,
      resourceType: "model",
      packageName: "test",
      parents: {},
      children: {},
      ...(columnChanges
        ? {
            change: {
              category: "non_breaking" as const,
              columns: columnChanges,
            },
          }
        : {}),
    },
  };
}

function createGraph(nodes: LineageGraphNode[]): LineageGraph {
  return {
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    edges: {},
    modifiedSet: nodes.map(({ id }) => id),
    manifestMetadata: { base: undefined, current: undefined },
    catalogMetadata: { base: undefined, current: undefined },
  };
}

function expectCount(label: string, count: number) {
  const labelElement = screen.getByText(label);
  const countGroup = labelElement.parentElement;

  expect(countGroup).not.toBeNull();
  expect(
    within(countGroup as HTMLElement).getByText(String(count)),
  ).toBeVisible();
  // Every counter carries the icon for its own change status, so dropping a
  // branch of getIconForChangeStatus (or the conditional render) fails here.
  expect((countGroup as HTMLElement).querySelector("svg")).not.toBeNull();
}

function expectCounts({
  models,
  columns,
}: {
  models: [added: number, removed: number, modified: number];
  columns: [added: number, removed: number, modified: number];
}) {
  expectCount("Model Added", models[0]);
  expectCount("Model Removed", models[1]);
  expectCount("Model Modified", models[2]);
  expectCount("Column Added", columns[0]);
  expectCount("Column Removed", columns[1]);
  expectCount("Column Modified", columns[2]);
}

describe("ChangeSummary counts from lineage graph data", () => {
  it("shows zero counts for a graph with no nodes", () => {
    render(<ChangeSummary lineageGraph={createGraph([])} />);

    expectCounts({ models: [0, 0, 0], columns: [0, 0, 0] });
  });

  it("counts added models and no columns when no column changes are present", () => {
    const graph = createGraph([
      createNode("model.new_model_1", "added"),
      createNode("model.new_model_2", "added"),
      createNode("model.new_model_3", "added"),
    ]);

    render(<ChangeSummary lineageGraph={graph} />);

    expectCounts({ models: [3, 0, 0], columns: [0, 0, 0] });
  });

  it("counts each model once by its status and each column by its own status", () => {
    const graph = createGraph([
      createNode("model.customers", "modified", {
        phone: "added",
        name: "modified",
      }),
      createNode("model.orders", "modified", {
        discount: "removed",
      }),
      createNode("model.new_analytics", "added", {
        id: "added",
        metric: "added",
      }),
      createNode("model.legacy_report", "removed", {
        id: "removed",
        value: "removed",
      }),
    ]);

    render(<ChangeSummary lineageGraph={graph} />);

    expectCounts({ models: [1, 1, 2], columns: [3, 3, 1] });
  });

  it("sums model and column counts across 15 changed models", () => {
    const statuses: NodeChangeStatus[] = [
      "added",
      "removed",
      "modified",
      "added",
      "removed",
      "modified",
      "added",
      "removed",
      "modified",
      "added",
      "removed",
      "modified",
      "added",
      "removed",
      "modified",
    ];
    const graph = createGraph(
      statuses.map((status, index) => {
        const columnChanges: ColumnChanges =
          status === "added"
            ? { id: "added", col_a: "added", col_b: "added" }
            : status === "removed"
              ? { id: "removed", col_a: "removed" }
              : { col_a: "modified", col_b: "modified", col_c: "added" };
        return createNode(`model.model_${index}`, status, columnChanges);
      }),
    );

    render(<ChangeSummary lineageGraph={graph} />);

    // Two modified columns per modified model, deliberately: with one,
    // `Model Removed` (5) and `Column Modified` (5) held the same value in every
    // fixture, so swapping those two counters passed the whole suite. Across the
    // four fixtures no pair of the six counters is equal everywhere now.
    expectCounts({ models: [5, 5, 5], columns: [20, 10, 10] });
  });
});
