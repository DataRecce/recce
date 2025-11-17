import { ReactFlowProvider } from "@xyflow/react";
import { LineageView } from "./LineageView";

export function LineagePage() {
  return (
    <ReactFlowProvider>
      <LineageView interactive />
    </ReactFlowProvider>
  );
}
