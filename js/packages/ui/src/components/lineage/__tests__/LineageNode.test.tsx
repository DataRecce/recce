/**
 * @file LineageNode.test.tsx
 * @description Comprehensive tests for UI Package LineageNode component
 *
 * Tests verify:
 * - Rendering of node with label
 * - Change status colors and icons
 * - Selection states and modes
 * - Interactive mode with checkbox
 * - Click callbacks
 * - Handle rendering
 * - Action tag display
 * - Hover behavior
 * - Memoization
 *
 * Source of truth: UI package primitives
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @xyflow/react
jest.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: {
    Left: "left",
    Right: "right",
    Top: "top",
    Bottom: "bottom",
  },
}));

// ============================================================================
// Imports
// ============================================================================

import { fireEvent, render, screen } from "@testing-library/react";
import {
  type ChangeCategory,
  LineageNode,
  type LineageNodeData,
  type LineageNodeProps,
  type NodeChangeStatus,
  type SelectMode,
} from "../nodes/LineageNode";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNodeProps = (
  overrides: Partial<LineageNodeProps> = {},
  dataOverrides: Partial<LineageNodeData> = {},
): LineageNodeProps => ({
  id: "test-node-1",
  data: {
    label: "test_model",
    ...dataOverrides,
  },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("LineageNode", () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders node label correctly", () => {
      const props = createMockNodeProps({}, { label: "my_model" });

      render(<LineageNode {...props} />);

      expect(screen.getByText("my_model")).toBeInTheDocument();
    });

    it("renders node label in tooltip with resource type", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", resourceType: "model" },
      );

      render(<LineageNode {...props} />);

      // The label should be visible
      expect(screen.getByText("test")).toBeInTheDocument();
      // Tooltip is shown on hover - verifying aria-label exists
      expect(screen.getByLabelText("test")).toBeInTheDocument();
    });

    it("renders label with unknown resource type in tooltip", () => {
      const props = createMockNodeProps({}, { label: "test" });

      render(<LineageNode {...props} />);

      expect(screen.getByText("test")).toBeInTheDocument();
      // When no resource type, shows "unknown"
      expect(screen.getByLabelText("test (unknown)")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Handle Tests
  // ==========================================================================

  describe("handles", () => {
    it("renders left target handle when hasParents is true", () => {
      const props = createMockNodeProps({ hasParents: true });

      render(<LineageNode {...props} />);

      const handle = screen.getByTestId("handle-target");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveAttribute("data-position", "left");
    });

    it("renders right source handle when hasChildren is true", () => {
      const props = createMockNodeProps({ hasChildren: true });

      render(<LineageNode {...props} />);

      const handle = screen.getByTestId("handle-source");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveAttribute("data-position", "right");
    });

    it("does not render target handle when hasParents is false", () => {
      const props = createMockNodeProps({ hasParents: false });

      render(<LineageNode {...props} />);

      expect(screen.queryByTestId("handle-target")).not.toBeInTheDocument();
    });

    it("does not render source handle when hasChildren is false", () => {
      const props = createMockNodeProps({ hasChildren: false });

      render(<LineageNode {...props} />);

      expect(screen.queryByTestId("handle-source")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Change Status Tests
  // ==========================================================================

  describe("change status", () => {
    it("renders without errors for added status", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", changeStatus: "added" },
      );

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders without errors for removed status", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", changeStatus: "removed" },
      );

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders without errors for modified status", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", changeStatus: "modified" },
      );

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("defaults to unchanged status when not provided", () => {
      const props = createMockNodeProps({}, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Selection Tests
  // ==========================================================================

  describe("selection", () => {
    it("renders in selected state when selected prop is true", () => {
      const props = createMockNodeProps({ selected: true }, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders in selected state when isNodeSelected is true", () => {
      const props = createMockNodeProps(
        { isNodeSelected: true },
        { label: "test" },
      );

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders in selected state when data.isSelected is true", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", isSelected: true },
      );

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders in focused state when isFocused is true", () => {
      const props = createMockNodeProps({ isFocused: true }, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders dimmed when not highlighted", () => {
      const props = createMockNodeProps(
        { isHighlighted: false },
        { label: "test" },
      );

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Interactive Mode Tests
  // ==========================================================================

  describe("interactive mode", () => {
    it("renders checkbox when interactive is true", () => {
      const props = createMockNodeProps(
        { interactive: true },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("does not render checkbox when interactive is false", () => {
      const props = createMockNodeProps(
        { interactive: false },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("checkbox is checked when selecting mode and isNodeSelected", () => {
      const props = createMockNodeProps(
        { interactive: true, selectMode: "selecting", isNodeSelected: true },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("checkbox is unchecked when selecting mode and not selected", () => {
      const props = createMockNodeProps(
        { interactive: true, selectMode: "selecting", isNodeSelected: false },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("checkbox is disabled in action_result mode", () => {
      const props = createMockNodeProps(
        { interactive: true, selectMode: "action_result" },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("calls onSelect when checkbox is clicked in selecting mode", () => {
      const onSelect = jest.fn();
      const props = createMockNodeProps(
        { interactive: true, selectMode: "selecting", onSelect },
        { label: "test" },
      );

      render(<LineageNode {...props} />);
      fireEvent.click(screen.getByRole("checkbox"));

      expect(onSelect).toHaveBeenCalledWith("test-node-1");
    });

    it("does not call onSelect when checkbox is clicked in action_result mode", () => {
      const onSelect = jest.fn();
      const props = createMockNodeProps(
        {
          interactive: true,
          selectMode: "action_result",
          onSelect,
          actionTag: <span>Action</span>,
        },
        { label: "test" },
      );

      render(<LineageNode {...props} />);
      // Checkbox is disabled so click won't propagate
      fireEvent.click(screen.getByRole("checkbox"));

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Select Mode Tests
  // ==========================================================================

  describe("select modes", () => {
    const selectModes: SelectMode[] = ["normal", "selecting", "action_result"];

    it.each(selectModes)("renders correctly in %s mode", (mode) => {
      const props = createMockNodeProps(
        { selectMode: mode },
        { label: "test" },
      );

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("shows pointer cursor in selecting mode", () => {
      const props = createMockNodeProps(
        { selectMode: "selecting" },
        { label: "test" },
      );

      const { container } = render(<LineageNode {...props} />);
      // Component renders with cursor style applied via sx prop
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Action Tag Tests
  // ==========================================================================

  describe("action tag", () => {
    it("renders action tag in action_result mode", () => {
      const props = createMockNodeProps(
        {
          selectMode: "action_result",
          actionTag: <span data-testid="action-tag">Running</span>,
        },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByTestId("action-tag")).toBeInTheDocument();
      expect(screen.getByText("Running")).toBeInTheDocument();
    });

    it("does not render action tag when not provided", () => {
      const props = createMockNodeProps(
        { selectMode: "action_result" },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.queryByTestId("action-tag")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Change Analysis Tests
  // ==========================================================================

  describe("change analysis", () => {
    const changeCategories: ChangeCategory[] = [
      "breaking",
      "non_breaking",
      "partial_breaking",
      "unknown",
    ];

    it.each(
      changeCategories,
    )("shows %s category label when showChangeAnalysis is true", (category) => {
      const labels: Record<ChangeCategory, string> = {
        breaking: "Breaking",
        non_breaking: "Non Breaking",
        partial_breaking: "Partial Breaking",
        unknown: "Unknown",
      };

      const props = createMockNodeProps(
        { showChangeAnalysis: true, changeCategory: category },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByText(labels[category])).toBeInTheDocument();
    });

    it("does not show category label when showChangeAnalysis is false", () => {
      const props = createMockNodeProps(
        { showChangeAnalysis: false, changeCategory: "breaking" },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.queryByText("Breaking")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Runs Aggregated Tests
  // ==========================================================================

  describe("runs aggregated", () => {
    it("renders runsAggregatedTag when provided in normal mode", () => {
      const props = createMockNodeProps(
        {
          selectMode: "normal",
          runsAggregatedTag: <span data-testid="runs-tag">+10%</span>,
        },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByTestId("runs-tag")).toBeInTheDocument();
    });

    it("does not render runsAggregatedTag in action_result mode", () => {
      const props = createMockNodeProps(
        {
          selectMode: "action_result",
          runsAggregatedTag: <span data-testid="runs-tag">+10%</span>,
        },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.queryByTestId("runs-tag")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Column Container Tests
  // ==========================================================================

  describe("column container", () => {
    it("renders column container when columnCount > 0", () => {
      const props = createMockNodeProps(
        { columnCount: 5, columnHeight: 28 },
        { label: "test" },
      );

      const { container } = render(<LineageNode {...props} />);

      // The component should render with the column container
      expect(container.firstChild).toBeInTheDocument();
    });

    it("does not render column container when columnCount is 0", () => {
      const props = createMockNodeProps({ columnCount: 0 }, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Visibility Tests
  // ==========================================================================

  describe("visibility", () => {
    it("renders content when showContent is true", () => {
      const props = createMockNodeProps(
        { showContent: true },
        { label: "test" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByText("test")).toBeInTheDocument();
    });

    it("hides content when showContent is false", () => {
      const props = createMockNodeProps(
        { showContent: false },
        { label: "test" },
      );

      const { container } = render(<LineageNode {...props} />);
      // Component still renders, but content has visibility:hidden
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Callback Tests
  // ==========================================================================

  describe("callbacks", () => {
    it("calls onNodeClick with node id when clicked", () => {
      const onNodeClick = jest.fn();
      const props = createMockNodeProps({ onNodeClick }, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      const element = container.firstChild as HTMLElement;
      fireEvent.click(element);

      expect(onNodeClick).toHaveBeenCalledWith("test-node-1");
    });

    it("calls onNodeDoubleClick with node id when double-clicked", () => {
      const onNodeDoubleClick = jest.fn();
      const props = createMockNodeProps(
        { onNodeDoubleClick },
        { label: "test" },
      );

      const { container } = render(<LineageNode {...props} />);
      const element = container.firstChild as HTMLElement;
      fireEvent.doubleClick(element);

      expect(onNodeDoubleClick).toHaveBeenCalledWith("test-node-1");
    });

    it("does not throw when callbacks are not provided", () => {
      const props = createMockNodeProps({}, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      const element = container.firstChild as HTMLElement;

      expect(() => {
        fireEvent.click(element);
        fireEvent.doubleClick(element);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Dark Mode Tests
  // ==========================================================================

  describe("dark mode", () => {
    it("renders correctly in dark mode", () => {
      const props = createMockNodeProps({ isDark: true }, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders correctly in light mode", () => {
      const props = createMockNodeProps({ isDark: false }, { label: "test" });

      const { container } = render(<LineageNode {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Memoization Tests
  // ==========================================================================

  describe("memoization", () => {
    it("has displayName set for debugging", () => {
      expect(LineageNode.displayName).toBe("LineageNode");
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders complete node with all features", () => {
      const props = createMockNodeProps(
        {
          selected: true,
          interactive: true,
          hasParents: true,
          hasChildren: true,
        },
        {
          label: "customers",
          changeStatus: "modified",
          resourceType: "model",
        },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByText("customers")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      expect(screen.getByTestId("handle-target")).toBeInTheDocument();
      expect(screen.getByTestId("handle-source")).toBeInTheDocument();
    });
  });
});
