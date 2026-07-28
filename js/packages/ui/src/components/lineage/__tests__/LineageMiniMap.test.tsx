/**
 * MiniMap auto-disable tests.
 *
 * The lineage view drops the MiniMap once a graph gets large enough that its
 * extra DOM costs more than it helps. This drives the real view with a mocked
 * graph boundary (`toReactFlow`) so the 500/501 boundary is observed the way a
 * user would see it — MiniMap present or absent — instead of restating the
 * threshold arithmetic.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import React from "react";
import { vi } from "vitest";
import type { LineageGraph } from "../../../contexts/lineage/types";
import { LineageViewOss } from "../LineageViewOss";

const MODIFIED_NODE = "model.test.orders";

const mockToReactFlow = vi.fn();

// Graph boundary: hand the view an exact node count without laying anything out.
vi.mock("../lineage", () => ({
  toReactFlow: (...args: unknown[]) => mockToReactFlow(...args),
}));

// React Flow renders nothing meaningful in happy-dom; keep the pieces the view
// mounts as identifiable stubs so MiniMap presence is observable.
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow">{children}</div>
  ),
  Background: () => <div data-testid="background" />,
  BackgroundVariant: { Dots: "dots" },
  Controls: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="controls">{children}</div>
  ),
  ControlButton: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  MiniMap: () => <div data-testid="minimap" />,
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
    getZoom: () => 1,
  }),
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

const lineageGraph = {
  nodes: {
    [MODIFIED_NODE]: {
      id: MODIFIED_NODE,
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: MODIFIED_NODE,
        name: "orders",
        resourceType: "model",
        packageName: "test",
        changeStatus: "modified",
        parents: {},
        children: {},
      },
    },
  },
  edges: {},
  modifiedSet: [MODIFIED_NODE],
  manifestMetadata: { base: undefined, current: undefined },
  catalogMetadata: { base: undefined, current: undefined },
} as unknown as LineageGraph;

function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: "lineageGraphNode",
    position: { x: i * 400, y: 0 },
    data: { id: `node-${i}`, name: `model ${i}` },
  }));
}

/** Render the lineage view over a graph that lays out `nodeCount` nodes. */
async function renderWithNodeCount(nodeCount: number) {
  mockToReactFlow.mockResolvedValue([makeNodes(nodeCount), [], {}]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LineageViewOss viewOptions={{ node_ids: [MODIFIED_NODE] }} />
    </QueryClientProvider>,
  );
  await screen.findByTestId("reactflow");
}

// The boundary is stated here as literals on purpose: 500 nodes still get a
// MiniMap, 501 do not. Deriving these from the production constant would let
// the threshold move without a test noticing.
describe("MiniMap auto-disable for large graphs", () => {
  it("shows the MiniMap on a 500-node graph", async () => {
    await renderWithNodeCount(500);

    expect(screen.getByTestId("minimap")).toBeInTheDocument();
  });

  it("hides the MiniMap on a 501-node graph", async () => {
    await renderWithNodeCount(501);

    expect(screen.queryByTestId("minimap")).not.toBeInTheDocument();
  });

  it("shows the MiniMap for an ordinary graph", async () => {
    await renderWithNodeCount(10);

    expect(screen.getByTestId("minimap")).toBeInTheDocument();
  });
});
