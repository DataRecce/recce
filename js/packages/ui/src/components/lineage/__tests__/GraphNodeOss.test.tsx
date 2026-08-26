import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

const { mockGraphContext, mockLineageNode, mockViewContext } = vi.hoisted(
  () => ({
    mockGraphContext: { current: undefined as unknown },
    mockLineageNode: vi.fn(),
    mockViewContext: { current: undefined as unknown },
  }),
);

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useStore: (selector: (state: { transform: number[] }) => unknown) =>
      selector({ transform: [0, 0, 1] }),
  };
});

vi.mock("../../../contexts", () => ({
  useLineageGraphContext: () => mockGraphContext.current,
  useLineageViewContextSafe: () => mockViewContext.current,
}));

vi.mock("../../../hooks", () => ({
  useThemeColors: () => ({
    isDark: false,
    text: { inverted: "white", secondary: "grey" },
  }),
}));

vi.mock("../nodes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../nodes")>();
  return {
    ...actual,
    LineageNode: (props: {
      interactive?: boolean;
      onSelect?: (nodeId: string) => void;
      runsAggregatedTag?: ReactNode;
      selectMode?: string;
    }) => {
      mockLineageNode(props);
      return <div data-testid="lineage-node">{props.runsAggregatedTag}</div>;
    },
  };
});

import type {
  LineageGraphNode,
  LineageViewContextType,
} from "../../../contexts";
import { getSemanticColorTheme } from "../../../theme";
import { GraphNode, type GraphNodeProps } from "../GraphNodeOss";

function createViewContext(
  overrides: Partial<LineageViewContextType> = {},
): LineageViewContextType {
  return {
    interactive: true,
    selectNode: vi.fn(),
    selectMode: "normal",
    focusedNode: undefined,
    getNodeAction: vi.fn(),
    getNodeColumnSet: vi.fn(() => new Set()),
    isNodeHighlighted: vi.fn(() => false),
    isNodeSelected: vi.fn(() => false),
    isNodeShowingChangeAnalysis: vi.fn(() => false),
    showContextMenu: vi.fn(),
    viewOptions: {},
    cll: {
      current: { nodes: {}, columns: {}, parent_map: {}, child_map: {} },
    },
    impactedNodeIds: new Set(),
    newCllExperience: false,
    wholeModelChangedNodeIds: new Set(),
    wholeModelImpactedNodeIds: new Set(),
    ...overrides,
  } as LineageViewContextType;
}

function createNodeProps(): GraphNodeProps {
  const node: LineageGraphNode = {
    id: "model.test.orders",
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id: "model.test.orders",
      name: "orders",
      resourceType: "model",
      changeStatus: "modified",
      change: { category: "non_breaking" }, // wire-enum-ok
      parents: {},
      children: {},
    },
  };

  return {
    ...node,
    selected: false,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  };
}

describe("GraphNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphContext.current = {};
  });

  it("uses the merged-lineage category in the legacy experience", () => {
    mockViewContext.current = createViewContext();

    render(<GraphNode {...createNodeProps()} />);

    expect(mockLineageNode).toHaveBeenCalledWith(
      expect.objectContaining({
        changeCategory: "non_breaking", // wire-enum-ok
        showChangeAnalysis: true,
      }),
    );
  });

  it("does not leak the merged-lineage category into the new CLL experience", () => {
    mockViewContext.current = createViewContext({ newCllExperience: true });

    render(<GraphNode {...createNodeProps()} />);

    expect(mockLineageNode).toHaveBeenCalledWith(
      expect.objectContaining({
        changeCategory: undefined,
        showChangeAnalysis: false,
      }),
    );
  });

  it("preserves a fresh CLL category in the new CLL experience", () => {
    mockViewContext.current = createViewContext({
      newCllExperience: true,
      cll: {
        current: {
          nodes: {
            "model.test.orders": {
              id: "model.test.orders",
              name: "orders",
              source_name: "",
              resource_type: "model",
              change_category: "partial_breaking", // wire-enum-ok
            },
          },
          columns: {},
          parent_map: {},
          child_map: {},
        },
      },
    });

    render(<GraphNode {...createNodeProps()} />);

    expect(mockLineageNode).toHaveBeenCalledWith(
      expect.objectContaining({
        changeCategory: "partial_breaking", // wire-enum-ok
        showChangeAnalysis: false,
      }),
    );
  });

  it("keeps first-node selection wired in normal mode", () => {
    const selectNode = vi.fn();
    mockViewContext.current = createViewContext({
      selectNode,
    });

    render(<GraphNode {...createNodeProps()} />);

    const lineageNodeProps = mockLineageNode.mock.lastCall?.[0] as {
      interactive?: boolean;
      onSelect?: (nodeId: string) => void;
      selectMode?: string;
    };
    expect(lineageNodeProps).toEqual(
      expect.objectContaining({
        interactive: true,
        selectMode: "normal",
      }),
    );

    lineageNodeProps.onSelect?.("model.test.orders");

    expect(selectNode).toHaveBeenCalledWith("model.test.orders");
  });

  it.each([
    [100, 150, "↑ +50.0% Rows", "increase"],
    [100, 80, "↓ -20.0% Rows", "decrease"],
    [null, 100, "Added · 100 Rows", "added"],
    [100, null, "Removed · 100 Rows", "removed"],
    [100, 100, "=", "unchanged"],
    [null, null, "Failed to load", "unavailable"],
  ])(
    "renders the %s → %s row-count chip as %s",
    (base, current, label, direction) => {
      mockViewContext.current = createViewContext();
      mockGraphContext.current = {
        runsAggregated: {
          "model.test.orders": {
            row_count_diff: { result: { base, curr: current } },
          },
        },
      };

      render(<GraphNode {...createNodeProps()} />);

      const chip = screen.getByText(label).closest(".MuiChip-root");
      expect(chip).toHaveAttribute("data-row-count-direction", direction);
      if (direction === "increase") {
        expect(chip).toHaveStyle({
          backgroundColor: getSemanticColorTheme(false).direction.background,
          color: getSemanticColorTheme(false).direction.foreground,
        });
      }
      if (direction === "decrease") {
        expect(chip).toHaveStyle({
          backgroundColor: getSemanticColorTheme(false).direction.background,
          color: getSemanticColorTheme(false).direction.foreground,
        });
      }
    },
  );
});
