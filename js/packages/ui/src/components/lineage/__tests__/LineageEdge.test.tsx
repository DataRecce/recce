/**
 * @file LineageEdge.test.tsx
 * @description Comprehensive tests for UI Package LineageEdge component
 *
 * Tests verify:
 * - Rendering of bezier edge path
 * - Change status colors
 * - Highlighting behavior
 * - Label rendering
 * - Style application
 *
 * Source of truth: UI package primitives
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

import { type Mock, vi } from "vitest";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  BaseEdge: ({
    id,
    path,
    style,
    ...props
  }: {
    id: string;
    path: string;
    style: Record<string, unknown>;
    [key: string]: unknown;
  }) => (
    <svg>
      <path
        data-testid="base-edge"
        data-id={id}
        d={path}
        style={style}
        {...props}
      />
    </svg>
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  getBezierPath: vi.fn(() => ["M0,0 C100,0 200,100 300,100", 150, 50]),
}));

// ============================================================================
// Imports
// ============================================================================

import { render, screen } from "@testing-library/react";
import { getBezierPath } from "@xyflow/react";
import React from "react";
import { getSemanticColorTheme, STRUCTURAL_EDGE_DASH } from "../../../theme";
import { GraphEdge, type GraphEdgeProps } from "../edges/GraphEdge";
import {
  type EdgeChangeStatus,
  LineageEdge,
  type LineageEdgeData,
  type LineageEdgeProps,
} from "../edges/LineageEdge";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEdgeProps = (
  overrides: Partial<LineageEdgeProps> = {},
  dataOverrides: Partial<LineageEdgeData> = {},
): LineageEdgeProps =>
  ({
    id: "edge-1",
    source: "node1",
    target: "node2",
    sourceX: 100,
    sourceY: 50,
    targetX: 300,
    targetY: 50,
    sourcePosition: "right",
    targetPosition: "left",
    data: {
      ...dataOverrides,
    },
    ...overrides,
  }) as unknown as LineageEdgeProps;

const createMockGraphEdgeProps = (
  changeStatus: EdgeChangeStatus,
): GraphEdgeProps =>
  ({
    ...createMockEdgeProps(),
    data: { changeStatus },
  }) as unknown as GraphEdgeProps;

// ============================================================================
// Tests
// ============================================================================

describe("LineageEdge", () => {
  const mockGetBezierPath = getBezierPath as Mock;

  it("publishes distinct redundant dash patterns for structural changes", () => {
    expect(STRUCTURAL_EDGE_DASH.added).toBe("0");
    expect(STRUCTURAL_EDGE_DASH.removed).toBe("3 3");
    expect(STRUCTURAL_EDGE_DASH.modified).toBe("8 3 2 3");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBezierPath.mockReturnValue(["M0,0 C100,0 200,100 300,100", 150, 50]);
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders BaseEdge with bezier path", () => {
      const props = createMockEdgeProps();

      render(<LineageEdge {...props} />);

      expect(screen.getByTestId("base-edge")).toBeInTheDocument();
    });

    it("calls getBezierPath with correct coordinates", () => {
      const props = createMockEdgeProps();

      render(<LineageEdge {...props} />);

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
      mockGetBezierPath.mockReturnValue([
        "M10,20 C50,20 100,80 150,80",
        75,
        50,
      ]);
      const props = createMockEdgeProps();

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge).toHaveAttribute("d", "M10,20 C50,20 100,80 150,80");
    });

    it("passes id to BaseEdge", () => {
      const props = createMockEdgeProps({ id: "custom-edge-id" });

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge).toHaveAttribute("data-id", "custom-edge-id");
    });
  });

  // ==========================================================================
  // Change Status Tests
  // ==========================================================================

  describe("change status styling", () => {
    const neutralStroke =
      getSemanticColorTheme(false).structural.neutral.border;

    it.each<EdgeChangeStatus>(["added", "removed", "modified", "unchanged"])(
      "applies neutral stroke and the public %s dash pattern",
      (status) => {
        const props = createMockEdgeProps(
          {},
          { changeStatus: status as EdgeChangeStatus },
        );

        render(<LineageEdge {...props} />);

        const edge = screen.getByTestId("base-edge");
        expect(edge.style.stroke).toBe(neutralStroke);
        expect(edge.style.strokeDasharray).toBe(STRUCTURAL_EDGE_DASH[status]);
      },
    );

    it.each([
      ["added", "Added change"],
      ["removed", "Removed change"],
      ["modified", "Modified change"],
      ["unchanged", "Unchanged change"],
    ] as const)("exposes %s status in its accessible name", (status, name) => {
      render(
        <LineageEdge {...createMockEdgeProps({}, { changeStatus: status })} />,
      );

      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    });

    it("defaults to unchanged status when not provided", () => {
      const props = createMockEdgeProps();

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe(neutralStroke);
      expect(edge.style.strokeDasharray).toBe(STRUCTURAL_EDGE_DASH.unchanged);
    });

    it("defaults to unchanged when data is undefined", () => {
      const props = { ...createMockEdgeProps(), data: undefined };

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe(neutralStroke);
      expect(edge.style.strokeDasharray).toBe(STRUCTURAL_EDGE_DASH.unchanged);
    });
  });

  // ==========================================================================
  // Highlighting Tests
  // ==========================================================================

  describe("highlighting", () => {
    it("applies thick stroke when highlighted", () => {
      const props = createMockEdgeProps({}, { isHighlighted: true });

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.strokeWidth).toBe("2.5");
    });

    it("applies thin stroke when not highlighted", () => {
      const props = createMockEdgeProps({}, { isHighlighted: false });

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.strokeWidth).toBe("1.5");
    });

    it("applies full opacity when highlighted", () => {
      const props = createMockEdgeProps({}, { isHighlighted: true });

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.opacity).toBe("1");
    });

    it("applies reduced opacity when not highlighted", () => {
      const props = createMockEdgeProps({}, { isHighlighted: false });

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.opacity).toBe("0.6");
    });

    it("defaults to not highlighted when not provided", () => {
      const props = createMockEdgeProps();

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.strokeWidth).toBe("1.5");
      expect(edge.style.opacity).toBe("0.6");
    });
  });

  // ==========================================================================
  // Selection Tests
  // ==========================================================================

  describe("selection", () => {
    it("applies thick stroke when selected", () => {
      const props = createMockEdgeProps({ selected: true });

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.strokeWidth).toBe("2.5");
    });

    it("applies full opacity when selected", () => {
      const props = createMockEdgeProps({ selected: true });

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.opacity).toBe("1");
    });
  });

  // ==========================================================================
  // Label Tests
  // ==========================================================================

  describe("label", () => {
    it("renders label when provided", () => {
      const props = createMockEdgeProps({}, { label: "depends on" });

      render(<LineageEdge {...props} />);

      expect(screen.getByText("depends on")).toBeInTheDocument();
    });

    it("does not render EdgeLabelRenderer when no label", () => {
      const props = createMockEdgeProps();

      render(<LineageEdge {...props} />);

      expect(
        screen.queryByTestId("edge-label-renderer"),
      ).not.toBeInTheDocument();
    });

    it("renders EdgeLabelRenderer when label is provided", () => {
      const props = createMockEdgeProps({}, { label: "test label" });

      render(<LineageEdge {...props} />);

      expect(screen.getByTestId("edge-label-renderer")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Memoization Tests
  // ==========================================================================

  describe("memoization", () => {
    it("has displayName set for debugging", () => {
      expect(LineageEdge.displayName).toBe("LineageEdge");
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders highlighted edge with change status and label", () => {
      const props = createMockEdgeProps(
        {},
        {
          changeStatus: "added",
          isHighlighted: true,
          label: "new dependency",
        },
      );

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe(
        getSemanticColorTheme(false).structural.neutral.border,
      );
      expect(edge.style.strokeDasharray).toBe(STRUCTURAL_EDGE_DASH.added);
      expect(edge.style.strokeWidth).toBe("2.5"); // highlighted
      expect(edge.style.opacity).toBe("1"); // highlighted
      expect(screen.getByText("new dependency")).toBeInTheDocument();
    });

    it("renders non-highlighted edge with removed status", () => {
      const props = createMockEdgeProps(
        {},
        {
          changeStatus: "removed",
          isHighlighted: false,
        },
      );

      render(<LineageEdge {...props} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe(
        getSemanticColorTheme(false).structural.neutral.border,
      );
      expect(edge.style.strokeDasharray).toBe(STRUCTURAL_EDGE_DASH.removed);
      expect(edge.style.strokeWidth).toBe("1.5"); // not highlighted
      expect(edge.style.opacity).toBe("0.6"); // not highlighted
    });
  });
});

describe("GraphEdge", () => {
  it.each([
    ["added", "Added change"],
    ["removed", "Removed change"],
    ["modified", "Modified change"],
    ["unchanged", "Unchanged change"],
  ] as const)(
    "uses redundant presentation with an accessible name for %s status",
    (status, name) => {
      render(<GraphEdge {...createMockGraphEdgeProps(status)} />);

      const edge = screen.getByTestId("base-edge");
      expect(edge.style.stroke).toBe("#737373");
      expect(edge.style.strokeDasharray).toBe(STRUCTURAL_EDGE_DASH[status]);
      expect(screen.getByRole("img", { name })).toBe(edge);
    },
  );
});
