"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { LineageViewOss } from "./LineageViewOss";

export function LineagePageOss() {
  return (
    <ReactFlowProvider>
      <LineageViewOss interactive />
    </ReactFlowProvider>
  );
}
