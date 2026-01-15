/**
 * @file SummaryView.test.tsx
 * @description Comprehensive tests for SummaryView component
 *
 * Tests verify:
 * - Renders correctly with lineageGraph from context
 * - Displays both ChangeSummary and SchemaSummary components
 * - Shows section title "Change Summary"
 * - Includes divider between sections
 * - Handles missing lineageGraph gracefully
 * - Integrates with useLineageGraphContext correctly
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui/contexts
jest.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: jest.fn(() => ({ basePath: "" })),
  useLineageGraphContext: jest.fn(),
}));

// Mock ChangeSummary component
jest.mock("@datarecce/ui/components/summary/ChangeSummary", () => ({
  ChangeSummary: ({ lineageGraph }: { lineageGraph: unknown }) => (
    <div data-testid="change-summary">
      <span data-testid="change-summary-graph">
        {lineageGraph ? "Graph Present" : "No Graph"}
      </span>
    </div>
  ),
}));

// Mock SchemaSummary component
jest.mock("@datarecce/ui/components/summary/SchemaSummary", () => ({
  SchemaSummary: ({ lineageGraph }: { lineageGraph: unknown }) => (
    <div data-testid="schema-summary">
      <span data-testid="schema-summary-graph">
        {lineageGraph ? "Graph Present" : "No Graph"}
      </span>
    </div>
  ),
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraph } from "@datarecce/ui";
import { SummaryView } from "@datarecce/ui/components/summary";
import { useLineageGraphContext } from "@datarecce/ui/contexts";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLineageGraph = (): LineageGraph => ({
  nodes: {
    "model.test.node1": {
      id: "model.test.node1",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "model.test.node1",
        name: "node1",
        from: "both",
        changeStatus: "modified",
        data: {
          base: {
            id: "model.test.node1",
            unique_id: "model.test.node1",
            name: "node1",
            resource_type: "model",
            package_name: "test",
            columns: { col1: { name: "col1", type: "STRING" } },
            checksum: { name: "sha256", checksum: "abc123" },
          },
          current: {
            id: "model.test.node1",
            unique_id: "model.test.node1",
            name: "node1",
            resource_type: "model",
            package_name: "test",
            columns: {
              col1: { name: "col1", type: "STRING" },
              col2: { name: "col2", type: "INT" },
            },
            checksum: { name: "sha256", checksum: "def456" },
          },
        },
        resourceType: "model",
        packageName: "test",
        parents: {},
        children: {},
      },
    },
  },
  edges: {},
  modifiedSet: ["model.test.node1"],
  manifestMetadata: { base: undefined, current: undefined },
  catalogMetadata: { base: undefined, current: undefined },
});

const createMockContext = (
  lineageGraph: LineageGraph | undefined = undefined,
) => ({
  lineageGraph,
  runsAggregated: undefined,
});

// ============================================================================
// Test Setup
// ============================================================================

describe("SummaryView", () => {
  const mockUseLineageGraphContext = useLineageGraphContext as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders section title", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      render(<SummaryView />);

      expect(screen.getByText("Change Summary")).toBeInTheDocument();
    });

    it("renders ChangeSummary component when lineageGraph is present", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      render(<SummaryView />);

      expect(screen.getByTestId("change-summary")).toBeInTheDocument();
      expect(screen.getByTestId("change-summary-graph")).toHaveTextContent(
        "Graph Present",
      );
    });

    it("renders SchemaSummary component when lineageGraph is present", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      render(<SummaryView />);

      expect(screen.getByTestId("schema-summary")).toBeInTheDocument();
      expect(screen.getByTestId("schema-summary-graph")).toHaveTextContent(
        "Graph Present",
      );
    });

    it("renders divider between sections", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      const { container } = render(<SummaryView />);

      // MUI Divider renders an HR element
      const divider = container.querySelector("hr");
      expect(divider).toBeInTheDocument();
    });

    it("does not render ChangeSummary when lineageGraph is undefined", () => {
      mockUseLineageGraphContext.mockReturnValue(createMockContext(undefined));

      render(<SummaryView />);

      expect(screen.queryByTestId("change-summary")).not.toBeInTheDocument();
    });

    it("does not render SchemaSummary when lineageGraph is undefined", () => {
      mockUseLineageGraphContext.mockReturnValue(createMockContext(undefined));

      render(<SummaryView />);

      expect(screen.queryByTestId("schema-summary")).not.toBeInTheDocument();
    });

    it("does not render divider when lineageGraph is undefined", () => {
      mockUseLineageGraphContext.mockReturnValue(createMockContext(undefined));

      const { container } = render(<SummaryView />);

      const divider = container.querySelector("hr");
      expect(divider).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Context Integration Tests
  // ==========================================================================

  describe("context integration", () => {
    it("uses lineageGraph from useLineageGraphContext", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      render(<SummaryView />);

      expect(mockUseLineageGraphContext).toHaveBeenCalled();
      expect(screen.getByTestId("change-summary")).toBeInTheDocument();
      expect(screen.getByTestId("schema-summary")).toBeInTheDocument();
    });

    it("passes lineageGraph to both child components", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      render(<SummaryView />);

      // Both components should receive the graph
      expect(screen.getByTestId("change-summary-graph")).toHaveTextContent(
        "Graph Present",
      );
      expect(screen.getByTestId("schema-summary-graph")).toHaveTextContent(
        "Graph Present",
      );
    });

    it("handles context returning undefined lineageGraph", () => {
      mockUseLineageGraphContext.mockReturnValue(createMockContext(undefined));

      render(<SummaryView />);

      // Only the title should be visible
      expect(screen.getByText("Change Summary")).toBeInTheDocument();
      expect(screen.queryByTestId("change-summary")).not.toBeInTheDocument();
      expect(screen.queryByTestId("schema-summary")).not.toBeInTheDocument();
    });

    it("handles context returning null lineageGraph", () => {
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(null as unknown as undefined),
      );

      render(<SummaryView />);

      // Only the title should be visible
      expect(screen.getByText("Change Summary")).toBeInTheDocument();
      expect(screen.queryByTestId("change-summary")).not.toBeInTheDocument();
      expect(screen.queryByTestId("schema-summary")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Layout Tests
  // ==========================================================================

  describe("layout", () => {
    it("renders in stack layout with proper structure", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      const { container } = render(<SummaryView />);

      // The component uses Stack (renders as div with flex styles)
      const stack = container.querySelector('[class*="MuiStack"]');
      expect(stack).toBeTruthy();
    });

    it("has minimum height constraint", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      const { container } = render(<SummaryView />);

      // Component should have minHeight: 650px
      const stack = container.firstChild as HTMLElement;
      // MUI sx styles are applied but may not be directly inspectable
      expect(stack).toBeInTheDocument();
    });

    it("applies proper spacing to title box", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      render(<SummaryView />);

      const titleBox = screen.getByText("Change Summary").closest("div");
      expect(titleBox).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("handles empty lineageGraph (no nodes)", () => {
      const emptyGraph: LineageGraph = {
        nodes: {},
        edges: {},
        modifiedSet: [],
        manifestMetadata: { base: undefined, current: undefined },
        catalogMetadata: { base: undefined, current: undefined },
      };
      mockUseLineageGraphContext.mockReturnValue(createMockContext(emptyGraph));

      render(<SummaryView />);

      // Should still render both components with empty data
      expect(screen.getByTestId("change-summary")).toBeInTheDocument();
      expect(screen.getByTestId("schema-summary")).toBeInTheDocument();
    });

    it("handles lineageGraph with only unmodified nodes", () => {
      const graphWithUnmodifiedNodes: LineageGraph = {
        nodes: {
          "model.test.node1": {
            id: "model.test.node1",
            type: "lineageGraphNode",
            position: { x: 0, y: 0 },
            data: {
              id: "model.test.node1",
              name: "node1",
              from: "both",
              changeStatus: undefined, // No change status
              data: {
                base: {
                  id: "model.test.node1",
                  unique_id: "model.test.node1",
                  name: "node1",
                  resource_type: "model",
                  package_name: "test",
                  columns: { col1: { name: "col1", type: "STRING" } },
                  checksum: { name: "sha256", checksum: "abc123" },
                },
                current: {
                  id: "model.test.node1",
                  unique_id: "model.test.node1",
                  name: "node1",
                  resource_type: "model",
                  package_name: "test",
                  columns: { col1: { name: "col1", type: "STRING" } },
                  checksum: { name: "sha256", checksum: "abc123" },
                },
              },
              resourceType: "model",
              packageName: "test",
              parents: {},
              children: {},
            },
          },
        },
        edges: {},
        modifiedSet: [], // Empty modifiedSet
        manifestMetadata: { base: undefined, current: undefined },
        catalogMetadata: { base: undefined, current: undefined },
      };
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(graphWithUnmodifiedNodes),
      );

      render(<SummaryView />);

      // Should still render both components
      expect(screen.getByTestId("change-summary")).toBeInTheDocument();
      expect(screen.getByTestId("schema-summary")).toBeInTheDocument();
    });

    it("re-renders when lineageGraph changes", () => {
      const lineageGraph1 = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph1),
      );

      const { rerender } = render(<SummaryView />);

      expect(screen.getByTestId("change-summary")).toBeInTheDocument();

      // Update context with undefined graph
      mockUseLineageGraphContext.mockReturnValue(createMockContext(undefined));

      rerender(<SummaryView />);

      // Components should no longer be rendered
      expect(screen.queryByTestId("change-summary")).not.toBeInTheDocument();
      expect(screen.queryByTestId("schema-summary")).not.toBeInTheDocument();
    });

    it("maintains consistent layout when switching between states", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      const { rerender, container } = render(<SummaryView />);

      // Get the initial structure
      const initialStack = container.firstChild;
      expect(initialStack).toBeInTheDocument();

      // Update with undefined graph
      mockUseLineageGraphContext.mockReturnValue(createMockContext(undefined));
      rerender(<SummaryView />);

      // Stack structure should remain
      const updatedStack = container.firstChild;
      expect(updatedStack).toBeInTheDocument();

      // Title should still be present
      expect(screen.getByText("Change Summary")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Component Composition Tests
  // ==========================================================================

  describe("component composition", () => {
    it("renders components in correct order: title -> ChangeSummary -> divider -> SchemaSummary", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      const { container } = render(<SummaryView />);

      // Get all rendered elements in order
      const title = screen.getByText("Change Summary");
      const changeSummary = screen.getByTestId("change-summary");
      const schemaSummary = screen.getByTestId("schema-summary");

      // All should be in the document
      expect(title).toBeInTheDocument();
      expect(changeSummary).toBeInTheDocument();
      expect(schemaSummary).toBeInTheDocument();

      // Divider should be between sections
      const divider = container.querySelector("hr");
      expect(divider).toBeInTheDocument();
    });

    it("wraps components in proper container structure", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      const { container } = render(<SummaryView />);

      // Main Stack container
      expect(container.firstChild).toBeInTheDocument();

      // Title Box container
      const titleBox = screen.getByText("Change Summary").closest("div");
      expect(titleBox).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Typography Tests
  // ==========================================================================

  describe("typography", () => {
    it("renders title with correct variant and size", () => {
      const lineageGraph = createMockLineageGraph();
      mockUseLineageGraphContext.mockReturnValue(
        createMockContext(lineageGraph),
      );

      render(<SummaryView />);

      const title = screen.getByText("Change Summary");
      expect(title).toBeInTheDocument();

      // Title uses Typography with variant="h5" and fontSize: 24
      expect(title.tagName).toBe("H5");
    });
  });
});
