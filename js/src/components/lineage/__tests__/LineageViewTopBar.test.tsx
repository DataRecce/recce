/**
 * @file LineageViewTopBar.test.tsx
 * @description Comprehensive tests for LineageViewTopBar component
 *
 * Tests verify:
 * - Basic rendering of top bar container and child elements
 * - View mode selection (Changed Models vs All)
 * - Select filter input behavior
 * - Package filter dropdown
 * - Action menu options and disabled states
 * - Multi-node action controls
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock LineageViewContext (included with other @datarecce/ui/contexts mocks)
jest.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: jest.fn(() => ({ basePath: "" })),
  useLineageGraphContext: jest.fn(),
  useRecceInstanceContext: jest.fn(),
  useRecceServerFlag: jest.fn(),
  useLineageViewContextSafe: jest.fn(),
  useRecceActionContext: jest.fn(() => ({
    isHistoryOpen: false,
    showHistory: jest.fn(),
  })),
}));

// Mock @datarecce/ui/components/lineage - get the actual module and only mock what we need
jest.mock("@datarecce/ui/components/lineage", () => ({
  LineageViewTopBarOss: jest.requireActual(
    "@datarecce/ui/components/lineage/topbar/LineageViewTopBarOss",
  ).LineageViewTopBarOss,
  getIconForResourceType: jest.fn(() => ({
    icon: () => <span data-testid="model-icon">ModelIcon</span>,
  })),
}));

// Mock @datarecce/ui/hooks
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: jest.fn(() => false),
}));

// Mock registry
jest.mock("@datarecce/ui/components/run", () => ({
  findByRunType: jest.fn((type: string) => ({
    icon: () => <span data-testid={`${type}-icon`}>{type}</span>,
    title: type.replace(/_/g, " "),
  })),
}));

// Mock track functions
jest.mock("@datarecce/ui/lib/api/track", () => ({
  trackHistoryAction: jest.fn(),
}));

// Mock SetupConnectionPopover
jest.mock("@datarecce/ui/components/app", () => ({
  __esModule: true,
  SetupConnectionPopover: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock HistoryToggle
jest.mock("@datarecce/ui/components", () => ({
  __esModule: true,
  HistoryToggle: () => <div data-testid="history-toggle">History Toggle</div>,
}));

// ============================================================================
// Imports
// ============================================================================

import type {
  LineageGraph,
  LineageGraphNode,
  LineageViewContextType,
} from "@datarecce/ui";
import type { LineageDiffViewOptions } from "@datarecce/ui/api";
import { LineageViewTopBarOss as LineageViewTopBar } from "@datarecce/ui/components/lineage";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
  useRecceInstanceContext,
  useRecceServerFlag,
} from "@datarecce/ui/contexts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLineageViewContext = (
  overrides: Partial<LineageViewContextType> = {},
): Partial<LineageViewContextType> => ({
  interactive: true,
  nodes: [],
  focusedNode: undefined,
  selectedNodes: [],
  cll: undefined,
  viewOptions: {
    view_mode: "changed_models",
    packages: undefined,
    select: undefined,
    exclude: undefined,
  } as LineageDiffViewOptions,
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
  showContextMenu: jest.fn(),
  ...overrides,
});

const createMockLineageGraphContext = () => ({
  lineageGraph: {
    nodes: {
      "model.test.node1": {
        id: "model.test.node1",
        type: "lineageGraphNode" as const,
        position: { x: 0, y: 0 },
        data: {
          id: "model.test.node1",
          name: "node1",
          from: "both" as const,
          data: {},
          resourceType: "model",
          packageName: "my_project",
          parents: {},
          children: {},
        },
      },
      "model.test.node2": {
        id: "model.test.node2",
        type: "lineageGraphNode" as const,
        position: { x: 100, y: 0 },
        data: {
          id: "model.test.node2",
          name: "node2",
          from: "both" as const,
          data: {},
          resourceType: "model",
          packageName: "my_project",
          parents: {},
          children: {},
        },
      },
      "model.test.node3": {
        id: "model.test.node3",
        type: "lineageGraphNode" as const,
        position: { x: 200, y: 0 },
        data: {
          id: "model.test.node3",
          name: "node3",
          from: "both" as const,
          data: {},
          resourceType: "model",
          packageName: "other_project",
          parents: {},
          children: {},
        },
      },
    },
    edges: {},
    modifiedSet: [],
    manifestMetadata: {
      current: {
        project_name: "my_project",
      } as LineageGraph["manifestMetadata"]["current"],
    },
    catalogMetadata: {},
  } as unknown as LineageGraph,
  envInfo: undefined,
  reviewMode: false,
  cloudMode: false,
  fileMode: false,
  isDemoSite: false,
  isActionAvailable: jest.fn(() => true),
});

const createMockNode = (
  id: string,
  name: string,
  packageName = "my_project",
): LineageGraphNode =>
  ({
    id,
    type: "lineageGraphNode" as const,
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      from: "both" as const,
      data: {},
      resourceType: "model",
      packageName,
      parents: {},
      children: {},
    },
  }) as LineageGraphNode;

const createMockInstanceContext = (
  overrides: Partial<{
    featureToggles: {
      mode?: string;
      disableDatabaseQuery?: boolean;
      disableViewActionDropdown?: boolean;
    };
  }> = {},
) => ({
  featureToggles: {
    mode: "connected",
    disableDatabaseQuery: false,
    disableViewActionDropdown: false,
    ...overrides.featureToggles,
  },
  ...overrides,
});

// ============================================================================
// Test Setup
// ============================================================================

describe("LineageViewTopBar", () => {
  const mockUseLineageViewContextSafe = useLineageViewContextSafe as jest.Mock;
  const mockUseLineageGraphContext = useLineageGraphContext as jest.Mock;
  const mockUseRecceInstanceContext = useRecceInstanceContext as jest.Mock;
  const mockUseRecceServerFlag = useRecceServerFlag as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseLineageViewContextSafe.mockReturnValue(
      createMockLineageViewContext(),
    );
    mockUseLineageGraphContext.mockReturnValue(createMockLineageGraphContext());
    mockUseRecceInstanceContext.mockReturnValue(createMockInstanceContext());
    mockUseRecceServerFlag.mockReturnValue({
      data: { single_env_onboarding: false },
    });
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe("basic rendering", () => {
    it("renders top bar container", () => {
      render(<LineageViewTopBar />);

      // The top bar should render with children
      expect(screen.getByText("History")).toBeInTheDocument();
    });

    it("renders mode control with label", () => {
      render(<LineageViewTopBar />);

      expect(screen.getByText("Mode")).toBeInTheDocument();
    });

    it("renders package control with label", () => {
      render(<LineageViewTopBar />);

      expect(screen.getByText("Package")).toBeInTheDocument();
    });

    it("renders select filter input with label", () => {
      render(<LineageViewTopBar />);

      expect(screen.getByText("Select")).toBeInTheDocument();
      // Both Select and Exclude filters use the same placeholder
      const inputs = screen.getAllByPlaceholderText("with selectors");
      expect(inputs).toHaveLength(2);
    });

    it("renders exclude filter input with label", () => {
      render(<LineageViewTopBar />);

      expect(screen.getByText("Exclude")).toBeInTheDocument();
    });

    it("renders actions button when not in single env onboarding", () => {
      render(<LineageViewTopBar />);

      expect(
        screen.getByRole("button", { name: /Actions/i }),
      ).toBeInTheDocument();
    });

    it("renders explore label for actions", () => {
      render(<LineageViewTopBar />);

      expect(screen.getByText("Explore")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // View Mode Selection Tests
  // ==========================================================================

  describe("view mode selection", () => {
    it("shows Changed Models as default view mode", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { view_mode: "changed_models" },
        }),
      );

      render(<LineageViewTopBar />);

      expect(
        screen.getByRole("button", { name: /Changed Models/i }),
      ).toBeInTheDocument();
    });

    it("shows All when view mode is all", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { view_mode: "all" },
        }),
      );

      render(<LineageViewTopBar />);

      // Find the mode button by its content - it will show "All" text
      // The button has icon + text, so we look for button containing "All"
      const buttons = screen.getAllByRole("button");
      const modeButton = buttons.find(
        (btn) =>
          btn.textContent?.includes("All") &&
          !btn.textContent?.includes("Select All") &&
          !btn.textContent?.includes("Actions"),
      );
      expect(modeButton).toBeDefined();
    });

    it("opens mode menu when clicked", async () => {
      render(<LineageViewTopBar />);

      const modeButton = screen.getByRole("button", {
        name: /Changed Models/i,
      });
      fireEvent.click(modeButton);

      await waitFor(() => {
        expect(screen.getByText("mode")).toBeInTheDocument();
      });
    });

    it("shows mode options in dropdown", async () => {
      render(<LineageViewTopBar />);

      const modeButton = screen.getByRole("button", {
        name: /Changed Models/i,
      });
      fireEvent.click(modeButton);

      await waitFor(() => {
        expect(
          screen.getByRole("radio", { name: /Changed Models/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("radio", { name: /^All$/i }),
        ).toBeInTheDocument();
      });
    });

    it("calls onViewOptionsChanged when mode is changed to all", async () => {
      const mockOnViewOptionsChanged = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { view_mode: "changed_models" },
          onViewOptionsChanged: mockOnViewOptionsChanged,
        }),
      );

      render(<LineageViewTopBar />);

      const modeButton = screen.getByRole("button", {
        name: /Changed Models/i,
      });
      fireEvent.click(modeButton);

      await waitFor(() => {
        const allMenuItem = screen.getByRole("menuitem", { name: /^All$/i });
        fireEvent.click(allMenuItem);
      });

      expect(mockOnViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({ view_mode: "all" }),
      );
    });

    it("calls onViewOptionsChanged when mode is changed to changed_models", async () => {
      const mockOnViewOptionsChanged = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { view_mode: "all" },
          onViewOptionsChanged: mockOnViewOptionsChanged,
        }),
      );

      render(<LineageViewTopBar />);

      // Find the mode button by its content
      const buttons = screen.getAllByRole("button");
      const modeButton = buttons.find(
        (btn) =>
          btn.textContent?.includes("All") &&
          !btn.textContent?.includes("Select All") &&
          !btn.textContent?.includes("Actions"),
      );
      expect(modeButton).toBeDefined();
      if (modeButton) {
        fireEvent.click(modeButton);
      }

      await waitFor(() => {
        const changedModelsMenuItem = screen.getByRole("menuitem", {
          name: /Changed Models/i,
        });
        fireEvent.click(changedModelsMenuItem);
      });

      expect(mockOnViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({ view_mode: "changed_models" }),
      );
    });

    it("disables mode selector when multi-select is active", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      const modeButton = screen.getByRole("button", {
        name: /Changed Models/i,
      });
      expect(modeButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Select Filter Tests
  // ==========================================================================

  describe("select filter", () => {
    it("shows placeholder text", () => {
      render(<LineageViewTopBar />);

      // Both Select and Exclude use the same placeholder
      const inputs = screen.getAllByPlaceholderText("with selectors");
      expect(inputs.length).toBeGreaterThan(0);
    });

    it("displays current select value from viewOptions", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { select: "my_model+" },
        }),
      );

      render(<LineageViewTopBar />);

      const input = screen.getAllByPlaceholderText("with selectors")[0];
      expect(input).toHaveValue("my_model+");
    });

    it("calls onViewOptionsChanged on Enter key", () => {
      const mockOnViewOptionsChanged = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { select: "" },
          onViewOptionsChanged: mockOnViewOptionsChanged,
        }),
      );

      render(<LineageViewTopBar />);

      const input = screen.getAllByPlaceholderText("with selectors")[0];
      fireEvent.change(input, { target: { value: "+upstream_model" } });
      fireEvent.keyUp(input, { key: "Enter" });

      expect(mockOnViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({ select: "+upstream_model" }),
      );
    });

    it("resets value on Escape key", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { select: "original" },
        }),
      );

      render(<LineageViewTopBar />);

      const input = screen.getAllByPlaceholderText("with selectors")[0];
      fireEvent.change(input, { target: { value: "new_value" } });
      fireEvent.keyUp(input, { key: "Escape" });

      expect(input).toHaveValue("original");
    });

    it("is disabled when multi-select is active", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      const input = screen.getAllByPlaceholderText("with selectors")[0];
      expect(input).toBeDisabled();
    });
  });

  // ==========================================================================
  // Package Filter Tests
  // ==========================================================================

  describe("package filter", () => {
    it("shows package button", () => {
      render(<LineageViewTopBar />);

      // Default shows project name when no packages selected
      expect(
        screen.getByRole("button", { name: /my_project/i }),
      ).toBeInTheDocument();
    });

    it("opens package menu when clicked", async () => {
      render(<LineageViewTopBar />);

      const packageButton = screen.getByRole("button", { name: /my_project/i });
      fireEvent.click(packageButton);

      await waitFor(() => {
        expect(screen.getByText("Select Packages")).toBeInTheDocument();
      });
    });

    it("shows available packages in dropdown", async () => {
      render(<LineageViewTopBar />);

      const packageButton = screen.getByRole("button", { name: /my_project/i });
      fireEvent.click(packageButton);

      await waitFor(() => {
        // After clicking, menu shows packages - look for other_project since
        // my_project appears in both button and menu
        expect(screen.getByText("other_project")).toBeInTheDocument();
        // Check for Select All which confirms menu is open
        expect(screen.getByText("Select All")).toBeInTheDocument();
      });
    });

    it("shows Select All option", async () => {
      render(<LineageViewTopBar />);

      const packageButton = screen.getByRole("button", { name: /my_project/i });
      fireEvent.click(packageButton);

      await waitFor(() => {
        expect(screen.getByText("Select All")).toBeInTheDocument();
      });
    });

    it("calls onViewOptionsChanged when package is toggled", async () => {
      const mockOnViewOptionsChanged = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: { packages: ["my_project"] },
          onViewOptionsChanged: mockOnViewOptionsChanged,
        }),
      );

      render(<LineageViewTopBar />);

      const packageButton = screen.getByRole("button", { name: /my_project/i });
      fireEvent.click(packageButton);

      await waitFor(() => {
        const otherProjectItem = screen
          .getByText("other_project")
          .closest("li");
        if (otherProjectItem) {
          fireEvent.click(otherProjectItem);
        }
      });

      expect(mockOnViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          packages: expect.arrayContaining(["my_project", "other_project"]),
        }),
      );
    });

    it("is disabled when multi-select is active", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      const packageButton = screen.getByRole("button", { name: /my_project/i });
      expect(packageButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Action Menu Tests
  // ==========================================================================

  describe("action menu", () => {
    it("shows actions button", () => {
      render(<LineageViewTopBar />);

      expect(
        screen.getByRole("button", { name: /Actions/i }),
      ).toBeInTheDocument();
    });

    it("opens action menu on click", async () => {
      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Diff")).toBeInTheDocument();
      });
    });

    it("shows Row Count Diff option in menu", async () => {
      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Row Count Diff")).toBeInTheDocument();
      });
    });

    it("shows Value Diff option in menu", async () => {
      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Value Diff")).toBeInTheDocument();
      });
    });

    it("shows Add to Checklist section", async () => {
      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Add to Checklist")).toBeInTheDocument();
      });
    });

    it("shows Lineage Diff option in Add to Checklist", async () => {
      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Lineage Diff")).toBeInTheDocument();
      });
    });

    it("shows Schema Diff option in Add to Checklist", async () => {
      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Schema Diff")).toBeInTheDocument();
      });
    });

    it("disables diff options when database query is disabled", async () => {
      mockUseRecceInstanceContext.mockReturnValue(
        createMockInstanceContext({
          featureToggles: { disableDatabaseQuery: true },
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const rowCountDiffItem = screen
          .getByText("Row Count Diff")
          .closest("li");
        expect(rowCountDiffItem).toHaveAttribute("aria-disabled", "true");
      });
    });

    it("disables actions button when disableViewActionDropdown is true", () => {
      mockUseRecceInstanceContext.mockReturnValue(
        createMockInstanceContext({
          featureToggles: { disableViewActionDropdown: true },
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      expect(actionsButton).toBeDisabled();
    });

    it("calls runRowCountDiff when Row Count Diff is clicked", async () => {
      const mockRunRowCountDiff = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          runRowCountDiff: mockRunRowCountDiff,
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const rowCountDiffItem = screen.getByText("Row Count Diff");
        fireEvent.click(rowCountDiffItem);
      });

      expect(mockRunRowCountDiff).toHaveBeenCalled();
    });

    it("calls runValueDiff when Value Diff is clicked", async () => {
      const mockRunValueDiff = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          runValueDiff: mockRunValueDiff,
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const valueDiffItem = screen.getByText("Value Diff");
        fireEvent.click(valueDiffItem);
      });

      expect(mockRunValueDiff).toHaveBeenCalled();
    });

    it("calls addLineageDiffCheck when Lineage Diff is clicked", async () => {
      const mockAddLineageDiffCheck = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          addLineageDiffCheck: mockAddLineageDiffCheck,
          viewOptions: { view_mode: "changed_models" },
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const lineageDiffItem = screen.getByText("Lineage Diff");
        fireEvent.click(lineageDiffItem);
      });

      expect(mockAddLineageDiffCheck).toHaveBeenCalledWith("changed_models");
    });

    it("calls addSchemaDiffCheck when Schema Diff is clicked", async () => {
      const mockAddSchemaDiffCheck = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          addSchemaDiffCheck: mockAddSchemaDiffCheck,
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const schemaDiffItem = screen.getByText("Schema Diff");
        fireEvent.click(schemaDiffItem);
      });

      expect(mockAddSchemaDiffCheck).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Multi-node Selection Tests
  // ==========================================================================

  describe("multi-node selection", () => {
    it("shows selected node count when one node is selected", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      expect(screen.getByText("1 node selected")).toBeInTheDocument();
    });

    it("shows selected nodes count when multiple nodes are selected", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [
            createMockNode("node1", "node1"),
            createMockNode("node2", "node2"),
          ],
        }),
      );

      render(<LineageViewTopBar />);

      expect(screen.getByText("2 nodes selected")).toBeInTheDocument();
    });

    it("shows deselect button when nodes are selected", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      expect(
        screen.getByRole("button", { name: /Deselect/i }),
      ).toBeInTheDocument();
    });

    it("calls deselect when Deselect button is clicked", () => {
      const mockDeselect = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
          deselect: mockDeselect,
        }),
      );

      render(<LineageViewTopBar />);

      const deselectButton = screen.getByRole("button", { name: /Deselect/i });
      fireEvent.click(deselectButton);

      expect(mockDeselect).toHaveBeenCalled();
    });

    it("does not show selection count when no nodes are selected", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [],
        }),
      );

      render(<LineageViewTopBar />);

      expect(screen.queryByText(/node selected/)).not.toBeInTheDocument();
      expect(screen.queryByText(/nodes selected/)).not.toBeInTheDocument();
    });

    it("does not show deselect button when no nodes are selected", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [],
        }),
      );

      render(<LineageViewTopBar />);

      expect(
        screen.queryByRole("button", { name: /Deselect/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Single Environment Onboarding Mode Tests
  // ==========================================================================

  describe("single env onboarding mode", () => {
    it("shows Row Count action in multi-select when in single env onboarding", async () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
      });
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [
            createMockNode("node1", "node1"),
            createMockNode("node2", "node2"),
          ],
        }),
      );

      render(<LineageViewTopBar />);

      // In single env mode with selected nodes, should show Explore actions
      expect(screen.getByText("Explore")).toBeInTheDocument();

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Row Count")).toBeInTheDocument();
      });
    });

    it("calls runRowCount when Row Count is clicked in single env mode", async () => {
      const mockRunRowCount = jest.fn();
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
      });
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
          runRowCount: mockRunRowCount,
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const rowCountItem = screen.getByText("Row Count");
        fireEvent.click(rowCountItem);
      });

      expect(mockRunRowCount).toHaveBeenCalled();
    });

    it("does not show multi-select actions when not in single env and has selection", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: false },
      });
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      // Still should show Explore section (standard mode)
      expect(screen.getByText("Explore")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Lineage Diff Button State Tests
  // ==========================================================================

  describe("lineage diff button state", () => {
    it("enables Lineage Diff when no nodes are selected", async () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          focusedNode: undefined,
          selectedNodes: [],
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const lineageDiffItem = screen.getByText("Lineage Diff").closest("li");
        expect(lineageDiffItem).not.toHaveAttribute("aria-disabled", "true");
      });
    });

    it("enables Lineage Diff when multiple nodes are selected", async () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [
            createMockNode("node1", "node1"),
            createMockNode("node2", "node2"),
          ],
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const lineageDiffItem = screen.getByText("Lineage Diff").closest("li");
        expect(lineageDiffItem).not.toHaveAttribute("aria-disabled", "true");
      });
    });

    it("disables Lineage Diff when single node is focused", async () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          focusedNode: createMockNode("node1", "node1"),
          selectedNodes: [],
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const lineageDiffItem = screen.getByText("Lineage Diff").closest("li");
        expect(lineageDiffItem).toHaveAttribute("aria-disabled", "true");
      });
    });

    it("disables Lineage Diff when only one node is selected", async () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        const lineageDiffItem = screen.getByText("Lineage Diff").closest("li");
        expect(lineageDiffItem).toHaveAttribute("aria-disabled", "true");
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders all main controls correctly", () => {
      render(<LineageViewTopBar />);

      // All main controls should be present
      expect(screen.getByText("History")).toBeInTheDocument();
      expect(screen.getByText("Mode")).toBeInTheDocument();
      expect(screen.getByText("Package")).toBeInTheDocument();
      expect(screen.getByText("Select")).toBeInTheDocument();
      expect(screen.getByText("Exclude")).toBeInTheDocument();
      expect(screen.getByText("Explore")).toBeInTheDocument();
    });

    it("disables filters but keeps actions when nodes are selected", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          selectedNodes: [createMockNode("node1", "node1")],
        }),
      );

      render(<LineageViewTopBar />);

      // Filters should be disabled
      expect(
        screen.getByRole("button", { name: /Changed Models/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /my_project/i }),
      ).toBeDisabled();

      // Actions button should still be enabled
      expect(
        screen.getByRole("button", { name: /Actions/i }),
      ).not.toBeDisabled();
    });

    it("closes menu after selecting an action", async () => {
      const mockRunRowCountDiff = jest.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          runRowCountDiff: mockRunRowCountDiff,
        }),
      );

      render(<LineageViewTopBar />);

      const actionsButton = screen.getByRole("button", { name: /Actions/i });
      fireEvent.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText("Row Count Diff")).toBeInTheDocument();
      });

      const rowCountDiffItem = screen.getByText("Row Count Diff");
      fireEvent.click(rowCountDiffItem);

      // Menu should close after action
      await waitFor(() => {
        expect(screen.queryByText("Diff")).not.toBeInTheDocument();
      });
    });
  });
});
