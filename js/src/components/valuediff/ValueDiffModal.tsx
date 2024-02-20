import { LineageGraphNode } from "../lineage/lineage";

import { ValueDiffResultView } from "./ValueDiffResultView";
import { RunModal } from "../run/RunModal";
import { ValueDiffEditView } from "./ValueDiffEditView";

interface ValueDiffModalProp {
  node: LineageGraphNode;
  triggerComponentType?: string;
}

export const ValueDiffModal = ({ node, triggerComponentType }: ValueDiffModalProp) => {
  return (
    <RunModal
      title="Value Diff"
      triggerComponentType={triggerComponentType}
      type="value_diff"
      params={{ model: node.name, primary_key: "" }}
      RunEditView={ValueDiffEditView}
      RunResultView={ValueDiffResultView}
    ></RunModal>
  );
};
