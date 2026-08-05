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
import type {
  ColumnLineageData,
  Run,
  ServerInfoResult,
} from "@datarecce/ui/api";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React, { createRef } from "react";
import { type Mock, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before component imports
// ============================================================================

// Mock @xyflow/react - critical for ReactFlow component
// These will be populated after mocks are set up
let mockUseNodesStateReturnValue: [unknown[], Mock, Mock] = [
  [],
  vi.fn(),
  vi.fn(),
];
// Opt in to React Flow's real initial node identity. Production's render guard is
// `nodes == initialNodes` (referential), and initialNodes is a module-level [];
// a stubbed array is never that value, so the empty-render path is invisible to
// every test that does not set this.
let mockUseRealInitialNodes = false;
// biome-ignore lint/suspicious/noVar: vi.mock factories are hoisted above lexical initialization.
var mockReactFlowFitView: Mock;
// biome-ignore lint/suspicious/noVar: vi.mock factories are hoisted above lexical initialization.
var mockReactFlowSetCenter: Mock;
// biome-ignore lint/suspicious/noVar: vi.mock factories are hoisted above lexical initialization.
var mockReactFlowGetNodes: Mock;
// biome-ignore lint/suspicious/noVar: vi.mock factories are hoisted above lexical initialization.
var mockQueryClient: {
  invalidateQueries: Mock;
  getQueryData: Mock;
  setQueryData: Mock;
};
// biome-ignore lint/suspicious/noVar: vi.mock factories are hoisted above lexical initialization.
var mockLineageViewContext: React.Context<
  | {
      showColumnLevelLineage: (input?: unknown) => Promise<void>;
      resetColumnLevelLineage: (previous?: boolean) => Promise<void>;
      onViewOptionsChanged: (options: unknown) => Promise<void>;
      viewOptions: Record<string, unknown>;
      nodes: { id: string }[];
      changeAnalysisMode: boolean;
      setChangeAnalysisMode: (active: boolean) => void;
      isNodeShowingChangeAnalysis: (nodeId: string) => boolean;
      selectMode: string | undefined;
      selectNode: (nodeId: string) => void;
      selectParentNodes: (nodeId: string, degree?: number) => void;
      selectChildNodes: (nodeId: string, degree?: number) => void;
    }
  | undefined
>;

vi.mock("@xyflow/react", () => ({
  ReactFlow: vi.fn(
    ({
      children,
      nodes,
      onNodeClick,
      minZoom,
    }: {
      children: React.ReactNode;
      nodes?: { id: string }[];
      onNodeClick?: (
        event: React.MouseEvent<HTMLButtonElement>,
        node: { id: string },
      ) => void;
      minZoom?: number;
    }) => (
      <div
        data-testid="reactflow"
        data-node-count={nodes?.length ?? 0}
        data-node-ids={nodes?.map((node) => node.id).join(",")}
        data-min-zoom={minZoom}
      >
        {nodes?.map((node) => (
          <button
            key={node.id}
            data-testid={`click-${node.id}`}
            onClick={(event) => onNodeClick?.(event, node)}
          >
            Focus {node.id}
          </button>
        ))}
        {children}
      </div>
    ),
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="reactflow-provider">{children}</div>
  ),
  Background: vi.fn(() => <div data-testid="rf-background" />),
  BackgroundVariant: { Dots: "dots" },
  Controls: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="rf-controls">{children}</div>
  )),
  ControlButton: vi.fn(
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
  MiniMap: vi.fn(() => <div data-testid="rf-minimap" />),
  Panel: vi.fn(
    ({
      children,
      position,
    }: {
      children?: React.ReactNode;
      position?: string;
    }) => <div data-testid={`rf-panel-${position}`}>{children}</div>,
  ),
  useReactFlow: vi.fn(() => ({
    fitView: mockReactFlowFitView,
    setCenter: mockReactFlowSetCenter,
    getZoom: vi.fn().mockReturnValue(1),
    getNodes: mockReactFlowGetNodes,
  })),
  useNodesState: vi.fn((initial: unknown[]) => {
    const [nodes, setNodes] = React.useState(
      mockUseRealInitialNodes ? initial : mockUseNodesStateReturnValue[0],
    );
    return [nodes, setNodes, vi.fn()];
  }),
  useEdgesState: vi.fn(() => {
    const [edges, setEdges] = React.useState<unknown[]>([]);
    return [edges, setEdges, vi.fn()];
  }),
  getNodesBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
  Handle: vi.fn(() => null),
  Position: {
    Left: "left",
    Right: "right",
    Top: "top",
    Bottom: "bottom",
  },
}));

// Mock @datarecce/ui contexts
const mockRefetchLineageGraph = vi.fn();
const mockRefetchRunsAggregated = vi.fn();
let mockActiveRun: Run | undefined;
let mockActiveRunId: string | undefined;
let mockIsRunResultOpen = false;

const mockLineageGraphContext = {
  lineageGraph: undefined as LineageGraph | undefined,
  refetchLineageGraph: mockRefetchLineageGraph,
  isLoading: false,
  error: undefined as string | undefined,
  refetchRunsAggregated: mockRefetchRunsAggregated,
};

const mockRecceInstanceContext = {
  featureToggles: { mode: "full" } as { mode: string },
  singleEnv: false,
};

vi.mock("@datarecce/ui/contexts", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  mockLineageViewContext = React.createContext<
    | {
        showColumnLevelLineage: (input?: unknown) => Promise<void>;
        resetColumnLevelLineage: (previous?: boolean) => Promise<void>;
        onViewOptionsChanged: (options: unknown) => Promise<void>;
        viewOptions: Record<string, unknown>;
        nodes: { id: string }[];
        changeAnalysisMode: boolean;
        setChangeAnalysisMode: (active: boolean) => void;
        isNodeShowingChangeAnalysis: (nodeId: string) => boolean;
        selectMode: string | undefined;
        selectNode: (nodeId: string) => void;
        selectParentNodes: (nodeId: string, degree?: number) => void;
        selectChildNodes: (nodeId: string, degree?: number) => void;
      }
    | undefined
  >(undefined);
  return {
    useRouteConfig: vi.fn(() => ({ basePath: "" })),
    useLineageGraphContext: vi.fn(() => mockLineageGraphContext),
    useRecceInstanceContext: vi.fn(() => mockRecceInstanceContext),
    useRecceServerFlag: vi.fn(() => ({ data: {} })),
    useRecceActionContext: vi.fn(() => ({
      runId: mockActiveRunId,
      showRunId: mockShowRunId,
      closeRunResult: mockCloseRunResult,
      runAction: mockRunAction,
      isRunResultOpen: mockIsRunResultOpen,
    })),
    LineageViewContext: mockLineageViewContext,
    useLineageViewContextSafe: vi.fn(() => ({
      interactive: true,
      nodes: [],
      focusedNode: undefined,
      selectedNodes: [],
      cll: undefined,
      showContextMenu: vi.fn(),
      viewOptions: {},
      onViewOptionsChanged: vi.fn(),
      selectMode: undefined,
      selectNode: vi.fn(),
      selectParentNodes: vi.fn(),
      selectChildNodes: vi.fn(),
      deselect: vi.fn(),
      isNodeHighlighted: vi.fn(() => false),
      isNodeSelected: vi.fn(() => false),
      isEdgeHighlighted: vi.fn(() => false),
      getNodeAction: vi.fn(() => ({ mode: "per_node" as const })),
      getNodeColumnSet: vi.fn(() => new Set()),
      isNodeShowingChangeAnalysis: vi.fn(() => false),
      runRowCount: vi.fn(),
      runRowCountDiff: vi.fn(),
      runValueDiff: vi.fn(),
      addLineageDiffCheck: vi.fn(),
      addSchemaDiffCheck: vi.fn(),
      cancel: vi.fn(),
      actionState: {
        mode: "per_node" as const,
        status: "completed" as const,
        completed: 0,
        total: 0,
        actions: {},
      },
      centerNode: vi.fn(),
      showColumnLevelLineage: vi.fn(),
      resetColumnLevelLineage: vi.fn(),
    })),
  };
});

// Mock @datarecce/ui
vi.mock("@datarecce/ui", () => ({
  isLineageGraphColumnNode: vi.fn(
    (node) => node?.type === "lineageGraphColumnNode",
  ),
  isLineageGraphNode: vi.fn((node) => node?.type === "lineageGraphNode"),
  selectDownstream: vi.fn(() => new Set()),
  selectUpstream: vi.fn(() => new Set()),
  HSplit: vi.fn(({ children, sizes }) => (
    <div data-testid="hsplit" data-sizes={JSON.stringify(sizes)}>
      {children}
    </div>
  )),
  union: vi.fn((...sets) => {
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
vi.mock("@datarecce/ui/api", () => ({
  cacheKeys: {
    checks: vi.fn(() => ["checks"]),
    lineage: vi.fn(() => ["lineage"]),
  },
  getCll: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockResolvedValue({ nodes: [] }),
  createLineageDiffCheck: vi.fn().mockResolvedValue({ check_id: "test-check" }),
  createSchemaDiffCheck: vi.fn().mockResolvedValue({ check_id: "test-check" }),
}));

// Mock @datarecce/ui/components/lineage
vi.mock("@datarecce/ui/components/lineage", async () => {
  const actual = await vi.importActual("@datarecce/ui/components/lineage");
  return {
    ...(actual as Record<string, unknown>),
    BaseEnvironmentSetupNotification: vi.fn(() => null),
    getIconForChangeStatus: vi.fn(() => ({ hexColor: "#000000" })),
  };
});

vi.mock("@datarecce/ui/components/lineage/legend", () => ({
  LineageLegend: vi.fn(({ variant }) => (
    <div data-testid={`lineage-legend-${variant}`} />
  )),
}));

vi.mock("@datarecce/ui/components/lineage/topbar/LineageViewTopBarOss", () => ({
  LineageViewTopBarOss: vi.fn(() => <div data-testid="lineage-view-topbar" />),
}));

vi.mock("@datarecce/ui/components/lineage/NodeViewOss", () => ({
  NodeViewOss: vi.fn(({ node, onCloseNode, onNavigateToNode }) => (
    <div data-testid="node-view" data-node-id={node?.id}>
      <button data-testid="close-node-view" onClick={onCloseNode}>
        Close
      </button>
      <button
        data-testid="repeat-focused-node"
        onClick={() => onNavigateToNode(node.id)}
      >
        Keep current focus
      </button>
    </div>
  )),
}));

// Mock @datarecce/ui/components/ui
vi.mock("@datarecce/ui/components/ui", () => ({
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
    create: vi.fn(),
  },
  DataFrameColumnGroupHeader: () => null,
  DataFrameColumnHeader: () => null,
  defaultRenderCell: vi.fn(),
  inlineRenderCell: vi.fn(),
}));

// Mock @datarecce/ui/theme
vi.mock("@datarecce/ui/theme", () => ({
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

vi.mock("@datarecce/ui/components/lineage/ActionControlOss", () => ({
  ActionControlOss: vi.fn(({ onClose }) => (
    <div data-testid="action-control">
      <button data-testid="close-action" onClick={onClose}>
        Close
      </button>
    </div>
  )),
}));

vi.mock(
  "@datarecce/ui/components/lineage/ColumnLevelLineageControlOss",
  () => ({
    ColumnLevelLineageControlOss: vi.fn(() => {
      const context = React.useContext(mockLineageViewContext);
      return (
        <div
          data-testid="cll-control"
          data-change-analysis-mode={String(
            context?.changeAnalysisMode ?? false,
          )}
          data-select-mode={String(context?.selectMode)}
        >
          {/*
            The real multi-select entry points, driven through the context the
            canvas and the context menu use. Each one has to supersede a pending
            CLL interaction, or a late CLL response steals focus mid-selection.
          */}
          <button
            data-testid="select-parents-node1"
            onClick={() => context?.selectParentNodes("model.test.node1")}
          >
            Select node 1 parents
          </button>
          <button
            data-testid="select-children-node1"
            onClick={() => context?.selectChildNodes("model.test.node1")}
          >
            Select node 1 children
          </button>
          <button
            data-testid="select-node2"
            onClick={() => context?.selectNode("model.test.node2")}
          >
            Select node 2
          </button>
          <button
            data-testid="select-node1"
            onClick={() => context?.selectNode("model.test.node1")}
          >
            Select node 1
          </button>
          <button
            data-testid="select-missing-node"
            onClick={() => context?.selectNode("model.test.missing")}
          >
            Select a node the graph does not have
          </button>
          <button
            data-testid="select-parents-missing-node"
            onClick={() => context?.selectParentNodes("model.test.missing")}
          >
            Select parents of a node the graph does not have
          </button>
          {/*
            The change-analysis treatment every node consumes, read straight off
            the context the real GraphNode reads it from. Nothing here restates
            the rule — the component's `isNodeShowingChangeAnalysis` decides.
          */}
          {(context?.nodes ?? []).map((node) => (
            <span
              key={node.id}
              data-testid={`change-analysis-${node.id}`}
              data-showing={String(
                context?.isNodeShowingChangeAnalysis(node.id) ?? false,
              )}
            />
          ))}
          {/*
            Impact Radius activation as the real control performs it: set the
            independent mode flag, then request the radius. Activation is the
            control's job; what the *view* does with the resulting transitions
            is what the tests below pin.
          */}
          <button
            data-testid="activate-impact"
            onClick={() => {
              context?.setChangeAnalysisMode(true);
              void context?.showColumnLevelLineage({
                change_analysis: true,
                no_upstream: true,
              });
            }}
          >
            Activate impact radius
          </button>
          <button
            data-testid="activate-impact-node1"
            onClick={() => {
              context?.setChangeAnalysisMode(true);
              void context?.showColumnLevelLineage({
                node_id: "model.test.node1",
                change_analysis: true,
                no_upstream: true,
              });
            }}
          >
            Activate node 1 impact radius
          </button>
          <button
            data-testid="click-column-node1-id"
            onClick={() =>
              void context?.showColumnLevelLineage({
                node_id: "model.test.node1",
                column: "id",
              })
            }
          >
            Click node 1 id column
          </button>
          <button
            data-testid="show-impact-node1"
            onClick={() =>
              void context?.showColumnLevelLineage({
                node_id: "model.test.node1",
                change_analysis: true,
                no_upstream: true,
              })
            }
          >
            Show node 1 impact
          </button>
          <button
            data-testid="refresh-cll-node1"
            onClick={() =>
              void context?.onViewOptionsChanged({
                ...context.viewOptions,
                column_level_lineage: {
                  node_id: "model.test.node1",
                  column: "id",
                },
              })
            }
          >
            Refresh node 1 CLL
          </button>
          <button
            data-testid="show-all-models"
            onClick={() =>
              void context?.onViewOptionsChanged({
                ...context.viewOptions,
                view_mode: "all",
                column_level_lineage: undefined,
              })
            }
          >
            Show all models
          </button>
          <button
            data-testid="disable-cll"
            onClick={() => void context?.showColumnLevelLineage(undefined)}
          >
            Disable CLL
          </button>
          <button
            data-testid="reset-cll"
            onClick={() => void context?.resetColumnLevelLineage()}
          >
            Reset CLL
          </button>
          <button
            data-testid="previous-cll"
            onClick={() => void context?.resetColumnLevelLineage(true)}
          >
            Previous CLL
          </button>
        </div>
      );
    }),
  }),
);

vi.mock("@datarecce/ui/components/lineage/GraphNodeOss", () => ({
  GraphNode: vi.fn(() => <div data-testid="graph-node" />),
}));

vi.mock("@datarecce/ui/components/lineage/GraphColumnNodeOss", () => ({
  GraphColumnNode: vi.fn(() => <div data-testid="graph-column-node" />),
}));

vi.mock("@datarecce/ui/components/lineage/GraphEdgeOss", () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="graph-edge" />),
}));

vi.mock("@datarecce/ui/components/lineage/LineageViewContextMenuOss", () => ({
  LineageViewContextMenu: vi.fn(() => <div data-testid="context-menu" />),
  useLineageViewContextMenu: vi.fn(() => ({
    showContextMenu: vi.fn(),
    closeContextMenu: vi.fn(),
    props: {},
  })),
}));

vi.mock("@datarecce/ui/components/notifications", () => ({
  LineageViewNotification: vi.fn(() => null),
}));

vi.mock("@datarecce/ui/components/lineage/SetupConnectionBannerOss", () => ({
  __esModule: true,
  default: vi.fn(() => null),
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
  runRowCount: vi.fn(),
  runRowCountDiff: vi.fn(),
  runValueDiff: vi.fn(),
  addLineageDiffCheck: vi.fn(),
  addSchemaDiffCheck: vi.fn(),
  cancel: vi.fn(),
  reset: vi.fn(),
};

vi.mock("@datarecce/ui/hooks/useMultiNodesActionOss", () => ({
  useMultiNodesActionOss: vi.fn(() => mockMultiNodesAction),
}));

const mockCopyToClipboard = vi.fn().mockResolvedValue(undefined);

// Mock OSS hooks
vi.mock("@datarecce/ui/hooks", () => ({
  useApiConfig: vi.fn(() => ({
    apiClient: {},
  })),
  useClipBoardToast: vi.fn(() => ({
    successToast: vi.fn(),
    failToast: vi.fn(),
  })),
  IGNORE_SCREENSHOT_CLASS: "ignore-screenshot",
  useCopyToClipboard: vi.fn(() => ({
    copyToClipboard: mockCopyToClipboard,
    ImageDownloadModal: () => null,
    ref: { current: null },
  })),
  useRun: vi.fn(() => ({ run: mockActiveRun })),
  useThemeColors: vi.fn(() => ({
    isDark: false,
  })),
}));

const mockShowRunId = vi.fn();
const mockCloseRunResult = vi.fn();
const mockRunAction = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/lineage"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

// Mock tracking
vi.mock("@datarecce/ui/lib/api/track", () => ({
  trackCopyToClipboard: vi.fn(),
  trackLineageViewRender: vi.fn(),
  trackMultiNodesAction: vi.fn(),
}));

// Mock lineage utilities
vi.mock("@datarecce/ui/components/lineage/lineage", () => ({
  layout: vi.fn(),
  toReactFlow: vi.fn(() => [[], [], {}]),
}));

// Mock @tanstack/react-query
vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  })),
  useQuery: vi.fn(() => ({
    data: undefined,
  })),
  useQueryClient: vi.fn(() => mockQueryClient),
}));

// ============================================================================
// Imports - MUST come after mocks
// ============================================================================

import { selectDownstream, selectUpstream } from "@datarecce/ui";
import { select } from "@datarecce/ui/api";
import {
  LineageViewOss as LineageView,
  type LineageViewProps,
  type LineageViewRef,
  PrivateLineageView,
} from "@datarecce/ui/components/lineage/LineageViewOss";
import { useRecceServerFlag } from "@datarecce/ui/contexts";
import { trackLineageViewRender } from "@datarecce/ui/lib/api/track";

// Wrap PrivateLineageView with forwardRef for testing purposes
// This is needed because PrivateLineageView is a function that takes (props, ref)
// but is not wrapped with forwardRef in the export
const TestablePrivateLineageView = React.forwardRef<
  LineageViewRef,
  LineageViewProps
>(PrivateLineageView);

import { toReactFlow } from "@datarecce/ui/components/lineage/lineage";
import { toaster } from "@datarecce/ui/components/ui";
import { useMultiNodesActionOss as useMultiNodesAction } from "@datarecce/ui/hooks/useMultiNodesActionOss";
import { HttpError } from "@datarecce/ui/lib/fetchClient";
import { useMutation } from "@tanstack/react-query";

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
      resourceType: "model",
      packageName: "test",
      parents: {},
      children: {},
      changeStatus: "modified",
      ...overrides,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createColumnLineageData(): ColumnLineageData {
  return {
    current: {
      nodes: {
        "model.test.node1": {
          id: "model.test.node1",
          name: "node1",
          source_name: "",
          resource_type: "model",
          change_status: "modified",
          change_category: "breaking",
          columns: {
            "model.test.node1.id": {
              name: "id",
              type: "INTEGER",
              change_status: "modified",
            },
          },
        },
      },
      columns: {},
      parent_map: {},
      child_map: {},
    },
  };
}

function createPatchableServerInfoResult(): ServerInfoResult {
  return {
    state_metadata: {
      schema_version: "1",
      recce_version: "0.1.0",
      generated_at: "2026-01-01",
    },
    adapter_type: "dbt",
    review_mode: false,
    cloud_mode: false,
    file_mode: false,
    demo: false,
    codespace: false,
    support_tasks: {},
    lineage: {
      nodes: {
        "model.test.node1": {
          name: "node1",
          resource_type: "model",
          package_name: "test",
        },
      },
      edges: [],
      metadata: { base: {}, current: {} },
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
  mockUseNodesStateReturnValue = [mockNodes, vi.fn(), vi.fn()];

  (toReactFlow as Mock).mockReturnValue([
    mockNodes,
    [],
    Object.fromEntries(mockNodes.map((n) => [n.id, new Set<string>()])),
  ]);

  (select as Mock).mockResolvedValue({
    nodes: mockNodes.map((n) => n.id),
  });
}

type ModelScopedRunType =
  | "profile"
  | "profile_diff"
  | "top_k_diff"
  | "histogram_diff"
  | "value_diff"
  | "value_diff_detail";

function setupOpenModelRun(type: ModelScopedRunType, model: string) {
  mockActiveRunId = `${type}-${model}`;
  mockIsRunResultOpen = true;
  mockActiveRun = {
    type,
    run_id: mockActiveRunId,
    run_at: "2026-07-28T00:00:00Z",
    params: { model },
  } as Run;
}

function setupOpenProfileRun(model: string) {
  setupOpenModelRun("profile_diff", model);
}

function setupOpenRowCountRun(
  type: "row_count" | "row_count_diff",
  model: string,
) {
  mockActiveRunId = `${type}-${model}`;
  mockIsRunResultOpen = true;
  mockActiveRun = {
    type,
    run_id: mockActiveRunId,
    run_at: "2026-07-28T00:00:00Z",
    params: { node_names: [model] },
  } as Run;
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
    vi.clearAllMocks();
    // clearAllMocks resets call records but NOT implementations, so a
    // mockReturnValue set by one test would otherwise leak into every later
    // test that does not set its own and make the suite order-dependent.
    (useMutation as Mock).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    });
    (useRecceServerFlag as Mock).mockReturnValue({ data: {} });
    (toReactFlow as Mock).mockReturnValue([[], [], {}]);
    (select as Mock).mockResolvedValue({ nodes: [] });
    mockReactFlowFitView = vi.fn().mockResolvedValue(undefined);
    mockReactFlowSetCenter = vi.fn().mockResolvedValue(undefined);
    mockReactFlowGetNodes = vi.fn().mockReturnValue([]);
    mockQueryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      getQueryData: vi.fn().mockReturnValue(undefined),
      setQueryData: vi.fn(),
    };

    // Reset context mocks to defaults
    mockLineageGraphContext.lineageGraph = undefined;
    mockLineageGraphContext.isLoading = false;
    mockLineageGraphContext.error = undefined;
    mockRecceInstanceContext.featureToggles = { mode: "full" };
    mockRecceInstanceContext.singleEnv = false;
    mockActiveRun = undefined;
    mockActiveRunId = undefined;
    mockIsRunResultOpen = false;

    // Reset node state mock
    mockUseNodesStateReturnValue = [[], vi.fn(), vi.fn()];
    mockUseRealInitialNodes = false;
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

    it("calls refetchLineageGraph when retry button is clicked", () => {
      mockLineageGraphContext.error = "Network error";

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      const retryButton = screen.getByRole("button", { name: "Retry" });
      fireEvent.click(retryButton);

      expect(mockRefetchLineageGraph).toHaveBeenCalledTimes(1);
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
      mockUseNodesStateReturnValue = [[], vi.fn(), vi.fn()];
      (toReactFlow as Mock).mockReturnValue([[], [], {}]);
      (select as Mock).mockResolvedValue({ nodes: [] });

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
      const callArgs = (useMultiNodesAction as Mock).mock.calls[0];
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

    it("lets manual zoom go below the floor fitView will settle at", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-all-models")).toBeInTheDocument(),
      );

      // A view change fits the graph, and fitView carries the legibility floor.
      fireEvent.click(screen.getByTestId("show-all-models"));
      await waitFor(() => expect(mockReactFlowFitView).toHaveBeenCalled());

      const fitViewMinZoom = (
        mockReactFlowFitView.mock.calls[0][0] as { minZoom: number }
      ).minZoom;
      const canvasMinZoom = Number(
        screen.getByTestId("reactflow").getAttribute("data-min-zoom"),
      );

      // The whole point of two floors: fitView keeps labels legible, while the
      // user may still zoom out past that to explore a large graph.
      expect(fitViewMinZoom).toBeGreaterThan(0);
      expect(fitViewMinZoom).toBeLessThan(1);
      expect(canvasMinZoom).toBeGreaterThan(0);
      expect(canvasMinZoom).toBeLessThan(fitViewMinZoom);
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

  // ==========================================================================
  // Impact-at-Startup Auto-Trigger Tests
  // ==========================================================================

  describe("impact-at-startup auto-trigger", () => {
    let mockMutateAsync: Mock;

    beforeEach(() => {
      mockMutateAsync = vi.fn().mockResolvedValue(undefined);
      (useMutation as Mock).mockReturnValue({
        mutateAsync: mockMutateAsync,
      });
    });

    afterEach(() => {
      // Restore default mock
      (useRecceServerFlag as Mock).mockReturnValue({ data: {} });
      (useMutation as Mock).mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
      });
    });

    it("triggers CLL when impact_at_startup flag is true", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      (useRecceServerFlag as Mock).mockReturnValue({
        data: { impact_at_startup: true },
      });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            change_analysis: true,
            no_upstream: true,
          }),
        );
      });
    });

    it("does not trigger CLL when flag is false", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      (useRecceServerFlag as Mock).mockReturnValue({
        data: { impact_at_startup: false },
      });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      // Wait for the effect to settle, then verify no CLL call
      await waitFor(() => {
        expect(select).toHaveBeenCalled();
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it("still triggers CLL when a hidden run model supersedes the first layout", async () => {
      // The run-focus effect asks for view_mode "all" on the first commit, which
      // supersedes the layout effect while its node selection is in flight — and
      // the layout effect is the only thing that arms the one-shot impact
      // request. Dropping it would silently disable the flag for the session.
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      setupOpenProfileRun("node2");
      mockUseNodesStateReturnValue = [
        [lineageGraph.nodes["model.test.node1"]],
        vi.fn(),
        vi.fn(),
      ];
      (useRecceServerFlag as Mock).mockReturnValue({
        data: { impact_at_startup: true },
      });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            change_analysis: true,
            no_upstream: true,
          }),
        ),
      );
    });

    it("does not trigger CLL when flag is absent", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      (useRecceServerFlag as Mock).mockReturnValue({ data: {} });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(select).toHaveBeenCalled();
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("run focus synchronization", () => {
    it.each([
      "profile",
      "profile_diff",
      "top_k_diff",
      "histogram_diff",
      "value_diff",
      "value_diff_detail",
    ] as const)(
      "detaches an open %s result when the user focuses another node",
      async (runType) => {
        const lineageGraph = createMockLineageGraph();
        setupWithLineageGraph(lineageGraph);
        setupOpenModelRun(runType, "node1");

        render(
          <TestWrapper>
            <TestablePrivateLineageView interactive={true} ref={null} />
          </TestWrapper>,
        );

        await waitFor(() =>
          expect(screen.getByTestId("node-view")).toHaveAttribute(
            "data-node-id",
            "model.test.node1",
          ),
        );

        fireEvent.click(screen.getByTestId("click-model.test.node2"));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(screen.getByTestId("node-view")).toHaveAttribute(
          "data-node-id",
          "model.test.node2",
        );
        expect(mockCloseRunResult).not.toHaveBeenCalled();
      },
    );

    it.each(["row_count", "row_count_diff"] as const)(
      "keeps node navigation independent of an open %s result",
      async (runType) => {
        const lineageGraph = createMockLineageGraph();
        setupWithLineageGraph(lineageGraph);
        const view = () => (
          <TestWrapper>
            <TestablePrivateLineageView interactive={true} ref={null} />
          </TestWrapper>
        );
        const { rerender } = render(view());

        await waitFor(() =>
          expect(
            screen.getByTestId("click-model.test.node1"),
          ).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId("click-model.test.node1"));
        expect(screen.getByTestId("node-view")).toHaveAttribute(
          "data-node-id",
          "model.test.node1",
        );

        setupOpenRowCountRun(runType, "node1");
        rerender(view());
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(screen.getByTestId("node-view")).toHaveAttribute(
          "data-node-id",
          "model.test.node1",
        );

        fireEvent.click(screen.getByTestId("click-model.test.node2"));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(screen.getByTestId("node-view")).toHaveAttribute(
          "data-node-id",
          "model.test.node2",
        );
        expect(mockCloseRunResult).not.toHaveBeenCalled();
      },
    );
  });

  describe("async layout ownership", () => {
    it("invalidates a deferred CLL request on unmount before it patches or lays out", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowCll = deferred<ColumnLineageData>();
      const mockMutateAsync = vi.fn(() => slowCll.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });
      const cachedLineage = createPatchableServerInfoResult();
      mockQueryClient.getQueryData.mockReturnValue(cachedLineage);
      mockQueryClient.setQueryData.mockReturnValue({
        ...cachedLineage,
        lineage: { ...cachedLineage.lineage },
      });

      const { unmount } = render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );

      (toReactFlow as Mock).mockClear();
      (trackLineageViewRender as Mock).mockClear();
      mockQueryClient.setQueryData.mockClear();
      mockReactFlowFitView.mockClear();

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      unmount();

      await act(async () => {
        slowCll.resolve(createColumnLineageData());
        await slowCll.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockQueryClient.setQueryData).not.toHaveBeenCalled();
      expect(toReactFlow).not.toHaveBeenCalled();
      expect(trackLineageViewRender).not.toHaveBeenCalled();
      expect(mockReactFlowFitView).not.toHaveBeenCalled();
    });

    it("invalidates refreshLayout ownership on unmount while layout is deferred", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const mockMutateAsync = vi
        .fn()
        .mockResolvedValue(createColumnLineageData());
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      const { unmount } = render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("refresh-cll-node1")).toBeInTheDocument(),
      );

      const slowLayout =
        deferred<[LineageGraphNode[], [], Record<string, Set<string>>]>();
      const staleNode = createMockLineageGraphNode(
        "model.test.after_unmount",
        "after_unmount",
      );
      (toReactFlow as Mock).mockClear();
      (toReactFlow as Mock).mockImplementationOnce(() => slowLayout.promise);
      (trackLineageViewRender as Mock).mockClear();
      mockReactFlowFitView.mockClear();

      fireEvent.click(screen.getByTestId("refresh-cll-node1"));
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));
      unmount();

      await act(async () => {
        slowLayout.resolve([
          [staleNode],
          [],
          { [staleNode.id]: new Set<string>() },
        ]);
        await slowLayout.promise;
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      expect(trackLineageViewRender).not.toHaveBeenCalled();
      expect(mockReactFlowFitView).not.toHaveBeenCalled();
    });

    it("keeps the production reset focus when an older show finishes late", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowShowLayout =
        deferred<[LineageGraphNode[], [], Record<string, Set<string>>]>();
      const mockMutateAsync = vi
        .fn()
        .mockResolvedValue(createColumnLineageData());
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );
      (toReactFlow as Mock).mockClear();
      (toReactFlow as Mock).mockImplementationOnce(
        () => slowShowLayout.promise,
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId("reset-cll"));
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(2));

      await act(async () => {
        slowShowLayout.resolve([[], [], {}]);
        await slowShowLayout.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.queryByTestId("node-view")).not.toBeInTheDocument();
    });

    it("keeps a newer direct view change when an older show finishes late", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowShow = deferred<ColumnLineageData>();
      const mockMutateAsync = vi.fn(() => slowShow.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );
      (toReactFlow as Mock).mockClear();

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId("show-all-models"));
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));

      await act(async () => {
        slowShow.resolve(createColumnLineageData());
        await slowShow.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.queryByTestId("node-view")).not.toBeInTheDocument();
    });

    it("keeps a newer node focus and excludes the stale show from history", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowShow = deferred<ColumnLineageData>();
      const mockMutateAsync = vi.fn(() => slowShow.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId("click-model.test.node2"));
      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node2",
      );

      await act(async () => {
        slowShow.resolve(createColumnLineageData());
        await slowShow.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node2",
      );

      // Flushed, then asserted: a superseded show must not have pushed a history
      // entry, so "previous" has nothing to restore. Without the flush a
      // regressed push would land after the test body returned and the bare
      // assertion could not fail.
      fireEvent.click(screen.getByTestId("previous-cll"));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node2",
      );
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    it("honors repeated focus intent while an older show is pending", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowShow = deferred<ColumnLineageData>();
      const mockMutateAsync = vi.fn(() => slowShow.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(
          screen.getByTestId("click-model.test.node2"),
        ).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("click-model.test.node2"));
      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node2",
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId("repeat-focused-node"));

      await act(async () => {
        slowShow.resolve(createColumnLineageData());
        await slowShow.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node2",
      );
      // Flushed, then asserted: a superseded show must not have pushed a history
      // entry, so "previous" has nothing to restore. Without the flush a
      // regressed push would land after the test body returned and the bare
      // assertion could not fail.
      fireEvent.click(screen.getByTestId("previous-cll"));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node2",
      );
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    it("does not let an unchanged open run supersede a newer CLL interaction", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      mockActiveRunId = "run-node2";
      mockIsRunResultOpen = true;
      mockActiveRun = {
        type: "schema_diff",
        run_id: mockActiveRunId,
        run_at: "2026-07-28T00:00:00Z",
      };
      const slowShow = deferred<ColumnLineageData>();
      const mockMutateAsync = vi.fn(() => slowShow.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      await act(async () => {
        slowShow.resolve(createColumnLineageData());
        await slowShow.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node1",
      );
    });

    it("lets a newly opened run supersede an older CLL interaction", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowShow = deferred<ColumnLineageData>();
      const mockMutateAsync = vi.fn(() => slowShow.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      // A fresh element every time: React bails out of re-rendering a
      // referentially identical one, so the newly opened run would never reach
      // the component.
      const view = () => (
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>
      );
      const { rerender } = render(view());
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

      mockActiveRunId = "new-run";
      mockIsRunResultOpen = true;
      mockActiveRun = {
        type: "schema_diff",
        run_id: mockActiveRunId,
        run_at: "2026-07-28T00:00:00Z",
      };
      rerender(view());

      await act(async () => {
        slowShow.resolve(createColumnLineageData());
        await slowShow.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.queryByTestId("node-view")).not.toBeInTheDocument();
    });

    it("focuses a hidden run model after the all-models layout resolves", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      setupOpenProfileRun("node2");
      const visibleNode = lineageGraph.nodes["model.test.node1"];
      const hiddenNode = lineageGraph.nodes["model.test.node2"];
      mockUseNodesStateReturnValue = [[visibleNode], vi.fn(), vi.fn()];
      const slowLayout =
        deferred<[LineageGraphNode[], [], Record<string, Set<string>>]>();
      (toReactFlow as Mock).mockImplementation(() => slowLayout.promise);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));
      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({ view_mode: "all" }),
        expect.anything(),
      );
      expect(screen.queryByTestId("node-view")).not.toBeInTheDocument();

      await act(async () => {
        slowLayout.resolve([
          [visibleNode, hiddenNode],
          [],
          {
            [visibleNode.id]: new Set<string>(),
            [hiddenNode.id]: new Set<string>(),
          },
        ]);
        await slowLayout.promise;
      });

      await waitFor(() =>
        expect(screen.getByTestId("node-view")).toHaveAttribute(
          "data-node-id",
          hiddenNode.id,
        ),
      );
    });

    it("does not let a hidden run model steal a newer user focus", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      setupOpenProfileRun("node2");
      const visibleNode = lineageGraph.nodes["model.test.node1"];
      const hiddenNode = lineageGraph.nodes["model.test.node2"];
      mockUseNodesStateReturnValue = [[visibleNode], vi.fn(), vi.fn()];
      const slowLayout =
        deferred<[LineageGraphNode[], [], Record<string, Set<string>>]>();
      (toReactFlow as Mock).mockImplementation(() => slowLayout.promise);

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByTestId(`click-${visibleNode.id}`));
      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        visibleNode.id,
      );

      await act(async () => {
        slowLayout.resolve([
          [visibleNode, hiddenNode],
          [],
          {
            [visibleNode.id]: new Set<string>(),
            [hiddenNode.id]: new Set<string>(),
          },
        ]);
        await slowLayout.promise;
      });

      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        visibleNode.id,
      );
    });

    it("retains previous CLL history when a deferred reset is superseded", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowPrevious = deferred<ColumnLineageData>();
      const mockMutateAsync = vi
        .fn()
        .mockResolvedValueOnce(createColumnLineageData())
        .mockImplementationOnce(() => slowPrevious.promise)
        .mockResolvedValue(createColumnLineageData());
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() =>
        expect(screen.getByTestId("node-view")).toHaveAttribute(
          "data-node-id",
          "model.test.node1",
        ),
      );
      fireEvent.click(screen.getByTestId("disable-cll"));
      await waitFor(() =>
        expect(screen.queryByTestId("node-view")).not.toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("previous-cll"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByTestId("click-model.test.node2"));

      await act(async () => {
        slowPrevious.resolve(createColumnLineageData());
        await slowPrevious.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(screen.getByTestId("node-view")).toHaveAttribute(
        "data-node-id",
        "model.test.node2",
      );

      fireEvent.click(screen.getByTestId("previous-cll"));
      await waitFor(() =>
        expect(screen.getByTestId("node-view")).toHaveAttribute(
          "data-node-id",
          "model.test.node1",
        ),
      );
      expect(mockMutateAsync).toHaveBeenCalledTimes(3);
    });

    it("does not fit an unmounted layout after its fit delay", async () => {
      vi.useFakeTimers();
      try {
        const lineageGraph = createMockLineageGraph();
        setupWithLineageGraph(lineageGraph);

        const { unmount } = render(
          <TestWrapper>
            <TestablePrivateLineageView interactive={true} ref={null} />
          </TestWrapper>,
        );
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });
        expect(screen.getByTestId("show-all-models")).toBeInTheDocument();

        (toReactFlow as Mock).mockClear();
        (trackLineageViewRender as Mock).mockClear();
        mockReactFlowFitView.mockClear();

        fireEvent.click(screen.getByTestId("show-all-models"));
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });
        expect(toReactFlow).toHaveBeenCalledTimes(1);
        expect(trackLineageViewRender).toHaveBeenCalledTimes(1);
        expect(mockReactFlowFitView).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBeGreaterThan(0);

        unmount();
        await act(async () => {
          await vi.runAllTimersAsync();
        });

        expect(mockReactFlowFitView).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps the newer rendered layout and tracking when an older toReactFlow finishes last", async () => {
      const lineageGraphA = createMockLineageGraph();
      setupWithLineageGraph(lineageGraphA);
      const slowLayoutA =
        deferred<[LineageGraphNode[], [], Record<string, Set<string>>]>();
      const nodeA = createMockLineageGraphNode(
        "model.test.layout_a",
        "layout_a",
      );
      const nodeB = createMockLineageGraphNode(
        "model.test.layout_b",
        "layout_b",
      );
      (toReactFlow as Mock)
        .mockImplementationOnce(() => slowLayoutA.promise)
        .mockResolvedValueOnce([
          [nodeB],
          [],
          { [nodeB.id]: new Set<string>() },
        ]);

      const { rerender } = render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));

      mockLineageGraphContext.lineageGraph = createMockLineageGraph({
        nodes: { [nodeB.id]: nodeB },
      });
      rerender(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reactflow")).toHaveAttribute(
          "data-node-ids",
          nodeB.id,
        );
      });
      expect(trackLineageViewRender).toHaveBeenCalledTimes(1);

      await act(async () => {
        slowLayoutA.resolve([[nodeA], [], { [nodeA.id]: new Set<string>() }]);
        await slowLayoutA.promise;
      });

      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId("reactflow")).toHaveAttribute(
        "data-node-ids",
        nodeB.id,
      );
      expect(trackLineageViewRender).toHaveBeenCalledTimes(1);
    });

    // Pins the layout-generation half of the
    // `!isCurrentGeneration() || !resolution.isCurrent()` guard: the disable
    // owns a newer layout generation, so the older CLL completion may not reach
    // toReactFlow. The lifecycle-epoch half (`resolution.isCurrent()`) is
    // defence-in-depth for a future caller that does not own a layout
    // generation; its contract is pinned directly in
    // packages/ui/.../CllCachePatchLifecycle.test.ts ("keeps the newer patch
    // when an older patchable request finishes last" and friends).
    it("does not send stale CLL to layout after a newer disable completes", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const slowCllA = deferred<{
        current: {
          nodes: Record<string, never>;
          columns: Record<string, never>;
          parent_map: Record<string, never>;
          child_map: Record<string, never>;
        };
      }>();
      const mockMutateAsync = vi.fn(() => slowCllA.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });
      const nodeB = createMockLineageGraphNode(
        "model.test.after_disable",
        "after_disable",
      );
      (toReactFlow as Mock).mockResolvedValue([
        [nodeB],
        [],
        { [nodeB.id]: new Set<string>() },
      ]);

      render(
        <TestWrapper>
          <TestablePrivateLineageView
            interactive={true}
            viewOptions={{
              column_level_lineage: {
                node_id: "model.test.node1",
                change_analysis: true,
              },
            }}
            ref={null}
          />
        </TestWrapper>,
      );
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByTestId("disable-cll"));
      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId("reactflow")).toHaveAttribute(
        "data-node-ids",
        nodeB.id,
      );

      await act(async () => {
        slowCllA.resolve({
          current: {
            nodes: {},
            columns: {},
            parent_map: {},
            child_map: {},
          },
        });
        await slowCllA.promise;
      });

      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      expect(toReactFlow).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("reactflow")).toHaveAttribute(
        "data-node-ids",
        nodeB.id,
      );
    });
  });

  // ==========================================================================
  // First-layout ownership
  // ==========================================================================

  describe("first layout ownership", () => {
    it("still lays out the graph when the view change that superseded the first layout fails", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      // The real initial identity, so the "nothing has laid out yet" render
      // guard is live for this test.
      mockUseRealInitialNodes = true;
      // A run result open on a model the current view does not show: the
      // run-focus effect asks for view_mode "all", which supersedes the layout
      // effect mid-flight and makes refreshLayout the only layout producer.
      setupOpenProfileRun("node2");
      const nodeIds = Object.keys(lineageGraph.nodes);
      (select as Mock)
        .mockResolvedValueOnce({ nodes: nodeIds })
        .mockRejectedValueOnce(
          new HttpError(500, { detail: "select blew up" }, "select failed"),
        );

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() =>
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Select node error" }),
        ),
      );

      // The failed view change must not take the whole panel with it: a lineage
      // view that renders nothing has no canvas, no top bar and no way back.
      await waitFor(() =>
        expect(screen.getByTestId("reactflow")).toBeInTheDocument(),
      );
    });
  });

  // ==========================================================================
  // Multi-select entry points
  // ==========================================================================

  describe("multi-select", () => {
    function selectMode() {
      return screen.getByTestId("cll-control").getAttribute("data-select-mode");
    }

    async function renderWithPendingCll() {
      setupWithLineageGraph(createMockLineageGraph());
      (selectUpstream as Mock).mockReturnValue(
        new Set(["model.test.node1", "model.test.node2"]),
      );
      (selectDownstream as Mock).mockReturnValue(
        new Set(["model.test.node1", "model.test.node2"]),
      );
      const slowShow = deferred<ColumnLineageData>();
      const mockMutateAsync = vi.fn(() => slowShow.promise);
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId("show-impact-node1"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      return slowShow;
    }

    async function resolvePendingCll(slowShow: {
      promise: Promise<ColumnLineageData>;
      resolve: (value: ColumnLineageData) => void;
    }) {
      await act(async () => {
        slowShow.resolve(createColumnLineageData());
        await slowShow.promise;
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    it.each([
      ["select-parents-node1"] as const,
      ["select-children-node1"] as const,
      ["select-node2"] as const,
    ])(
      "does not let a pending CLL response steal focus after %s",
      async (testId) => {
        const slowShow = await renderWithPendingCll();

        fireEvent.click(screen.getByTestId(testId));
        expect(selectMode()).toBe("selecting");

        await resolvePendingCll(slowShow);

        // The CLL request the user abandoned by starting a selection must not
        // open the Model Detail panel on top of that selection.
        expect(screen.queryByTestId("node-view")).not.toBeInTheDocument();
        expect(selectMode()).toBe("selecting");
      },
    );

    it.each([
      ["select-parents-node1"] as const,
      ["select-children-node1"] as const,
      ["select-node1"] as const,
    ])(
      "supersedes a pending CLL response from %s while already selecting",
      async (testId) => {
        // Entering the selection first matters: from then on the handler skips
        // the branch that clears CLL through onViewOptionsChanged, so its own
        // supersede call is the only thing standing between a late CLL response
        // and the user's selection.
        setupWithLineageGraph(createMockLineageGraph());
        (selectUpstream as Mock).mockReturnValue(
          new Set(["model.test.node1", "model.test.node2"]),
        );
        (selectDownstream as Mock).mockReturnValue(
          new Set(["model.test.node1", "model.test.node2"]),
        );
        const slowShow = deferred<ColumnLineageData>();
        const mockMutateAsync = vi.fn(() => slowShow.promise);
        (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

        render(
          <TestWrapper>
            <TestablePrivateLineageView interactive={true} ref={null} />
          </TestWrapper>,
        );
        await waitFor(() =>
          expect(screen.getByTestId("select-node2")).toBeInTheDocument(),
        );

        fireEvent.click(screen.getByTestId("select-node2"));
        expect(selectMode()).toBe("selecting");

        fireEvent.click(screen.getByTestId("show-impact-node1"));
        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByTestId(testId));
        await resolvePendingCll(slowShow);

        expect(screen.queryByTestId("node-view")).not.toBeInTheDocument();
        expect(selectMode()).toBe("selecting");
      },
    );

    it.each([
      ["select-missing-node"] as const,
      ["select-parents-missing-node"] as const,
    ])(
      "ignores %s, which names a node the graph does not have",
      async (testId) => {
        setupWithLineageGraph(createMockLineageGraph());

        render(
          <TestWrapper>
            <TestablePrivateLineageView interactive={true} ref={null} />
          </TestWrapper>,
        );
        await waitFor(() =>
          expect(screen.getByTestId(testId)).toBeInTheDocument(),
        );

        fireEvent.click(screen.getByTestId(testId));

        // No selection is entered, so the action toolbar never appears for a node
        // that cannot be acted on.
        expect(selectMode()).toBe("undefined");
        expect(screen.queryByTestId("action-control")).not.toBeInTheDocument();
      },
    );
  });

  // ==========================================================================
  // Change Analysis Mode
  //
  // The transitions themselves are unit-tested in
  // packages/ui/.../CllChangeAnalysisPropagation.test.ts. What follows pins the
  // *component's* use of them: which handler applies which transition, when the
  // mode lands, and what every node consumer reads off the context.
  // ==========================================================================

  describe("change analysis mode", () => {
    const CHANGED_NODE = "model.test.node1";
    const OTHER_CHANGED_NODE = "model.test.node2";
    const UNCHANGED_NODE = "model.test.node3";

    function setupChangeAnalysisGraph() {
      const graph = createMockLineageGraph({
        nodes: {
          [CHANGED_NODE]: createMockLineageGraphNode(CHANGED_NODE, "node1"),
          [OTHER_CHANGED_NODE]: createMockLineageGraphNode(
            OTHER_CHANGED_NODE,
            "node2",
          ),
          [UNCHANGED_NODE]: createMockLineageGraphNode(
            UNCHANGED_NODE,
            "node3",
            { changeStatus: undefined },
          ),
        },
        modifiedSet: [CHANGED_NODE, OTHER_CHANGED_NODE],
      });
      setupWithLineageGraph(graph);
    }

    function mode() {
      return screen
        .getByTestId("cll-control")
        .getAttribute("data-change-analysis-mode");
    }

    function showsChangeAnalysis(nodeId: string) {
      return screen
        .getByTestId(`change-analysis-${nodeId}`)
        .getAttribute("data-showing");
    }

    async function renderAndActivate(testId: string) {
      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId(testId)).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId(testId));
      await waitFor(() => expect(mode()).toBe("true"));
    }

    it("treats every changed node in a global impact radius", async () => {
      setupChangeAnalysisGraph();

      await renderAndActivate("activate-impact");

      expect(showsChangeAnalysis(CHANGED_NODE)).toBe("true");
      expect(showsChangeAnalysis(OTHER_CHANGED_NODE)).toBe("true");
      expect(showsChangeAnalysis(UNCHANGED_NODE)).toBe("false");
    });

    it("scopes a node-scoped impact radius to its own node", async () => {
      setupChangeAnalysisGraph();

      await renderAndActivate("activate-impact-node1");

      expect(showsChangeAnalysis(CHANGED_NODE)).toBe("true");
      expect(showsChangeAnalysis(OTHER_CHANGED_NODE)).toBe("false");
      expect(showsChangeAnalysis(UNCHANGED_NODE)).toBe("false");
    });

    it("widens a node-scoped radius to every changed node once a column is clicked", async () => {
      setupChangeAnalysisGraph();
      await renderAndActivate("activate-impact-node1");

      fireEvent.click(screen.getByTestId("click-column-node1-id"));

      await waitFor(() =>
        expect(showsChangeAnalysis(OTHER_CHANGED_NODE)).toBe("true"),
      );
      // The column click replaced the CllInput wholesale and carries no
      // change_analysis of its own — the mode has to survive it.
      expect(mode()).toBe("true");
      expect(showsChangeAnalysis(CHANGED_NODE)).toBe("true");
      expect(showsChangeAnalysis(UNCHANGED_NODE)).toBe("false");
    });

    it("clears change analysis as soon as CLL is turned off, before the layout round trip", async () => {
      setupChangeAnalysisGraph();
      await renderAndActivate("activate-impact");

      fireEvent.click(screen.getByTestId("disable-cll"));

      // Asserted synchronously: `showColumnLevelLineage` applies the transition
      // before it awaits the layout, so the impact treatment never survives a
      // frame past the click. The layout's own clear is a microtask later.
      expect(mode()).toBe("false");
      expect(showsChangeAnalysis(CHANGED_NODE)).toBe("false");

      await waitFor(() => expect(mode()).toBe("false"));
    });

    it("clears change analysis when a view-option change drops CLL", async () => {
      setupChangeAnalysisGraph();
      await renderAndActivate("activate-impact");

      // Reaches refreshLayout directly, not via showColumnLevelLineage — the
      // path reselect / selectParentNodes / selectChildNodes take.
      fireEvent.click(screen.getByTestId("show-all-models"));

      await waitFor(() => expect(mode()).toBe("false"));
      expect(showsChangeAnalysis(CHANGED_NODE)).toBe("false");
      expect(showsChangeAnalysis(OTHER_CHANGED_NODE)).toBe("false");
    });
  });

  // ==========================================================================
  // CLL Failure Handling
  // ==========================================================================

  describe("CLL failure handling", () => {
    function httpFailure(detail?: string) {
      return new HttpError(
        500,
        detail === undefined ? {} : { detail },
        "Internal Server Error",
      );
    }

    it("toasts the server detail when a user-triggered CLL request fails", async () => {
      setupWithLineageGraph(createMockLineageGraph());
      const mockMutateAsync = vi.fn().mockRejectedValue(httpFailure("boom"));
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));

      await waitFor(() =>
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Column Level Lineage error",
            description: "boom",
            type: "error",
          }),
        ),
      );
    });

    it("falls back to the error message when the failure carries no detail", async () => {
      setupWithLineageGraph(createMockLineageGraph());
      const mockMutateAsync = vi.fn().mockRejectedValue(httpFailure());
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId("show-impact-node1"));

      await waitFor(() =>
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Column Level Lineage error",
            description: "Internal Server Error",
          }),
        ),
      );
    });

    it("rolls the impact radius back off when the auto-triggered request fails", async () => {
      setupWithLineageGraph(createMockLineageGraph());
      (useRecceServerFlag as Mock).mockReturnValue({
        data: { impact_at_startup: true },
      });
      const mockMutateAsync = vi.fn().mockRejectedValue(httpFailure("nope"));
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );

      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Column Level Lineage error",
            description: "nope",
          }),
        ),
      );
      // Without the rollback the UI would sit in "impact on, no impact data".
      await waitFor(() =>
        expect(
          screen
            .getByTestId("cll-control")
            .getAttribute("data-change-analysis-mode"),
        ).toBe("false"),
      );
      // The rollback is not a retry: the failed auto-trigger is not re-fetched.
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    it("still lays out the graph, without a toast, when CLL fails for a non-HTTP reason", async () => {
      const lineageGraph = createMockLineageGraph();
      setupWithLineageGraph(lineageGraph);
      const mockMutateAsync = vi
        .fn()
        .mockRejectedValue(new Error("network down"));
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView interactive={true} ref={null} />
        </TestWrapper>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("show-impact-node1")).toBeInTheDocument(),
      );
      (toReactFlow as Mock).mockClear();

      fireEvent.click(screen.getByTestId("show-impact-node1"));

      await waitFor(() => expect(toReactFlow).toHaveBeenCalledTimes(1));
      expect((toReactFlow as Mock).mock.calls[0][1]).toMatchObject({
        cll: undefined,
      });
      expect(toaster.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: "Column Level Lineage error" }),
      );
    });
  });

  // ==========================================================================
  // No Lineage Graph
  // ==========================================================================

  describe("without a lineage graph", () => {
    function armCachePatch() {
      const cachedLineage = createPatchableServerInfoResult();
      mockQueryClient.getQueryData.mockReturnValue(cachedLineage);
      mockQueryClient.setQueryData.mockReturnValue({
        ...cachedLineage,
        lineage: { ...cachedLineage.lineage },
      });
    }

    const impactViewOptions = {
      column_level_lineage: { change_analysis: true, no_upstream: true },
    };

    it("reuses its own cache patch instead of re-fetching when the patch re-fires the layout", async () => {
      setupWithLineageGraph(createMockLineageGraph());
      armCachePatch();
      const mockMutateAsync = vi
        .fn()
        .mockResolvedValue(createColumnLineageData());
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      // A fresh element every time: React bails out of re-rendering a
      // referentially identical one, which would hide the context change.
      const view = () => (
        <TestWrapper>
          <TestablePrivateLineageView
            interactive={true}
            viewOptions={impactViewOptions}
            ref={null}
          />
        </TestWrapper>
      );
      const { rerender } = render(view());
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

      // A fresh lineageGraph reference is what the patched lineage query hands
      // the component in production; the layout effect re-fires on it.
      mockLineageGraphContext.lineageGraph = createMockLineageGraph();
      rerender(view());

      await waitFor(() => expect(toReactFlow).toHaveBeenCalled());
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    it("drops the armed patch when the lineage graph goes away, so its return re-fetches", async () => {
      setupWithLineageGraph(createMockLineageGraph());
      armCachePatch();
      const mockMutateAsync = vi
        .fn()
        .mockResolvedValue(createColumnLineageData());
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      // A fresh element every time: React bails out of re-rendering a
      // referentially identical one, which would hide the context change.
      const view = () => (
        <TestWrapper>
          <TestablePrivateLineageView
            interactive={true}
            viewOptions={impactViewOptions}
            ref={null}
          />
        </TestWrapper>
      );
      const { rerender } = render(view());
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

      mockLineageGraphContext.lineageGraph = undefined;
      rerender(view());
      await waitFor(() =>
        expect(screen.queryByTestId("cll-control")).not.toBeInTheDocument(),
      );

      mockLineageGraphContext.lineageGraph = createMockLineageGraph();
      rerender(view());

      // Re-arriving lineage may carry no change data at all, so replaying the
      // previous session's patched result would show stale impact.
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    });

    it("does not fetch CLL or lay out when a run wants a view change before lineage loads", async () => {
      mockLineageGraphContext.lineageGraph = undefined;
      setupOpenProfileRun("node2");
      const mockMutateAsync = vi
        .fn()
        .mockResolvedValue(createColumnLineageData());
      (useMutation as Mock).mockReturnValue({ mutateAsync: mockMutateAsync });

      render(
        <TestWrapper>
          <TestablePrivateLineageView
            interactive={true}
            viewOptions={impactViewOptions}
            ref={null}
          />
        </TestWrapper>,
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.queryByTestId("reactflow")).not.toBeInTheDocument();
      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(toReactFlow).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
    });
  });
});
