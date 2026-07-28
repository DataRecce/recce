/**
 * @file CllCachePatchLifecycle.test.ts
 *
 * Lifecycle of the CLL cache patch (DRC-2893): after a change-analysis CLL
 * call, the lineage query is patched in place instead of refetched, and the
 * layout effect that re-fires because of that patch must not call the API or
 * patch again.
 *
 * Everything here runs the production lifecycle object that `LineageViewOss`
 * holds (`createCllCachePatchLifecycle`) against a real React Query cache. The
 * re-entry is not simulated by calling a helper twice: the test subscribes to
 * the query cache and re-enters from inside the patch, which is exactly when
 * the real effect re-fires, so the guard has to be armed *before* the patch for
 * the reuse to happen at all.
 *
 * The patch's own merge rules are covered directly in
 * `patchLineageDiffFromCll.test.ts`.
 */

import { QueryClient } from "@tanstack/react-query";
import { vi } from "vitest";
import type {
  CllInput,
  CllNodeData,
  ColumnLineageData,
  MergedLineageResponse,
  MergedNodeData,
  ServerInfoResult,
} from "../../../api";
import { cacheKeys } from "../../../api/cacheKeys";
import { buildLineageGraph } from "../../../contexts/lineage/utils";
import { createCllCachePatchLifecycle } from "../cllCachePatchLifecycle";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NODE_A = "model.test.orders";
const NODE_B = "model.test.customers";

/** Impact Radius on NODE_A — the input that makes a patch eligible. */
const IMPACT_RADIUS_INPUT: CllInput = {
  node_id: NODE_A,
  change_analysis: true,
  no_upstream: true,
};

/** A plain column click — nothing to patch into the lineage cache. */
const COLUMN_CLICK_INPUT: CllInput = { node_id: NODE_A, column: "order_id" };

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

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/**
 * The lifecycle wired to a real query cache, a counting CLL mutation, and a
 * counting view of the cache patches it performs.
 */
function createHarness({ seedLineage = true } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (seedLineage) {
    queryClient.setQueryData(cacheKeys.lineage(), createServerInfoResult());
  }
  // Spied after seeding, so only the lifecycle's own patches are counted.
  const patch = vi.spyOn(queryClient, "setQueryData");
  const mutateAsync = vi.fn(
    async (_input: CllInput): Promise<ColumnLineageData> => modifiedNodeACll(),
  );
  const lifecycle = createCllCachePatchLifecycle();

  return {
    queryClient,
    lifecycle,
    mutateAsync,
    apiCallCount: () => mutateAsync.mock.calls.length,
    patchCount: () => patch.mock.calls.length,
    request<T extends CllInput | undefined>(
      cllInput: T,
      changeAnalysis = true,
    ) {
      return {
        cllInput,
        changeAnalysis,
        actionGetCll: { mutateAsync },
        queryClient,
      };
    },
    /** The graph the canvas renders, rebuilt from whatever the cache holds. */
    graph() {
      const cached = queryClient.getQueryData<ServerInfoResult>(
        cacheKeys.lineage(),
      );
      return cached ? buildLineageGraph(cached.lineage) : undefined;
    },
  };
}

/**
 * Re-enter `run` from inside the next lineage cache patch — the moment the real
 * layout effect re-fires, because `setQueryData` notifies subscribers
 * synchronously while the first entry is still in flight.
 */
function onNextCachePatch<T>(
  queryClient: QueryClient,
  run: () => Promise<T>,
): { result: () => Promise<T> } {
  let reentry: Promise<T> | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || reentry) {
      return;
    }
    unsubscribe();
    reentry = run();
  });

  return {
    async result() {
      unsubscribe();
      if (!reentry) {
        throw new Error("the cache patch never re-entered the lifecycle");
      }
      return await reentry;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLL cache patch lifecycle", () => {
  it("fetches once and patches the lineage cache once for a genuine input", async () => {
    const h = createHarness();

    const cll = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    expect(cll).toBeDefined();
    expect(h.apiCallCount()).toBe(1);
    expect(h.patchCount()).toBe(1);
    // The change data reached the graph the canvas renders.
    expect(h.graph()?.nodes[NODE_A].data.changeStatus).toBe("modified");
    expect(h.graph()?.nodes[NODE_B].data.changeStatus).toBeUndefined();
  });

  it("reuses the pending data when the patch re-enters the layout, with no second request or patch", async () => {
    const h = createHarness();
    const reentry = onNextCachePatch(h.queryClient, () =>
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );

    const first = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const reused = await reentry.result();

    expect(reused).toBe(first);
    expect(h.apiCallCount()).toBe(1);
    expect(h.patchCount()).toBe(1);
  });

  it("fetches and patches again for the next genuine input after a re-entry", async () => {
    const h = createHarness();
    const reentry = onNextCachePatch(h.queryClient, () =>
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );
    await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT));
    await reentry.result();

    await h.lifecycle.resolveCllForLayout(
      h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
    );

    expect(h.apiCallCount()).toBe(2);
    expect(h.patchCount()).toBe(2);
  });

  it("clears the pending data when CLL is disabled, so re-enabling fetches", async () => {
    const h = createHarness();
    // Arms the guard; nothing consumes it (no re-entry in this scenario).
    await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT));

    const disabled = await h.lifecycle.resolveCllForLayout(
      h.request(undefined),
    );
    await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT));

    expect(disabled).toBeUndefined();
    expect(h.apiCallCount()).toBe(2);
    expect(h.patchCount()).toBe(2);
  });

  it("arms the guard from refreshLayout's fetch too, so the effect re-fire reuses it", async () => {
    const h = createHarness();
    const reentry = onNextCachePatch(h.queryClient, () =>
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );

    const fetched = await h.lifecycle.fetchAndPatch(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const reused = await reentry.result();

    expect(reused).toBe(fetched);
    expect(h.apiCallCount()).toBe(1);
    expect(h.patchCount()).toBe(1);
  });

  it("does not patch or arm anything for a plain column-lineage call", async () => {
    const h = createHarness();

    await h.lifecycle.resolveCllForLayout(h.request(COLUMN_CLICK_INPUT, false));
    // Nothing was armed, so the next input is a real request.
    await h.lifecycle.resolveCllForLayout(h.request(COLUMN_CLICK_INPUT, false));

    expect(h.apiCallCount()).toBe(2);
    expect(h.patchCount()).toBe(0);
    expect(h.graph()?.nodes[NODE_A].data.changeStatus).toBeUndefined();
  });

  it("propagates a failed CLL request and arms nothing", async () => {
    const h = createHarness();
    h.mutateAsync.mockRejectedValueOnce(new Error("cll boom"));

    await expect(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    ).rejects.toThrow("cll boom");
    // A retry after the failure is a real request, not a reuse of nothing.
    const retried = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    expect(retried).toBeDefined();
    expect(h.apiCallCount()).toBe(2);
    expect(h.patchCount()).toBe(1);
  });

  it("leaves an unpopulated lineage cache alone", async () => {
    const h = createHarness({ seedLineage: false });

    await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT));

    expect(
      h.queryClient.getQueryData<ServerInfoResult>(cacheKeys.lineage()),
    ).toBeUndefined();
  });
});
