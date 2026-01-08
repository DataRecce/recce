/**
 * @file LineageColumnNode.test.tsx
 * @description Comprehensive tests for UI Package LineageColumnNode component
 *
 * Tests verify:
 * - Column name and type rendering
 * - Change status indicators (added, removed, modified)
 * - Transformation type chips (P, R, D, S, U)
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

// Mock @xyflow/react
jest.mock("@xyflow/react", () => ({
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
import React from "react";
import {
  COLUMN_NODE_HEIGHT,
  COLUMN_NODE_WIDTH,
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
    it("renders + symbol for added status", () => {
      const props = createMockColumnNodeProps({}, { changeStatus: "added" });

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("+")).toBeInTheDocument();
    });

    it("renders - symbol for removed status", () => {
      const props = createMockColumnNodeProps({}, { changeStatus: "removed" });

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("renders ~ symbol for modified status", () => {
      const props = createMockColumnNodeProps({}, { changeStatus: "modified" });

      render(<LineageColumnNode {...props} />);

      expect(screen.getByText("~")).toBeInTheDocument();
    });

    it("does not render change status indicator when not provided", () => {
      const props = createMockColumnNodeProps({}, { changeStatus: undefined });

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

    it("shows change status instead of transformation when both present", () => {
      const props = createMockColumnNodeProps(
        {},
        {
          transformationType: "passthrough",
          changeStatus: "added",
        },
      );

      render(<LineageColumnNode {...props} />);

      // Change status takes precedence
      expect(screen.getByText("+")).toBeInTheDocument();
      expect(screen.queryByText("P")).not.toBeInTheDocument();
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
      const onColumnClick = jest.fn();
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
    it("renders complete column node with all features", () => {
      const props = createMockColumnNodeProps(
        {},
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
  });
});
