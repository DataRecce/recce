import { LineageGraphNode } from "../lineage/lineage";

import { ValueDiffResultView } from "./ValueDiffResultView";
import { RunModal } from "../run/RunModal";
import { ValueDiffEditView } from "./ValueDiffEditView";

interface ValueDiffModalProp {
  node: LineageGraphNode;
}

export const ValueDiffModal = ({ node }: ValueDiffModalProp) => {
  return (
    <RunModal
      title="Value Diff"
      type="value_diff"
      params={{ model: node.name, primary_key: "" }}
      RunEditView={ValueDiffEditView}
      RunResultView={ValueDiffResultView}
    ></RunModal>
  );
};
