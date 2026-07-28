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

/**
 * Marks the response a given API call returned. The marker node is absent from
 * the cached lineage, so it never reaches the graph — it exists so a test can
 * name *which* response it got back instead of relying on object identity
 * alone, and so two responses can never compare equal by accident.
 */
const CALL_MARKER_PREFIX = "model.test.cll_call_";

function callMarkerOf(cll: ColumnLineageData | undefined): string | undefined {
  return Object.keys(cll?.current.nodes ?? {}).find((id) =>
    id.startsWith(CALL_MARKER_PREFIX),
  );
}

/** A change-analysis response marking NODE_A modified with a changed column. */
function modifiedNodeACll(callMarker: string): ColumnLineageData {
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
    [callMarker]: createCllNodeData({
      id: callMarker,
      name: callMarker,
      change_status: "modified",
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
  // A distinct response object per call, each tagged with its call number, so
  // "which response came back" is observable and never accidentally equal.
  const responses: ColumnLineageData[] = [];
  const mutateAsync = vi.fn(
    async (_input: CllInput): Promise<ColumnLineageData> => {
      const response = modifiedNodeACll(
        `${CALL_MARKER_PREFIX}${mutateAsync.mock.calls.length}`,
      );
      responses.push(response);
      return response;
    },
  );
  const lifecycle = createCllCachePatchLifecycle();

  return {
    queryClient,
    lifecycle,
    mutateAsync,
    apiCallCount: () => mutateAsync.mock.calls.length,
    patchCount: () => patch.mock.calls.length,
    /** Every response the mutation has handed out, oldest first. */
    responses: () => responses,
    /** The literal input the mutation was last called with. */
    lastApiInput: () => mutateAsync.mock.lastCall?.[0],
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

  it("does not hold data pending when there was no lineage cache to patch", async () => {
    // The response is patch-eligible but no cache entry exists to write, so no
    // subscriber is notified and no re-entry is ever coming to consume a pending
    // value. Every later request — the identical one included, which is the case
    // the request comparison alone cannot catch — is genuine.
    // Kills: arming before knowing the patch produced a cache value.
    const h = createHarness({ seedLineage: false });

    const first = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const repeated = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const different = await h.lifecycle.resolveCllForLayout(
      h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
    );

    expect(h.apiCallCount()).toBe(3);
    expect(h.patchCount()).toBe(3);
    expect(callMarkerOf(first)).toBe(`${CALL_MARKER_PREFIX}1`);
    expect(callMarkerOf(repeated)).toBe(`${CALL_MARKER_PREFIX}2`);
    expect(callMarkerOf(different)).toBe(`${CALL_MARKER_PREFIX}3`);
    expect(different).toBe(h.responses()[2]);
  });

  it("does not reuse pending data for a different input", async () => {
    // The pending result belongs to the request that patched the cache. A
    // different input is a different question and gets its own answer. Kills:
    // consuming pending data without comparing it to the current request.
    const h = createHarness();
    const radius = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    const otherNode = await h.lifecycle.resolveCllForLayout(
      h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
    );

    expect(h.apiCallCount()).toBe(2);
    expect(otherNode).not.toBe(radius);
    expect(callMarkerOf(otherNode)).toBe(`${CALL_MARKER_PREFIX}2`);
  });

  it("supersedes pending data when a different non-patching request follows", async () => {
    // A column click with change analysis off patches nothing, so it must both
    // make its own call and leave nothing behind for the request after it.
    // Kills: the missing request comparison (step 2 would replay the radius),
    // and clearing pending only on success (step 3 would replay the radius,
    // because its input matches the one still armed).
    const h = createHarness();
    const radius = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    const columnCll = await h.lifecycle.resolveCllForLayout(
      h.request(COLUMN_CLICK_INPUT, false),
    );
    const radiusAgain = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    expect(h.apiCallCount()).toBe(3);
    expect(columnCll).not.toBe(radius);
    expect(callMarkerOf(columnCll)).toBe(`${CALL_MARKER_PREFIX}2`);
    expect(radiusAgain).not.toBe(radius);
    expect(callMarkerOf(radiusAgain)).toBe(`${CALL_MARKER_PREFIX}3`);
  });

  it("leaves nothing to replay when a different genuine request rejects", async () => {
    // The failed request supersedes the armed one before it awaits, so the
    // retry is a real request rather than a replay of older change data.
    // Kills: the missing request comparison (the rejecting request would never
    // reach the API), and clearing pending after the await instead of before.
    const h = createHarness();
    const radius = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    h.mutateAsync.mockRejectedValueOnce(new Error("cll boom"));

    await expect(
      h.lifecycle.resolveCllForLayout(
        h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
      ),
    ).rejects.toThrow("cll boom");
    const retried = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    expect(h.apiCallCount()).toBe(3);
    expect(retried).not.toBe(radius);
    expect(retried).toBe(h.responses().at(-1));
  });

  it("sends the complete built API input to the mutation", async () => {
    // A column click carries no change_analysis of its own; the resolved mode is
    // injected when the request is built. Kills: passing `cllInput` straight
    // through instead of `buildCllApiInput(cllInput, changeAnalysis)`.
    const h = createHarness();

    await h.lifecycle.resolveCllForLayout(h.request(COLUMN_CLICK_INPUT, true));

    expect(h.lastApiInput()).toEqual({
      node_id: NODE_A,
      column: "order_id",
      change_analysis: true,
    });
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

    const fetched = await h.lifecycle.refreshCll(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const reused = await reentry.result();

    expect(reused).toBe(fetched);
    expect(h.apiCallCount()).toBe(1);
    expect(h.patchCount()).toBe(1);
  });

  it("clears the pending data on refreshLayout's explicit disable", async () => {
    // `refreshLayout` runs on view-option changes that need not re-run the
    // layout effect, so clearing CLL there has to disarm the lifecycle itself.
    // Kills: making `refreshCll` a no-op when there is no input instead of
    // dropping the pending value (and, in the owning component, calling it only
    // inside the `column_level_lineage` branch).
    const h = createHarness();
    const radius = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    const disabled = await h.lifecycle.refreshCll(h.request(undefined));
    const radiusAgain = await h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );

    expect(disabled).toBeUndefined();
    expect(h.apiCallCount()).toBe(2);
    expect(radiusAgain).not.toBe(radius);
    expect(callMarkerOf(radiusAgain)).toBe(`${CALL_MARKER_PREFIX}2`);
  });

  it("sends the complete built API input from refreshLayout's fetch", async () => {
    // The column-click path is showColumnLevelLineage → refreshLayout, so this
    // is the entry point a real column click reaches. Kills: passing `cllInput`
    // straight through instead of `buildCllApiInput(cllInput, changeAnalysis)`.
    const h = createHarness();

    await h.lifecycle.refreshCll(h.request(COLUMN_CLICK_INPUT, true));

    expect(h.lastApiInput()).toEqual({
      node_id: NODE_A,
      column: "order_id",
      change_analysis: true,
    });
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
