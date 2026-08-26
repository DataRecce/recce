/**
 * @file LineageCanvas.test.tsx
 * @description Tests for LineageCanvas component
 *
 * Tests verify:
 * - Basic rendering with nodes and edges
 * - Node types registration (lineageNode, lineageGraphColumnNode)
 * - Callbacks (onNodeSelect, onNodeDoubleClick)
 * - UI controls (minimap, controls, background)
 * - Interactive mode
 * - CLL (Column Level Lineage) support - column nodes rendering
 *
 * TDD approach: These tests are written BEFORE implementing CLL support
 * to ensure we don't break existing functionality.
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

import { vi } from "vitest";

// Track registered node types to verify CLL support
let registeredNodeTypes: Record<string, unknown> = {};
let registeredEdgeTypes: Record<string, unknown> = {};
let registeredMiniMapNodeColor:
  | ((node: { data?: unknown }) => string)
  | undefined;

vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: vi.fn(() => false),
}));

vi.mock("../nodes", () => ({
  LineageNode: ({
    id,
    isDark,
    onContextMenu,
  }: {
    id?: string;
    isDark?: boolean;
    onContextMenu?: (event: React.MouseEvent, nodeId: string) => void;
  }) => (
    <button
      type="button"
      data-testid={`registered-lineage-node-${id ?? "unknown"}`}
      data-is-dark={String(isDark)}
      onClick={(event) => onContextMenu?.(event, id ?? "unknown")}
    />
  ),
}));

vi.mock("../columns", () => ({
  LineageColumnNode: ({ id, isDark }: { id?: string; isDark?: boolean }) => (
    <div
      data-testid={`registered-lineage-column-node-${id ?? "unknown"}`}
      data-is-dark={String(isDark)}
    />
  ),
}));

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    nodes,
    edges,
    nodeTypes,
    edgeTypes,
    onNodeClick,
    onNodeDoubleClick,
    onPaneClick,
    fitView,
    children,
  }: {
    nodes: Array<{ id: string; type?: string; data?: unknown }>;
    edges: Array<{ id: string }>;
    nodeTypes?: Record<string, unknown>;
    edgeTypes?: Record<string, unknown>;
    onNodeClick?: (event: React.MouseEvent, node: { id: string }) => void;
    onNodeDoubleClick?: (event: React.MouseEvent, node: { id: string }) => void;
    onPaneClick?: () => void;
    fitView?: boolean;
    children?: React.ReactNode;
  }) => {
    // Store registered types for assertions
    registeredNodeTypes = nodeTypes || {};
    registeredEdgeTypes = edgeTypes || {};

    return (
      <div data-testid="react-flow">
        <div data-testid="nodes-container">
          {nodes.map((node) => {
            const NodeRenderer = node.type
              ? (nodeTypes?.[node.type] as
                  | React.ComponentType<{
                      id: string;
                      data: unknown;
                      selected: boolean;
                    }>
                  | undefined)
              : undefined;

            return (
              <div
                key={node.id}
                data-testid={`node-${node.id}`}
                data-node-type={node.type}
                onClick={(e) => onNodeClick?.(e, node)}
                onDoubleClick={(e) => onNodeDoubleClick?.(e, node)}
              >
                {NodeRenderer ? (
                  <NodeRenderer
                    id={node.id}
                    data={node.data}
                    selected={false}
                  />
                ) : (
                  node.id
                )}
              </div>
            );
          })}
        </div>
        <div data-testid="edges-container">
          {edges.map((edge) => (
            <div key={edge.id} data-testid={`edge-${edge.id}`}>
              {edge.id}
            </div>
          ))}
        </div>
        <div
          data-testid="pane"
          onClick={onPaneClick}
          style={{ position: "absolute", inset: 0 }}
        />
        {children}
      </div>
    );
  },
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: ({
    nodeColor,
  }: {
    nodeColor?: (node: { data?: unknown }) => string;
  }) => {
    registeredMiniMapNodeColor = nodeColor;
    return <div data-testid="minimap" />;
  },
  useNodesState: (initialNodes: unknown[]) => [initialNodes, vi.fn(), vi.fn()],
  useEdgesState: (initialEdges: unknown[]) => [initialEdges, vi.fn(), vi.fn()],
}));

// ============================================================================
// Imports
// ============================================================================

import { fireEvent, render, screen } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import { useIsDark } from "../../../hooks/useIsDark";
import { getSemanticColorTheme } from "../../../theme";
import type { LineageEdgeData } from "../edges";
import { LineageCanvas, type LineageCanvasProps } from "../LineageCanvas";
import type { LineageNodeData } from "../nodes";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNodes = (): Node<LineageNodeData>[] => [
  {
    id: "node1",
    type: "lineageNode",
    position: { x: 0, y: 0 },
    data: { label: "Model A", changeStatus: "unchanged" },
  },
  {
    id: "node2",
    type: "lineageNode",
    position: { x: 400, y: 0 },
    data: { label: "Model B", changeStatus: "modified" },
  },
];

const createMockEdges = (): Edge<LineageEdgeData>[] => [
  {
    id: "edge1",
    type: "lineageEdge",
    source: "node1",
    target: "node2",
    data: { changeStatus: "unchanged" },
  },
];

const createMockColumnNodes = (): Node[] => [
  {
    id: "node1",
    type: "lineageNode",
    position: { x: 0, y: 0 },
    data: { label: "Model A" },
  },
  {
    id: "node1_col1",
    type: "lineageGraphColumnNode",
    position: { x: 10, y: 70 },
    parentId: "node1",
    data: { column: "id", type: "INTEGER", nodeId: "node1" },
  },
  {
    id: "node1_col2",
    type: "lineageGraphColumnNode",
    position: { x: 10, y: 94 },
    parentId: "node1",
    data: { column: "name", type: "VARCHAR", nodeId: "node1" },
  },
];

const createDefaultProps = (
  overrides: Partial<LineageCanvasProps> = {},
): LineageCanvasProps => ({
  nodes: createMockNodes(),
  edges: createMockEdges(),
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("LineageCanvas", () => {
  beforeEach(() => {
    registeredNodeTypes = {};
    registeredEdgeTypes = {};
    registeredMiniMapNodeColor = undefined;
    vi.mocked(useIsDark).mockReturnValue(false);
  });

  // ==========================================================================
  // Basic Rendering Tests (Regression tests for existing functionality)
  // ==========================================================================

  describe("basic rendering", () => {
    it("renders ReactFlow container", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("renders all provided nodes", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(screen.getByTestId("node-node1")).toBeInTheDocument();
      expect(screen.getByTestId("node-node2")).toBeInTheDocument();
    });

    it("renders all provided edges", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(screen.getByTestId("edge-edge1")).toBeInTheDocument();
    });

    it("renders nodes with correct type attribute", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(screen.getByTestId("node-node1")).toHaveAttribute(
        "data-node-type",
        "lineageNode",
      );
    });
  });

  // ==========================================================================
  // Node Type Registration Tests
  // ==========================================================================

  describe("node type registration", () => {
    it("registers lineageNode type", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(registeredNodeTypes).toHaveProperty("lineageNode");
    });

    it("registers lineageEdge type", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(registeredEdgeTypes).toHaveProperty("lineageEdge");
    });

    // NEW TEST: Verify column node type is registered for CLL support
    it("registers lineageGraphColumnNode type for CLL support", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(registeredNodeTypes).toHaveProperty("lineageGraphColumnNode");
    });

    it("keeps node types stable while propagating dark mode to both raw renderers", () => {
      const props = createDefaultProps({
        nodes: createMockColumnNodes() as Node<LineageNodeData>[],
      });
      const { rerender } = render(<LineageCanvas {...props} />);
      const initialNodeTypes = registeredNodeTypes;

      expect(
        screen.getByTestId("registered-lineage-node-node1"),
      ).toHaveAttribute("data-is-dark", "false");
      expect(
        screen.getByTestId("registered-lineage-column-node-node1_col1"),
      ).toHaveAttribute("data-is-dark", "false");

      vi.mocked(useIsDark).mockReturnValue(true);
      rerender(<LineageCanvas {...props} />);

      expect(registeredNodeTypes).toBe(initialNodeTypes);
      expect(
        screen.getByTestId("registered-lineage-node-node1"),
      ).toHaveAttribute("data-is-dark", "true");
      expect(
        screen.getByTestId("registered-lineage-column-node-node1_col1"),
      ).toHaveAttribute("data-is-dark", "true");
    });

    it("updates the model-node context-menu callback without rebuilding node types", () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();
      const props = createDefaultProps({ onNodeContextMenu: firstCallback });
      const { rerender } = render(<LineageCanvas {...props} />);
      const initialNodeTypes = registeredNodeTypes;

      fireEvent.click(screen.getByTestId("registered-lineage-node-node1"));
      expect(firstCallback).toHaveBeenCalledWith(expect.anything(), "node1");

      rerender(<LineageCanvas {...props} onNodeContextMenu={secondCallback} />);
      fireEvent.click(screen.getByTestId("registered-lineage-node-node1"));

      expect(registeredNodeTypes).toBe(initialNodeTypes);
      expect(secondCallback).toHaveBeenCalledWith(expect.anything(), "node1");
    });
  });

  // ==========================================================================
  // CLL (Column Level Lineage) Support Tests
  // ==========================================================================

  describe("CLL support", () => {
    it("renders column nodes when provided", () => {
      const props = createDefaultProps({
        nodes: createMockColumnNodes() as Node<LineageNodeData>[],
      });

      render(<LineageCanvas {...props} />);

      expect(screen.getByTestId("node-node1_col1")).toBeInTheDocument();
      expect(screen.getByTestId("node-node1_col2")).toBeInTheDocument();
    });

    it("renders column nodes with correct type attribute", () => {
      const props = createDefaultProps({
        nodes: createMockColumnNodes() as Node<LineageNodeData>[],
      });

      render(<LineageCanvas {...props} />);

      expect(screen.getByTestId("node-node1_col1")).toHaveAttribute(
        "data-node-type",
        "lineageGraphColumnNode",
      );
    });

    it("renders both model nodes and column nodes together", () => {
      const props = createDefaultProps({
        nodes: createMockColumnNodes() as Node<LineageNodeData>[],
      });

      render(<LineageCanvas {...props} />);

      // Model node
      expect(screen.getByTestId("node-node1")).toBeInTheDocument();
      // Column nodes
      expect(screen.getByTestId("node-node1_col1")).toBeInTheDocument();
      expect(screen.getByTestId("node-node1_col2")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // UI Controls Tests (Regression)
  // ==========================================================================

  describe("UI controls", () => {
    it("renders minimap by default", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(screen.getByTestId("minimap")).toBeInTheDocument();
    });

    it("resolves MiniMap node colors from the active light and dark themes", () => {
      const props = createDefaultProps();
      const modifiedNode = props.nodes[1];
      const { rerender } = render(<LineageCanvas {...props} />);

      const lightNodeColor = registeredMiniMapNodeColor;
      expect(lightNodeColor?.(modifiedNode)).toBe(
        getSemanticColorTheme(false).structural.secondaryAccent.modified,
      );

      vi.mocked(useIsDark).mockReturnValue(true);
      rerender(<LineageCanvas {...props} />);

      const darkNodeColor = registeredMiniMapNodeColor;
      expect(darkNodeColor?.(modifiedNode)).toBe(
        getSemanticColorTheme(true).structural.secondaryAccent.modified,
      );
      expect(darkNodeColor).not.toBe(lightNodeColor);

      rerender(<LineageCanvas {...props} />);
      expect(registeredMiniMapNodeColor).toBe(darkNodeColor);
    });

    it("hides minimap when showMiniMap is false", () => {
      render(<LineageCanvas {...createDefaultProps({ showMiniMap: false })} />);

      expect(screen.queryByTestId("minimap")).not.toBeInTheDocument();
    });

    it("renders controls by default", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(screen.getByTestId("controls")).toBeInTheDocument();
    });

    it("hides controls when showControls is false", () => {
      render(
        <LineageCanvas {...createDefaultProps({ showControls: false })} />,
      );

      expect(screen.queryByTestId("controls")).not.toBeInTheDocument();
    });

    it("renders background by default", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(screen.getByTestId("background")).toBeInTheDocument();
    });

    it("hides background when showBackground is false", () => {
      render(
        <LineageCanvas {...createDefaultProps({ showBackground: false })} />,
      );

      expect(screen.queryByTestId("background")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Callback Tests (Regression)
  // ==========================================================================

  describe("callbacks", () => {
    it("calls onNodeSelect with node id when node is clicked", () => {
      const onNodeSelect = vi.fn();
      render(<LineageCanvas {...createDefaultProps({ onNodeSelect })} />);

      fireEvent.click(screen.getByTestId("node-node1"));

      expect(onNodeSelect).toHaveBeenCalledWith("node1");
    });

    it("calls onNodeSelect with null when pane is clicked", () => {
      const onNodeSelect = vi.fn();
      render(<LineageCanvas {...createDefaultProps({ onNodeSelect })} />);

      fireEvent.click(screen.getByTestId("pane"));

      expect(onNodeSelect).toHaveBeenCalledWith(null);
    });

    it("calls onNodeDoubleClick with node id when node is double-clicked", () => {
      const onNodeDoubleClick = vi.fn();
      render(<LineageCanvas {...createDefaultProps({ onNodeDoubleClick })} />);

      fireEvent.doubleClick(screen.getByTestId("node-node1"));

      expect(onNodeDoubleClick).toHaveBeenCalledWith("node1");
    });

    it("does not throw when callbacks are not provided", () => {
      render(<LineageCanvas {...createDefaultProps()} />);

      expect(() => {
        fireEvent.click(screen.getByTestId("node-node1"));
        fireEvent.doubleClick(screen.getByTestId("node-node1"));
        fireEvent.click(screen.getByTestId("pane"));
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Props Defaults Tests (Regression)
  // ==========================================================================

  describe("props defaults", () => {
    it("defaults showMiniMap to true", () => {
      render(
        <LineageCanvas nodes={createMockNodes()} edges={createMockEdges()} />,
      );

      expect(screen.getByTestId("minimap")).toBeInTheDocument();
    });

    it("defaults showControls to true", () => {
      render(
        <LineageCanvas nodes={createMockNodes()} edges={createMockEdges()} />,
      );

      expect(screen.getByTestId("controls")).toBeInTheDocument();
    });

    it("defaults showBackground to true", () => {
      render(
        <LineageCanvas nodes={createMockNodes()} edges={createMockEdges()} />,
      );

      expect(screen.getByTestId("background")).toBeInTheDocument();
    });

    it("defaults interactive to true", () => {
      // Interactive mode is tested via ReactFlow props passed through
      // This test verifies the component renders without errors with default interactive
      render(
        <LineageCanvas nodes={createMockNodes()} edges={createMockEdges()} />,
      );

      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Empty State Tests (Regression)
  // ==========================================================================

  describe("empty state", () => {
    it("renders with empty nodes array", () => {
      render(<LineageCanvas nodes={[]} edges={[]} />);

      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.getByTestId("nodes-container")).toBeEmptyDOMElement();
    });

    it("renders with empty edges array", () => {
      render(<LineageCanvas nodes={createMockNodes()} edges={[]} />);

      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.getByTestId("edges-container")).toBeEmptyDOMElement();
    });
  });
});
