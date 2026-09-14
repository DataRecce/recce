import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { vi } from "vitest";

const {
  mockGraphContext,
  mockLineageNode,
  mockNodeSurfaceClick,
  mockViewContext,
} = vi.hoisted(() => ({
  mockGraphContext: { current: undefined as unknown },
  mockLineageNode: vi.fn(),
  mockNodeSurfaceClick: vi.fn(),
  mockViewContext: { current: undefined as unknown },
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useStore: (selector: (state: { transform: number[] }) => unknown) =>
      selector({ transform: [0, 0, 1] }),
  };
});

vi.mock("../../../contexts", () => ({
  useLineageGraphContext: () => mockGraphContext.current,
  useLineageViewContextSafe: () => mockViewContext.current,
}));

vi.mock("../../../hooks", () => ({
  useThemeColors: () => ({
    isDark: false,
    text: { inverted: "white", secondary: "grey" },
  }),
}));

vi.mock("../nodes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../nodes")>();
  return {
    ...actual,
    LineageNode: (props: {
      interactive?: boolean;
      onSelect?: (nodeId: string) => void;
      runsAggregatedTag?: ReactNode;
      selectMode?: string;
    }) => {
      mockLineageNode(props);
      return (
        <div data-testid="lineage-node" onClick={mockNodeSurfaceClick}>
          {props.runsAggregatedTag}
        </div>
      );
    },
  };
});

import type {
  LineageGraphNode,
  LineageViewContextType,
} from "../../../contexts";
import { getSemanticColorTheme } from "../../../theme";
import { GraphNode, type GraphNodeProps } from "../GraphNodeOss";

function createViewContext(
  overrides: Partial<LineageViewContextType> & {
    openNodeDetails?: (nodeId: string, view: "analysis") => void;
  } = {},
): LineageViewContextType {
  return {
    interactive: true,
    openNodeDetails: vi.fn(),
    selectNode: vi.fn(),
    selectMode: "normal",
    focusedNode: undefined,
    getNodeAction: vi.fn(),
    getNodeColumnSet: vi.fn(() => new Set()),
    isNodeHighlighted: vi.fn(() => false),
    isNodeSelected: vi.fn(() => false),
    isNodeShowingChangeAnalysis: vi.fn(() => false),
    showContextMenu: vi.fn(),
    viewOptions: {},
    cll: {
      current: { nodes: {}, columns: {}, parent_map: {}, child_map: {} },
    },
    impactedNodeIds: new Set(),
    newCllExperience: false,
    wholeModelChangedNodeIds: new Set(),
    wholeModelImpactedNodeIds: new Set(),
    ...overrides,
  } as LineageViewContextType;
}

function createNodeProps(id = "model.test.orders"): GraphNodeProps {
  const name = id.split(".").at(-1) ?? id;
  const node: LineageGraphNode = {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      resourceType: "model",
      changeStatus: "modified",
      change: { category: "non_breaking" }, // wire-enum-ok
      parents: {},
      children: {},
    },
  };

  return {
    ...node,
    selected: false,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  };
}

type ValidationTypes = NonNullable<
  NonNullable<
    import("../../../api").NodeRunsAggregated["validation_summary"]
  >["types"]
>;

function validationSummary(
  resultCount: number,
  differenceCount: number,
  types: ValidationTypes,
) {
  return {
    result_count: resultCount,
    difference_count: differenceCount,
    types,
  };
}

describe("GraphNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphContext.current = {};
  });

  it("uses the merged-lineage category in the legacy experience", () => {
    mockViewContext.current = createViewContext();

    render(<GraphNode {...createNodeProps()} />);

    expect(mockLineageNode).toHaveBeenCalledWith(
      expect.objectContaining({
        changeCategory: "non_breaking", // wire-enum-ok
        showChangeAnalysis: true,
      }),
    );
  });

  it("does not leak the merged-lineage category into the new CLL experience", () => {
    mockViewContext.current = createViewContext({ newCllExperience: true });

    render(<GraphNode {...createNodeProps()} />);

    expect(mockLineageNode).toHaveBeenCalledWith(
      expect.objectContaining({
        changeCategory: undefined,
        showChangeAnalysis: false,
      }),
    );
  });

  it("preserves a fresh CLL category in the new CLL experience", () => {
    mockViewContext.current = createViewContext({
      newCllExperience: true,
      cll: {
        current: {
          nodes: {
            "model.test.orders": {
              id: "model.test.orders",
              name: "orders",
              source_name: "",
              resource_type: "model",
              change_category: "partial_breaking", // wire-enum-ok
            },
          },
          columns: {},
          parent_map: {},
          child_map: {},
        },
      },
    });

    render(<GraphNode {...createNodeProps()} />);

    expect(mockLineageNode).toHaveBeenCalledWith(
      expect.objectContaining({
        changeCategory: "partial_breaking", // wire-enum-ok
        showChangeAnalysis: false,
      }),
    );
  });

  it("keeps first-node selection wired in normal mode", () => {
    const selectNode = vi.fn();
    mockViewContext.current = createViewContext({
      selectNode,
    });

    render(<GraphNode {...createNodeProps()} />);

    const lineageNodeProps = mockLineageNode.mock.lastCall?.[0] as {
      interactive?: boolean;
      onSelect?: (nodeId: string) => void;
      selectMode?: string;
    };
    expect(lineageNodeProps).toEqual(
      expect.objectContaining({
        interactive: true,
        selectMode: "normal",
      }),
    );

    lineageNodeProps.onSelect?.("model.test.orders");

    expect(selectNode).toHaveBeenCalledWith("model.test.orders");
  });

  it("does not mount the aggregate display when the node has no visible schema, row-count, or validation data", () => {
    mockViewContext.current = createViewContext();
    mockGraphContext.current = {
      runsAggregated: {
        "model.test.orders": {
          row_count: { run_id: "row-count", result: { curr: 42 } },
        },
      },
    };

    render(<GraphNode {...createNodeProps()} />);

    expect(mockLineageNode).toHaveBeenLastCalledWith(
      expect.objectContaining({ runsAggregatedTag: undefined }),
    );
    expect(
      screen.queryByTestId("node-runs-aggregated-display"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
  ])(
    "does not mount an otherwise-empty aggregate display for a %s validation result count",
    (_label, resultCount) => {
      mockViewContext.current = createViewContext();
      mockGraphContext.current = {
        runsAggregated: {
          "model.test.orders": {
            validation_summary: validationSummary(resultCount, 0, {}),
          },
        },
      };

      render(<GraphNode {...createNodeProps()} />);

      expect(mockLineageNode).toHaveBeenLastCalledWith(
        expect.objectContaining({ runsAggregatedTag: undefined }),
      );
      expect(
        screen.queryByTestId("node-runs-aggregated-display"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("validation-summary-chip")).toBeNull();
    },
  );

  it("preserves schema and row-count evidence while hiding a zero-result validation summary", () => {
    const props = createNodeProps();
    props.data.change = {
      category: "non_breaking", // wire-enum-ok
      columns: { id: "modified" },
    };
    mockViewContext.current = createViewContext();
    mockGraphContext.current = {
      runsAggregated: {
        "model.test.orders": {
          row_count_diff: {
            run_id: "row-count-1",
            result: { base: 100, curr: 150 },
          },
          validation_summary: validationSummary(0, 0, {}),
        },
      },
    };

    render(<GraphNode {...props} />);

    expect(
      screen.getByTestId("node-runs-aggregated-display"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Schema (changed)")).toBeInTheDocument();
    expect(screen.getByText("↑ +50.0% Rows")).toBeInTheDocument();
    expect(screen.queryByTestId("validation-summary-chip")).toBeNull();
  });

  it.each([
    {
      name: "value diff",
      summary: validationSummary(1, 1, {
        value_diff: {
          result_available: true,
          latest_run_id: "value-1",
          difference_count: 1,
        },
      }),
      chip: "1 result · 1 diff",
      detail: "1 result · 1 diff",
    },
    {
      name: "profile diff",
      summary: validationSummary(1, 91, {
        profile_diff: {
          result_available: true,
          latest_run_id: "profile-1",
          result_count: 1,
        },
      }),
      chip: "1 result",
      detail: "1 result",
    },
    {
      name: "top-k diff",
      summary: validationSummary(2, 91, {
        top_k_diff: {
          result_available: true,
          latest_run_ids_by_column: { country: "top-k-1", status: "top-k-2" },
          column_count: 2,
        },
      }),
      chip: "2 results",
      detail: "2 columns",
    },
    {
      name: "histogram diff",
      summary: validationSummary(3, 91, {
        histogram_diff: {
          result_available: true,
          latest_run_ids_by_column: {
            amount: "histogram-1",
            quantity: "histogram-2",
            tax: "histogram-3",
          },
          column_count: 3,
        },
      }),
      chip: "3 results",
      detail: "3 columns",
    },
  ])(
    "renders neutral, type-correct counts for a $name summary",
    ({ name, summary, chip, detail }) => {
      mockViewContext.current = createViewContext();
      mockGraphContext.current = {
        runsAggregated: {
          "model.test.orders": { validation_summary: summary },
        },
      };

      render(<GraphNode {...createNodeProps()} />);

      const trigger = screen.getByRole("button", {
        name: new RegExp(`orders.*${chip.replace(" · ", ".*")}`, "i"),
      });
      expect(trigger).toHaveTextContent(chip);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveStyle({ minHeight: "24px" });
      expect(trigger.querySelectorAll(".MuiChip-root")).toHaveLength(1);
      expect(trigger.querySelector(".MuiChip-root")).toHaveClass(
        "MuiChip-colorDefault",
        "MuiChip-outlined",
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.mouseEnter(trigger);

      const dialog = screen.getByRole("dialog", {
        name: "orders validation details",
      });
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByText(new RegExp(name, "i")),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(detail, { exact: true }),
      ).toBeInTheDocument();
    },
  );

  it("renders one mixed-summary chip and readable per-type details", () => {
    mockViewContext.current = createViewContext();
    mockGraphContext.current = {
      runsAggregated: {
        "model.test.orders": {
          validation_summary: validationSummary(7, 2, {
            value_diff: {
              result_available: true,
              latest_run_id: "value-1",
              difference_count: 2,
            },
            profile_diff: {
              result_available: true,
              latest_run_id: "profile-1",
              result_count: 1,
            },
            top_k_diff: {
              result_available: true,
              latest_run_ids_by_column: {
                country: "top-k-1",
                status: "top-k-2",
              },
              column_count: 2,
            },
            histogram_diff: {
              result_available: true,
              latest_run_ids_by_column: {
                amount: "histogram-1",
                quantity: "histogram-2",
                tax: "histogram-3",
              },
              column_count: 3,
            },
          }),
        },
      },
    };

    render(<GraphNode {...createNodeProps()} />);

    const trigger = screen.getByRole("button", {
      name: /orders.*7 results.*2 diffs/i,
    });
    expect(trigger).toHaveTextContent("7 results · 2 diffs");
    expect(screen.getAllByTestId("validation-summary-chip")).toHaveLength(1);

    fireEvent.mouseEnter(trigger);

    expect(screen.getByText("Value diff")).toBeInTheDocument();
    expect(screen.getByText("Profile diff")).toBeInTheDocument();
    expect(screen.getByText("Top-k diff")).toBeInTheDocument();
    expect(screen.getByText("Histogram diff")).toBeInTheDocument();
    expect(screen.getByText("1 result · 2 diffs")).toBeInTheDocument();
    expect(screen.getByText("1 result", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText("2 columns")).toHaveLength(1);
    expect(screen.getAllByText("3 columns")).toHaveLength(1);
  });

  it("opens Analysis repeatably from keyboard without toggling batch selection or the node surface", async () => {
    const user = userEvent.setup();
    const openNodeDetails = vi.fn();
    const selectNode = vi.fn();
    mockViewContext.current = createViewContext({
      openNodeDetails,
      selectNode,
    });
    mockGraphContext.current = {
      runsAggregated: {
        "model.test.orders": {
          validation_summary: validationSummary(1, 0, {
            value_diff: {
              result_available: true,
              latest_run_id: "value-1",
              difference_count: 0,
            },
          }),
        },
      },
    };

    render(<GraphNode {...createNodeProps()} />);

    const trigger = screen.getByRole("button", {
      name: /orders.*1 result.*0 diffs/i,
    });
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Enter} ");

    expect(openNodeDetails).toHaveBeenNthCalledWith(
      1,
      "model.test.orders",
      "analysis",
    );
    expect(openNodeDetails).toHaveBeenNthCalledWith(
      2,
      "model.test.orders",
      "analysis",
    );
    expect(selectNode).not.toHaveBeenCalled();
    expect(mockNodeSurfaceClick).not.toHaveBeenCalled();
  });

  it("keeps lazy details open while the summary button retains focus", () => {
    vi.useFakeTimers();
    try {
      mockViewContext.current = createViewContext();
      mockGraphContext.current = {
        runsAggregated: {
          "model.test.orders": {
            validation_summary: validationSummary(1, 0, {
              profile_diff: {
                result_available: true,
                latest_run_id: "profile-1",
                result_count: 1,
              },
            }),
          },
        },
      };
      render(<GraphNode {...createNodeProps()} />);
      const trigger = screen.getByRole("button", { name: /orders.*1 result/i });

      act(() => trigger.focus());
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(101));

      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds and removes the display as aggregate data changes", () => {
    mockViewContext.current = createViewContext();
    mockGraphContext.current = { runsAggregated: {} };
    const initialProps = createNodeProps();
    const { rerender } = render(<GraphNode {...initialProps} />);
    expect(
      screen.queryByTestId("node-runs-aggregated-display"),
    ).not.toBeInTheDocument();

    mockGraphContext.current = {
      runsAggregated: {
        "model.test.orders": {
          validation_summary: validationSummary(1, 0, {
            profile_diff: {
              result_available: true,
              latest_run_id: "profile-1",
              result_count: 1,
            },
          }),
        },
      },
    };
    rerender(<GraphNode {...initialProps} selected />);
    expect(screen.getByText("1 result")).toBeInTheDocument();

    mockGraphContext.current = { runsAggregated: {} };
    rerender(<GraphNode {...initialProps} selected={false} />);
    expect(
      screen.queryByTestId("node-runs-aggregated-display"),
    ).not.toBeInTheDocument();
  });

  it("coexists with schema, row-count, and new-CLL presentation inside the fixed node slot", () => {
    const props = createNodeProps();
    props.data.change = {
      category: "partial_breaking", // wire-enum-ok
      columns: {},
    };
    mockViewContext.current = createViewContext({ newCllExperience: true });
    mockGraphContext.current = {
      runsAggregated: {
        "model.test.orders": {
          row_count_diff: {
            run_id: "row-count-1",
            result: { base: 100, curr: 150 },
          },
          validation_summary: validationSummary(1234567, 765432, {
            value_diff: {
              result_available: true,
              latest_run_id: "value-1",
              difference_count: 765432,
            },
          }),
        },
      },
    };

    render(<GraphNode {...props} />);

    expect(screen.getByText("↑ +50.0% Rows")).toBeInTheDocument();
    expect(
      screen.getByText("1,234,567 results · 765,432 diffs"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Schema (no change)")).toBeInTheDocument();
    expect(mockLineageNode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changeCategory: undefined,
        showChangeAnalysis: false,
      }),
    );
  });

  it("mounts aggregate displays and popovers in proportion to summarized nodes in a large sparse graph", () => {
    const summarizedNodeIds = [
      "model.test.node_7",
      "model.test.node_503",
      "model.test.node_997",
    ];
    mockViewContext.current = createViewContext();
    mockGraphContext.current = {
      runsAggregated: Object.fromEntries(
        summarizedNodeIds.map((id, index) => [
          id,
          {
            validation_summary: validationSummary(index + 1, 0, {
              profile_diff: {
                result_available: true,
                latest_run_id: `profile-${index}`,
                result_count: 1,
              },
            }),
          },
        ]),
      ),
    };

    render(
      <>
        {Array.from({ length: 1000 }, (_, index) => {
          const id = `model.test.node_${index}`;
          return <GraphNode key={id} {...createNodeProps(id)} />;
        })}
      </>,
    );

    expect(screen.getAllByTestId("node-runs-aggregated-display")).toHaveLength(
      summarizedNodeIds.length,
    );
    expect(screen.getAllByTestId("validation-summary-chip")).toHaveLength(
      summarizedNodeIds.length,
    );
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: /node_503.*2 results/i }),
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it.each([
    [100, 150, "↑ +50.0% Rows", "increase"],
    [100, 80, "↓ -20.0% Rows", "decrease"],
    [null, 100, "Added · 100 Rows", "added"],
    [100, null, "Removed · 100 Rows", "removed"],
    [100, 100, "=", "unchanged"],
    [null, null, "Failed to load", "unavailable"],
  ])(
    "renders the %s → %s row-count chip as %s",
    (base, current, label, direction) => {
      mockViewContext.current = createViewContext();
      mockGraphContext.current = {
        runsAggregated: {
          "model.test.orders": {
            row_count_diff: { result: { base, curr: current } },
          },
        },
      };

      render(<GraphNode {...createNodeProps()} />);

      const chip = screen.getByText(label).closest(".MuiChip-root");
      expect(chip).toHaveAttribute("data-row-count-direction", direction);
      if (direction === "increase") {
        expect(chip).toHaveStyle({
          backgroundColor: getSemanticColorTheme(false).direction.background,
          color: getSemanticColorTheme(false).direction.foreground,
        });
      }
      if (direction === "decrease") {
        expect(chip).toHaveStyle({
          backgroundColor: getSemanticColorTheme(false).direction.background,
          color: getSemanticColorTheme(false).direction.foreground,
        });
      }
    },
  );
});
