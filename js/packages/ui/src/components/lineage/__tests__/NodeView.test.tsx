/**
 * @file NodeView.test.tsx
 * @description Tests for NodeView component.
 *
 * Verifies that schema content renders correctly for all resource types
 * that support columns, including source nodes where the action buttons
 * row is conditionally absent.
 */

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { NodeColumnData } from "../../../api";
import type { NodeViewNodeData } from "../NodeView";
import { NodeView } from "../NodeView";

// ============================================================================
// Test Fixtures
// ============================================================================

const testColumns: Record<string, NodeColumnData> = {
  ID: { name: "ID", type: "NUMBER" },
  NAME: { name: "NAME", type: "TEXT" },
};

function createNode(
  resourceType: string,
  columns?: Record<string, NodeColumnData>,
): NodeViewNodeData {
  return {
    id: `${resourceType}.test.node`,
    data: {
      name: "test_node",
      resourceType,
      from: "both",
      data: {
        base: columns ? { columns } : undefined,
        current: columns ? { columns } : undefined,
      },
    },
  };
}

/**
 * Mock SchemaView that renders column names as testable elements.
 */
function MockSchemaView({
  base,
  current,
}: {
  base?: { columns?: Record<string, NodeColumnData | undefined> };
  current?: { columns?: Record<string, NodeColumnData | undefined> };
}) {
  const cols = current?.columns ?? base?.columns ?? {};
  return (
    <div data-testid="schema-view">
      {Object.keys(cols).map((name) => (
        <span key={name} data-testid={`column-${name}`}>
          {name}
        </span>
      ))}
    </div>
  );
}

function renderNodeView(node: NodeViewNodeData) {
  return render(
    <NodeView
      node={node}
      onCloseNode={vi.fn()}
      isSingleEnv={false}
      SchemaView={MockSchemaView}
    />,
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("NodeView", () => {
  describe("source node schema display", () => {
    test("renders column schema for source nodes", () => {
      renderNodeView(createNode("source", testColumns));

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
      expect(screen.getByTestId("column-ID")).toBeInTheDocument();
      expect(screen.getByTestId("column-NAME")).toBeInTheDocument();
    });
  });

  describe("schema display for other resource types", () => {
    test("renders column schema for model nodes", () => {
      renderNodeView(createNode("model", testColumns));

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
      expect(screen.getByTestId("column-ID")).toBeInTheDocument();
    });

    test("renders column schema for seed nodes", () => {
      renderNodeView(createNode("seed", testColumns));

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
    });

    test("renders column schema for snapshot nodes", () => {
      renderNodeView(createNode("snapshot", testColumns));

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
    });

    test("does not render schema view for exposure nodes", () => {
      renderNodeView(createNode("exposure"));

      expect(screen.queryByTestId("schema-view")).not.toBeInTheDocument();
    });
  });
});
