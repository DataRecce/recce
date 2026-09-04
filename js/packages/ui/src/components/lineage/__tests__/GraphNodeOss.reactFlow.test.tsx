import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type NodeTypes, ReactFlow } from "@xyflow/react";
import { vi } from "vitest";
import type { NodeRunsAggregated } from "../../../api";
import {
  type LineageGraph,
  type LineageGraphNode,
  LineageGraphProvider,
  LineageViewContext,
  type LineageViewContextType,
  type SelectMode,
} from "../../../contexts";
import { GraphNode } from "../GraphNodeOss";

const nodeTypes = { lineageGraphNode: GraphNode } satisfies NodeTypes;

function createNode(): LineageGraphNode {
  return {
    id: "model.test.orders",
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    width: 300,
    height: 60,
    data: {
      id: "model.test.orders",
      name: "orders",
      resourceType: "model",
      parents: {},
      children: {},
    },
  };
}

function createGraph(node: LineageGraphNode): LineageGraph {
  return {
    nodes: { [node.id]: node },
    edges: {},
    modifiedSet: [],
    manifestMetadata: {},
    catalogMetadata: {},
  };
}

function createViewContext(
  selectMode: SelectMode,
  openNodeDetails: ReturnType<typeof vi.fn>,
): LineageViewContextType {
  return {
    interactive: true,
    nodes: [],
    selectedNodes: [],
    cll: undefined,
    showContextMenu: vi.fn(),
    viewOptions: {},
    onViewOptionsChanged: vi.fn(),
    selectMode,
    selectNode: vi.fn(),
    openNodeDetails,
    getNodeAction: vi.fn(),
    getNodeColumnSet: vi.fn(() => new Set()),
    isNodeHighlighted: vi.fn(() => false),
    isNodeSelected: vi.fn(() => false),
    isNodeShowingChangeAnalysis: vi.fn(() => false),
    newCllExperience: false,
    impactedNodeIds: new Set(),
    impactedColumnIds: new Set(),
    wholeModelChangedNodeIds: new Set(),
    wholeModelImpactedNodeIds: new Set(),
  } as unknown as LineageViewContextType;
}

function renderInReactFlow(selectMode: SelectMode = undefined) {
  const node = createNode();
  const onNodeClick = vi.fn();
  const onNodeDoubleClick = vi.fn();
  const onNodeContextMenu = vi.fn();
  const onNodeDragStart = vi.fn();
  const onNodesChange = vi.fn();
  const openNodeDetails = vi.fn();
  const runsAggregated: NodeRunsAggregated = {
    validation_summary: {
      result_count: 1,
      difference_count: 0,
      types: {
        profile_diff: {
          result_available: true,
          latest_run_id: "profile-1",
          result_count: 1,
        },
      },
    },
  };

  render(
    <LineageGraphProvider
      lineageGraph={createGraph(node)}
      runsAggregated={{ [node.id]: runsAggregated }}
      isLoading={false}
    >
      <LineageViewContext.Provider
        value={createViewContext(selectMode, openNodeDetails)}
      >
        <div style={{ width: 800, height: 600 }}>
          <ReactFlow
            nodes={[node]}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDragStart={onNodeDragStart}
            onNodesChange={onNodesChange}
            elementsSelectable
            nodesDraggable
            nodesFocusable
          />
        </div>
      </LineageViewContext.Provider>
    </LineageGraphProvider>,
  );

  return {
    onNodeClick,
    onNodeDoubleClick,
    onNodeContextMenu,
    onNodeDragStart,
    onNodesChange,
    openNodeDetails,
  };
}

describe("GraphNode React Flow interaction isolation", () => {
  it("uses React Flow interaction guards while preserving native Enter and Space activation", async () => {
    const user = userEvent.setup();
    const callbacks = renderInReactFlow();
    const trigger = screen.getByRole("button", {
      name: /orders.*1 result/i,
    });

    expect(trigger).toHaveClass("nodrag", "nopan", "nokey");
    callbacks.onNodesChange.mockClear();

    trigger.focus();
    await user.keyboard("{Enter} ");

    expect(callbacks.openNodeDetails).toHaveBeenCalledTimes(2);
    expect(callbacks.onNodeClick).not.toHaveBeenCalled();
    expect(callbacks.onNodesChange).not.toHaveBeenCalled();

    fireEvent.mouseDown(trigger, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(document, { buttons: 1, clientX: 50, clientY: 50 });
    fireEvent.mouseUp(document, { button: 0, clientX: 50, clientY: 50 });

    expect(callbacks.onNodeDragStart).not.toHaveBeenCalled();
    expect(callbacks.onNodesChange).not.toHaveBeenCalled();
  });

  it.each([
    ["normal", undefined],
    ["selecting", "selecting" as const],
  ])(
    "contains portaled detail-surface events in %s mode",
    (_mode, selectMode) => {
      const callbacks = renderInReactFlow(selectMode);
      const trigger = screen.getByRole("button", {
        name: /orders.*1 result/i,
      });
      callbacks.onNodesChange.mockClear();

      fireEvent.mouseEnter(trigger);
      const dialog = screen.getByRole("dialog", {
        name: "orders validation details",
      });

      fireEvent.pointerDown(dialog);
      fireEvent.mouseDown(dialog, { button: 0 });
      fireEvent.click(dialog);
      fireEvent.doubleClick(dialog);
      const contextMenuEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      fireEvent(dialog, contextMenuEvent);

      expect(callbacks.onNodeClick).not.toHaveBeenCalled();
      expect(callbacks.onNodeDoubleClick).not.toHaveBeenCalled();
      expect(callbacks.onNodeContextMenu).not.toHaveBeenCalled();
      expect(callbacks.onNodeDragStart).not.toHaveBeenCalled();
      expect(callbacks.onNodesChange).not.toHaveBeenCalled();
      expect(contextMenuEvent.defaultPrevented).toBe(false);
      expect(dialog).toBeInTheDocument();
    },
  );
});
