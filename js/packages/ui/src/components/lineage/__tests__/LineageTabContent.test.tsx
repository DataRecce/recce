/**
 * @file LineageTabContent.test.tsx
 * @description Tests for the Lineage tab body that lives inside the Model
 * Detail panel and shows direct upstream/downstream plus a back-path
 * breadcrumb.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { LineageGraphNode } from "../../../contexts/lineage/types";
import { LineageTabContent } from "../LineageTabContent";

function makeNode(
  id: string,
  overrides: Partial<LineageGraphNode["data"]> = {},
): LineageGraphNode {
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name: id,
      resourceType: "model",
      parents: {},
      children: {},
      ...overrides,
    },
  } as LineageGraphNode;
}

function makeNodesById(
  ids: string[],
  overrides: Record<string, Partial<LineageGraphNode["data"]>> = {},
): Record<string, LineageGraphNode> {
  const out: Record<string, LineageGraphNode> = {};
  for (const id of ids) {
    out[id] = makeNode(id, overrides[id]);
  }
  return out;
}

describe("LineageTabContent", () => {
  test("renders direct upstream and downstream rows and direct counts", () => {
    const parents = { p1: {} as never, p2: {} as never };
    const children = { c1: {} as never };
    const node = makeNode("focus", { parents, children });
    const nodesById = makeNodesById(["p1", "p2", "c1", "focus"]);

    render(<LineageTabContent node={node} nodesById={nodesById} />);

    expect(screen.getByTestId("lineage-tab-content")).toBeInTheDocument();
    expect(screen.getByText("p1")).toBeInTheDocument();
    expect(screen.getByText("p2")).toBeInTheDocument();
    expect(screen.getByText("c1")).toBeInTheDocument();
    // Direct counts.
    expect(screen.getByText("· 2 direct")).toBeInTheDocument();
    expect(screen.getByText("· 1 direct")).toBeInTheDocument();
  });

  test("shows empty hints when the focused node has no upstream or downstream", () => {
    const node = makeNode("isolated");
    render(<LineageTabContent node={node} />);
    expect(screen.getByText("(source — no upstream)")).toBeInTheDocument();
    expect(screen.getByText("(leaf — no downstream)")).toBeInTheDocument();
  });

  test("invokes onNavigate when a row is clicked", () => {
    const parents = { p1: {} as never };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p1"]);
    const onNavigate = vi.fn();

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText("p1"));
    expect(onNavigate).toHaveBeenCalledWith("p1");
  });

  test("shows a filter input when direct children exceed the threshold", () => {
    const childIds = Array.from({ length: 12 }, (_, i) => `c${i + 1}`);
    const children = Object.fromEntries(
      childIds.map((id) => [id, {} as never]),
    );
    const node = makeNode("focus", { children });
    const nodesById = makeNodesById(childIds);

    render(<LineageTabContent node={node} nodesById={nodesById} />);

    expect(screen.getByLabelText("Filter Downstream")).toBeInTheDocument();
  });

  test("filter input narrows the visible list", () => {
    const childIds = [
      "stg_orders",
      "stg_customers",
      "stg_payments",
      "stg_products",
      "stg_locations",
      "stg_items",
      "stg_stores",
      "stg_vendors",
      "dim_orders",
      "dim_customers",
    ];
    const children = Object.fromEntries(
      childIds.map((id) => [id, {} as never]),
    );
    const node = makeNode("focus", { children });
    const nodesById = makeNodesById(childIds);

    render(<LineageTabContent node={node} nodesById={nodesById} />);

    const input = screen.getByLabelText("Filter Downstream");
    fireEvent.change(input, { target: { value: "dim" } });

    expect(screen.getByText("dim_orders")).toBeInTheDocument();
    expect(screen.getByText("dim_customers")).toBeInTheDocument();
    expect(screen.queryByText("stg_orders")).not.toBeInTheDocument();
  });

  test("paginated 'show more' reveals additional rows", () => {
    const childIds = Array.from({ length: 15 }, (_, i) => `child_${i + 1}`);
    const children = Object.fromEntries(
      childIds.map((id) => [id, {} as never]),
    );
    const node = makeNode("focus", { children });
    const nodesById = makeNodesById(childIds);

    render(<LineageTabContent node={node} nodesById={nodesById} />);

    // Initial page size is 8, so child_15 is hidden.
    expect(screen.queryByText("child_15")).not.toBeInTheDocument();
    const showMore = screen.getByText(
      (_, el) => el?.textContent?.startsWith("+ show") ?? false,
    );
    fireEvent.click(showMore);
    expect(screen.getByText("child_15")).toBeInTheDocument();
  });

  test("hides the back button by default and shows it when onBack is provided", () => {
    const parents = { p1: {} as never };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p1"]);

    const { rerender } = render(
      <LineageTabContent node={node} nodesById={nodesById} />,
    );
    expect(
      screen.queryByLabelText("Back to previous node"),
    ).not.toBeInTheDocument();

    const onBack = vi.fn();
    rerender(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        onBack={onBack}
        historyTrail={["prev"]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Back to previous node"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("renders the center icon in the focus card and calls onCenterFocus", () => {
    const parents = { p1: {} as never };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p1"]);
    const onCenterFocus = vi.fn();

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        onCenterFocus={onCenterFocus}
      />,
    );
    fireEvent.click(screen.getByLabelText("Center on canvas"));
    expect(onCenterFocus).toHaveBeenCalledTimes(1);
  });

  test("breadcrumb is hidden when historyTrail is empty", () => {
    const node = makeNode("focus");
    render(<LineageTabContent node={node} />);
    expect(screen.queryByText("Path")).not.toBeInTheDocument();
  });

  test("breadcrumb shows only the most recent previous step even with multiple history entries", () => {
    const node = makeNode("d");
    const nodesById = makeNodesById(["a", "b", "c", "d"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        historyTrail={["a", "b", "c"]}
        onBack={vi.fn()}
      />,
    );

    // Label and the immediate previous step appear in the breadcrumb.
    // ("d" — the current node — also renders in the focus card; we don't
    // assert on it here to avoid colliding with that occurrence.)
    expect(screen.getByText("Path")).toBeInTheDocument();
    expect(screen.getByText("c")).toBeInTheDocument();
    // Older history entries are not rendered.
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(screen.queryByText("b")).not.toBeInTheDocument();
  });

  test("clicking the breadcrumb previous-step calls onJumpToHistory with the last index", () => {
    const node = makeNode("d");
    const nodesById = makeNodesById(["a", "b", "c", "d"]);
    const onJumpToHistory = vi.fn();

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        historyTrail={["a", "b", "c"]}
        onJumpToHistory={onJumpToHistory}
      />,
    );

    fireEvent.click(screen.getByText("c"));
    expect(onJumpToHistory).toHaveBeenCalledWith(2);
  });

  test("breadcrumb falls back to onBack when onJumpToHistory is not provided", () => {
    const node = makeNode("d");
    const nodesById = makeNodesById(["c", "d"]);
    const onBack = vi.fn();

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        historyTrail={["c"]}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByText("c"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Impact Analysis row marks
  // -------------------------------------------------------------------------

  test("renders no impact marks when both impact sets are omitted", () => {
    const parents = { p1: {} as never };
    const children = { c1: {} as never };
    const node = makeNode("focus", { parents, children });
    const nodesById = makeNodesById(["p1", "c1", "focus"]);

    render(<LineageTabContent node={node} nodesById={nodesById} />);

    expect(screen.queryByTestId("lineage-impact-mark")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lineage-impact-chip")).not.toBeInTheDocument();
  });

  test("renders no impact marks when both sets are empty", () => {
    const parents = { p1: {} as never };
    const children = { c1: {} as never };
    const node = makeNode("focus", { parents, children });
    const nodesById = makeNodesById(["p1", "c1", "focus"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set()}
        impactedNodeIds={new Set()}
      />,
    );

    expect(screen.queryByTestId("lineage-impact-mark")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lineage-impact-chip")).not.toBeInTheDocument();
  });

  test("renders no impact marks when the focused node is not in either set", () => {
    // Active impact sets but uninvolved focus → no marks.
    const parents = { p1: {} as never };
    const children = { c1: {} as never };
    const node = makeNode("focus", { parents, children });
    const nodesById = makeNodesById(["p1", "c1", "focus"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["p1"])}
        impactedNodeIds={new Set(["c1"])}
      />,
    );

    expect(screen.queryByTestId("lineage-impact-mark")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lineage-impact-chip")).not.toBeInTheDocument();
  });

  test("marks an upstream parent only when it is in impactingNodeIds", () => {
    const parents = {
      p_propagates: {} as never,
      p_silent: {} as never,
    };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p_propagates", "p_silent", "focus"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["p_propagates"])}
        impactedNodeIds={new Set(["focus"])}
      />,
    );

    const marks = screen.getAllByTestId("lineage-impact-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute("aria-label", "Impacts this model");
  });

  test("does NOT mark an upstream parent that is only in impactedNodeIds", () => {
    // impactedNodeIds (downstream-side) must not bleed into the upstream rail.
    const parents = { stg_payments: {} as never };
    const node = makeNode("customers", { parents });
    const nodesById = makeNodesById(["stg_payments", "customers"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set()}
        impactedNodeIds={new Set(["customers"])}
      />,
    );

    expect(screen.queryByTestId("lineage-impact-mark")).not.toBeInTheDocument();
  });

  test("marks an upstream parent for the partial_breaking case (impacting=true, impacted=false)", () => {
    // partial_breaking: in impactingNodeIds but not impactedNodeIds.
    const parents = { stg_orders: {} as never };
    const node = makeNode("int_throughput", { parents });
    const nodesById = makeNodesById(["stg_orders", "int_throughput"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["stg_orders"])}
        impactedNodeIds={new Set(["int_throughput"])}
      />,
    );

    const marks = screen.getAllByTestId("lineage-impact-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute("aria-label", "Impacts this model");
  });

  test("marks a downstream child when it is in impactedNodeIds, with downstream tooltip", () => {
    const children = {
      c_impacted: {} as never,
      c_isolated: {} as never,
    };
    const node = makeNode("focus", { children });
    const nodesById = makeNodesById(["c_impacted", "c_isolated", "focus"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["focus"])}
        impactedNodeIds={new Set(["focus", "c_impacted"])}
      />,
    );

    const marks = screen.getAllByTestId("lineage-impact-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute("aria-label", "Impacted by this model");
  });

  test("section-header impact chip surfaces the count per side, hidden at zero", () => {
    const parents = { p1: {} as never };
    const children = { c1: {} as never, c2: {} as never };
    const node = makeNode("focus", { parents, children });
    const nodesById = makeNodesById(["p1", "c1", "c2", "focus"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["focus"])}
        impactedNodeIds={new Set(["focus", "c1", "c2"])}
      />,
    );

    const chips = screen.getAllByTestId("lineage-impact-chip");
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("2 impacted");
  });

  test("clicking the impact chip filters the side to only impacted rows; clicking again restores", () => {
    const children = {
      c_impacted_a: {} as never,
      c_isolated: {} as never,
      c_impacted_b: {} as never,
    };
    const node = makeNode("focus", { children });
    const nodesById = makeNodesById([
      "c_impacted_a",
      "c_isolated",
      "c_impacted_b",
      "focus",
    ]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["focus"])}
        impactedNodeIds={new Set(["focus", "c_impacted_a", "c_impacted_b"])}
      />,
    );

    expect(screen.getByText("c_impacted_a")).toBeInTheDocument();
    expect(screen.getByText("c_isolated")).toBeInTheDocument();
    expect(screen.getByText("c_impacted_b")).toBeInTheDocument();

    const chip = screen.getByTestId("lineage-impact-chip");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);

    expect(screen.getByText("c_impacted_a")).toBeInTheDocument();
    expect(screen.getByText("c_impacted_b")).toBeInTheDocument();
    expect(screen.queryByText("c_isolated")).not.toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(chip);
    expect(screen.getByText("c_isolated")).toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  test("status dot reflects 'impacted' for unchanged-but-impacted neighbors (matches canvas)", () => {
    // customer_order_pattern is unchanged but receives upstream impact —
    // the dot's data-status must read "impacted", matching the canvas.
    const children = {
      customer_order_pattern: {} as never,
      truly_unchanged: {} as never,
    };
    const node = makeNode("customers", { children });
    const nodesById = makeNodesById([
      "customer_order_pattern",
      "truly_unchanged",
      "customers",
    ]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["customers"])}
        impactedNodeIds={new Set(["customers", "customer_order_pattern"])}
      />,
    );

    const dotFor = (name: string): HTMLElement => {
      const row = screen.getByText(name).parentElement as HTMLElement;
      const dots = row.querySelectorAll<HTMLElement>(
        "[data-testid='lineage-status-dot']",
      );
      return dots[0];
    };

    expect(dotFor("customer_order_pattern")).toHaveAttribute(
      "data-status",
      "impacted",
    );
    expect(dotFor("truly_unchanged")).toHaveAttribute(
      "data-status",
      "unchanged",
    );
  });

  test("focusInImpact triggers when focus is impacting (source of breaking change) even if not impacted", () => {
    // Focus is the partial_breaking source (impacted=false but in
    // impactingNodeIds) — downstream marks must still render.
    const children = { int_throughput: {} as never };
    const node = makeNode("stg_orders", { children });
    const nodesById = makeNodesById(["stg_orders", "int_throughput"]);

    render(
      <LineageTabContent
        node={node}
        nodesById={nodesById}
        impactingNodeIds={new Set(["stg_orders"])}
        impactedNodeIds={new Set(["int_throughput"])}
      />,
    );

    const marks = screen.getAllByTestId("lineage-impact-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute("aria-label", "Impacted by this model");
  });

  test("filter and pagination reset when the focused node changes", () => {
    const childIdsA = Array.from({ length: 15 }, (_, i) => `a_child_${i + 1}`);
    const childIdsB = ["b_child_1"];
    const nodeA = makeNode("focus_a", {
      children: Object.fromEntries(childIdsA.map((id) => [id, {} as never])),
    });
    const nodeB = makeNode("focus_b", {
      children: Object.fromEntries(childIdsB.map((id) => [id, {} as never])),
    });
    const nodesById = makeNodesById([...childIdsA, ...childIdsB]);

    const { rerender } = render(
      <LineageTabContent node={nodeA} nodesById={nodesById} />,
    );

    // Type a filter value on node A.
    const input = screen.getByLabelText("Filter Downstream");
    fireEvent.change(input, { target: { value: "a_child_1" } });
    expect((input as HTMLInputElement).value).toBe("a_child_1");

    // Switching node clears filter and resets pagination — node B has only
    // one child and should render it without any prior filter.
    rerender(<LineageTabContent node={nodeB} nodesById={nodesById} />);
    expect(screen.getByText("b_child_1")).toBeInTheDocument();
  });
});
