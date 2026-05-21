/**
 * @file LineageView.test.tsx
 * @description Tests for LineageView high-level component.
 */

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LineageView } from "../LineageView";

const mockUseLineageGraphContext = vi.fn();
const mockToReactFlowBasic = vi.fn();

vi.mock("../../../contexts/lineage", () => ({
  useLineageGraphContext: () => mockUseLineageGraphContext(),
}));

vi.mock("../../../contexts/lineage/utils", () => ({
  selectDownstream: vi.fn(() => []),
  selectUpstream: vi.fn(() => []),
  toReactFlowBasic: (...args: unknown[]) => mockToReactFlowBasic(...args),
}));

vi.mock("../LineageCanvas", () => ({
  LineageCanvas: ({
    nodes,
    edges,
  }: {
    nodes: { id: string }[];
    edges: { id: string }[];
  }) => (
    <div
      data-testid="lineage-canvas"
      data-nodes={nodes.length}
      data-edges={edges.length}
    />
  ),
}));

const lineageGraph = {
  nodes: {
    "model-1": {
      id: "model-1",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "model-1",
        name: "Model A",
        from: "both",
        data: {},
        parents: {},
        children: {},
        resourceType: "model",
        packageName: "core",
      },
    },
  },
  edges: {},
  modifiedSet: [],
  manifestMetadata: {},
  catalogMetadata: {},
};

// A lineage graph with both a body-changed and a config-only model.
// modifiedSet contains BOTH because buildLineageGraph treats any
// change_status as modified. The body_changes selector is applied
// server-side, so saved checks carry the resolved subset via node_ids.
const lineageGraphWithConfigOnly = {
  nodes: {
    "model.body_changed": {
      id: "model.body_changed",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "model.body_changed",
        name: "Body Changed",
        from: "both",
        data: {},
        parents: {},
        children: {},
        resourceType: "model",
        packageName: "core",
      },
    },
    "model.config_only": {
      id: "model.config_only",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "model.config_only",
        name: "Config Only",
        from: "both",
        data: {},
        parents: {},
        children: {},
        resourceType: "model",
        packageName: "core",
      },
    },
  },
  edges: {},
  modifiedSet: ["model.body_changed", "model.config_only"],
  manifestMetadata: {},
  catalogMetadata: {},
};

describe("LineageView", () => {
  beforeEach(() => {
    mockToReactFlowBasic.mockReturnValue([
      [
        {
          id: "model-1",
          position: { x: 0, y: 0 },
          data: {
            name: "Model A",
            resourceType: "model",
            changeStatus: "modified",
            packageName: "core",
          },
        },
      ],
      [],
    ]);
  });

  it("renders loading state when context is loading", () => {
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: undefined,
      isLoading: true,
      error: undefined,
    });

    render(<LineageView />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders error state from context", () => {
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: undefined,
      isLoading: false,
      error: "Failed to load",
    });

    render(<LineageView />);

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("renders empty message when no lineage data is available", () => {
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: undefined,
      isLoading: false,
      error: undefined,
    });

    render(<LineageView />);

    expect(
      screen.getByText(
        "No lineage data available. Provide data via LineageGraphProvider or lineageGraph prop.",
      ),
    ).toBeInTheDocument();
  });

  it("renders LineageCanvas when lineage data is provided", () => {
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph,
      isLoading: false,
      error: undefined,
    });

    render(<LineageView />);

    const canvas = screen.getByTestId("lineage-canvas");
    expect(canvas).toHaveAttribute("data-nodes", "1");
    expect(canvas).toHaveAttribute("data-edges", "0");
  });

  it("renders filtered empty state when no nodes match", () => {
    mockToReactFlowBasic.mockReturnValue([[], []]);
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph,
      isLoading: false,
      error: undefined,
    });

    render(<LineageView />);

    expect(
      screen.getByText("No nodes match the current filter criteria."),
    ).toBeInTheDocument();
  });

  // Regression test for DRC-3047 self-review NO-GO #1 — saved-check replay.
  // A saved Lineage Diff check created in Body Changes mode persists the
  // server-resolved node_ids. LineageView must honor that explicit list
  // instead of falling back to modifiedSet (which includes config-only nodes).
  it("body_changes saved-check replay honors explicit node_ids subset", () => {
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: lineageGraphWithConfigOnly,
      isLoading: false,
      error: undefined,
    });

    render(
      <LineageView
        viewOptions={{
          view_mode: "body_changes",
          node_ids: ["model.body_changed"],
        }}
      />,
    );

    // toReactFlowBasic should be called with the saved subset, NOT modifiedSet.
    expect(mockToReactFlowBasic).toHaveBeenCalledWith(
      lineageGraphWithConfigOnly,
      ["model.body_changed"],
    );
  });

  // Regression test for DRC-3047 self-review NO-GO #1 — body_changes without
  // explicit node_ids must NOT fall back to modifiedSet (which would include
  // config-only nodes). The intent is "no client-side filter; trust the
  // server-resolved list or render nothing rather than render the wrong set".
  it("body_changes without node_ids does NOT fall back to modifiedSet", () => {
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: lineageGraphWithConfigOnly,
      isLoading: false,
      error: undefined,
    });

    render(
      <LineageView
        viewOptions={{
          view_mode: "body_changes",
        }}
      />,
    );

    // selectedNodeIds should be undefined (no client-side filtering for
    // body_changes), NOT the modifiedSet that contains both nodes.
    expect(mockToReactFlowBasic).toHaveBeenCalledWith(
      lineageGraphWithConfigOnly,
      undefined,
    );
  });

  // Regression test for DRC-3047 self-review NO-GO #2 — empty filter result
  // for body_changes renders the friendly placeholder, not a blank canvas.
  // (LineageViewOss has its own dedicated guard; this test verifies the
  // shared LineageView empty-state path is hit when the filtered set is
  // empty.)
  it("body_changes renders empty-state when filter resolves to zero nodes", () => {
    mockToReactFlowBasic.mockReturnValue([[], []]);
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: lineageGraphWithConfigOnly,
      isLoading: false,
      error: undefined,
    });

    render(
      <LineageView
        viewOptions={{
          view_mode: "body_changes",
          node_ids: [],
        }}
      />,
    );

    expect(
      screen.getByText("No nodes match the current filter criteria."),
    ).toBeInTheDocument();
  });

  // Sanity test: changed_models still falls back to modifiedSet — the
  // body_changes fix must NOT have regressed the changed_models path.
  it("changed_models view_mode still falls back to modifiedSet", () => {
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: lineageGraphWithConfigOnly,
      isLoading: false,
      error: undefined,
    });

    render(
      <LineageView
        viewOptions={{
          view_mode: "changed_models",
        }}
      />,
    );

    expect(mockToReactFlowBasic).toHaveBeenCalledWith(
      lineageGraphWithConfigOnly,
      ["model.body_changed", "model.config_only"],
    );
  });
});
