import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import React from "react";
import { beforeEach, vi } from "vitest";
import type {
  LineageGraph,
  LineageGraphNodes,
} from "../../../contexts/lineage/types";
import { LineageViewOss } from "../LineageViewOss";

const MODEL_ID = "model.test.orders";

const mockToReactFlow = vi.fn();
let mockZoom = 1;

vi.mock("../lineage", () => ({
  toReactFlow: (...args: unknown[]) => mockToReactFlow(...args),
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow">{children}</div>
  ),
  Background: () => null,
  BackgroundVariant: { Dots: "dots" },
  Controls: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ControlButton: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  MiniMap: () => null,
  Panel: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  useNodesState: (initial: unknown[]) => {
    const [nodes, setNodes] = React.useState(initial);
    return [nodes, setNodes, vi.fn()];
  },
  useEdgesState: (initial: unknown[]) => {
    const [edges, setEdges] = React.useState(initial);
    return [edges, setEdges, vi.fn()];
  },
  useReactFlow: () => ({
    fitView: vi.fn(async () => true),
    setCenter: vi.fn(async () => undefined),
    getNodes: () => [],
    getZoom: () => mockZoom,
  }),
  useStore: (selector: (state: { transform: number[] }) => unknown) =>
    selector({ transform: [0, 0, mockZoom] }),
}));

vi.mock("../../../lib/api/track", () => ({
  trackCopyToClipboard: vi.fn(),
  trackLineageViewRender: vi.fn(),
  trackMultiNodesAction: vi.fn(),
}));

vi.mock("../../../hooks/useMultiNodesActionOss", () => ({
  useMultiNodesActionOss: () => ({
    actionState: { actions: {}, status: "pending" },
  }),
}));

vi.mock("../../../contexts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../contexts")>()),
  useLineageGraphContext: () => ({
    lineageGraph,
    isLoading: false,
    error: undefined,
    refetchLineageGraph: vi.fn(),
    refetchRunsAggregated: vi.fn(),
    isActionAvailable: () => true,
  }),
  useRecceActionContext: () => ({
    runId: undefined,
    showRunId: vi.fn(),
    closeRunResult: vi.fn(),
    runAction: vi.fn(),
    isRunResultOpen: false,
  }),
  useRecceInstanceContext: () => ({
    featureToggles: { mode: "read only" },
    singleEnv: false,
  }),
  useRecceServerFlag: () => ({ data: undefined }),
}));

vi.mock("../../../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../hooks")>()),
  useApiConfig: () => ({ apiClient: {} }),
  useRun: () => ({ run: undefined }),
  useThemeColors: () => ({ isDark: false }),
}));

const modelData = {
  id: MODEL_ID,
  name: "orders",
  resourceType: "model",
  packageName: "test",
  changeStatus: "modified",
  parents: {},
  children: {},
};

const lineageGraph = {
  nodes: {
    [MODEL_ID]: {
      id: MODEL_ID,
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: modelData,
    },
  },
  edges: {},
  modifiedSet: [MODEL_ID],
  manifestMetadata: { base: undefined, current: undefined },
  catalogMetadata: { base: undefined, current: undefined },
} as unknown as LineageGraph;

const modelNode = lineageGraph.nodes[MODEL_ID] as unknown as LineageGraphNodes;
const derivedColumnNode = {
  id: `${MODEL_ID}_total`,
  type: "lineageGraphColumnNode",
  parentId: MODEL_ID,
  position: { x: 0, y: 70 },
  data: {
    node: modelData,
    column: "total",
    type: "INTEGER",
    transformationType: "derived",
  },
} as LineageGraphNodes;

function renderView(nodes: Node[]) {
  mockToReactFlow.mockResolvedValue([nodes, [], {}]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LineageViewOss viewOptions={{ node_ids: [MODEL_ID] }} />
    </QueryClientProvider>,
  );
}

describe("LineageViewOss transformation legend", () => {
  beforeEach(() => {
    mockZoom = 1;
    mockToReactFlow.mockReset();
  });

  it("omits the legend for a model-only impact-radius graph", async () => {
    renderView([modelNode]);

    await screen.findByTestId("reactflow");
    expect(
      screen.queryByText("Column transformations"),
    ).not.toBeInTheDocument();
  });

  it("shows the transformation types rendered by column nodes", async () => {
    renderView([modelNode, derivedColumnNode]);

    expect(await screen.findByText("Column transformations")).toBeVisible();
    expect(screen.getByText("Derived")).toBeVisible();
    expect(screen.queryByText("Passthrough")).not.toBeInTheDocument();
  });

  it("hides the legend at the same zoom boundary as column content", async () => {
    mockZoom = 0.31;
    const { rerender } = renderView([modelNode, derivedColumnNode]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(await screen.findByText("Column transformations")).toBeVisible();

    mockZoom = 0.3;
    rerender(
      <QueryClientProvider client={queryClient}>
        <LineageViewOss viewOptions={{ node_ids: [MODEL_ID] }} />
      </QueryClientProvider>,
    );

    expect(
      screen.queryByText("Column transformations"),
    ).not.toBeInTheDocument();
  });
});
