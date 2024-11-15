import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { Run } from "@/lib/api/types";
import React, { createContext, useContext, useState, ReactNode } from "react";

type NewType = LineageDiffViewOptions;

export interface LineageViewContextType {
  selectMode: "action" | "detail" | "action_result";

  // filter
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: NewType) => void;

  // selector
  selectNodeMulti: (nodeId: string) => void;
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
