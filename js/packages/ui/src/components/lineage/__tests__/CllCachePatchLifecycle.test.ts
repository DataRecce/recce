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
 * central re-entry test mounts a real `useQuery` subscriber: React observes the
 * cache patch, schedules a render, and only then runs the layout resolution
 * again. This matches the production timing that the pending result must span.
 *
 * The patch's own merge rules are covered directly in
 * `patchLineageDiffFromCll.test.ts`.
 */

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { createElement, useLayoutEffect } from "react";
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
import {
  CLL_INPUT_FIELDS,
  createCllCachePatchLifecycle,
} from "../cllCachePatchLifecycle";
import { patchLineageCacheFromCll } from "../patchLineageDiffFromCll";

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

interface ExpectedResolution {
  cll: ColumnLineageData | undefined;
  isCurrent: () => boolean;
}

function asResolution(value: unknown): ExpectedResolution {
  return value as ExpectedResolution;
}

async function cllOf(
  resolution: Promise<unknown>,
): Promise<ColumnLineageData | undefined> {
  return asResolution(await resolution).cll;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
      change_category: "breaking", // wire-enum-ok -- legacy CLL response
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
    clearPatchCount: () => patch.mockClear(),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLL cache patch lifecycle", () => {
  it("fetches once and patches the lineage cache once for a genuine input", async () => {
    const h = createHarness();

    const cll = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );

    expect(cll).toBeDefined();
    expect(h.apiCallCount()).toBe(1);
    expect(h.patchCount()).toBe(1);
    // The change data reached the graph the canvas renders.
    expect(h.graph()?.nodes[NODE_A].data.changeStatus).toBe("modified");
    expect(h.graph()?.nodes[NODE_B].data.changeStatus).toBeUndefined();
  });

  it("reuses the exact pending result when a React Query subscriber schedules the layout re-entry", async () => {
    const h = createHarness();
    const cll = modifiedNodeACll("model.test.scheduled_reentry");
    h.mutateAsync.mockResolvedValue(cll);
    const resolutions: ExpectedResolution[] = [];

    function LayoutSubscriber() {
      const { data } = useQuery<ServerInfoResult>({
        queryKey: cacheKeys.lineage(),
        queryFn: async () => createServerInfoResult(),
        staleTime: Number.POSITIVE_INFINITY,
      });

      useLayoutEffect(() => {
        if (!data) {
          return;
        }
        void h.lifecycle
          .resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT))
          .then((resolution) => {
            resolutions.push(asResolution(resolution));
          });
      }, [data]);

      return null;
    }

    render(
      createElement(
        QueryClientProvider,
        { client: h.queryClient },
        createElement(LayoutSubscriber),
      ),
    );

    await waitFor(() => expect(resolutions).toHaveLength(2));

    expect(h.apiCallCount()).toBe(1);
    expect(h.patchCount()).toBe(1);
    expect(resolutions[0].cll).toBe(cll);
    expect(resolutions[1]).toBe(resolutions[0]);
  });

  it("fetches and patches again for the next genuine input after a re-entry", async () => {
    const h = createHarness();
    await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT));
    await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT));

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

    const first = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );
    const repeated = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );
    const different = await cllOf(
      h.lifecycle.resolveCllForLayout(
        h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
      ),
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
    const radius = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );

    const otherNode = await cllOf(
      h.lifecycle.resolveCllForLayout(
        h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
      ),
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
    const radius = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );

    const columnCll = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(COLUMN_CLICK_INPUT, false)),
    );
    const radiusAgain = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
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
    const radius = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );
    h.mutateAsync.mockRejectedValueOnce(new Error("cll boom"));

    await expect(
      h.lifecycle.resolveCllForLayout(
        h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
      ),
    ).rejects.toThrow("cll boom");
    const retried = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
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

    const disabled = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(undefined)),
    );
    await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT));

    expect(disabled).toBeUndefined();
    expect(h.apiCallCount()).toBe(2);
    expect(h.patchCount()).toBe(2);
  });

  it("arms the guard from refreshLayout's fetch too, so the effect re-fire reuses it", async () => {
    const h = createHarness();
    const fetched = asResolution(
      await h.lifecycle.refreshCll(h.request(IMPACT_RADIUS_INPUT)),
    );
    const reused = asResolution(
      await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );

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
    const radius = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );

    const disabled = await cllOf(h.lifecycle.refreshCll(h.request(undefined)));
    const radiusAgain = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
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
    const retried = await cllOf(
      h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
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

  it("keeps the newer patch when an older patchable request finishes last", async () => {
    const h = createHarness();
    const slowA = deferred<ColumnLineageData>();
    const fastB = deferred<ColumnLineageData>();
    h.mutateAsync
      .mockImplementationOnce(() => slowA.promise)
      .mockImplementationOnce(() => fastB.promise);

    const requestA = h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const requestB = h.lifecycle.resolveCllForLayout(
      h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
    );
    const cllB = modifiedNodeACll("model.test.newer_b");
    fastB.resolve(cllB);
    const resolutionB = asResolution(await requestB);

    expect(resolutionB.cll).toBe(cllB);
    expect(resolutionB.isCurrent()).toBe(true);
    expect(h.patchCount()).toBe(1);

    const cllA = modifiedNodeACll("model.test.older_a");
    slowA.resolve(cllA);
    const resolutionA = asResolution(await requestA);

    expect(resolutionA.cll).toBe(cllA);
    expect(resolutionA.isCurrent()).toBe(false);
    expect(h.patchCount()).toBe(1);
  });

  it("does not let an older patchable request patch after a newer non-patching request", async () => {
    const h = createHarness();
    const slowA = deferred<ColumnLineageData>();
    const fastB = deferred<ColumnLineageData>();
    h.mutateAsync
      .mockImplementationOnce(() => slowA.promise)
      .mockImplementationOnce(() => fastB.promise);

    const requestA = h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const requestB = h.lifecycle.resolveCllForLayout(
      h.request(COLUMN_CLICK_INPUT, false),
    );
    fastB.resolve(modifiedNodeACll("model.test.newer_plain_b"));
    const resolutionB = asResolution(await requestB);

    expect(resolutionB.isCurrent()).toBe(true);
    expect(h.patchCount()).toBe(0);

    slowA.resolve(modifiedNodeACll("model.test.older_patch_a"));
    const resolutionA = asResolution(await requestA);

    expect(resolutionA.isCurrent()).toBe(false);
    expect(h.patchCount()).toBe(0);
  });

  it("propagates a current rejection and makes the older completion non-current", async () => {
    const h = createHarness();
    const slowA = deferred<ColumnLineageData>();
    const currentB = deferred<ColumnLineageData>();
    h.mutateAsync
      .mockImplementationOnce(() => slowA.promise)
      .mockImplementationOnce(() => currentB.promise);

    const requestA = h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const requestB = h.lifecycle.resolveCllForLayout(
      h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
    );
    currentB.reject(new Error("current b failed"));

    await expect(requestB).rejects.toThrow("current b failed");
    slowA.resolve(modifiedNodeACll("model.test.older_after_error"));
    const resolutionA = asResolution(await requestA);

    expect(resolutionA.isCurrent()).toBe(false);
    expect(h.patchCount()).toBe(0);
  });

  it("turns a stale rejection into a non-current resolution", async () => {
    const h = createHarness();
    const slowA = deferred<ColumnLineageData>();
    const currentB = deferred<ColumnLineageData>();
    h.mutateAsync
      .mockImplementationOnce(() => slowA.promise)
      .mockImplementationOnce(() => currentB.promise);

    const requestA = h.lifecycle.resolveCllForLayout(
      h.request(IMPACT_RADIUS_INPUT),
    );
    const requestB = h.lifecycle.resolveCllForLayout(
      h.request({ ...IMPACT_RADIUS_INPUT, node_id: NODE_B }),
    );
    const cllB = modifiedNodeACll("model.test.newer_success");
    currentB.resolve(cllB);
    const resolutionB = asResolution(await requestB);
    slowA.reject(new Error("stale a failed"));
    const resolutionA = asResolution(await requestA);

    expect(resolutionB.cll).toBe(cllB);
    expect(resolutionB.isCurrent()).toBe(true);
    expect(resolutionA.cll).toBeUndefined();
    expect(resolutionA.isCurrent()).toBe(false);
    expect(h.patchCount()).toBe(1);
  });

  it.each([
    ["layout", "resolveCllForLayout"],
    ["refresh", "refreshCll"],
  ] as const)(
    "invalidates an older request when the %s entry disables CLL",
    async (_entry, method) => {
      const h = createHarness();
      const slowA = deferred<ColumnLineageData>();
      h.mutateAsync.mockImplementationOnce(() => slowA.promise);

      const requestA = h.lifecycle.resolveCllForLayout(
        h.request(IMPACT_RADIUS_INPUT),
      );
      const disabled = asResolution(
        await h.lifecycle[method](h.request(undefined)),
      );

      expect(disabled.cll).toBeUndefined();
      expect(disabled.isCurrent()).toBe(true);

      slowA.resolve(modifiedNodeACll(`model.test.older_${_entry}`));
      const resolutionA = asResolution(await requestA);

      expect(resolutionA.isCurrent()).toBe(false);
      expect(h.patchCount()).toBe(0);
    },
  );

  it("invalidates an in-flight request when its component owner is disposed", async () => {
    const h = createHarness();
    const slow = deferred<ColumnLineageData>();
    h.mutateAsync.mockImplementationOnce(() => slow.promise);
    const request = h.lifecycle.refreshCll(h.request(IMPACT_RADIUS_INPUT));

    h.lifecycle.invalidate();
    slow.resolve(modifiedNodeACll("model.test.after_dispose"));
    const resolution = asResolution(await request);

    expect(resolution.isCurrent()).toBe(false);
    expect(h.patchCount()).toBe(0);
  });

  // Typed as an exhaustive Record, not a loose array: a new CllInput field fails
  // to compile here until it gets its own row, so the matrix cannot fall behind
  // the type the way a hand-written list can.
  const FIELD_DIFFERENCES: Record<keyof CllInput, Partial<CllInput>> = {
    node_id: { node_id: NODE_B },
    column: { column: "customer_id" },
    change_analysis: { change_analysis: false },
    no_cll: { no_cll: false },
    no_upstream: { no_upstream: false },
    no_downstream: { no_downstream: false },
  };

  it("compares and normalizes every field of CllInput", () => {
    expect([...CLL_INPUT_FIELDS].sort()).toEqual(
      Object.keys(FIELD_DIFFERENCES).sort(),
    );
  });

  it.each(
    Object.entries(FIELD_DIFFERENCES) as [keyof CllInput, Partial<CllInput>][],
  )(
    "treats a difference in normalized %s as a genuine request",
    async (_field, difference) => {
      const h = createHarness();
      const fullInput: CllInput = {
        node_id: NODE_A,
        column: "order_id",
        change_analysis: true,
        no_cll: true,
        no_upstream: true,
        no_downstream: true,
      };
      await h.lifecycle.resolveCllForLayout(h.request(fullInput, true));

      await h.lifecycle.resolveCllForLayout(
        h.request({ ...fullInput, ...difference }, true),
      );

      expect(h.apiCallCount()).toBe(2);
    },
  );

  it("does not arm re-entry when structural sharing keeps a deep-equal cache reference", async () => {
    const h = createHarness();
    const cll = modifiedNodeACll("model.test.deep_equal");
    h.mutateAsync.mockResolvedValue(cll);
    patchLineageCacheFromCll(h.queryClient, cll);
    h.clearPatchCount();

    const seeded = h.queryClient.getQueryData<ServerInfoResult>(
      cacheKeys.lineage(),
    );
    expect(seeded).toBeDefined();
    const first = asResolution(
      await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );
    const afterFirst = h.queryClient.getQueryData<ServerInfoResult>(
      cacheKeys.lineage(),
    );
    const second = asResolution(
      await h.lifecycle.resolveCllForLayout(h.request(IMPACT_RADIUS_INPUT)),
    );
    const afterSecond = h.queryClient.getQueryData<ServerInfoResult>(
      cacheKeys.lineage(),
    );

    expect(first.cll).toBe(cll);
    expect(second.cll).toBe(cll);
    expect(afterFirst).toBe(seeded);
    expect(afterFirst).toBe(afterSecond);
    expect(h.apiCallCount()).toBe(2);
    expect(h.patchCount()).toBe(2);
  });
});
