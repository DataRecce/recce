import { LineageViewOss as LineageView } from "@datarecce/ui/components/lineage/LineageViewOss";
import { ReactFlowProvider } from "@xyflow/react";

export function LineagePage() {
  return (
    <ReactFlowProvider>
      <LineageView interactive />
    </ReactFlowProvider>
  );
}
