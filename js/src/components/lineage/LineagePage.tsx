import { LineageView } from "./LineageView";
import { ReactFlowProvider } from "reactflow";

export function LineagePage() {
  return (
    <ReactFlowProvider>
      <LineageView interactive />
    </ReactFlowProvider>
  );
}
