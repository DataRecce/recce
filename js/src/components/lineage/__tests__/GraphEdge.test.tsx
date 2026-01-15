/**
 * @file GraphEdge.test.tsx
 * @description Comprehensive tests for GraphEdge component
 *
 * Tests verify:
 * - Rendering of bezier edge path
 * - Change status styling (stroke color, dash array)
 * - Highlighting behavior (dim filter for non-highlighted edges)
 * - Integration with context and style utilities
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @xyflow/react
jest.mock("@xyflow/react", () => ({
  BaseEdge: ({
    path,
    style,
    markerEnd,
  }: {
    path: string;
    style: Record<string, unknown>;
    markerEnd?: string;
  }) => (
    <svg>
      <path
        data-testid="base-edge"
        d={path}
        style={style}
        data-marker-end={markerEnd}
      />
    </svg>
  ),
  getBezierPath: jest.fn(() => ["M0,0 C100,0 200,100 300,100"]),
  Position: {
    Left: "left",
    Right: "right",
    Top: "top",
    Bottom: "bottom",
  },
}));

// Mock LineageViewContext
jest.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: jest.fn(() => ({ basePath: "" })),
  useLineageViewContextSafe: jest.fn(),
}));

// Mock @datarecce/ui/components/lineage/styles
jest.mock("@datarecce/ui/components/lineage/styles", () => ({
  getIconForChangeStatus: jest.fn(),
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraphEdge } from "@datarecce/ui";
import GraphEdge from "@datarecce/ui/components/lineage/GraphEdgeOss";
import { getIconForChangeStatus } from "@datarecce/ui/components/lineage/styles";
import { useLineageViewContextSafe } from "@datarecce/ui/contexts";
import { render, screen } from "@testing-library/react";
import { getBezierPath, Position } from "@xyflow/react";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEdgeProps = (
  overrides: Partial<LineageGraphEdge["data"]> = {},
) => ({
  id: "edge1",
  source: "node1",
  target: "node2",
  sourceX: 100,
  sourceY: 50,
  targetX: 300,
  targetY: 50,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  style: {},
  markerEnd: undefined,
  data: {
    from: "both" as const,
    changeStatus: undefined,
    ...overrides,
  },
});

const createMockContext = (
  overrides: Partial<ReturnType<typeof useLineageViewContextSafe>> = {},
) => ({
  isEdgeHighlighted: jest.fn(() => true),
  ...overrides,
});

// ============================================================================
// Test Setup
// ============================================================================

describe("GraphEdge", () => {
  const mockUseLineageViewContextSafe = useLineageViewContextSafe as jest.Mock;
  const mockGetIconForChangeStatus = getIconForChangeStatus as jest.Mock;
  const mockGetBezierPath = getBezierPath as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseLineageViewContextSafe.mockReturnValue(createMockContext());
    mockGetIconForChangeStatus.mockReturnValue({
      icon: () => <span>Icon</span>,
      color: "#22c55e",
      hexColor: "#22c55e",
    });
    mockGetBezierPath.mockReturnValue(["M0,0 C100,0 200,100 300,100"]);
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders BaseEdge with bezier path", () => {
      const props = createMockEdgeProps();

      render(<GraphEdge {...props} />);

      expect(screen.getByTestId("base-edge")).toBeInTheDocument();
    });

    it("calls getBezierPath with correct coordinates", () => {
      const props = createMockEdgeProps();

      render(<GraphEdge {...props} />);

      expect(mockGetBezierPath).toHaveBeenCalledWith({
        sourceX: 100,
        sourceY: 50,
        sourcePosition: "right",
        targetX: 300,
        targetY: 50,
        targetPosition: "left",
      });
    });

    it("passes path to BaseEdge", () => {
      mockGetBezierPath.mockReturnValue(["M10,20 C50,20 100,80 150,80"]);
      const props = createMockEdgeProps();

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge).toHaveAttribute("d", "M10,20 C50,20 100,80 150,80");
    });

    it("passes markerEnd to BaseEdge", () => {
      const props = {
        ...createMockEdgeProps(),
        markerEnd: "url(#arrow)",
      };

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge).toHaveAttribute("data-marker-end", "url(#arrow)");
    });
  });

  // ==========================================================================
  // Change Status Styling Tests
  // ==========================================================================

  describe("change status styling", () => {
    it("applies stroke color for added status", () => {
      mockGetIconForChangeStatus.mockReturnValue({
        hexColor: "#22c55e",
      });
      const props = createMockEdgeProps({ changeStatus: "added" });

      render(<GraphEdge {...props} />);

      expect(mockGetIconForChangeStatus).toHaveBeenCalledWith("added");
    });

    it("applies stroke color for removed status", () => {
      mockGetIconForChangeStatus.mockReturnValue({
        hexColor: "#ef4444",
      });
      const props = createMockEdgeProps({ changeStatus: "removed" });

      render(<GraphEdge {...props} />);

      expect(mockGetIconForChangeStatus).toHaveBeenCalledWith("removed");
    });

    it("applies stroke dash array for changed edges", () => {
      mockGetIconForChangeStatus.mockReturnValue({
        hexColor: "#22c55e",
      });
      const props = createMockEdgeProps({ changeStatus: "added" });

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      // Style should include strokeDasharray: "5"
      expect(edge.style.strokeDasharray).toBe("5");
    });

    it("does not apply change status styling when changeStatus is undefined", () => {
      const props = createMockEdgeProps({ changeStatus: undefined });

      render(<GraphEdge {...props} />);

      // getIconForChangeStatus should not be called
      expect(mockGetIconForChangeStatus).not.toHaveBeenCalled();
    });

    it("applies correct hex color to stroke", () => {
      mockGetIconForChangeStatus.mockReturnValue({
        hexColor: "#f59e0b",
      });
      const props = createMockEdgeProps({ changeStatus: "removed" });

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe("#f59e0b");
    });
  });

  // ==========================================================================
  // Highlighting Tests
  // ==========================================================================

  describe("highlighting", () => {
    it("calls isEdgeHighlighted with source and target", () => {
      const mockIsEdgeHighlighted = jest.fn(() => true);
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          isEdgeHighlighted: mockIsEdgeHighlighted,
        }),
      );
      const props = createMockEdgeProps();

      render(<GraphEdge {...props} />);

      expect(mockIsEdgeHighlighted).toHaveBeenCalledWith("node1", "node2");
    });

    it("does not apply filter when edge is highlighted", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          isEdgeHighlighted: jest.fn(() => true),
        }),
      );
      const props = createMockEdgeProps();

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      // Filter should not be applied for highlighted edges
      expect(edge.style.filter).toBe("");
    });

    it("applies dim filter when edge is not highlighted", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          isEdgeHighlighted: jest.fn(() => false),
        }),
      );
      const props = createMockEdgeProps();

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      // Filter should be applied for non-highlighted edges
      expect(edge.style.filter).toBe("opacity(0.2) grayscale(50%)");
    });
  });

  // ==========================================================================
  // Style Override Tests
  // ==========================================================================

  describe("style overrides", () => {
    it("applies style overrides from props", () => {
      const props = {
        ...createMockEdgeProps(),
        style: {
          strokeWidth: 2,
        },
      };

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.strokeWidth).toBe("2");
    });

    it("combines style overrides with change status styling", () => {
      mockGetIconForChangeStatus.mockReturnValue({
        hexColor: "#22c55e",
      });
      const props = {
        ...createMockEdgeProps({ changeStatus: "added" }),
        style: {
          strokeWidth: 3,
        },
      };

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.strokeWidth).toBe("3");
      expect(edge.style.stroke).toBe("#22c55e");
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders highlighted edge with change status", () => {
      mockGetIconForChangeStatus.mockReturnValue({
        hexColor: "#22c55e",
      });
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          isEdgeHighlighted: jest.fn(() => true),
        }),
      );
      const props = createMockEdgeProps({ changeStatus: "added" });

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe("#22c55e");
      expect(edge.style.strokeDasharray).toBe("5");
      expect(edge.style.filter).toBe("");
    });

    it("renders non-highlighted edge with change status", () => {
      mockGetIconForChangeStatus.mockReturnValue({
        hexColor: "#ef4444",
      });
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          isEdgeHighlighted: jest.fn(() => false),
        }),
      );
      const props = createMockEdgeProps({ changeStatus: "removed" });

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe("#ef4444");
      expect(edge.style.strokeDasharray).toBe("5");
      expect(edge.style.filter).toBe("opacity(0.2) grayscale(50%)");
    });

    it("renders plain edge without change status", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          isEdgeHighlighted: jest.fn(() => true),
        }),
      );
      const props = createMockEdgeProps({ changeStatus: undefined });

      render(<GraphEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe("");
      expect(edge.style.strokeDasharray).toBe("");
      expect(edge.style.filter).toBe("");
    });
  });
});
