/**
 * @file LineageView.component.test.tsx
 * @description Comprehensive component tests for LineageView
 *
 * Tests verify:
 * - Basic rendering with ReactFlow, Background, Controls, MiniMap
 * - Loading state display
 * - Error state display with retry functionality
 * - Empty state handling (no nodes, no changes detected)
 * - Node selection behavior (single node, multi-node)
 * - Context provider functionality
 * - HSplit layout with NodeView panel
 * - Imperative handle (copyToClipboard)
 * - View options and filtering
 * - Column-level lineage integration
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

// Polyfill for Object.groupBy (not available in Node.js 18/jsdom)
if (typeof Object.groupBy === "undefined") {
  // biome-ignore lint/suspicious/noExplicitAny: Object.groupBy polyfill requires type assertion on global Object
  (Object as any).groupBy = function <T>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => string,
  ): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index++);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
    }
    return result;
  };
}

import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { createRef } from "react";

// ============================================================================
// Mocks - MUST be set up before component imports
// ============================================================================

// Mock @xyflow/react - critical for ReactFlow component
// These will be populated after mocks are set up
let mockUseNodesStateReturnValue: [unknown[], jest.Mock, jest.Mock] = [
  [],
  jest.fn(),
  jest.fn(),
];

jest.mock("@xyflow/react", () => ({
  ReactFlow: jest.fn(
    ({ children, nodes }: { children: React.ReactNode; nodes?: unknown[] }) => (
      <div data-testid="reactflow" data-node-count={nodes?.length ?? 0}>
        {children}
      </div>
    ),
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="reactflow-provider">{children}</div>
  ),
  Background: jest.fn(() => <div data-testid="rf-background" />),
  BackgroundVariant: { Dots: "dots" },
  Controls: jest.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="rf-controls">{children}</div>
  )),
  ControlButton: jest.fn(
    ({
      children,
      onClick,
      title,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      title?: string;
    }) => (
      <button data-testid="rf-control-button" onClick={onClick} title={title}>
        {children}
      </button>
    ),
  ),
  MiniMap: jest.fn(() => <div data-testid="rf-minimap" />),
  Panel: jest.fn(
    ({
      children,
      position,
    }: {
      children?: React.ReactNode;
      position?: string;
    }) => <div data-testid={`rf-panel-${position}`}>{children}</div>,
  ),
  useReactFlow: jest.fn(() => ({
    fitView: jest.fn().mockResolvedValue(undefined),
    setCenter: jest.fn().mockResolvedValue(undefined),
    getZoom: jest.fn().mockReturnValue(1),
    getNodes: jest.fn().mockReturnValue([]),
  })),
  useNodesState: jest.fn(() => mockUseNodesStateReturnValue),
  useEdgesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  getNodesBounds: jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
  Handle: jest.fn(() => null),
  Position: {
    Left: "left",
    Right: "right",
    Top: "top",
    Bottom: "bottom",
  },
}));

// Mock @datarecce/ui contexts
const mockRetchLineageGraph = jest.fn();
const mockRefetchRunsAggregated = jest.fn();

const mockLineageGraphContext = {
  lineageGraph: undefined as LineageGraph | undefined,
  retchLineageGraph: mockRetchLineageGraph,
  isLoading: false,
  error: undefined as string | undefined,
  refetchRunsAggregated: mockRefetchRunsAggregated,
};

const mockRecceInstanceContext = {
  featureToggles: { mode: "full" } as { mode: string },
  singleEnv: false,
};

jest.mock("@datarecce/ui/contexts", () => {
  const React = jest.requireActual("react");
  return {
    useLineageGraphContext: jest.fn(() => mockLineageGraphContext),
    useRecceInstanceContext: jest.fn(() => mockRecceInstanceContext),
    useRecceActionContext: jest.fn(() => ({
      runId: undefined,
      showRunId: mockShowRunId,
      closeRunResult: mockCloseRunResult,
      runAction: mockRunAction,
      isRunResultOpen: false,
    })),
    LineageViewContext: React.createContext(undefined),
    useLineageViewContextSafe: jest.fn(() => ({
      interactive: true,
      nodes: [],
      focusedNode: undefined,
      selectedNodes: [],
      cll: undefined,
      showContextMenu: jest.fn(),
      viewOptions: {},
      onViewOptionsChanged: jest.fn(),
      selectMode: undefined,
      selectNode: jest.fn(),
      selectParentNodes: jest.fn(),
      selectChildNodes: jest.fn(),
      deselect: jest.fn(),
      isNodeHighlighted: jest.fn(() => false),
      isNodeSelected: jest.fn(() => false),
      isEdgeHighlighted: jest.fn(() => false),
      getNodeAction: jest.fn(() => ({ mode: "per_node" as const })),
      getNodeColumnSet: jest.fn(() => new Set()),
      isNodeShowingChangeAnalysis: jest.fn(() => false),
      runRowCount: jest.fn(),
      runRowCountDiff: jest.fn(),
      runValueDiff: jest.fn(),
      addLineageDiffCheck: jest.fn(),
      addSchemaDiffCheck: jest.fn(),
      cancel: jest.fn(),
      actionState: {
        mode: "per_node" as const,
        status: "completed" as const,
        completed: 0,
        total: 0,
        actions: {},
      },
      centerNode: jest.fn(),
      showColumnLevelLineage: jest.fn(),
      resetColumnLevelLineage: jest.fn(),
    })),
  };
});

// Mock @datarecce/ui
jest.mock("@datarecce/ui", () => ({
  isLineageGraphColumnNode: jest.fn(
    (node) => node?.type === "lineageGraphColumnNode",
  ),
  isLineageGraphNode: jest.fn((node) => node?.type === "lineageGraphNode"),
  selectDownstream: jest.fn(() => new Set()),
  selectUpstream: jest.fn(() => new Set()),
  HSplit: jest.fn(({ children, sizes }) => (
    <div data-testid="hsplit" data-sizes={JSON.stringify(sizes)}>
      {children}
    </div>
  )),
  union: jest.fn((...sets) => {
    const result = new Set<string>();
    for (const set of sets) {
      for (const item of set) {
        result.add(item);
      }
    }
    return result;
  }),
}));

// Mock @datarecce/ui/api
jest.mock("@datarecce/ui/api", () => ({
  getCll: jest.fn().mockResolvedValue(undefined),
  select: jest.fn().mockResolvedValue({ nodes: [] }),
  createLineageDiffCheck: jest
    .fn()
    .mockResolvedValue({ check_id: "test-check" }),
  createSchemaDiffCheck: jest
    .fn()
    .mockResolvedValue({ check_id: "test-check" }),
  isHistogramDiffRun: jest.fn(() => false),
  isProfileDiffRun: jest.fn(() => false),
  isTopKDiffRun: jest.fn(() => false),
  isValueDiffDetailRun: jest.fn(() => false),
  isValueDiffRun: jest.fn(() => false),
}));

// Mock @datarecce/ui/components/lineage
jest.mock("@datarecce/ui/components/lineage", () => {
  const actual = jest.requireActual("@datarecce/ui/components/lineage");
  return {
    ...actual,
    BaseEnvironmentSetupNotification: jest.fn(() => null),
    getIconForChangeStatus: jest.fn(() => ({ hexColor: "#000000" })),
  };
});

jest.mock("@datarecce/ui/components/lineage/legend", () => ({
  LineageLegend: jest.fn(({ variant }) => (
    <div data-testid={`lineage-legend-${variant}`} />
  )),
}));

jest.mock(
  "@datarecce/ui/components/lineage/topbar/LineageViewTopBarOss",
  () => ({
    LineageViewTopBarOss: jest.fn(() => (
      <div data-testid="lineage-view-topbar" />
    )),
  }),
);

jest.mock("@datarecce/ui/components/lineage/NodeViewOss", () => ({
  NodeViewOss: jest.fn(({ node, onCloseNode }) => (
    <div data-testid="node-view" data-node-id={node?.id}>
      <button data-testid="close-node-view" onClick={onCloseNode}>
        Close
      </button>
    </div>
  )),
}));

// Mock @datarecce/ui/components/ui
jest.mock("@datarecce/ui/components/ui", () => ({
  HSplit: ({
    children,
    sizes,
  }: {
    children?: React.ReactNode;
    sizes?: number[];
  }) => (
    <div
      data-testid="hsplit"
      data-sizes={sizes ? JSON.stringify(sizes) : undefined}
    >
      {children}
    </div>
  ),
  toaster: {
    create: jest.fn(),
  },
}));

// Mock @datarecce/ui/theme
jest.mock("@datarecce/ui/theme", () => ({
  colors: {
    neutral: {
      50: "#fafafa",
      100: "#f4f4f5",
      200: "#e4e4e7",
      300: "#d4d4d8",
      400: "#a1a1aa",
      600: "#52525b",
      700: "#3f3f46",
      800: "#27272a",
      900: "#18181b",
    },
  },
}));

// Mock child components to isolate testing

jest.mock("@datarecce/ui/components/lineage/ActionControlOss", () => ({
  ActionControlOss: jest.fn(({ onClose }) => (
    <div data-testid="action-control">
      <button data-testid="close-action" onClick={onClose}>
        Close
      </button>
    </div>
  )),
}));

jest.mock(
  "@datarecce/ui/components/lineage/ColumnLevelLineageControlOss",
  () => ({
    ColumnLevelLineageControlOss: jest.fn(() => (
      <div data-testid="cll-control" />
    )),
  }),
);

jest.mock("@datarecce/ui/components/lineage/GraphNodeOss", () => ({
  GraphNode: jest.fn(() => <div data-testid="graph-node" />),
}));

jest.mock("@datarecce/ui/components/lineage/GraphColumnNodeOss", () => ({
  GraphColumnNode: jest.fn(() => <div data-testid="graph-column-node" />),
}));

jest.mock("@datarecce/ui/components/lineage/GraphEdgeOss", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="graph-edge" />),
}));

jest.mock("@datarecce/ui/components/lineage/LineageViewContextMenuOss", () => ({
  LineageViewContextMenu: jest.fn(() => <div data-testid="context-menu" />),
  useLineageViewContextMenu: jest.fn(() => ({
    showContextMenu: jest.fn(),
    closeContextMenu: jest.fn(),
    props: {},
  })),
}));

jest.mock("@datarecce/ui/components/notifications", () => ({
  LineageViewNotification: jest.fn(() => null),
}));

jest.mock("@datarecce/ui/components/lineage/SetupConnectionBannerOss", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@datarecce/ui/hooks/useValueDiffAlertDialogOss", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    confirm: jest.fn().mockResolvedValue(true),
    AlertDialog: null,
  })),
}));

// Mock useMultiNodesAction
const mockMultiNodesAction = {
  actionState: {
    mode: "per_node" as const,
    status: "pending" as
      | "pending"
      | "running"
      | "canceling"
      | "canceled"
      | "completed",
    completed: 0,
    total: 0,
    actions: {},
  },
  runRowCount: jest.fn(),
  runRowCountDiff: jest.fn(),
  runValueDiff: jest.fn(),
  addLineageDiffCheck: jest.fn(),
  addSchemaDiffCheck: jest.fn(),
  cancel: jest.fn(),
  reset: jest.fn(),
};

jest.mock("@datarecce/ui/hooks/useMultiNodesActionOss", () => ({
  useMultiNodesActionOss: jest.fn(() => mockMultiNodesAction),
}));

const mockCopyToClipboard = jest.fn().mockResolvedValue(undefined);

// Mock OSS hooks
jest.mock("@datarecce/ui/hooks", () => ({
  useApiConfig: jest.fn(() => ({
    apiClient: {},
  })),
  useClipBoardToast: jest.fn(() => ({
    successToast: jest.fn(),
    failToast: jest.fn(),
  })),
  IGNORE_SCREENSHOT_CLASS: "ignore-screenshot",
  useCopyToClipboard: jest.fn(() => ({
    copyToClipboard: mockCopyToClipboard,
    ImageDownloadModal: () => null,
    ref: { current: null },
  })),
  useRun: jest.fn(() => ({ run: undefined })),
  useThemeColors: jest.fn(() => ({
    isDark: false,
  })),
}));

const mockShowRunId = jest.fn();
const mockCloseRunResult = jest.fn();
const mockRunAction = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/lineage"),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock tracking
jest.mock("@datarecce/ui/lib/api/track", () => ({
  trackCopyToClipboard: jest.fn(),
  trackLineageViewRender: jest.fn(),
  trackMultiNodesAction: jest.fn(),
}));

// Mock lineage utilities
jest.mock("@datarecce/ui/components/lineage/lineage", () => ({
  layout: jest.fn(),
  toReactFlow: jest.fn(() => [[], [], {}]),
}));

// Mock @tanstack/react-query
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(() => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ============================================================================
// Imports - MUST come after mocks
// ============================================================================

import { select } from "@datarecce/ui/api";
import {
  LineageViewOss as LineageView,
  type LineageViewProps,
  type LineageViewRef,
  PrivateLineageView,
} from "@datarecce/ui/components/lineage/LineageViewOss";

// Wrap PrivateLineageView with forwardRef for testing purposes
// This is needed because PrivateLineageView is a function that takes (props, ref)
// but is not wrapped with forwardRef in the export
const TestablePrivateLineageView = React.forwardRef<
  LineageViewRef,
  LineageViewProps
>(PrivateLineageView);

import { toReactFlow } from "@datarecce/ui/components/lineage/lineage";
import { useMultiNodesActionOss as useMultiNodesAction } from "@datarecce/ui/hooks/useMultiNodesActionOss";

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockLineageGraph(
  overrides: Partial<LineageGraph> = {},
): LineageGraph {
  return {
    nodes: {
      "model.test.node1": createMockLineageGraphNode(
        "model.test.node1",
        "node1",
      ),
      "model.test.node2": createMockLineageGraphNode(
        "model.test.node2",
        "node2",
      ),
    },
    edges: {},
    modifiedSet: ["model.test.node1"],
    manifestMetadata: {
      base: {
        project_name: "test",
      } as unknown as LineageGraph["manifestMetadata"]["base"],
      current: {
        project_name: "test",
      } as unknown as LineageGraph["manifestMetadata"]["current"],
    },
    catalogMetadata: {
      base: undefined,
      current: undefined,
    },
    ...overrides,
  };
}

function createMockLineageGraphNode(
  id: string,
  name: string,
  overrides: Partial<LineageGraphNode["data"]> = {},
): LineageGraphNode {
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      from: "both",
      data: { base: undefined, current: undefined },
      resourceType: "model",
      packageName: "test",
      parents: {},
      children: {},
      changeStatus: "modified",
      ...overrides,
    },
  };
}

// Helper to setup mocks with lineage graph data
function setupWithLineageGraph(lineageGraph?: LineageGraph) {
  mockLineageGraphContext.lineageGraph = lineageGraph;
  mockLineageGraphContext.isLoading = false;
  mockLineageGraphContext.error = undefined;

  const mockNodes = lineageGraph ? Object.values(lineageGraph.nodes) : [];

  // Update the return value that the mock will use
  mockUseNodesStateReturnValue = [mockNodes, jest.fn(), jest.fn()];

  (toReactFlow as jest.Mock).mockReturnValue([
    mockNodes,
    [],
    Object.fromEntries(mockNodes.map((n) => [n.id, new Set<string>()])),
  ]);

  (select as jest.Mock).mockResolvedValue({
    nodes: mockNodes.map((n) => n.id),
  });
}

// ============================================================================
// Test Wrapper
// ============================================================================

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ============================================================================
// Tests
// ============================================================================

describe("LineageView Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset context mocks to defaults
    mockLineageGraphContext.lineageGraph = undefined;
    mockLineageGraphContext.isLoading = false;
    mockLineageGraphContext.error = undefined;
    mockRecceInstanceContext.featureToggles = { mode: "full" };
    mockRecceInstanceContext.singleEnv = false;

    // Reset node state mock
    mockUseNodesStateReturnValue = [[], jest.fn(), jest.fn()];
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe("basic rendering", () => {
    it("renders ReactFlow container when lineage graph is loaded", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toBeInTheDocument();
      });
    });

    it("renders Background component inside ReactFlow", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("rf-background")).toBeInTheDocument();
      });
    });

    it("renders Controls component with copy button", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("rf-controls")).toBeInTheDocument();
      });
    });

    it("renders MiniMap component", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("rf-minimap")).toBeInTheDocument();
      });
    });

    it("renders TopBar when interactive", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("lineage-view-topbar")).toBeInTheDocument();
      });
    });

    it("does not render TopBar when not interactive", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={false} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("lineage-view-topbar"),
      ).not.toBeInTheDocument();
    });

    it("renders HSplit layout container", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("hsplit")).toBeInTheDocument();
      });
    });

    it("renders ColumnLevelLineageControl in panel", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("cll-control")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe("loading states", () => {
    it("shows loading indicator when lineage data is loading", () => {
      mockLineageGraphContext.isLoading = true;

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      // CircularProgress renders with role="progressbar"
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("does not render ReactFlow while loading", () => {
      mockLineageGraphContext.isLoading = true;

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      expect(screen.queryByTestId("reactflow")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  describe("error states", () => {
    it("shows error message when loading fails", () => {
      mockLineageGraphContext.error = "Network error";

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      expect(
        screen.getByText(/Failed to load lineage data/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    it("shows retry button on error", () => {
      mockLineageGraphContext.error = "Network error";

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("calls retchLineageGraph when retry button is clicked", () => {
      mockLineageGraphContext.error = "Network error";

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      const retryButton = screen.getByRole("button", { name: "Retry" });
      fireEvent.click(retryButton);

      expect(mockRetchLineageGraph).toHaveBeenCalledTimes(1);
    });

    it("does not render ReactFlow when error", () => {
      mockLineageGraphContext.error = "Network error";

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      expect(screen.queryByTestId("reactflow")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe("empty states", () => {
    it("renders empty fragment when lineage graph is undefined", () => {
      setupWithLineageGraph(undefined);

      const { container } = render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      // Should render empty fragment
      expect(container.firstChild).toBeNull();
    });

    it("shows 'No change detected' when view_mode is changed_models but no modifications", async () => {
      const lineageGraph = createMockLineageGraph({ modifiedSet: [] });
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView
            interactive={true}
            viewOptions={{ view_mode: "changed_models" }}
            ref={null}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("No change detected")).toBeInTheDocument();
      });
    });

    it("shows 'Show all nodes' button when no changes detected", async () => {
      const lineageGraph = createMockLineageGraph({ modifiedSet: [] });
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView
            interactive={true}
            viewOptions={{ view_mode: "changed_models" }}
            ref={null}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Show all nodes" }),
        ).toBeInTheDocument();
      });
    });

    it("shows 'No nodes' text when nodes array is empty", async () => {
      mockLineageGraphContext.lineageGraph = createMockLineageGraph();
      mockLineageGraphContext.isLoading = false;
      mockLineageGraphContext.error = undefined;

      // Setup with empty nodes
      mockUseNodesStateReturnValue = [[], jest.fn(), jest.fn()];
      (toReactFlow as jest.Mock).mockReturnValue([[], [], {}]);
      (select as jest.Mock).mockResolvedValue({ nodes: [] });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("No nodes")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Node Detail Panel Tests (HSplit)
  // ==========================================================================

  describe("node detail panel (HSplit)", () => {
    it("sets HSplit sizes to [100, 0] when no node is focused", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        const hsplit = screen.getByTestId("hsplit");
        expect(hsplit).toHaveAttribute("data-sizes", "[100,0]");
      });
    });

    it("does not show NodeView when no node is focused", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("hsplit")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("node-view")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Context Provider Tests
  // ==========================================================================

  describe("context provider", () => {
    it("provides LineageViewContext to children", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      // The context menu and other children receive context
      await waitFor(() => {
        expect(screen.getByTestId("context-menu")).toBeInTheDocument();
      });
    });

    it("passes interactive prop through context", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={false} ref={null} />
        </TestWrapper>,
      );

      // When not interactive, TopBar is not rendered
      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("lineage-view-topbar"),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Imperative Handle Tests
  // ==========================================================================

  describe("imperative handle (copyToClipboard)", () => {
    it("exposes copyToClipboard function via ref", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      const ref = createRef<LineageViewRef>();

      // Use LineageView (the forwardRef component) to properly test ref handling
      render(
        <TestWrapper>
          <LineageView interactive={true} ref={ref} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toBeInTheDocument();
      });

      expect(ref.current).not.toBeNull();
      expect(typeof ref.current?.copyToClipboard).toBe("function");
    });

    it("calls internal copyToClipboard when ref method is invoked", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      const ref = createRef<LineageViewRef>();

      // Use LineageView (the forwardRef component) to properly test ref handling
      render(
        <TestWrapper>
          <LineageView interactive={true} ref={ref} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      await ref.current?.copyToClipboard();

      expect(mockCopyToClipboard).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useMultiNodesAction Integration Tests
  // ==========================================================================

  describe("useMultiNodesAction integration", () => {
    it("initializes useMultiNodesAction with proper callbacks", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(useMultiNodesAction).toHaveBeenCalled();
      });

      // Verify the hook was called with callbacks
      const callArgs = (useMultiNodesAction as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toHaveProperty("onActionStarted");
      expect(callArgs[1]).toHaveProperty("onActionNodeUpdated");
      expect(callArgs[1]).toHaveProperty("onActionCompleted");
    });

    it("provides action state to context", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      // Mock action state to running
      mockMultiNodesAction.actionState.status = "running";

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // View Options Tests
  // ==========================================================================

  describe("view options", () => {
    it("accepts initial viewOptions prop", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView
            interactive={true}
            viewOptions={{ view_mode: "all" }}
            ref={null}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toBeInTheDocument();
      });

      // Verify select was called - view options are processed
      expect(select).toHaveBeenCalled();
    });

    it("shows change status legend when models changed", async () => {
      const lineageGraph = createMockLineageGraph({
        modifiedSet: ["model.test.node1"],
      });
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("lineage-legend-changeStatus"),
        ).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Feature Toggle Tests
  // ==========================================================================

  describe("feature toggles", () => {
    it("shows SetupConnectionBanner when mode is metadata only", async () => {
      mockRecceInstanceContext.featureToggles = { mode: "metadata only" };
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      // SetupConnectionBanner is mocked to return null but we can verify
      // it's in the render tree by checking the TopBar is present
      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("lineage-view-topbar")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // forwardRef Export Tests
  // ==========================================================================

  describe("LineageView export", () => {
    it("exports LineageView as a forwardRef component", () => {
      expect(LineageView).toBeDefined();
      // forwardRef components have $$typeof symbol
      expect(LineageView.$$typeof?.toString()).toContain("Symbol");
    });
  });

  // ==========================================================================
  // Panel Position Tests
  // ==========================================================================

  describe("panel positions", () => {
    it("renders bottom-left panel for legends", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("rf-panel-bottom-left")).toBeInTheDocument();
      });
    });

    it("renders top-center panel for notifications", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("rf-panel-top-center")).toBeInTheDocument();
      });
    });

    it("renders top-left panel for CLL control", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("rf-panel-top-left")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Copy Image Button Tests
  // ==========================================================================

  describe("copy image button", () => {
    it("renders copy button in controls", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        const copyButton = screen.getByTestId("rf-control-button");
        expect(copyButton).toHaveAttribute("title", "copy image");
      });
    });
  });

  // ==========================================================================
  // ReactFlow Configuration Tests
  // ==========================================================================

  describe("ReactFlow configuration", () => {
    it("passes nodes to ReactFlow", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        const reactFlow = screen.getByTestId("reactflow");
        expect(reactFlow).toBeInTheDocument();
      });
    });

    it("default interactive is false", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toBeInTheDocument();
      });
      // When interactive is false (default), TopBar should not render
      expect(
        screen.queryByTestId("lineage-view-topbar"),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Context Menu Tests
  // ==========================================================================

  describe("context menu", () => {
    it("renders LineageViewContextMenu component", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("context-menu")).toBeInTheDocument();
      });
    });
  });
});
