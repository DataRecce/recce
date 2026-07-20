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
 * Mock SchemaView that renders column names AND the optional `headerAction`
 * slot, so tests can assert the diff-mode "Add schema diff" button is wired.
 */
function MockSchemaView({
  base,
  current,
  headerAction,
}: {
  base?: { columns?: Record<string, NodeColumnData | undefined> };
  current?: { columns?: Record<string, NodeColumnData | undefined> };
  headerAction?: React.ReactNode;
}) {
  const cols = current?.columns ?? base?.columns ?? {};
  return (
    <div data-testid="schema-view">
      {headerAction != null && (
        <div data-testid="schema-header-action">{headerAction}</div>
      )}
      {Object.keys(cols).map((name) => (
        <span key={name} data-testid={`column-${name}`}>
          {name}
        </span>
      ))}
    </div>
  );
}

function MockSingleEnvSchemaView({
  current,
}: {
  current?: { columns?: Record<string, NodeColumnData | undefined> };
}) {
  const cols = current?.columns ?? {};
  return (
    <div data-testid="single-env-schema-view">
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
  overrides: Partial<React.ComponentProps<typeof NodeView>> = {},
) {
  return render(
    <NodeView
      node={node}
      modelDetail={createModelDetail(columns)}
      onCloseNode={vi.fn()}
      isSingleEnv={false}
      SchemaView={MockSchemaView}
      SingleEnvSchemaView={MockSingleEnvSchemaView}
      {...overrides}
    />,
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("NodeView", () => {
  describe("change category", () => {
    test.each([
      ["breaking", "Model-Wide Change"], // wire-enum-ok
      ["partial_breaking", "Column Change"], // wire-enum-ok
      ["non_breaking", "Additive Change"], // wire-enum-ok
      ["unknown", "Unknown"],
    ])("renders the %s category chip", (category, label) => {
      const node = createNode("model");
      node.data.change = { category };

      renderNodeView(node);

      expect(screen.getByText(label)).toBeInTheDocument();
    });

    test("does not render a category chip without category data", () => {
      renderNodeView(createNode("model"));

      expect(
        screen.queryByTestId("change-category-chip"),
      ).not.toBeInTheDocument();
    });

    test("leaves category treatment to the new CLL experience", () => {
      const node = createNode("model");
      node.data.change = { category: "unknown" };

      renderNodeView(node, undefined, { newCllExperience: true });

      expect(
        screen.queryByTestId("change-category-chip"),
      ).not.toBeInTheDocument();
    });
  });

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
    // NodeView signals whole-model kinds via a title chip + left stripe and
    // never renders a graph badge of any kind. The structural badge check
    // (`[data-testid$="-badge"]` returns 0) catches a regression that
    // re-introduces a badge surface under any naming.
    test("renders the changed title chip (no inline badge) when isWholeModelChanged is true and newCllExperience is on", () => {
      const { container } = render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelChanged
          newCllExperience
        />,
      );
      expect(
        screen.getByTestId("whole-model-changed-title-chip"),
      ).toBeInTheDocument();
      expect(
        container.querySelectorAll('[data-testid$="-badge"]'),
      ).toHaveLength(0);
    });

    test("renders the impacted title chip (no inline badge) when isWholeModelImpacted is true and newCllExperience is on", () => {
      const { container } = render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelImpacted
          newCllExperience
        />,
      );
      expect(
        screen.getByTestId("whole-model-impacted-title-chip"),
      ).toBeInTheDocument();
      expect(
        container.querySelectorAll('[data-testid$="-badge"]'),
      ).toHaveLength(0);
    });

    test("changed-wins: renders the changed title chip (no badge) when both flags are true (Q11)", () => {
      const { container } = render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelChanged
          isWholeModelImpacted
          newCllExperience
        />,
      );
      expect(
        screen.getByTestId("whole-model-changed-title-chip"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("whole-model-impacted-title-chip"),
      ).not.toBeInTheDocument();
      expect(
        container.querySelectorAll('[data-testid$="-badge"]'),
      ).toHaveLength(0);
    });

    test("renders no whole-model surfaces when neither flag is set", () => {
      const { container } = render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          newCllExperience
        />,
      );
      expect(
        container.querySelectorAll('[data-testid$="-title-chip"]'),
      ).toHaveLength(0);
      expect(
        container.querySelectorAll('[data-testid$="-badge"]'),
      ).toHaveLength(0);
    });

    test("renders no NodeView treatment for additive (non_breaking) — additive is per-column, not whole-table", () => {
      const { container } = render(
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
          newCllExperience
        />,
      );
      expect(
        container.querySelectorAll('[data-testid$="-title-chip"]'),
      ).toHaveLength(0);
      expect(
        container.querySelectorAll('[data-testid$="-badge"]'),
      ).toHaveLength(0);
    });

    test("renders no whole-model surfaces when newCllExperience is off, even if flags are set", () => {
      const { container } = render(
        <NodeView
          node={createNode("model")}
          onCloseNode={vi.fn()}
          isSingleEnv={false}
          isWholeModelChanged
          isWholeModelImpacted
        />,
      );
      expect(
        container.querySelectorAll('[data-testid$="-title-chip"]'),
      ).toHaveLength(0);
      expect(
        container.querySelectorAll('[data-testid$="-badge"]'),
      ).toHaveLength(0);
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

  describe("Sandbox removal regression guard", () => {
    test("does not render a Sandbox button anywhere in the node view", () => {
      renderNodeView(createNode("model", testColumns), testColumns);

      expect(
        screen.queryByRole("button", { name: /sandbox/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/sandbox/i)).not.toBeInTheDocument();
    });
  });

  describe("'Add schema diff to checklist' placement", () => {
    test("renders headerAction in diff mode when onAddSchemaDiffClick is provided", () => {
      renderNodeView(createNode("model", testColumns), testColumns, {
        actionCallbacks: { onAddSchemaDiffClick: vi.fn() },
      });

      expect(screen.getByTestId("schema-header-action")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add schema diff to checklist/i }),
      ).toBeInTheDocument();
    });

    test("does not render headerAction in single-env mode", () => {
      renderNodeView(createNode("model", testColumns), testColumns, {
        isSingleEnv: true,
        actionCallbacks: { onAddSchemaDiffClick: vi.fn() },
      });

      expect(
        screen.queryByTestId("schema-header-action"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /add schema diff to checklist/i }),
      ).not.toBeInTheDocument();
    });
  });
});
