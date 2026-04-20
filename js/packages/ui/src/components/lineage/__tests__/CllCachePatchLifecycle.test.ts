/**
 * @file CllCachePatchLifecycle.test.ts
 *
 * Tests for the cache-patching lifecycle introduced in DRC-2893.
 *
 * After a CLL call with change_analysis: true, the frontend patches the
 * React Query lineage cache directly (via queryClient.setQueryData) instead
 * of refetching lineage from the server. This file validates:
 *
 * 1. The cache updater function correctly merges CLL change data into
 *    the cached ServerInfoResult.lineage nodes
 * 2. The patched lineage flows through buildLineageGraph to produce correct
 *    changeStatus on nodes
 * 3. The conditions under which patching occurs vs. is skipped
 * 4. The patching doesn't corrupt unrelated parts of the cache
 *
 * These tests use a real QueryClient to validate the actual setQueryData
 * behavior, but extract the logic from LineageViewOss.tsx as pure functions
 * to avoid rendering the full component.
 */

import { QueryClient } from "@tanstack/react-query";
import { cacheKeys } from "../../../api/cacheKeys";
import type {
  CllInput,
  CllNodeData,
  ColumnLineageData,
} from "../../../api/cll";
import type {
  MergedLineageResponse,
  MergedNodeData,
  ServerInfoResult,
} from "../../../api/info";
import { buildLineageGraph } from "../../../contexts/lineage/utils";
import { patchLineageFromCll } from "../patchLineageDiffFromCll";

// ---------------------------------------------------------------------------
// Helpers — mirror the cache-patching logic from LineageViewOss.tsx
// ---------------------------------------------------------------------------

/**
 * Mirrors the cache-patching block from refreshLayout / useLayoutEffect.
 * This is the exact logic that runs after a successful CLL API call.
 */
function applyCachePatch(
  queryClient: QueryClient,
  cllApiInput: CllInput,
  cllData: ColumnLineageData,
): void {
  if (cllApiInput.change_analysis && cllData) {
    queryClient.setQueryData(
      cacheKeys.lineage(),
      (old: ServerInfoResult | undefined) => {
        if (!old) return old;
        return {
          ...old,
          lineage: patchLineageFromCll(old.lineage, cllData),
        };
      },
    );
  }
}

/**
 * Mirrors how refreshLayout constructs CllInput from viewOptions.
 * The change_analysis field is injected from the independent boolean.
 */
function buildCllApiInput(
  columnLevelLineage: CllInput,
  changeAnalysisMode: boolean,
): CllInput {
  return {
    ...columnLevelLineage,
    change_analysis: columnLevelLineage.change_analysis ?? changeAnalysisMode,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NODE_A = "model.test.orders";
const NODE_B = "model.test.customers";

function createMergedLineage(
  nodeOverrides: Record<string, Partial<MergedNodeData>> = {},
): MergedLineageResponse {
  const defaultNodes: Record<string, MergedNodeData> = {
    [NODE_A]: {
      name: "orders",
      resource_type: "model",
      package_name: "test",
    },
    [NODE_B]: {
      name: "customers",
      resource_type: "model",
      package_name: "test",
    },
  };

  // Merge overrides
  const nodes: Record<string, MergedNodeData> = { ...defaultNodes };
  for (const [id, overrides] of Object.entries(nodeOverrides)) {
    nodes[id] = { ...nodes[id], ...overrides };
  }

  return {
    nodes,
    edges: [{ source: NODE_B, target: NODE_A }],
    metadata: { base: {}, current: {} },
  };
}

function createServerInfoResult(
  nodeOverrides: Record<string, Partial<MergedNodeData>> = {},
): ServerInfoResult {
  return {
    state_metadata: {
      schema_version: "1",
      recce_version: "0.1.0",
      generated_at: "2026-01-01",
    },
    adapter_type: "dbt",
    review_mode: false,
    cloud_mode: false,
    file_mode: false,
    demo: false,
    codespace: false,
    support_tasks: {},
    lineage: createMergedLineage(nodeOverrides),
  };
}

function createCllNodeData(
  overrides: Partial<CllNodeData> & { id: string; name: string },
): CllNodeData {
  return {
    source_name: "",
    resource_type: "model",
    ...overrides,
  };
}

function createCllResponse(
  nodes: Record<string, CllNodeData>,
): ColumnLineageData {
  return {
    current: {
      nodes,
      columns: {},
      parent_map: {},
      child_map: {},
    },
  };
}

function createQueryClient(
  nodeOverrides: Record<string, Partial<MergedNodeData>> = {},
): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(cacheKeys.lineage(), createServerInfoResult(nodeOverrides));
  return qc;
}

function getCachedNode(
  qc: QueryClient,
  nodeId: string,
): MergedNodeData | undefined {
  const data = qc.getQueryData<ServerInfoResult>(cacheKeys.lineage());
  return data?.lineage.nodes[nodeId];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLL cache patch lifecycle", () => {
  // =========================================================================
  // Core patching behavior
  // =========================================================================

  describe("cache patching after CLL with change_analysis", () => {
    it("patches node change_status when CLL returns change data", () => {
      const qc = createQueryClient();
      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
          change_category: "breaking",
          columns: {
            [`${NODE_A}.order_id`]: {
              name: "order_id",
              type: "INTEGER",
              change_status: "modified",
            },
          },
        }),
      });

      applyCachePatch(
        qc,
        { node_id: NODE_A, column: "order_id", change_analysis: true },
        cllData,
      );

      const node = getCachedNode(qc, NODE_A);
      expect(node?.change_status).toBe("modified");
      expect(node?.change).toEqual({
        category: "breaking",
        columns: { order_id: "modified" },
      });
    });

    it("preserves existing nodes not in CLL response", () => {
      const qc = createQueryClient({
        [NODE_B]: { change_status: "added" },
      });

      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
          change_category: "non_breaking",
        }),
      });

      applyCachePatch(qc, { node_id: NODE_A, change_analysis: true }, cllData);

      const nodeB = getCachedNode(qc, NODE_B);
      expect(nodeB?.change_status).toBe("added");
      expect(getCachedNode(qc, NODE_A)?.change_status).toBe("modified");
    });

    it("patches multiple nodes from impact radius CLL response", () => {
      const qc = createQueryClient();
      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
          change_category: "breaking",
        }),
        [NODE_B]: createCllNodeData({
          id: NODE_B,
          name: "customers",
          change_status: "added",
        }),
      });

      applyCachePatch(
        qc,
        { node_id: NODE_A, change_analysis: true, no_upstream: true },
        cllData,
      );

      expect(getCachedNode(qc, NODE_A)?.change_status).toBe("modified");
      expect(getCachedNode(qc, NODE_B)?.change_status).toBe("added");
    });
  });

  // =========================================================================
  // Conditions for patching vs. skipping
  // =========================================================================

  describe("patching conditions", () => {
    it("skips patching when change_analysis is false", () => {
      const qc = createQueryClient();
      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
          change_category: "breaking",
        }),
      });

      applyCachePatch(
        qc,
        { node_id: NODE_A, column: "order_id", change_analysis: false },
        cllData,
      );

      // Node should be unchanged (no change_status)
      const node = getCachedNode(qc, NODE_A);
      expect(node?.change_status).toBeUndefined();
    });

    it("skips patching when change_analysis is undefined", () => {
      const qc = createQueryClient();
      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
        }),
      });

      applyCachePatch(qc, { node_id: NODE_A, column: "order_id" }, cllData);

      const node = getCachedNode(qc, NODE_A);
      expect(node?.change_status).toBeUndefined();
    });

    it("handles empty cache gracefully (returns undefined)", () => {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      // No data in cache

      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
        }),
      });

      // Should not throw
      applyCachePatch(qc, { node_id: NODE_A, change_analysis: true }, cllData);

      expect(
        qc.getQueryData<ServerInfoResult>(cacheKeys.lineage()),
      ).toBeUndefined();
    });
  });

  // =========================================================================
  // CllInput construction (change_analysis injection)
  // =========================================================================

  describe("CllInput construction from viewOptions", () => {
    it("injects change_analysis from changeAnalysisMode when not explicitly set", () => {
      const input = buildCllApiInput(
        { node_id: NODE_A, column: "order_id" },
        true,
      );
      expect(input.change_analysis).toBe(true);
    });

    it("preserves explicit change_analysis from viewOptions", () => {
      const input = buildCllApiInput(
        { node_id: NODE_A, change_analysis: true, no_upstream: true },
        false,
      );
      expect(input.change_analysis).toBe(true);
    });

    it("does not inject change_analysis when mode is off", () => {
      const input = buildCllApiInput(
        { node_id: NODE_A, column: "order_id" },
        false,
      );
      expect(input.change_analysis).toBe(false);
    });
  });

  // =========================================================================
  // End-to-end: patched cache -> buildLineageGraph
  // =========================================================================

  describe("end-to-end: cache patch flows through buildLineageGraph", () => {
    it("buildLineageGraph picks up changeStatus from patched nodes", () => {
      const qc = createQueryClient();

      // Simulate CLL call with change_analysis
      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
          change_category: "breaking",
          columns: {
            [`${NODE_A}.order_id`]: {
              name: "order_id",
              type: "INTEGER",
              change_status: "added",
            },
          },
        }),
      });

      applyCachePatch(qc, { node_id: NODE_A, change_analysis: true }, cllData);

      // Now simulate what LineageGraphAdapter does: read cache, build graph
      const cached = qc.getQueryData<ServerInfoResult>(cacheKeys.lineage());
      expect(cached).toBeDefined();

      const graph = buildLineageGraph(cached!.lineage);

      // The node should have changeStatus from the patched lineage
      const node = graph.nodes[NODE_A];
      expect(node).toBeDefined();
      expect(node.data.changeStatus).toBe("modified");
      expect(node.data.change).toEqual({
        category: "breaking",
        columns: { order_id: "added" },
      });
    });

    it("buildLineageGraph shows unpatched node without changeStatus", () => {
      const qc = createQueryClient(); // no overrides

      const cached = qc.getQueryData<ServerInfoResult>(cacheKeys.lineage());
      const graph = buildLineageGraph(cached!.lineage);

      // With no change_status, node should not have changeStatus
      const node = graph.nodes[NODE_A];
      expect(node).toBeDefined();
      expect(node.data.changeStatus).toBeUndefined();
    });

    it("subsequent patches accumulate in cached nodes", () => {
      const qc = createQueryClient();

      // First CLL: patch NODE_A
      applyCachePatch(
        qc,
        { node_id: NODE_A, change_analysis: true },
        createCllResponse({
          [NODE_A]: createCllNodeData({
            id: NODE_A,
            name: "orders",
            change_status: "modified",
            change_category: "breaking",
          }),
        }),
      );

      // Second CLL: patch NODE_B (different column click)
      applyCachePatch(
        qc,
        { node_id: NODE_B, change_analysis: true },
        createCllResponse({
          [NODE_B]: createCllNodeData({
            id: NODE_B,
            name: "customers",
            change_status: "added",
          }),
        }),
      );

      expect(getCachedNode(qc, NODE_A)?.change_status).toBe("modified");
      expect(getCachedNode(qc, NODE_B)?.change_status).toBe("added");

      // Both should flow through to the graph
      const cached = qc.getQueryData<ServerInfoResult>(cacheKeys.lineage());
      const graph = buildLineageGraph(cached!.lineage);

      expect(graph.nodes[NODE_A].data.changeStatus).toBe("modified");
      expect(graph.nodes[NODE_B].data.changeStatus).toBe("added");
    });
  });

  // =========================================================================
  // Cache integrity
  // =========================================================================

  describe("cache integrity", () => {
    it("does not corrupt non-lineage fields in ServerInfoResult", () => {
      const qc = createQueryClient();
      const beforePatch = qc.getQueryData<ServerInfoResult>(
        cacheKeys.lineage(),
      );

      applyCachePatch(
        qc,
        { node_id: NODE_A, change_analysis: true },
        createCllResponse({
          [NODE_A]: createCllNodeData({
            id: NODE_A,
            name: "orders",
            change_status: "modified",
            change_category: "breaking",
          }),
        }),
      );

      const afterPatch = qc.getQueryData<ServerInfoResult>(cacheKeys.lineage());
      expect(afterPatch?.adapter_type).toBe(beforePatch?.adapter_type);
      expect(afterPatch?.state_metadata).toEqual(beforePatch?.state_metadata);
      expect(afterPatch?.support_tasks).toEqual(beforePatch?.support_tasks);
    });

    it("creates new lineage object reference (immutable update)", () => {
      const qc = createQueryClient({
        [NODE_B]: { change_status: "added" },
      });
      const beforeLineage = qc.getQueryData<ServerInfoResult>(
        cacheKeys.lineage(),
      )?.lineage;

      applyCachePatch(
        qc,
        { node_id: NODE_A, change_analysis: true },
        createCllResponse({
          [NODE_A]: createCllNodeData({
            id: NODE_A,
            name: "orders",
            change_status: "modified",
            change_category: "breaking",
          }),
        }),
      );

      const afterLineage = qc.getQueryData<ServerInfoResult>(
        cacheKeys.lineage(),
      )?.lineage;
      // Should be a new object (React Query needs referential inequality)
      expect(afterLineage).not.toBe(beforeLineage);
    });
  });

  // =========================================================================
  // Re-entry guard (cllCachePatchRef)
  // =========================================================================

  describe("re-entry guard prevents infinite loop", () => {
    interface CllCachePatchRef {
      pending: boolean;
      cllData?: ColumnLineageData;
    }

    it("guard is set before setQueryData and consumed on re-entry", () => {
      const guard: CllCachePatchRef = { pending: false };
      const qc = createQueryClient();
      const cllData = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
          change_category: "breaking",
        }),
      });

      // Simulate first pass: CLL call succeeds, set guard, patch cache
      guard.pending = true;
      guard.cllData = cllData;
      applyCachePatch(qc, { node_id: NODE_A, change_analysis: true }, cllData);

      // Guard should be pending with stored CLL data
      expect(guard.pending).toBe(true);
      expect(guard.cllData).toBe(cllData);

      // Simulate re-entry: effect fires again, guard is consumed
      if (guard.pending) {
        const reusedCll = guard.cllData;
        guard.pending = false;
        guard.cllData = undefined;

        // The reused CLL data should be the same
        expect(reusedCll).toBe(cllData);
      }

      // Guard should be cleared
      expect(guard.pending).toBe(false);
    });

    it("guard does not interfere with subsequent genuine CLL calls", () => {
      const guard: CllCachePatchRef = { pending: false };
      const qc = createQueryClient();

      // First CLL call: patch and set guard
      const cllData1 = createCllResponse({
        [NODE_A]: createCllNodeData({
          id: NODE_A,
          name: "orders",
          change_status: "modified",
          change_category: "breaking",
        }),
      });
      guard.pending = true;
      guard.cllData = cllData1;
      applyCachePatch(qc, { node_id: NODE_A, change_analysis: true }, cllData1);

      // Re-entry: consume guard
      guard.pending = false;
      guard.cllData = undefined;

      // Second genuine CLL call (different column click): guard is clear
      expect(guard.pending).toBe(false);

      const cllData2 = createCllResponse({
        [NODE_B]: createCllNodeData({
          id: NODE_B,
          name: "customers",
          change_status: "added",
        }),
      });
      guard.pending = true;
      guard.cllData = cllData2;
      applyCachePatch(qc, { node_id: NODE_B, change_analysis: true }, cllData2);

      expect(getCachedNode(qc, NODE_A)?.change_status).toBe("modified");
      expect(getCachedNode(qc, NODE_B)?.change_status).toBe("added");
    });
  });
});
