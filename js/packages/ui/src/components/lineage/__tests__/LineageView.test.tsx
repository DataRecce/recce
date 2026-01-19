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
});
