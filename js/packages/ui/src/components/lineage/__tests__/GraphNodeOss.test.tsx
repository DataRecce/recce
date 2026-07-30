import { render } from "@testing-library/react";
import { vi } from "vitest";

const { mockLineageNode, mockViewContext } = vi.hoisted(() => ({
  mockLineageNode: vi.fn(),
  mockViewContext: { current: undefined as unknown },
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useStore: (selector: (state: { transform: number[] }) => unknown) =>
      selector({ transform: [0, 0, 1] }),
  };
});

vi.mock("../../../contexts", () => ({
  useLineageGraphContext: () => ({}),
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
    LineageNode: (props: unknown) => {
      mockLineageNode(props);
      return <div data-testid="lineage-node" />;
    },
  };
});

import type {
  LineageGraphNode,
  LineageViewContextType,
} from "../../../contexts";
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
});
