import { LineageGraphNode } from "../lineage/lineage";
import { RunModal } from "../run/RunModal";
import { HistogramDiffEditView } from "./HistogramDiffEditView";
import { HistogramDiffResultView } from "./HistogramDiffResultView";

interface HistogramDiffModalProps {
  node: LineageGraphNode;
  triggerComponentType?: string;
}

export const HistogramDiffModal = ({ node, triggerComponentType }: HistogramDiffModalProps) => {
  return (
    <RunModal
      title="Histogram Diff"
      triggerComponentType={triggerComponentType}
      type="histogram_diff"
      params={{ model: node.name, column_name: "" , column_type: "" }}
      RunEditView={HistogramDiffEditView}
      RunResultView={HistogramDiffResultView}
    />
  );
}
