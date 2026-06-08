import {
  isHistogramDiffRun,
  isProfileDiffRun,
  isTopKDiffRun,
  isValueDiffDetailRun,
  isValueDiffRun,
  type Run,
} from "../../api";
import {
  isLineageGraphNode,
  type LineageGraphNodes,
} from "../../contexts/lineage/types";

/** The run types whose result is bound to a specific model node. */
type NodeBoundRun = Run & {
  type:
    | "top_k_diff"
    | "profile_diff"
    | "histogram_diff"
    | "value_diff"
    | "value_diff_detail";
};

/**
 * A run result whose content is bound to a specific model node. Profile /
 * value / top-k / histogram / value-detail diffs render inside that model's
 * NodeView, so they only make sense while the model is part of the rendered
 * lineage. (row_count / query / query_diff results are NOT node-bound — they
 * render in their own pane regardless of the visible nodes.)
 *
 * Typed as a type guard so callers narrow `run` to `NodeBoundRun` and can read
 * `run.params?.model` without casting away the discriminated-union typing.
 */
export function isNodeBoundRunResult(
  run: Run | undefined,
): run is NodeBoundRun {
  return (
    !!run &&
    (isTopKDiffRun(run) ||
      isProfileDiffRun(run) ||
      isHistogramDiffRun(run) ||
      isValueDiffRun(run) ||
      isValueDiffDetailRun(run))
  );
}

/**
 * Decide whether an open, node-bound run result should be closed because its
 * model is no longer present in the rendered lineage (e.g. after a view-mode
 * change filters the model out of the graph).
 */
export function shouldCloseOrphanedRunResult(
  run: Run | undefined,
  nodes: LineageGraphNodes[],
): boolean {
  if (!isNodeBoundRunResult(run)) {
    return false;
  }
  // `run` is now narrowed to a node-bound run, whose params carry `model`.
  const model = run.params?.model;
  if (!model) {
    return false;
  }
  // DRC-3532 deep-link race guard: while the lineage graph has not been built
  // yet the node set is empty, so "model not found" means "not rendered yet",
  // NOT "orphaned". A run result deep-linked open before the first layout (a
  // cloud `?id=` calling showRunId) must not be closed in that window. Once
  // nodes exist, an absent model is a genuine orphan and the pane closes.
  if (nodes.length === 0) {
    return false;
  }
  return !nodes.filter(isLineageGraphNode).some((n) => n.data.name === model);
}
