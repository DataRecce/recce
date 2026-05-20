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
    },
  };
}

function createModelDetail(columns?: Record<string, NodeColumnData>) {
  if (!columns) return undefined;
  return {
    base: {
      id: "test.node",
      unique_id: "test.node",
      name: "test_node",
      columns,
    },
    current: {
      id: "test.node",
      unique_id: "test.node",
      name: "test_node",
      columns,
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

function renderNodeView(
  node: NodeViewNodeData,
  columns?: Record<string, NodeColumnData>,
) {
  return render(
    <NodeView
      node={node}
      modelDetail={createModelDetail(columns)}
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
      renderNodeView(createNode("source", testColumns), testColumns);

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
      expect(screen.getByTestId("column-ID")).toBeInTheDocument();
      expect(screen.getByTestId("column-NAME")).toBeInTheDocument();
    });
  });

  describe("schema display for other resource types", () => {
    test("renders column schema for model nodes", () => {
      renderNodeView(createNode("model", testColumns), testColumns);

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
      expect(screen.getByTestId("column-ID")).toBeInTheDocument();
    });

    test("renders column schema for seed nodes", () => {
      renderNodeView(createNode("seed", testColumns), testColumns);

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
    });

    test("renders column schema for snapshot nodes", () => {
      renderNodeView(createNode("snapshot", testColumns), testColumns);

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
    });

    test("does not render schema view for exposure nodes", () => {
      renderNodeView(createNode("exposure"));

      expect(screen.queryByTestId("schema-view")).not.toBeInTheDocument();
    });
  });

  describe("whole-model treatment", () => {
    test("renders the changed title chip (no inline badge) when isWholeModelChanged is true and wholeModelImpact is on", () => {
      render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelChanged
          wholeModelImpact
        />,
      );
      expect(
        screen.getByTestId("whole-model-changed-title-chip"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-changed-badge"),
      ).not.toBeInTheDocument();
    });

    test("renders the impacted title chip (no inline badge) when isWholeModelImpacted is true and wholeModelImpact is on", () => {
      render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelImpacted
          wholeModelImpact
        />,
      );
      expect(
        screen.getByTestId("whole-model-impacted-title-chip"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-badge"),
      ).not.toBeInTheDocument();
    });

    test("changed-wins: renders the changed title chip (no badge) when both flags are true (Q11)", () => {
      render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelChanged
          isWholeModelImpacted
          wholeModelImpact
        />,
      );
      expect(
        screen.getByTestId("whole-model-changed-title-chip"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-changed-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-badge"),
      ).not.toBeInTheDocument();
    });

    test("renders no whole-model surfaces when neither flag is set", () => {
      render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          wholeModelImpact
        />,
      );
      expect(
        screen.queryByTestId("whole-model-changed-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-changed-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-badge"),
      ).not.toBeInTheDocument();
    });

    test("renders no NodeView treatment for additive (non_breaking) — additive is per-column, not whole-table", () => {
      render(
        <NodeView
          node={{
            id: "model.test.additive",
            data: {
              name: "additive_model",
              resourceType: "model",
              change: { category: "non_breaking" },
            },
          }}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          wholeModelImpact
        />,
      );
      expect(
        screen.queryByTestId("whole-model-additive-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-additive-badge"),
      ).not.toBeInTheDocument();
    });

    test("renders no whole-model surfaces when wholeModelImpact is off, even if flags are set", () => {
      render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelChanged
          isWholeModelImpacted
        />,
      );
      expect(
        screen.queryByTestId("whole-model-changed-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-changed-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-badge"),
      ).not.toBeInTheDocument();
    });
  });

  describe("default landing tab", () => {
    // DRC-3468: Columns must be the default tab even when lineageTabContent
    // is provided. Without this assertion, a regression that re-inverts the
    // tab indices would pass — existing tests only exercise the 2-tab branch.
    test("lands on Columns (not Lineage) when lineageTabContent is provided", () => {
      render(
        <NodeView
          node={createNode("model", testColumns)}
          modelDetail={createModelDetail(testColumns)}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          SchemaView={MockSchemaView}
          lineageTabContent={<div data-testid="lineage-content">lineage</div>}
        />,
      );

      expect(screen.getByTestId("schema-view")).toBeInTheDocument();
      expect(screen.queryByTestId("lineage-content")).not.toBeInTheDocument();
    });
  });
});
