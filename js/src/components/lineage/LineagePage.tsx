import { LineageView } from "./LineageView";
import { ReactFlowProvider } from "@xyflow/react";

export function LineagePage() {
  return (
    <ReactFlowProvider>
      <LineageView interactive />
    </ReactFlowProvider>
  );
}
