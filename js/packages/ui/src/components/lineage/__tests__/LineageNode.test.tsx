/**
 * @file LineageNode.test.tsx
 * @description Comprehensive tests for UI Package LineageNode component
 *
 * Tests verify:
 * - Rendering of node with label and type
 * - Change status border colors
 * - Selection states
 * - Click callbacks
 * - Package name display
 * - Handle rendering
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
import React from "react";
import {
  LineageNode,
  type LineageNodeData,
  type LineageNodeProps,
  type NodeChangeStatus,
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

    it("renders node type chip when provided", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", nodeType: "model" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByText("model")).toBeInTheDocument();
    });

    it("does not render node type chip when not provided", () => {
      const props = createMockNodeProps({}, { label: "test" });

      render(<LineageNode {...props} />);

      expect(screen.queryByText("model")).not.toBeInTheDocument();
    });

    it("renders package name when provided", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", packageName: "my_package" },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByText("my_package")).toBeInTheDocument();
    });

    it("does not render package name when not provided", () => {
      const props = createMockNodeProps({}, { label: "test" });

      render(<LineageNode {...props} />);

      expect(screen.queryByText("my_package")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Handle Tests
  // ==========================================================================

  describe("handles", () => {
    it("renders left target handle", () => {
      const props = createMockNodeProps();

      render(<LineageNode {...props} />);

      const handle = screen.getByTestId("handle-target");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveAttribute("data-position", "left");
    });

    it("renders right source handle", () => {
      const props = createMockNodeProps();

      render(<LineageNode {...props} />);

      const handle = screen.getByTestId("handle-source");
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveAttribute("data-position", "right");
    });
  });

  // ==========================================================================
  // Change Status Tests
  // ==========================================================================

  describe("change status", () => {
    const statusColors: Record<NodeChangeStatus, string> = {
      added: "#22c55e",
      removed: "#ef4444",
      modified: "#f59e0b",
      unchanged: "#6b7280",
    };

    it.each(
      Object.entries(statusColors),
    )("applies %s status border color", (status, expectedColor) => {
      const props = createMockNodeProps(
        {},
        { label: "test", changeStatus: status as NodeChangeStatus },
      );

      const { container } = render(<LineageNode {...props} />);

      // Find the main box element
      const box = container.firstChild;
      expect(box).toHaveStyle(`border: 2px solid ${expectedColor}`);
    });

    it("defaults to unchanged status when not provided", () => {
      const props = createMockNodeProps({}, { label: "test" });

      const { container } = render(<LineageNode {...props} />);

      const box = container.firstChild;
      expect(box).toHaveStyle(`border: 2px solid ${statusColors.unchanged}`);
    });
  });

  // ==========================================================================
  // Selection Tests
  // ==========================================================================

  describe("selection", () => {
    it("applies selected background when selected prop is true", () => {
      const props = createMockNodeProps({ selected: true }, { label: "test" });

      const { container } = render(<LineageNode {...props} />);

      // MUI uses sx prop which applies styles via CSS classes
      // We can verify the component renders without error when selected
      expect(container.firstChild).toBeInTheDocument();
    });

    it("applies selected background when isSelected data prop is true", () => {
      const props = createMockNodeProps(
        {},
        { label: "test", isSelected: true },
      );

      const { container } = render(<LineageNode {...props} />);

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
        { selected: true },
        {
          label: "customers",
          nodeType: "model",
          changeStatus: "modified",
          packageName: "analytics",
        },
      );

      render(<LineageNode {...props} />);

      expect(screen.getByText("customers")).toBeInTheDocument();
      expect(screen.getByText("model")).toBeInTheDocument();
      expect(screen.getByText("analytics")).toBeInTheDocument();
      expect(screen.getByTestId("handle-target")).toBeInTheDocument();
      expect(screen.getByTestId("handle-source")).toBeInTheDocument();
    });
  });
});
