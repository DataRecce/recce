import type { QueryClient } from "@tanstack/react-query";
import { cacheKeys } from "../../api/cacheKeys";
import type { CllInput, ColumnLineageData } from "../../api/cll";
import type { MergedLineageResponse, ServerInfoResult } from "../../api/info";

/**
 * Extract change analysis data from a CLL response and merge it into
 * the cached MergedLineageResponse.
 *
 * Patches node change_status and change fields in-place (shallow clone)
 * so React Query triggers a re-render.
 */
export function patchLineageFromCll(
  lineage: MergedLineageResponse,
  cllData: ColumnLineageData,
): MergedLineageResponse {
  const patchedNodes = { ...lineage.nodes };

  for (const [nodeId, cllNode] of Object.entries(cllData.current.nodes)) {
    if (!cllNode.change_status) {
      continue;
    }

    const existingNode = patchedNodes[nodeId];
    if (!existingNode) {
      continue;
    }

    // Build column change map from CLL node's columns
    let columns:
      | Record<string, "added" | "removed" | "modified" | "unknown">
      | undefined;
    if (cllNode.columns) {
      const columnChanges: Record<
        string,
        "added" | "removed" | "modified" | "unknown"
      > = {};
      let hasChanges = false;
      for (const col of Object.values(cllNode.columns)) {
        if (col.change_status) {
          columnChanges[col.name] = col.change_status;
          hasChanges = true;
        }
      }
      if (hasChanges) {
        columns = columnChanges;
      }
    }

    patchedNodes[nodeId] = {
      ...existingNode,
      change_status: cllNode.change_status,
      change: cllNode.change_category
        ? { category: cllNode.change_category, columns }
        : existingNode.change,
    };
  }

  return {
    ...lineage,
    nodes: patchedNodes,
  };
}

/**
 * Whether a finished CLL call carries change data worth patching into the
 * lineage cache. Only change-analysis calls do; a plain column-lineage call
 * has nothing to contribute, so the cache is left alone (no refetch either).
 */
export function shouldPatchLineageCache(
  cllApiInput: CllInput,
  cllData: ColumnLineageData | undefined,
): boolean {
  return !!cllApiInput.change_analysis && !!cllData;
}

/**
 * Merge CLL change data into the cached lineage instead of refetching it.
 *
 * The lineage query is patched in place so the graph picks up change status
 * immediately. The update is immutable — React Query needs a new reference to
 * notify subscribers.
 */
export function patchLineageCacheFromCll(
  queryClient: QueryClient,
  cllData: ColumnLineageData,
): void {
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
