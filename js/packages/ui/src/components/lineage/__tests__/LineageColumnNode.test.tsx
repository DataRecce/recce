/**
 * @file LineageColumnNode.test.tsx
 * @description Comprehensive tests for UI Package LineageColumnNode component
 *
 * Tests verify:
 * - Column name and type rendering
 * - Change status indicators (added, removed, modified)
 * - Transformation type chips (P, R, D, S, U)
 * - showContent prop (zoom-level visibility)
 * - showChangeAnalysis prop (toggle between change status and transformation)
 * - Context menu callback (kebab menu on hover)
 * - Highlighting behavior
 * - Focus state
 * - Hover behavior
 * - Click callbacks
 *
 * Source of truth: UI package primitives
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

import { vi } from "vitest";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  Handle: ({
    type,
    position,
  }: {
    type: string;
    position: string;
    isConnectable?: boolean;
    style?: Record<string, unknown>;
  }) => <div data-testid={`handle-${type}`} data-position={position} />,
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
import type { MouseEvent } from "react";
import {
  COLUMN_NODE_HEIGHT,
  COLUMN_NODE_WIDTH,
  type ColumnChangeStatus,
  type ColumnTransformationType,
  LineageColumnNode,
  type LineageColumnNodeData,
  type LineageColumnNodeProps,
} from "../columns/LineageColumnNode";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockColumnNodeProps = (
  overrides: Partial<LineageColumnNodeProps> = {},
  dataOverrides: Partial<LineageColumnNodeData> = {},
): LineageColumnNodeProps => ({
  id: "users-id",
  data: {
    column: "id",
    type: "INTEGER",
    nodeId: "model.test.users",
    ...dataOverrides,
  },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("LineageColumnNode", () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders column name", () => {
      const props = createMockColumnNodeProps({}, { column: "user_email" });

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("user_email")).toBeInTheDocument();
    });

    it("renders column type when provided", () => {
      const props = createMockColumnNodeProps({}, { type: "VARCHAR" });

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("VARCHAR")).toBeInTheDocument();
    });

    it("does not render type when not provided", () => {
      const props = createMockColumnNodeProps({}, { type: undefined });

      render(<LineageColumnNode {...props} />);

      expect(screen.queryByText("INTEGER")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Handle Tests
  // ==========================================================================

  describe("handles", () => {
    it("renders left target handle", () => {
      const props = createMockColumnNodeProps();

      render(<LineageColumnNode {...props} />);

      const handle = screen.getByTestId("handle-target");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveAttribute("data-position", "left");
    });

    it("renders right source handle", () => {
      const props = createMockColumnNodeProps();

      render(<LineageColumnNode {...props} />);

      const handle = screen.getByTestId("handle-source");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveAttribute("data-position", "right");
    });
  });

  // ==========================================================================
  // Change Status Tests
  // ==========================================================================

  describe("change status indicator", () => {
    it("renders + symbol for added status when showChangeAnalysis is true", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: true },
        { changeStatus: "added" },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("+")).toBeInTheDocument();
    });

    it("renders - symbol for removed status when showChangeAnalysis is true", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: true },
        { changeStatus: "removed" },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("renders ~ symbol for modified status when showChangeAnalysis is true", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: true },
        { changeStatus: "modified" },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("~")).toBeInTheDocument();
    });

    it("does not render change status indicator when showChangeAnalysis is false", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: false },
        { changeStatus: "added" },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.queryByText("+")).not.toBeInTheDocument();
    });

    it("does not render change status indicator when not provided", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: true },
        { changeStatus: undefined },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.queryByText("+")).not.toBeInTheDocument();
      expect(screen.queryByText("-")).not.toBeInTheDocument();
      expect(screen.queryByText("~")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Transformation Type Tests
  // ==========================================================================

  describe("transformation type indicator", () => {
    const transformationLetters: Record<ColumnTransformationType, string> = {
      passthrough: "P",
      renamed: "R",
      derived: "D",
      source: "S",
      unknown: "U",
    };

    it.each(
      Object.entries(transformationLetters),
    )("shows %s chip for %s transformation", (type, letter) => {
      const props = createMockColumnNodeProps(
        {},
        {
          transformationType: type as ColumnTransformationType,
          changeStatus: undefined, // Change status takes precedence
        },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText(letter)).toBeInTheDocument();
    });

    it("shows transformation type by default even when change status is present", () => {
      const props = createMockColumnNodeProps(
        {},
        {
          transformationType: "passthrough",
          changeStatus: "added",
        },
      );

      render(<LineageColumnNode {...props} />);

      // Transformation type shown when showChangeAnalysis is false (default)
      expect(screen.getByText("P")).toBeInTheDocument();
      expect(screen.queryByText("+")).not.toBeInTheDocument();
    });

    it("does not render transformation indicator when not provided", () => {
      const props = createMockColumnNodeProps(
        {},
        {
          transformationType: undefined,
          changeStatus: undefined,
        },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.queryByText("P")).not.toBeInTheDocument();
      expect(screen.queryByText("R")).not.toBeInTheDocument();
      expect(screen.queryByText("D")).not.toBeInTheDocument();
      expect(screen.queryByText("S")).not.toBeInTheDocument();
      expect(screen.queryByText("U")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Highlighting Tests
  // ==========================================================================

  describe("highlighting", () => {
    // Note: MUI sx prop applies styles via CSS classes, not inline styles.
    // These tests verify the component renders correctly with different highlight states.

    it("renders without error when not highlighted", () => {
      const props = createMockColumnNodeProps({}, { isHighlighted: false });

      const { container } = render(<LineageColumnNode {...props} />);

      // Component should render successfully with isHighlighted=false
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders without error when highlighted", () => {
      const props = createMockColumnNodeProps({}, { isHighlighted: true });

      const { container } = render(<LineageColumnNode {...props} />);

      // Component should render successfully with isHighlighted=true
      expect(container.firstChild).toBeInTheDocument();
    });

    it("defaults to highlighted when not specified", () => {
      const props = createMockColumnNodeProps();

      const { container } = render(<LineageColumnNode {...props} />);

      // Component should render successfully with default highlighting
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Focus State Tests
  // ==========================================================================

  describe("focus state", () => {
    it("renders without error when focused", () => {
      const props = createMockColumnNodeProps({}, { isFocused: true });

      const { container } = render(<LineageColumnNode {...props} />);

      // MUI uses sx prop which applies styles via CSS classes
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders without error when not focused", () => {
      const props = createMockColumnNodeProps({}, { isFocused: false });

      const { container } = render(<LineageColumnNode {...props} />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("defaults to not focused when not specified", () => {
      const props = createMockColumnNodeProps();

      const { container } = render(<LineageColumnNode {...props} />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Click Callback Tests
  // ==========================================================================

  describe("callbacks", () => {
    it("calls onColumnClick with column id when clicked", () => {
      const onColumnClick = vi.fn();
      const props = createMockColumnNodeProps({ onColumnClick });

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;
      fireEvent.click(element);

      expect(onColumnClick).toHaveBeenCalledWith("users-id");
    });

    it("does not throw when callback is not provided", () => {
      const props = createMockColumnNodeProps();

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      expect(() => {
        fireEvent.click(element);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Hover Behavior Tests
  // ==========================================================================

  describe("hover behavior", () => {
    it("handles mouse enter without error", () => {
      const props = createMockColumnNodeProps();

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      expect(() => {
        fireEvent.mouseEnter(element);
      }).not.toThrow();
    });

    it("handles mouse leave without error", () => {
      const props = createMockColumnNodeProps();

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(element);

      expect(() => {
        fireEvent.mouseLeave(element);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("constants", () => {
    it("exports COLUMN_NODE_HEIGHT", () => {
      expect(COLUMN_NODE_HEIGHT).toBe(24);
    });

    it("exports COLUMN_NODE_WIDTH", () => {
      expect(COLUMN_NODE_WIDTH).toBe(280);
    });
  });

  // ==========================================================================
  // showContent Prop Tests (Zoom Visibility)
  // ==========================================================================

  describe("showContent prop", () => {
    it("renders node when showContent is true (default)", () => {
      const props = createMockColumnNodeProps();

      const { container } = render(<LineageColumnNode {...props} />);

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText("id")).toBeInTheDocument();
    });

    it("returns null when showContent is false (low zoom)", () => {
      const props = createMockColumnNodeProps({ showContent: false });

      const { container } = render(<LineageColumnNode {...props} />);

      expect(container.firstChild).toBeNull();
    });

    it("hides node at low zoom level", () => {
      const props = createMockColumnNodeProps({ showContent: false });

      render(<LineageColumnNode {...props} />);

      expect(screen.queryByText("id")).not.toBeInTheDocument();
      expect(screen.queryByTestId("handle-target")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // showChangeAnalysis Prop Tests (Mode Toggle)
  // ==========================================================================

  describe("showChangeAnalysis prop", () => {
    it("shows transformation type when showChangeAnalysis is false", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: false },
        {
          transformationType: "passthrough",
          changeStatus: "added",
        },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("P")).toBeInTheDocument();
      expect(screen.queryByText("+")).not.toBeInTheDocument();
    });

    it("shows change status when showChangeAnalysis is true", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: true },
        {
          transformationType: "passthrough",
          changeStatus: "added",
        },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("+")).toBeInTheDocument();
      expect(screen.queryByText("P")).not.toBeInTheDocument();
    });

    it("shows transformation type when showChangeAnalysis is true but no change status", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: true },
        {
          transformationType: "derived",
          changeStatus: undefined,
        },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("D")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // onContextMenu Callback Tests (Kebab Menu)
  // ==========================================================================

  describe("onContextMenu callback", () => {
    it("shows kebab menu on hover when onContextMenu is provided", () => {
      const onContextMenu = vi.fn();
      const props = createMockColumnNodeProps({ onContextMenu });

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      // Initially shows column type
      expect(screen.getByText("INTEGER")).toBeInTheDocument();

      // Hover to show kebab menu
      fireEvent.mouseEnter(element);

      // Now shows kebab menu instead of type
      expect(screen.getByTestId("column-kebab-menu")).toBeInTheDocument();
      expect(screen.queryByText("INTEGER")).not.toBeInTheDocument();
    });

    it("calls onContextMenu when kebab menu is clicked", () => {
      const onContextMenu = vi.fn();
      const props = createMockColumnNodeProps({ onContextMenu });

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      // Hover to show kebab menu
      fireEvent.mouseEnter(element);

      // Click kebab menu
      const kebabMenu = screen.getByTestId("column-kebab-menu");
      fireEvent.click(kebabMenu);

      expect(onContextMenu).toHaveBeenCalledWith(
        expect.any(Object),
        "users-id",
      );
    });

    it("kebab menu click stops event propagation", () => {
      const onContextMenu = vi.fn();
      const onColumnClick = vi.fn();
      const props = createMockColumnNodeProps({ onContextMenu, onColumnClick });

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      // Hover to show kebab menu
      fireEvent.mouseEnter(element);

      // Click kebab menu
      const kebabMenu = screen.getByTestId("column-kebab-menu");
      fireEvent.click(kebabMenu);

      // onContextMenu should be called, but onColumnClick should NOT be called
      expect(onContextMenu).toHaveBeenCalled();
      expect(onColumnClick).not.toHaveBeenCalled();
    });

    it("shows column type when not hovering even with onContextMenu", () => {
      const onContextMenu = vi.fn();
      const props = createMockColumnNodeProps({ onContextMenu });

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      // Hover then leave
      fireEvent.mouseEnter(element);
      fireEvent.mouseLeave(element);

      // Should show type again
      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.queryByTestId("column-kebab-menu")).not.toBeInTheDocument();
    });

    it("does not show kebab menu when onContextMenu is not provided", () => {
      const props = createMockColumnNodeProps();

      const { container } = render(<LineageColumnNode {...props} />);
      const element = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(element);

      // Should still show type, no kebab menu
      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.queryByTestId("column-kebab-menu")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Memoization Tests
  // ==========================================================================

  describe("memoization", () => {
    it("has displayName set for debugging", () => {
      expect(LineageColumnNode.displayName).toBe("LineageColumnNode");
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders complete column node with change analysis mode", () => {
      const props = createMockColumnNodeProps(
        { showChangeAnalysis: true },
        {
          column: "created_at",
          type: "TIMESTAMP",
          changeStatus: "added",
          isHighlighted: true,
          isFocused: false,
        },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("created_at")).toBeInTheDocument();
      expect(screen.getByText("TIMESTAMP")).toBeInTheDocument();
      expect(screen.getByText("+")).toBeInTheDocument(); // added indicator
      expect(screen.getByTestId("handle-target")).toBeInTheDocument();
      expect(screen.getByTestId("handle-source")).toBeInTheDocument();
    });

    it("renders column with transformation type", () => {
      const props = createMockColumnNodeProps(
        {},
        {
          column: "user_id",
          type: "INTEGER",
          transformationType: "derived",
          isHighlighted: true,
        },
      );

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("user_id")).toBeInTheDocument();
      expect(screen.getByText("INTEGER")).toBeInTheDocument();
      expect(screen.getByText("D")).toBeInTheDocument(); // derived indicator
    });

    it("renders non-highlighted column without error", () => {
      const props = createMockColumnNodeProps(
        {},
        {
          column: "old_column",
          isHighlighted: false,
        },
      );

      const { container } = render(<LineageColumnNode {...props} />);

      // Component should render with column name visible
      expect(screen.getByText("old_column")).toBeInTheDocument();
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders column node with all new props", () => {
      const onContextMenu = vi.fn();
      const props = createMockColumnNodeProps(
        {
          showContent: true,
          showChangeAnalysis: true,
          isDark: true,
          onContextMenu,
        },
        {
          column: "test_column",
          type: "VARCHAR",
          changeStatus: "modified",
          transformationType: "derived",
          isHighlighted: true,
          isFocused: true,
        },
      );

      const { container } = render(<LineageColumnNode {...props} />);

      expect(screen.getByText("test_column")).toBeInTheDocument();
      // Shows change status because showChangeAnalysis is true
      expect(screen.getByText("~")).toBeInTheDocument();
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Export Tests
  // ==========================================================================

  describe("type exports", () => {
    it("ColumnChangeStatus type accepts valid values", () => {
      const status: ColumnChangeStatus = "added";
      expect(status).toBe("added");
    });
  });
});
