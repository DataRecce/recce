/**
 * @file NodeView.test.tsx
 * @description Tests for NodeView component.
 *
 * Verifies that schema content renders correctly for all resource types
 * that support columns, including source nodes where the action buttons
 * row is conditionally absent.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  _columns?: Record<string, NodeColumnData>,
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

function renderNodeViewWithTreatment(
  node: NodeViewNodeData,
  treatment: {
    isBreakingSource?: boolean;
    isWholeModelImpactedDownstream?: boolean;
  },
  columns?: Record<string, NodeColumnData>,
) {
  return render(
    <NodeView
      node={node}
      modelDetail={createModelDetail(columns)}
      onCloseNode={vi.fn()}
      isSingleEnv={false}
      SchemaView={MockSchemaView}
      isBreakingSource={treatment.isBreakingSource ?? false}
      isWholeModelImpactedDownstream={
        treatment.isWholeModelImpactedDownstream ?? false
      }
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
    test("downstream-impact: renders title chip with ! glyph wrapping the model name", () => {
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isWholeModelImpactedDownstream: true },
        testColumns,
      );

      const chip = screen.getByTestId("whole-model-impact-title-chip");
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveTextContent("test_node");
      expect(chip).toHaveTextContent("!");
    });

    test("source: renders title chip with ~ glyph wrapping the model name", () => {
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isBreakingSource: true },
        testColumns,
      );

      const chip = screen.getByTestId("whole-model-source-title-chip");
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveTextContent("test_node");
      expect(chip).toHaveTextContent("~");
    });

    test("downstream-impact: wash + labeled bar are gone; [TABLE] badge sits next to chip", () => {
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isWholeModelImpactedDownstream: true },
        testColumns,
      );

      // Old panel wash and labeled bar are gone.
      expect(
        screen.queryByTestId("whole-model-impact-wash"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impact-header"),
      ).not.toBeInTheDocument();
      // [TABLE] badge is rendered next to the title chip (mirrors the
      // lineage-graph badge so users get the same signal on both surfaces).
      const badge = screen.getByTestId("whole-model-impact-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("TABLE");
      // Tooltip wrapper passes its title down as an aria description.
      expect(badge.closest("[aria-label]")).toBeTruthy();
    });

    test("downstream-impact: badge tooltip reads 'Table-wide impact'", async () => {
      const user = userEvent.setup();
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isWholeModelImpactedDownstream: true },
        testColumns,
      );

      await user.hover(screen.getByTestId("whole-model-impact-badge"));
      expect(
        await screen.findByRole("tooltip", { name: "Table-wide impact" }),
      ).toBeInTheDocument();
    });

    test("source: wash + labeled bar are gone; [TABLE] badge sits next to chip", () => {
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isBreakingSource: true },
        testColumns,
      );

      expect(
        screen.queryByTestId("whole-model-source-wash"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-source-header"),
      ).not.toBeInTheDocument();
      const badge = screen.getByTestId("whole-model-source-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("TABLE");
    });

    test("source: badge tooltip reads 'Table-wide change'", async () => {
      const user = userEvent.setup();
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isBreakingSource: true },
        testColumns,
      );

      await user.hover(screen.getByTestId("whole-model-source-badge"));
      expect(
        await screen.findByRole("tooltip", { name: "Table-wide change" }),
      ).toBeInTheDocument();
    });

    test("source: title chip and badge surface the same tooltip text", async () => {
      const user = userEvent.setup();
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isBreakingSource: true },
        testColumns,
      );

      await user.hover(screen.getByTestId("whole-model-source-title-chip"));
      expect(
        await screen.findByRole("tooltip", { name: "Table-wide change" }),
      ).toBeInTheDocument();
    });

    test("downstream-impact: title chip and badge surface the same tooltip text", async () => {
      const user = userEvent.setup();
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        { isWholeModelImpactedDownstream: true },
        testColumns,
      );

      await user.hover(screen.getByTestId("whole-model-impact-title-chip"));
      expect(
        await screen.findByRole("tooltip", { name: "Table-wide impact" }),
      ).toBeInTheDocument();
    });

    test("no treatment: title chip is absent and plain model name renders", () => {
      renderNodeViewWithTreatment(
        createNode("model", testColumns),
        {},
        testColumns,
      );

      expect(
        screen.queryByTestId("whole-model-impact-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-source-title-chip"),
      ).not.toBeInTheDocument();
      // The fallback branch must still render the model name as plain text.
      expect(screen.getByText("test_node")).toBeInTheDocument();
    });
  });
});
