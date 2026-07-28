/**
 * @file CllCachePatchLifecycle.test.ts
 *
 * Lifecycle of the CLL cache patch (DRC-2893): after a change-analysis CLL
 * call, the lineage query is patched in place instead of refetched.
 *
 * Covered here: which CLL calls are eligible to patch, and that a patch made
 * through the real React Query cache reaches the graph the canvas renders.
 * The patch's own merge rules are covered directly in
 * `patchLineageDiffFromCll.test.ts`.
 */

import { QueryClient } from "@tanstack/react-query";
import type {
  CllNodeData,
  ColumnLineageData,
  MergedLineageResponse,
  MergedNodeData,
  ServerInfoResult,
} from "../../../api";
import { cacheKeys } from "../../../api/cacheKeys";
import { buildLineageGraph } from "../../../contexts/lineage/utils";
import {
  patchLineageCacheFromCll,
  shouldPatchLineageCache,
} from "../patchLineageDiffFromCll";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NODE_A = "model.test.orders";
const NODE_B = "model.test.customers";

function createMergedLineage(): MergedLineageResponse {
  const nodes: Record<string, MergedNodeData> = {
    [NODE_A]: { name: "orders", resource_type: "model", package_name: "test" },
    [NODE_B]: {
      name: "customers",
      resource_type: "model",
      package_name: "test",
    },
  };

  return {
    nodes,
    edges: [{ source: NODE_B, target: NODE_A }],
    metadata: { base: {}, current: {} },
  };
}

function createServerInfoResult(): ServerInfoResult {
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
    lineage: createMergedLineage(),
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

/** A change-analysis response marking NODE_A modified with a changed column. */
function modifiedNodeACll(): ColumnLineageData {
  return createCllResponse({
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
}

function createQueryClient(seedLineage = true): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (seedLineage) {
    qc.setQueryData(cacheKeys.lineage(), createServerInfoResult());
  }
  return qc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLL cache patch lifecycle", () => {
  describe("eligibility", () => {
    it("patches after a change-analysis call that returned data", () => {
      expect(
        shouldPatchLineageCache(
          { node_id: NODE_A, column: "order_id", change_analysis: true },
          modifiedNodeACll(),
        ),
      ).toBe(true);
    });

    it("skips a plain column-lineage call", () => {
      expect(
        shouldPatchLineageCache(
          { node_id: NODE_A, column: "order_id" },
          modifiedNodeACll(),
        ),
      ).toBe(false);
    });

    it("skips when change analysis was explicitly off", () => {
      expect(
        shouldPatchLineageCache(
          { node_id: NODE_A, column: "order_id", change_analysis: false },
          modifiedNodeACll(),
        ),
      ).toBe(false);
    });

    it("skips when the call returned no data", () => {
      expect(
        shouldPatchLineageCache(
          { node_id: NODE_A, change_analysis: true },
          undefined,
        ),
      ).toBe(false);
    });
  });

  describe("patched cache reaches the graph", () => {
    it("gives the graph node the change status from the CLL response", () => {
      const qc = createQueryClient();

      patchLineageCacheFromCll(qc, modifiedNodeACll());

      const cached = qc.getQueryData<ServerInfoResult>(cacheKeys.lineage());
      expect(cached).toBeDefined();
      const graph = buildLineageGraph(cached!.lineage);

      expect(graph.nodes[NODE_A].data.changeStatus).toBe("modified");
      expect(graph.nodes[NODE_A].data.change).toEqual({
        category: "breaking",
        columns: { order_id: "added" },
      });
      // Nodes absent from the response are left alone.
      expect(graph.nodes[NODE_B].data.changeStatus).toBeUndefined();
    });

    it("replaces the lineage reference so subscribers re-render", () => {
      const qc = createQueryClient();
      const before = qc.getQueryData<ServerInfoResult>(
        cacheKeys.lineage(),
      )?.lineage;

      patchLineageCacheFromCll(qc, modifiedNodeACll());

      const after = qc.getQueryData<ServerInfoResult>(
        cacheKeys.lineage(),
      )?.lineage;
      expect(after).not.toBe(before);
    });

    it("leaves an unpopulated cache alone", () => {
      const qc = createQueryClient(false);

      patchLineageCacheFromCll(qc, modifiedNodeACll());

      expect(
        qc.getQueryData<ServerInfoResult>(cacheKeys.lineage()),
      ).toBeUndefined();
    });
  });
});
