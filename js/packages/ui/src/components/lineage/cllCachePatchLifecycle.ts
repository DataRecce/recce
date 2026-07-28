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
 * refetching it. That patch is the problem this owns: `setQueryData` notifies
 * subscribers synchronously, so `lineageGraph` recomputes and the lineage
 * layout effect re-fires *while the patch is still running*. Without a guard
 * the re-entry would call the API and patch again, forever.
 *
 * The guard is therefore not a detail of the fetch — it is the fetch, the
 * patch, the re-entry and the disable path decided together. Keeping the four
 * in one object is what makes them impossible to drift apart:
 *
 * - a genuine CLL input fetches once and patches once;
 * - the pending result is armed *before* the patch, so a synchronous re-entry
 *   can find it — but only when a cache entry was really written, because
 *   nothing re-enters otherwise;
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

export interface CllCachePatchLifecycle {
  /**
   * The layout effect's CLL step. Fetches and patches for a genuine input,
   * reuses the pending result when the effect re-fired because of our own cache
   * patch for *this same* request, and disarms when CLL is off. Rejections
   * propagate so the caller can keep its own error handling (toast +
   * auto-trigger rollback).
   */
  resolveCllForLayout(
    request: CllLifecycleRequest,
  ): Promise<ColumnLineageData | undefined>;
  /**
   * `refreshLayout`'s CLL step: never a reuse. A genuine input fetches and
   * patches — still arming before the patch, because the patch re-fires the
   * layout effect the same way — and no input disarms, since `refreshLayout`
   * runs on view-option changes that need not re-run the layout effect.
   */
  refreshCll(
    request: CllLifecycleRequest,
  ): Promise<ColumnLineageData | undefined>;
}

/** The armed result of a cache patch, tied to the request that caused it. */
interface PendingCll {
  apiInput: CllInput;
  cllData: ColumnLineageData;
}

/**
 * Whether two CLL requests ask the same question. `CllInput` is six optional
 * primitives, so comparing them field by field is exact, needs no
 * deep-equality dependency, and does not depend on key order the way
 * serializing would. A seventh field must be added here too.
 */
function isSameCllApiInput(a: CllInput, b: CllInput): boolean {
  return (
    a.node_id === b.node_id &&
    a.column === b.column &&
    a.change_analysis === b.change_analysis &&
    a.no_cll === b.no_cll &&
    a.no_upstream === b.no_upstream &&
    a.no_downstream === b.no_downstream
  );
}

export function createCllCachePatchLifecycle(): CllCachePatchLifecycle {
  let pending: PendingCll | undefined;

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
    pending = undefined;
    const cll = await actionGetCll.mutateAsync(cllApiInput);
    if (shouldPatchLineageCache(cllApiInput, cll)) {
      // Arm before patching: setQueryData notifies subscribers synchronously,
      // so the layout effect can re-enter inside the next line.
      const armed: PendingCll = { apiInput: cllApiInput, cllData: cll };
      pending = armed;
      if (!patchLineageCacheFromCll(queryClient, cll) && pending === armed) {
        // No cache value was produced, so no re-entry is coming. Clear only our
        // own token — a synchronous re-entry may already have consumed or
        // replaced it.
        pending = undefined;
      }
    }
    return cll;
  }

  return {
    async resolveCllForLayout(request) {
      const { cllInput, changeAnalysis } = request;
      if (!cllInput) {
        // CLL disabled — drop the armed result so re-enabling CLL cannot reuse
        // change data from the previous session.
        pending = undefined;
        return undefined;
      }
      if (
        pending &&
        isSameCllApiInput(
          pending.apiInput,
          buildCllApiInput(cllInput, changeAnalysis),
        )
      ) {
        // The effect re-fired because our own patch for this request updated the
        // lineage query. Reuse that result; skip the API call and the re-patch.
        const { cllData } = pending;
        pending = undefined;
        return cllData;
      }
      return await fetchAndPatch({ ...request, cllInput });
    },
    async refreshCll(request) {
      const { cllInput } = request;
      if (!cllInput) {
        // The paths that clear CLL without going through the layout effect
        // (reselect, selectParentNodes, view-option changes). Disarm explicitly.
        pending = undefined;
        return undefined;
      }
      return await fetchAndPatch({ ...request, cllInput });
    },
  };
}
