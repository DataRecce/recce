import type { QueryClient } from "@tanstack/react-query";
import type { CllInput, ColumnLineageData } from "../../api/cll";
import { buildCllApiInput } from "./changeAnalysisState";
import {
  patchLineageCacheFromCll,
  shouldPatchLineageCache,
} from "./patchLineageDiffFromCll";

/**
 * The CLL fetch → cache-patch → re-entry lifecycle (DRC-2893).
 *
 * A change-analysis CLL response is merged into the cached lineage instead of
 * refetching it. That patch is the problem this owns: `setQueryData` schedules
 * subscribed React views to render with a recomputed `lineageGraph`, then the
 * lineage layout effect runs again. Without a guard the later re-entry would
 * call the API and patch again, forever.
 *
 * The guard is therefore not a detail of the fetch — it is the fetch, the
 * patch, the re-entry and the disable path decided together. Keeping the four
 * in one object is what makes them impossible to drift apart:
 *
 * - a genuine CLL input fetches once and patches once;
 * - the pending result is armed *before* the patch and kept until the
 *   subscriber's later layout effect can find it — but only when a cache entry
 *   was really written, because nothing re-enters otherwise;
 * - the pending result belongs to the request that patched the cache, and only
 *   the re-entry asking that same question may reuse it;
 * - every genuine fetch supersedes what was pending *before* it awaits, so a
 *   response that patches nothing, or a rejection, cannot leave older change
 *   data reusable;
 * - disabling CLL disarms, so re-enabling never replays stale change data.
 *
 * Internal to the lineage package — not exported from any barrel.
 */

/** The CLL mutation, narrowed to what the lifecycle calls. */
export interface CllFetcher {
  mutateAsync: (input: CllInput) => Promise<ColumnLineageData>;
}

export interface CllLifecycleRequest {
  /** The CLL request from viewOptions; `undefined` means CLL is off. */
  cllInput: CllInput | undefined;
  /** Resolved change-analysis mode (read from a ref by the layout effect). */
  changeAnalysis: boolean;
  actionGetCll: CllFetcher;
  queryClient: QueryClient;
}

export interface CllLifecycleResolution {
  cll: ColumnLineageData | undefined;
  isCurrent: () => boolean;
}

export interface CllCachePatchLifecycle {
  /**
   * Synchronously supersede every in-flight request and clear any armed
   * re-entry. The owning component calls this when it unmounts so a late CLL
   * completion cannot patch a cache that no longer has a view to consume it.
   */
  invalidate(): void;
  /**
   * The layout effect's CLL step. Fetches and patches for a genuine input,
   * reuses the pending result when the effect re-fired because of our own cache
   * patch for *this same* request, and disarms when CLL is off. Rejections
   * propagate so the caller can keep its own error handling (toast +
   * auto-trigger rollback). The resolution lets the caller reject a completion
   * that was superseded while the request was in flight.
   */
  resolveCllForLayout(
    request: CllLifecycleRequest,
  ): Promise<CllLifecycleResolution>;
  /**
   * `refreshLayout`'s CLL step: never a reuse. A genuine input fetches and
   * patches — still arming before the patch, because the patch re-fires the
   * layout effect the same way — and no input disarms, since `refreshLayout`
   * runs on view-option changes that need not re-run the layout effect.
   */
  refreshCll(request: CllLifecycleRequest): Promise<CllLifecycleResolution>;
}

/** The armed result of a cache patch, tied to the request that caused it. */
interface PendingCll {
  apiInput: CllInput;
  resolution: CllLifecycleResolution;
}

/**
 * Every field of `CllInput`, as a value.
 *
 * The `satisfies` clause is the whole point: add a field to `CllInput` and this
 * object stops compiling until the field is listed here, so neither the
 * comparison nor the normalization below can silently ignore it. An ignored
 * field means two different questions compare equal and one request reuses the
 * other's cached answer — a comment asking the next author to remember could not
 * enforce that.
 */
export const CLL_INPUT_FIELDS = Object.keys({
  node_id: true,
  column: true,
  change_analysis: true,
  no_cll: true,
  no_upstream: true,
  no_downstream: true,
} satisfies Record<keyof CllInput, true>) as (keyof CllInput)[];

/**
 * Whether two CLL requests ask the same question. `CllInput` is optional
 * primitives throughout, so comparing field by field is exact, needs no
 * deep-equality dependency, and does not depend on key order the way serializing
 * would.
 */
function isSameCllApiInput(a: CllInput, b: CllInput): boolean {
  return CLL_INPUT_FIELDS.every((field) => a[field] === b[field]);
}

function normalizeCllApiInput(input: CllInput): CllInput {
  const normalized: Record<string, unknown> = {};
  for (const field of CLL_INPUT_FIELDS) {
    normalized[field] = input[field];
  }
  return normalized as CllInput;
}

export function createCllCachePatchLifecycle(): CllCachePatchLifecycle {
  let pending: PendingCll | undefined;
  let epoch = 0;

  function resolutionFor(
    requestEpoch: number,
    cll: ColumnLineageData | undefined,
  ): CllLifecycleResolution {
    return {
      cll,
      isCurrent: () => epoch === requestEpoch,
    };
  }

  function disable(): CllLifecycleResolution {
    invalidate();
    const requestEpoch = epoch;
    return resolutionFor(requestEpoch, undefined);
  }

  function invalidate(): void {
    ++epoch;
    pending = undefined;
  }

  async function fetchAndPatch({
    cllInput,
    changeAnalysis,
    actionGetCll,
    queryClient,
  }: CllLifecycleRequest & { cllInput: CllInput }) {
    const cllApiInput = buildCllApiInput(cllInput, changeAnalysis);
    // Supersede before awaiting: from here on, only what *this* request returns
    // may be reused. A response that patches nothing, or a rejection, therefore
    // leaves nothing reusable behind.
    const requestEpoch = ++epoch;
    pending = undefined;
    let cll: ColumnLineageData;
    try {
      cll = await actionGetCll.mutateAsync(cllApiInput);
    } catch (error) {
      if (epoch !== requestEpoch) {
        return resolutionFor(requestEpoch, undefined);
      }
      throw error;
    }
    const resolution = resolutionFor(requestEpoch, cll);
    if (!resolution.isCurrent()) {
      return resolution;
    }
    if (shouldPatchLineageCache(cllApiInput, cll)) {
      // Arm before patching and keep the result across the scheduled React
      // render so the subscriber's later layout effect can consume it.
      const armed: PendingCll = {
        apiInput: normalizeCllApiInput(cllApiInput),
        resolution,
      };
      pending = armed;
      if (!patchLineageCacheFromCll(queryClient, cll) && pending === armed) {
        // No cache value was produced, so no re-entry is coming. Clear only our
        // own token in case another cache observer replaced it.
        pending = undefined;
      }
    }
    return resolution;
  }

  return {
    invalidate,
    async resolveCllForLayout(request) {
      const { cllInput, changeAnalysis } = request;
      if (!cllInput) {
        // CLL disabled — drop the armed result so re-enabling CLL cannot reuse
        // change data from the previous session.
        return disable();
      }
      if (
        pending &&
        isSameCllApiInput(
          pending.apiInput,
          normalizeCllApiInput(buildCllApiInput(cllInput, changeAnalysis)),
        )
      ) {
        // The effect re-fired because our own patch for this request updated the
        // lineage query. Reuse that result; skip the API call and the re-patch.
        const { resolution } = pending;
        pending = undefined;
        return resolution;
      }
      return await fetchAndPatch({ ...request, cllInput });
    },
    async refreshCll(request) {
      const { cllInput } = request;
      if (!cllInput) {
        // The paths that clear CLL without going through the layout effect
        // (reselect, selectParentNodes, view-option changes). Disarm explicitly.
        return disable();
      }
      return await fetchAndPatch({ ...request, cllInput });
    },
  };
}
