/**
 * @file NodeView.test.tsx
 * @description Tests for NodeView component.
 *
 * Verifies that schema content renders correctly for all resource types
 * that support columns, including source nodes where the action buttons
 * row is conditionally absent.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import type { NodeColumnData } from "../../../api";
import type { NodeDetailsOpenRequest } from "../../../contexts";
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
  describe("diff-mode information architecture", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-26T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("keeps only Row Count in the header and hides analysis launchers until the Analysis tab opens", async () => {
      renderNodeView(createNode("model", testColumns), testColumns, {
        rowCountDisplay: <span>999 rows · No Change</span>,
      });

      expect(
        screen.getByRole("button", { name: /row count.*999 rows/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^profile$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^value$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^top-k$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^histogram$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^query$/i })).toBeNull();

      fireEvent.click(screen.getByRole("tab", { name: "Analysis" }));

      expect(screen.getByRole("button", { name: /^profile$/i })).toBeVisible();
      expect(screen.getByRole("button", { name: /^value$/i })).toBeVisible();
      expect(screen.getByRole("button", { name: /^top-k$/i })).toBeVisible();
      expect(
        screen.getByRole("button", { name: /^histogram$/i }),
      ).toBeVisible();
      expect(screen.queryByRole("button", { name: /^query$/i })).toBeNull();
    });

    test("launches all four analysis actions from always-visible buttons", async () => {
      const callbacks = {
        onProfileDiffClick: vi.fn(),
        onValueDiffClick: vi.fn(),
        onTopKDiffClick: vi.fn(),
        onHistogramDiffClick: vi.fn(),
      };
      renderNodeView(createNode("model", testColumns), testColumns, {
        actionCallbacks: callbacks,
      });

      fireEvent.click(screen.getByRole("tab", { name: "Analysis" }));
      fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^value$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^top-k$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^histogram$/i }));

      expect(callbacks.onProfileDiffClick).toHaveBeenCalledOnce();
      expect(callbacks.onValueDiffClick).toHaveBeenCalledOnce();
      expect(callbacks.onTopKDiffClick).toHaveBeenCalledOnce();
      expect(callbacks.onHistogramDiffClick).toHaveBeenCalledOnce();
    });

    test("renders a flat Recent list with column context and reopens a selected result", async () => {
      const onViewAnalysisRun = vi.fn();
      renderNodeView(createNode("model", testColumns), testColumns, {
        recentAnalysisRuns: [
          {
            id: "profile-1",
            type: "profile_diff",
            runAt: "2026-08-23T12:00:00Z",
          },
          {
            id: "histogram-1",
            type: "histogram_diff",
            columnName: "STATUS",
            runAt: "2026-08-26T11:00:00Z",
          },
        ],
        onViewAnalysisRun,
      });

      fireEvent.click(screen.getByRole("tab", { name: "Analysis" }));

      expect(screen.getByText("Recent")).toBeInTheDocument();
      expect(screen.getAllByText("Profile")).toHaveLength(2);
      expect(screen.getByText(/Histogram.*STATUS/)).toBeInTheDocument();
      expect(screen.getByText("3 days ago")).toBeInTheDocument();
      expect(screen.getByText("about 1 hour ago")).toBeInTheDocument();

      const viewButtons = screen.getAllByRole("button", { name: /view/i });
      expect(viewButtons).toHaveLength(2);
      expect(viewButtons[0]).toHaveAccessibleName("View Profile result");
      expect(viewButtons[1]).toHaveAccessibleName(
        "View Histogram result for STATUS",
      );
      fireEvent.click(viewButtons[1]);
      expect(onViewAnalysisRun).toHaveBeenCalledWith("histogram-1");
    });

    test("shows an explicit empty state when the focused model has no recent analysis", async () => {
      renderNodeView(createNode("model", testColumns), testColumns, {
        recentAnalysisRuns: [],
      });

      fireEvent.click(screen.getByRole("tab", { name: "Analysis" }));

      expect(screen.getByText("No recent analysis runs")).toBeInTheDocument();
    });

    test("moves Query into the Code tab without changing its callback", async () => {
      const onQueryDiffClick = vi.fn();
      renderNodeView(createNode("model", testColumns), testColumns, {
        actionCallbacks: { onQueryDiffClick },
        NodeSqlView: () => <div>SQL diff</div>,
      });

      expect(screen.queryByRole("button", { name: /^query$/i })).toBeNull();
      fireEvent.click(screen.getByRole("tab", { name: "Code" }));
      fireEvent.click(screen.getByRole("button", { name: /^query$/i }));

      expect(onQueryDiffClick).toHaveBeenCalledOnce();
      expect(screen.getByText("SQL diff")).toBeInTheDocument();
    });

    test("keeps Columns first and appends Analysis before optional Lineage", () => {
      renderNodeView(createNode("model", testColumns), testColumns, {
        lineageTabContent: <div>lineage</div>,
      });

      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Columns",
        "Code",
        "Analysis",
        "Lineage",
      ]);
      expect(screen.getByRole("tab", { name: "Columns" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    test("honors repeated explicit Analysis requests for the same focused node", () => {
      const node = createNode("model", testColumns);
      const sharedProps = {
        node,
        modelDetail: createModelDetail(testColumns),
        onCloseNode: vi.fn(),
        isSingleEnv: false,
        SchemaView: MockSchemaView,
      };
      const { rerender } = render(
        <NodeView
          {...sharedProps}
          openRequest={{
            nodeId: node.id,
            view: "analysis",
            requestToken: 1,
          }}
        />,
      );

      expect(screen.getByRole("tab", { name: "Analysis" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      fireEvent.click(screen.getByRole("tab", { name: "Columns" }));
      expect(screen.getByRole("tab", { name: "Columns" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      rerender(
        <NodeView
          {...sharedProps}
          openRequest={{
            nodeId: node.id,
            view: "analysis",
            requestToken: 2,
          }}
        />,
      );

      expect(screen.getByRole("tab", { name: "Analysis" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    test("consumes an Analysis request so remounting cannot replay it while later activations still work", () => {
      const node = createNode("model", testColumns);

      function RequestHarness() {
        const [mounted, setMounted] = useState(true);
        const [nextToken, setNextToken] = useState(1);
        const [request, setRequest] = useState<
          NodeDetailsOpenRequest | undefined
        >({ nodeId: node.id, view: "analysis", requestToken: 1 });

        return (
          <>
            <button type="button" onClick={() => setMounted((value) => !value)}>
              {mounted ? "Unmount details" : "Remount details"}
            </button>
            <button
              type="button"
              onClick={() => {
                const requestToken = nextToken + 1;
                setNextToken(requestToken);
                setRequest({
                  nodeId: node.id,
                  view: "analysis",
                  requestToken,
                });
              }}
            >
              Request Analysis
            </button>
            {mounted && (
              <NodeView
                node={node}
                modelDetail={createModelDetail(testColumns)}
                onCloseNode={vi.fn()}
                isSingleEnv={false}
                SchemaView={MockSchemaView}
                openRequest={request}
                onOpenRequestConsumed={(requestToken) =>
                  setRequest((current) =>
                    current?.requestToken === requestToken
                      ? undefined
                      : current,
                  )
                }
              />
            )}
          </>
        );
      }

      render(<RequestHarness />);
      expect(screen.getByRole("tab", { name: "Analysis" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      fireEvent.click(screen.getByRole("tab", { name: "Columns" }));
      fireEvent.click(screen.getByRole("button", { name: "Unmount details" }));
      fireEvent.click(screen.getByRole("button", { name: "Remount details" }));

      expect(screen.getByRole("tab", { name: "Columns" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      fireEvent.click(screen.getByRole("button", { name: "Request Analysis" }));
      expect(screen.getByRole("tab", { name: "Analysis" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      fireEvent.click(screen.getByRole("tab", { name: "Columns" }));
      fireEvent.click(screen.getByRole("button", { name: "Request Analysis" }));
      expect(screen.getByRole("tab", { name: "Analysis" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    test("ignores an Analysis request addressed to a different node", () => {
      const node = createNode("model", testColumns);
      renderNodeView(node, testColumns, {
        openRequest: {
          nodeId: "model.test.somewhere_else",
          view: "analysis",
          requestToken: 1,
        },
      });

      expect(screen.getByRole("tab", { name: "Columns" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    test.each(["Analysis", "Lineage"])(
      "resets to Columns when focus moves from the %s tab to a source node",
      (selectedTab) => {
        const sharedProps = {
          onCloseNode: vi.fn(),
          isSingleEnv: false,
          SchemaView: MockSchemaView,
          lineageTabContent: <div data-testid="lineage-content">lineage</div>,
        };
        const { rerender } = render(
          <NodeView
            {...sharedProps}
            node={createNode("model", testColumns)}
            modelDetail={createModelDetail(testColumns)}
          />,
        );
        fireEvent.click(screen.getByRole("tab", { name: selectedTab }));

        rerender(
          <NodeView
            {...sharedProps}
            node={{
              ...createNode("source", testColumns),
              id: "source.test.next_node",
            }}
            modelDetail={createModelDetail(testColumns)}
          />,
        );

        expect(screen.getByRole("tab", { name: "Columns" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        expect(screen.getByTestId("schema-view")).toBeInTheDocument();
        expect(screen.queryByTestId("lineage-content")).toBeNull();
      },
    );
  });

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

  describe("disabled action tooltips", () => {
    /**
     * Profiling an added or a removed model has nothing to compare against, so
     * the action button is disabled and has to say why on hover. The button is
     * wrapped in a span precisely because a disabled button fires no pointer
     * events — hover the wrapper, as the user's cursor does.
     */
    async function hoverDisabledReason(buttonName: RegExp) {
      const user = userEvent.setup();
      const button = screen.getByRole("button", { name: buttonName });
      const wrapper = button.parentElement;
      if (wrapper == null) throw new Error("action button has no hover target");
      await user.hover(wrapper);
      return { button, wrapper };
    }

    test.each(["added", "removed"])(
      "explains why Profile is unavailable for a %s model in diff mode",
      async (changeStatus) => {
        const node = createNode("model", testColumns);
        node.data.changeStatus = changeStatus;

        renderNodeView(node, testColumns);
        await userEvent.click(screen.getByRole("tab", { name: "Analysis" }));

        const { button } = await hoverDisabledReason(/^profile$/i);

        expect(button).toBeDisabled();
        expect(await screen.findByRole("tooltip")).toHaveTextContent(
          "Unavailable for added or removed resources.",
        );
      },
    );

    test("explains why Profile is unavailable for an added model in single-env mode", async () => {
      const node = createNode("model", testColumns);
      node.data.changeStatus = "added";

      renderNodeView(node, testColumns, { isSingleEnv: true });

      const { button } = await hoverDisabledReason(/^profile$/i);

      expect(button).toBeDisabled();
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "Unavailable for added or removed resources.",
      );
    });

    test("reports an unsupported action instead when the model itself is diffable", async () => {
      const node = createNode("model", testColumns);
      node.data.changeStatus = "modified";

      renderNodeView(node, testColumns, {
        isActionAvailable: (runType) => runType !== "value_diff",
      });

      await userEvent.click(screen.getByRole("tab", { name: "Analysis" }));

      await hoverDisabledReason(/^value$/i);

      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "This action is not supported yet.",
      );
    });

    test("does not launch Histogram while database queries are disabled", async () => {
      const onHistogramDiffClick = vi.fn();
      renderNodeView(createNode("model", testColumns), testColumns, {
        featureToggles: { disableDatabaseQuery: true },
        actionCallbacks: { onHistogramDiffClick },
      });

      await userEvent.click(screen.getByRole("tab", { name: "Analysis" }));

      const histogram = screen.getByRole("button", { name: /histogram/i });
      expect(histogram).toBeDisabled();
      expect(onHistogramDiffClick).not.toHaveBeenCalled();
    });

    test("shows no reason on an action that is available", async () => {
      const node = createNode("model", testColumns);
      node.data.changeStatus = "modified";

      renderNodeView(node, testColumns);

      await userEvent.click(screen.getByRole("tab", { name: "Analysis" }));

      const { button } = await hoverDisabledReason(/^profile$/i);

      expect(button).toBeEnabled();
      // MUI opens the tooltip after an enter delay, so a synchronous
      // queryByRole would pass even when a reason IS shown. findByRole waits
      // out that delay and only rejects once nothing has appeared.
      await expect(screen.findByRole("tooltip")).rejects.toThrow();
    });
  });
});
