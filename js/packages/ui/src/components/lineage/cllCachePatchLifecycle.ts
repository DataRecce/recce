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
 *   can find it;
 * - a re-entry consumes it and disarms, so the next genuine input fetches;
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
   * patch, and disarms when CLL is off. Rejections propagate so the caller can
   * keep its own error handling (toast + auto-trigger rollback).
   */
  resolveCllForLayout(
    request: CllLifecycleRequest,
  ): Promise<ColumnLineageData | undefined>;
  /**
   * `refreshLayout`'s CLL step: always a genuine fetch. It still arms the guard
   * before patching, because the patch re-fires the layout effect the same way.
   */
  fetchAndPatch(
    request: CllLifecycleRequest & { cllInput: CllInput },
  ): Promise<ColumnLineageData>;
}

export function createCllCachePatchLifecycle(): CllCachePatchLifecycle {
  let guard: { pending: boolean; cllData?: ColumnLineageData } = {
    pending: false,
  };

  async function fetchAndPatch({
    cllInput,
    changeAnalysis,
    actionGetCll,
    queryClient,
  }: CllLifecycleRequest & { cllInput: CllInput }) {
    const cllApiInput = buildCllApiInput(cllInput, changeAnalysis);
    const cll = await actionGetCll.mutateAsync(cllApiInput);
    if (shouldPatchLineageCache(cllApiInput, cll)) {
      // Arm before patching: setQueryData notifies subscribers synchronously,
      // so the layout effect can re-enter inside the next line.
      guard = { pending: true, cllData: cll };
      patchLineageCacheFromCll(queryClient, cll);
    }
    return cll;
  }

  return {
    fetchAndPatch,
    async resolveCllForLayout(request) {
      const { cllInput } = request;
      if (!cllInput) {
        // CLL disabled — drop the armed result so re-enabling CLL cannot reuse
        // change data from the previous session.
        guard = { pending: false };
        return undefined;
      }
      if (guard.pending) {
        // The effect re-fired because our own patch updated the lineage query.
        // Reuse that result; skip the API call and the re-patch.
        const cllData = guard.cllData;
        guard = { pending: false };
        return cllData;
      }
      return await fetchAndPatch({ ...request, cllInput });
    },
  };
}
