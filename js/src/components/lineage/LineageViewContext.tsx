import { Run } from "@/lib/api/types";
import React, { createContext, useContext, useState, ReactNode } from "react";

export interface LineageViewContextType {
  selectNodeMulti: (nodeId: string) => void;
  selectMode: "action" | "detail" | "action_result";
  runRowCountDiff: () => Promise<void>;
  runValueDiff: () => Promise<void>;
  addLineageDiffCheck: (viewMode: string) => void;
  addSchemaDiffCheck: () => void;
  cancel: () => void;
  actionState: {
    mode: "per_node" | "multi_nodes";
    status: "pending" | "running" | "canceling" | "canceled" | "completed";
    currentRun?: Partial<Run>;
    completed: number;
    total: number;
  };
}

export const LineageViewContext = createContext<
  LineageViewContextType | undefined
>(undefined);

export const useLineageViewContext = (): LineageViewContextType => {
  const context = useContext(LineageViewContext);
  if (!context) {
    throw new Error(
      "useLineageViewContext must be used within a LineageViewProvider"
    );
  }
  return context;
};
