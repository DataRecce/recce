import { LineageGraphNode } from "../lineage/lineage";
import { RunModal } from "../run/RunModal";
import { TopKDiffEditView } from "./TopKDiffEditView";
import { TopKDiffResultView } from "./TopKDiffResultView";

interface ValueDiffModalProp {
  node: LineageGraphNode;
  triggerComponentType?: string;
}

export const TopKDiffModal = ({ node, triggerComponentType }: ValueDiffModalProp) => {
  return (
    <RunModal
      title="Top-K Diff"
      triggerComponentType={triggerComponentType}
      type="top_k_diff"
      params={{ model: node.name, column_name: "", k: 50 }}
      RunEditView={TopKDiffEditView}
      RunResultView={TopKDiffResultView}
    />
  );
}
