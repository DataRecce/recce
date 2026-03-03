/**
 * @file LineageViewContextMenu.test.tsx
 * @description Comprehensive tests for LineageViewContextMenu component and hook
 *
 * Tests verify:
 * - useLineageViewContextMenu hook state management
 * - LineageViewContextMenu delegation to ModelNodeContextMenu and ColumnNodeContextMenu
 * - ModelNodeContextMenu menu items, disabled states, and click handlers
 * - ColumnNodeContextMenu menu items for column-level actions
 * - Feature toggle behavior for disabling context menu
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

import { type Mock, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui
vi.mock("@datarecce/ui", () => ({
  isLineageGraphNode: vi.fn((node) => node?.type === "lineageGraphNode"),
  isLineageGraphColumnNode: vi.fn(
    (node) => node?.type === "lineageGraphColumnNode",
  ),
}));

// Mock @datarecce/ui/contexts
const mockUseLineageGraphContext = vi.fn();
const mockUseRecceInstanceContext = vi.fn();
const mockUseRecceServerFlag = vi.fn();
const mockUseRecceActionContext = vi.fn();
const mockUseLineageViewContextSafe = vi.fn();

vi.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
  useLineageGraphContext: () => mockUseLineageGraphContext(),
  useRecceInstanceContext: () => mockUseRecceInstanceContext(),
  useRecceServerFlag: () => mockUseRecceServerFlag(),
  useRecceActionContext: () => mockUseRecceActionContext(),
  useLineageViewContextSafe: () => mockUseLineageViewContextSafe(),
}));

// Mock @datarecce/ui/utils
vi.mock("@datarecce/ui/utils", () => ({
  formatSelectColumns: vi.fn((base, current) => {
    if (base.length === 0 && current.length === 0) return [];
    return [...new Set([...base, ...current])];
  }),
}));

// Mock QueryContextAdapter
const mockUseRecceQueryContext = vi.fn();

// Mock next/navigation
const mockUseRouter = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
}));

// Mock useModelColumns
const mockUseModelColumns = vi.fn();
vi.mock("@datarecce/ui/hooks", () => ({
  useModelColumns: (model: string | undefined) => mockUseModelColumns(model),
  useRecceQueryContext: () => mockUseRecceQueryContext(),
}));

// Mock run registry
const mockFindByRunType = vi.fn();
vi.mock("@datarecce/ui/components/run", () => ({
  findByRunType: (type: string) => mockFindByRunType(type),
}));

// Mock tracking functions
vi.mock("@datarecce/ui/lib/api/track", () => ({
  trackExploreAction: vi.fn(),
  trackLineageSelection: vi.fn(),
  EXPLORE_ACTION: {
    ROW_COUNT: "row_count",
    ROW_COUNT_DIFF: "row_count_diff",
    PROFILE: "profile",
    PROFILE_DIFF: "profile_diff",
    VALUE_DIFF: "value_diff",
    HISTOGRAM_DIFF: "histogram_diff",
    TOP_K_DIFF: "top_k_diff",
  },
  EXPLORE_SOURCE: {
    LINEAGE_VIEW_CONTEXT_MENU: "lineage_view_context_menu",
  },
  LINEAGE_SELECTION_ACTION: {
    SELECT_PARENT_NODES: "select_parent_nodes",
    SELECT_CHILD_NODES: "select_child_nodes",
    SELECT_ALL_UPSTREAM: "select_all_upstream",
    SELECT_ALL_DOWNSTREAM: "select_all_downstream",
  },
}));

// Mock SetupConnectionPopover
vi.mock("@datarecce/ui/components/app", () => ({
  SetupConnectionPopover: ({
    children,
    display,
  }: {
    children: React.ReactNode;
    display: boolean;
  }) => (
    <div data-testid="setup-connection-popover" data-display={display}>
      {children}
    </div>
  ),
}));

// Mock histogram form
vi.mock("@datarecce/ui/components/histogram", () => ({
  supportsHistogramDiff: vi.fn((columnType: string) => {
    const unsupportedTypes = [
      "VARCHAR",
      "TEXT",
      "BOOLEAN",
      "DATE",
      "TIMESTAMP",
    ];
    return !unsupportedTypes.includes(columnType.toUpperCase());
  }),
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraphColumnNode, LineageGraphNode } from "@datarecce/ui";
import { isLineageGraphColumnNode, isLineageGraphNode } from "@datarecce/ui";
import {
  ColumnNodeContextMenu,
  LineageViewContextMenu,
  ModelNodeContextMenu,
  useLineageViewContextMenu,
} from "@datarecce/ui/components/lineage/LineageViewContextMenuOss";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockModelNode = (
  overrides: Partial<{
    id: string;
    name: string;
    resourceType: string;
    changeStatus: "modified" | "added" | "removed" | undefined;
    base: Partial<{
      id: string;
      unique_id: string;
      name: string;
      columns: Record<string, { name: string; type: string }>;
    }>;
    current: Partial<{
      id: string;
      unique_id: string;
      name: string;
      columns: Record<string, { name: string; type: string }>;
    }>;
    change: {
      category?: "breaking" | "non_breaking" | "partial_breaking" | "unknown";
      columns?: Record<string, "modified" | "added" | "removed"> | null;
    };
  }> = {},
): LineageGraphNode => ({
  id: overrides.id ?? "model.test.node1",
  type: "lineageGraphNode",
  position: { x: 0, y: 0 },
  data: {
    id: overrides.id ?? "model.test.node1",
    name: overrides.name ?? "node1",
    from: "both" as const,
    resourceType: overrides.resourceType ?? "model",
    changeStatus: overrides.changeStatus,
    parents: {},
    children: {},
    data: {
      base: {
        id: "model.test.node1",
        unique_id: "model.test.node1",
        name: overrides.name ?? "node1",
        columns: { col1: { name: "col1", type: "INTEGER" } },
        ...overrides.base,
      },
      current: {
        id: "model.test.node1",
        unique_id: "model.test.node1",
        name: overrides.name ?? "node1",
        columns: { col1: { name: "col1", type: "INTEGER" } },
        ...overrides.current,
      },
    },
    change: {
      category: "unknown" as const,
      columns: null,
      ...overrides.change,
    },
  },
});

const createMockColumnNode = (
  overrides: Partial<{
    id: string;
    column: string;
    type: string;
    changeStatus: "modified" | "added" | "removed" | undefined;
    node: LineageGraphNode["data"];
  }> = {},
): LineageGraphColumnNode => ({
  id: overrides.id ?? "model.test.node1_col1",
  type: "lineageGraphColumnNode",
  position: { x: 0, y: 0 },
  parentId: "model.test.node1",
  data: {
    node: overrides.node ?? createMockModelNode().data,
    column: overrides.column ?? "col1",
    type: overrides.type ?? "INTEGER",
    changeStatus: overrides.changeStatus,
  },
});

const MockIcon = () => <span data-testid="mock-icon">Icon</span>;

const setupDefaultMocks = () => {
  // Default LineageViewContext mock
  mockUseLineageViewContextSafe.mockReturnValue({
    selectParentNodes: vi.fn(),
    selectChildNodes: vi.fn(),
    getNodeColumnSet: vi.fn().mockReturnValue(new Set(["col1", "col2"])),
    selectMode: false,
    cll: undefined,
    showColumnLevelLineage: vi.fn(),
  });

  // Default RecceActionContext mock
  mockUseRecceActionContext.mockReturnValue({
    runAction: vi.fn(),
  });

  // Default RecceInstanceContext mock
  mockUseRecceInstanceContext.mockReturnValue({
    featureToggles: {
      disableDatabaseQuery: false,
      disableViewActionDropdown: false,
      mode: "full",
    },
  });

  // Default LineageGraphContext mock
  mockUseLineageGraphContext.mockReturnValue({
    isActionAvailable: vi.fn().mockReturnValue(true),
    lineageGraph: {
      nodes: {},
      edges: {},
      catalogMetadata: { current: true, base: true },
    },
  });

  // Default RecceServerFlag mock
  mockUseRecceServerFlag.mockReturnValue({
    data: { single_env_onboarding: false },
  });

  // Default QueryContext mock
  mockUseRecceQueryContext.mockReturnValue({
    setSqlQuery: vi.fn(),
    setPrimaryKeys: vi.fn(),
  });

  // Default router mock
  mockUseRouter.mockReturnValue({ push: vi.fn() });

  // Default useModelColumns mock
  mockUseModelColumns.mockReturnValue({
    columns: [
      { name: "col1", type: "INTEGER" },
      { name: "col2", type: "VARCHAR" },
    ],
    primaryKey: "col1",
    isLoading: false,
    error: null,
  });

  // Default findByRunType mock
  mockFindByRunType.mockImplementation((type: string) => ({
    title:
      type === "query"
        ? "Query"
        : type === "query_diff"
          ? "Query Diff"
          : type === "row_count"
            ? "Row Count"
            : type === "row_count_diff"
              ? "Row Count Diff"
              : type === "profile"
                ? "Profile"
                : type === "profile_diff"
                  ? "Profile Diff"
                  : type === "value_diff"
                    ? "Value Diff"
                    : type === "histogram_diff"
                      ? "Histogram Diff"
                      : type === "top_k_diff"
                        ? "Top-K Diff"
                        : type,
    icon: MockIcon,
  }));
};

// ============================================================================
// Test Setup
// ============================================================================

describe("LineageViewContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // ==========================================================================
  // useLineageViewContextMenu Hook Tests
  // ==========================================================================

  describe("useLineageViewContextMenu hook", () => {
    it("returns initial state with open: false and position: {x:0, y:0}", () => {
      const { result } = renderHook(() => useLineageViewContextMenu());

      expect(result.current.props.isOpen).toBe(false);
      expect(result.current.props.x).toBe(0);
      expect(result.current.props.y).toBe(0);
      expect(result.current.props.node).toBeUndefined();
    });

    it("showContextMenu updates state with position and node", () => {
      const { result } = renderHook(() => useLineageViewContextMenu());
      const mockNode = createMockModelNode();

      act(() => {
        result.current.showContextMenu(100, 200, mockNode);
      });

      expect(result.current.props.isOpen).toBe(true);
      expect(result.current.props.x).toBe(100);
      expect(result.current.props.y).toBe(200);
      expect(result.current.props.node).toBe(mockNode);
    });

    it("closeContextMenu resets state to initial values", () => {
      const { result } = renderHook(() => useLineageViewContextMenu());
      const mockNode = createMockModelNode();

      // First open the menu
      act(() => {
        result.current.showContextMenu(100, 200, mockNode);
      });

      // Then close it
      act(() => {
        result.current.closeContextMenu();
      });

      expect(result.current.props.isOpen).toBe(false);
      expect(result.current.props.x).toBe(0);
      expect(result.current.props.y).toBe(0);
      expect(result.current.props.node).toBeUndefined();
    });

    it("returns correct props object shape", () => {
      const { result } = renderHook(() => useLineageViewContextMenu());

      expect(result.current.props).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        node: undefined,
        isOpen: expect.any(Boolean),
        onClose: expect.any(Function),
      });
      expect(typeof result.current.showContextMenu).toBe("function");
      expect(typeof result.current.closeContextMenu).toBe("function");
    });
  });

  // ==========================================================================
  // LineageViewContextMenu Component Tests
  // ==========================================================================

  describe("LineageViewContextMenu component", () => {
    it("renders empty menu when feature toggle disables it", () => {
      mockUseRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableDatabaseQuery: false,
          disableViewActionDropdown: true,
          mode: "full",
        },
      });

      const mockNode = createMockModelNode();
      render(
        <LineageViewContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      // Should show "No action available" when dropdown is disabled
      expect(screen.getByText("No action available")).toBeInTheDocument();
    });

    it("delegates to ModelNodeContextMenu for model nodes", () => {
      (isLineageGraphNode as unknown as Mock).mockReturnValue(true);
      (isLineageGraphColumnNode as unknown as Mock).mockReturnValue(false);

      const mockNode = createMockModelNode();
      render(
        <LineageViewContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      // Model menu items should be present - the label is from findByRunType
      expect(screen.getByText("Row Count Diff")).toBeInTheDocument();
    });

    it("delegates to ColumnNodeContextMenu for column nodes", () => {
      (isLineageGraphNode as unknown as Mock).mockReturnValue(false);
      (isLineageGraphColumnNode as unknown as Mock).mockReturnValue(true);

      const mockNode = createMockColumnNode();
      render(
        <LineageViewContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      // Column menu items should be present
      expect(screen.getByText("Profile Diff")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // ModelNodeContextMenu Tests
  // ==========================================================================

  describe("ModelNodeContextMenu", () => {
    it('renders "No action available" when node data is undefined', () => {
      const mockNode = { ...createMockModelNode(), data: undefined };
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode as unknown as LineageGraphNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    });

    it('shows "Show Impact Radius" for modified nodes', () => {
      const mockNode = createMockModelNode({ changeStatus: "modified" });
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Show Impact Radius")).toBeInTheDocument();
    });

    it('does not show "Show Impact Radius" for unchanged nodes', () => {
      // For unchanged nodes, changeStatus is undefined
      const mockNode = createMockModelNode({ changeStatus: undefined });
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByText("Show Impact Radius")).not.toBeInTheDocument();
    });

    it("shows Query menu item for models", () => {
      const mockNode = createMockModelNode({ resourceType: "model" });
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      // In multi-env mode (default), the menu item is labeled based on findByRunType("query_diff")
      // The mock returns the title from the type, so it shows "Query Diff"
      // But the actual label comes from the registry which uses "Query" as the base label
      expect(screen.getByText("Query")).toBeInTheDocument();
    });

    it("shows Row Count Diff menu item", () => {
      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Row Count Diff")).toBeInTheDocument();
    });

    it("shows Profile Diff menu item", () => {
      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Profile Diff")).toBeInTheDocument();
    });

    it("shows Value Diff menu item in multi-env mode", () => {
      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Value Diff")).toBeInTheDocument();
    });

    it("hides Value Diff menu item in single-env mode", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
      });

      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByText("Value Diff")).not.toBeInTheDocument();
    });

    it("shows Select Parent/Child Nodes items in multi-env mode", () => {
      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Select Parent Nodes")).toBeInTheDocument();
      expect(screen.getByText("Select Child Nodes")).toBeInTheDocument();
      expect(screen.getByText("Select All Upstream Nodes")).toBeInTheDocument();
      expect(
        screen.getByText("Select All Downstream Nodes"),
      ).toBeInTheDocument();
    });

    it("hides Select Parent/Child Nodes items in single-env mode", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
      });

      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByText("Select Parent Nodes")).not.toBeInTheDocument();
      expect(screen.queryByText("Select Child Nodes")).not.toBeInTheDocument();
    });

    it("calls runAction when Row Count Diff is clicked", () => {
      const mockRunAction = vi.fn();
      mockUseRecceActionContext.mockReturnValue({
        runAction: mockRunAction,
      });

      const mockNode = createMockModelNode();
      const onClose = vi.fn();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Row Count Diff"));

      expect(mockRunAction).toHaveBeenCalledWith(
        "row_count_diff",
        { node_names: ["node1"] },
        expect.any(Object),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("calls runAction when Profile Diff is clicked", () => {
      const mockRunAction = vi.fn();
      mockUseRecceActionContext.mockReturnValue({
        runAction: mockRunAction,
      });

      const mockNode = createMockModelNode();
      const onClose = vi.fn();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Profile Diff"));

      expect(mockRunAction).toHaveBeenCalledWith(
        "profile_diff",
        expect.objectContaining({ model: "node1" }),
        expect.any(Object),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("calls selectParentNodes when Select Parent Nodes is clicked", () => {
      const mockSelectParentNodes = vi.fn();
      mockUseLineageViewContextSafe.mockReturnValue({
        selectParentNodes: mockSelectParentNodes,
        selectChildNodes: vi.fn(),
        getNodeColumnSet: vi.fn().mockReturnValue(new Set()),
        selectMode: false,
        cll: undefined,
        showColumnLevelLineage: vi.fn(),
      });

      const mockNode = createMockModelNode();
      const onClose = vi.fn();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Select Parent Nodes"));

      expect(mockSelectParentNodes).toHaveBeenCalledWith(mockNode.id, 1);
      expect(onClose).toHaveBeenCalled();
    });

    it("calls selectChildNodes when Select Child Nodes is clicked", () => {
      const mockSelectChildNodes = vi.fn();
      mockUseLineageViewContextSafe.mockReturnValue({
        selectParentNodes: vi.fn(),
        selectChildNodes: mockSelectChildNodes,
        getNodeColumnSet: vi.fn().mockReturnValue(new Set()),
        selectMode: false,
        cll: undefined,
        showColumnLevelLineage: vi.fn(),
      });

      const mockNode = createMockModelNode();
      const onClose = vi.fn();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Select Child Nodes"));

      expect(mockSelectChildNodes).toHaveBeenCalledWith(mockNode.id, 1);
      expect(onClose).toHaveBeenCalled();
    });

    it("disables menu items when query is disabled", () => {
      mockUseRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableDatabaseQuery: true,
          disableViewActionDropdown: false,
          mode: "full",
        },
      });

      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      // Query should be disabled when database query is disabled
      const queryItem = screen.getByText("Query").closest("li");
      expect(queryItem).toHaveAttribute("aria-disabled", "true");
    });

    it("wraps disabled items with SetupConnectionPopover in metadata only mode", () => {
      mockUseRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableDatabaseQuery: true,
          disableViewActionDropdown: false,
          mode: "metadata only",
        },
      });

      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      // SetupConnectionPopover should be rendered
      const popovers = screen.getAllByTestId("setup-connection-popover");
      expect(popovers.length).toBeGreaterThan(0);
    });

    it("calls showColumnLevelLineage when Show Impact Radius is clicked", () => {
      const mockShowColumnLevelLineage = vi.fn();
      mockUseLineageViewContextSafe.mockReturnValue({
        selectParentNodes: vi.fn(),
        selectChildNodes: vi.fn(),
        getNodeColumnSet: vi.fn().mockReturnValue(new Set()),
        selectMode: false,
        cll: undefined,
        showColumnLevelLineage: mockShowColumnLevelLineage,
      });

      const mockNode = createMockModelNode({ changeStatus: "modified" });
      const onClose = vi.fn();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Show Impact Radius"));

      expect(mockShowColumnLevelLineage).toHaveBeenCalledWith({
        node_id: mockNode.id,
        change_analysis: true,
        no_upstream: true,
      });
      expect(onClose).toHaveBeenCalled();
    });

    it("navigates to /query when Query is clicked", () => {
      const mockPush = vi.fn();
      const mockSetSqlQuery = vi.fn();
      mockUseRouter.mockReturnValue({ push: mockPush });
      mockUseRecceQueryContext.mockReturnValue({
        setSqlQuery: mockSetSqlQuery,
        setPrimaryKeys: vi.fn(),
      });

      const mockNode = createMockModelNode();
      render(
        <ModelNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText("Query"));

      expect(mockSetSqlQuery).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/query");
    });
  });

  // ==========================================================================
  // ColumnNodeContextMenu Tests
  // ==========================================================================

  describe("ColumnNodeContextMenu", () => {
    beforeEach(() => {
      (isLineageGraphNode as unknown as Mock).mockReturnValue(false);
      (isLineageGraphColumnNode as unknown as Mock).mockReturnValue(true);
    });

    it("renders nothing when node data is undefined", () => {
      const mockNode = { ...createMockColumnNode(), data: undefined };
      const { container } = render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode as unknown as LineageGraphColumnNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("shows Profile Diff option", () => {
      const mockNode = createMockColumnNode();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Profile Diff")).toBeInTheDocument();
    });

    it("shows Histogram Diff option for numeric columns", () => {
      const mockNode = createMockColumnNode({ type: "INTEGER" });
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Histogram Diff")).toBeInTheDocument();
    });

    it("disables Histogram Diff for unsupported column types", () => {
      const mockNode = createMockColumnNode({ type: "VARCHAR" });
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      const histogramDiffItem = screen
        .getByText("Histogram Diff")
        .closest("li");
      expect(histogramDiffItem).toHaveAttribute("aria-disabled", "true");
    });

    it("shows Top-K Diff option", () => {
      const mockNode = createMockColumnNode();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Top-K Diff")).toBeInTheDocument();
    });

    it("shows Value Diff option in multi-env mode", () => {
      const mockNode = createMockColumnNode();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Value Diff")).toBeInTheDocument();
    });

    it("disables items for added columns (not in base)", () => {
      const nodeWithAddedColumn = createMockColumnNode();
      nodeWithAddedColumn.data.node.data.base = {
        id: "node1",
        unique_id: "model.test.node1",
        name: "node1",
        columns: {},
      };
      nodeWithAddedColumn.data.node.data.current = {
        id: "node1",
        unique_id: "model.test.node1",
        name: "node1",
        columns: { col1: { name: "col1", type: "INTEGER" } },
      };

      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={nodeWithAddedColumn}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      const profileDiffItem = screen.getByText("Profile Diff").closest("li");
      expect(profileDiffItem).toHaveAttribute("aria-disabled", "true");
    });

    it("disables items for removed columns (not in current)", () => {
      const nodeWithRemovedColumn = createMockColumnNode();
      nodeWithRemovedColumn.data.node.data.base = {
        id: "node1",
        unique_id: "model.test.node1",
        name: "node1",
        columns: { col1: { name: "col1", type: "INTEGER" } },
      };
      nodeWithRemovedColumn.data.node.data.current = {
        id: "node1",
        unique_id: "model.test.node1",
        name: "node1",
        columns: {},
      };

      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={nodeWithRemovedColumn}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      const profileDiffItem = screen.getByText("Profile Diff").closest("li");
      expect(profileDiffItem).toHaveAttribute("aria-disabled", "true");
    });

    it("calls runAction when Profile Diff is clicked", () => {
      const mockRunAction = vi.fn();
      mockUseRecceActionContext.mockReturnValue({
        runAction: mockRunAction,
      });

      const mockNode = createMockColumnNode();
      const onClose = vi.fn();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Profile Diff"));

      expect(mockRunAction).toHaveBeenCalledWith(
        "profile_diff",
        expect.objectContaining({
          model: "node1",
          columns: ["col1"],
        }),
        expect.any(Object),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("calls runAction when Histogram Diff is clicked", () => {
      const mockRunAction = vi.fn();
      mockUseRecceActionContext.mockReturnValue({
        runAction: mockRunAction,
      });

      const mockNode = createMockColumnNode({ type: "INTEGER" });
      const onClose = vi.fn();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Histogram Diff"));

      expect(mockRunAction).toHaveBeenCalledWith(
        "histogram_diff",
        expect.objectContaining({
          model: "node1",
          column_name: "col1",
          column_type: "INTEGER",
        }),
        expect.any(Object),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("calls runAction when Top-K Diff is clicked", () => {
      const mockRunAction = vi.fn();
      mockUseRecceActionContext.mockReturnValue({
        runAction: mockRunAction,
      });

      const mockNode = createMockColumnNode();
      const onClose = vi.fn();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Top-K Diff"));

      expect(mockRunAction).toHaveBeenCalledWith(
        "top_k_diff",
        expect.objectContaining({
          model: "node1",
          column_name: "col1",
          k: 50,
        }),
        expect.any(Object),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("calls runAction when Value Diff is clicked", () => {
      const mockRunAction = vi.fn();
      mockUseRecceActionContext.mockReturnValue({
        runAction: mockRunAction,
      });

      const mockNode = createMockColumnNode();
      const onClose = vi.fn();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText("Value Diff"));

      expect(mockRunAction).toHaveBeenCalledWith(
        "value_diff",
        expect.objectContaining({
          model: "node1",
          columns: ["col1"],
        }),
        expect.any(Object),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("hides histogram/top-k/value diff options in single-env mode", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
      });

      const mockNode = createMockColumnNode();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByText("Histogram Diff")).not.toBeInTheDocument();
      expect(screen.queryByText("Top-K Diff")).not.toBeInTheDocument();
      expect(screen.queryByText("Value Diff")).not.toBeInTheDocument();
    });

    it("disables Profile Diff when action is not available", () => {
      mockUseLineageGraphContext.mockReturnValue({
        isActionAvailable: vi.fn().mockReturnValue(false),
        lineageGraph: {
          nodes: {},
          edges: {},
          catalogMetadata: { current: true, base: true },
        },
      });

      const mockNode = createMockColumnNode();
      render(
        <ColumnNodeContextMenu
          x={100}
          y={200}
          node={mockNode}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      const profileDiffItem = screen.getByText("Profile Diff").closest("li");
      expect(profileDiffItem).toHaveAttribute("aria-disabled", "true");
    });
  });
});
