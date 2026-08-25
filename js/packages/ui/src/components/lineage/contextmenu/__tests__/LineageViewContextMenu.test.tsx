/**
 * @file LineageViewContextMenu.test.tsx
 *
 * "Show Impact Radius" on a modified node — the second of the two user-facing
 * Impact Radius entry points (the CLL control button is the other). The whole
 * activation is asserted here at the component that owns the click, so the
 * state-transition tests in `../../__tests__/CllChangeAnalysisPropagation.test.ts`
 * cannot go on passing if this call site stops enabling change analysis.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { LineageGraphNode } from "../../../../contexts/lineage/types";
import {
  ColumnNodeContextMenu,
  ModelNodeContextMenu,
} from "../LineageViewContextMenu";

const NODE_ID = "model.test.orders";

function modifiedNode(): LineageGraphNode {
  return {
    id: NODE_ID,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id: NODE_ID,
      name: "orders",
      resourceType: "model",
      packageName: "test",
      changeStatus: "modified",
      parents: {},
      children: {},
    },
  } as unknown as LineageGraphNode;
}

describe("ModelNodeContextMenu — Show Impact Radius", () => {
  it("turns change analysis on and requests the radius scoped to the node", async () => {
    const setChangeAnalysisMode = vi.fn();
    const showColumnLevelLineage = vi.fn().mockResolvedValue(undefined);
    render(
      <ModelNodeContextMenu
        x={0}
        y={0}
        isOpen
        onClose={vi.fn()}
        node={modifiedNode()}
        viewOptions={{ setChangeAnalysisMode, showColumnLevelLineage }}
      />,
    );

    await userEvent.click(screen.getByText("Show Impact Radius"));

    expect(setChangeAnalysisMode).toHaveBeenCalledWith(true);
    expect(showColumnLevelLineage).toHaveBeenCalledWith({
      node_id: NODE_ID,
      change_analysis: true,
      no_upstream: true,
    });
  });
});

describe("ColumnNodeContextMenu — Histogram launcher", () => {
  it("keeps lineage-column Histogram as a direct launch with its source", async () => {
    const runAction = vi.fn();
    const Icon = () => <span />;
    render(
      <ColumnNodeContextMenu
        x={0}
        y={0}
        isOpen
        onClose={vi.fn()}
        node={
          {
            id: "model.test.orders.column.amount",
            data: {
              node: { name: "orders" },
              column: "amount",
              type: "DECIMAL(12, 2)",
              changeStatus: "modified",
            },
          } as never
        }
        deps={{
          runAction,
          findByRunType: (type) => ({
            title: type === "histogram_diff" ? "Histogram Diff" : type,
            icon: Icon,
          }),
          supportsHistogramDiff: () => true,
        }}
      />,
    );

    await userEvent.click(
      screen.getByRole("menuitem", { name: "Histogram Diff" }),
    );

    expect(runAction).toHaveBeenCalledWith(
      "histogram_diff",
      {
        model: "orders",
        column_name: "amount",
        column_type: "DECIMAL(12, 2)",
      },
      {
        showForm: false,
        trackProps: { source: "lineage_column_node" },
      },
    );
  });
});
