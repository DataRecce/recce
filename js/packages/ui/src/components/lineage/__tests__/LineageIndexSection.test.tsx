/**
 * @file LineageIndexSection.test.tsx
 * @description Tests for the Upstream & Downstream collapsible section
 * that lives at the top of the Model Detail panel.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { LineageGraphNode } from "../../../contexts/lineage/types";
import { LineageIndexSection } from "../LineageIndexSection";

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

describe("LineageIndexSection", () => {
  test("renders upstream and downstream counts in the header", () => {
    const parents = { p1: {} as never, p2: {} as never };
    const children = { c1: {} as never };
    const node = makeNode("focus", { parents, children });
    const nodesById = makeNodesById(["p1", "p2", "c1"]);

    render(<LineageIndexSection node={node} nodesById={nodesById} />);

    expect(screen.getByTestId("lineage-index-section")).toBeInTheDocument();
    expect(screen.getByText("p1")).toBeInTheDocument();
    expect(screen.getByText("c1")).toBeInTheDocument();
  });

  test("returns null when the node has no upstream or downstream", () => {
    const node = makeNode("isolated");
    const { container } = render(<LineageIndexSection node={node} />);
    expect(container.firstChild).toBeNull();
  });

  test("invokes onNavigate when a row is clicked", () => {
    const parents = { p1: {} as never };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p1"]);
    const onNavigate = vi.fn();

    render(
      <LineageIndexSection
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

    render(<LineageIndexSection node={node} nodesById={nodesById} />);

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

    render(<LineageIndexSection node={node} nodesById={nodesById} />);

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

    render(<LineageIndexSection node={node} nodesById={nodesById} />);

    // Initial page size is 8, so child_15 is hidden.
    expect(screen.queryByText("child_15")).not.toBeInTheDocument();
    // Use a function matcher to match the show-more text that also contains
    // a "(N hidden)" span.
    const showMore = screen.getByText(
      (_, el) => el?.textContent?.startsWith("+ show") ?? false,
    );
    fireEvent.click(showMore);
    expect(screen.getByText("child_15")).toBeInTheDocument();
  });

  test("renders the center icon when onCenterFocus is provided and calls it on click without collapsing", () => {
    const parents = { p1: {} as never };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p1"]);
    const onCenterFocus = vi.fn();

    render(
      <LineageIndexSection
        node={node}
        nodesById={nodesById}
        onCenterFocus={onCenterFocus}
      />,
    );
    const centerBtn = screen.getByLabelText("Center on canvas");
    fireEvent.click(centerBtn);
    expect(onCenterFocus).toHaveBeenCalledTimes(1);
    // Section should stay expanded (row still visible).
    expect(screen.getByText("p1")).toBeInTheDocument();
  });

  test("hides the back button when onBack is not provided and shows it when it is", () => {
    const parents = { p1: {} as never };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p1"]);

    const { rerender } = render(
      <LineageIndexSection node={node} nodesById={nodesById} />,
    );
    expect(
      screen.queryByLabelText("Back to previous node"),
    ).not.toBeInTheDocument();

    const onBack = vi.fn();
    rerender(
      <LineageIndexSection node={node} nodesById={nodesById} onBack={onBack} />,
    );
    const backBtn = screen.getByLabelText("Back to previous node");
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
    // Section should stay expanded after clicking back.
    expect(screen.getByText("p1")).toBeInTheDocument();
  });

  test("collapses and expands on header click", () => {
    const parents = { p1: {} as never };
    const node = makeNode("focus", { parents });
    const nodesById = makeNodesById(["p1"]);

    render(<LineageIndexSection node={node} nodesById={nodesById} />);
    expect(screen.getByText("p1")).toBeInTheDocument();

    const header = screen.getByRole("button", {
      name: /Upstream & Downstream/,
    });
    fireEvent.click(header);
    expect(screen.queryByText("p1")).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByText("p1")).toBeInTheDocument();
  });
});
