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

/**
 * A run result whose content is bound to a specific model node. Profile /
 * value / top-k / histogram / value-detail diffs render inside that model's
 * NodeView, so they only make sense while the model is part of the rendered
 * lineage. (row_count / query / query_diff results are NOT node-bound — they
 * render in their own pane regardless of the visible nodes.)
 */
export function isNodeBoundRunResult(run: Run | undefined): boolean {
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
  // `run` is a node-bound run (checked above) whose params carry a `model`. The
  // Run union as a whole doesn't expose `model` (query runs lack it), so read it
  // through a narrow shape rather than fighting the union type.
  const model = (run?.params as { model?: string } | undefined)?.model;
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
