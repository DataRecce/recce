import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { Run } from "@/lib/api/types";
import { createContext, useContext } from "react";
import { Node } from "reactflow";
import { LineageGraphNode } from "./lineage";

type NewType = LineageDiffViewOptions;

export interface LineageViewContextType {
  interactive: boolean;
  selectMode: "multi" | "single" | "action_result";
  nodes: Node<LineageGraphNode>[];

  // filter
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: NewType) => void;

  // selector
  selectNodeMulti: (nodeId: string) => void;
  deselect: () => void;

  runRowCount: () => Promise<void>;
  runRowCountDiff: () => Promise<void>;
  runValueDiff: () => Promise<void>;
  addLineageDiffCheck: (viewMode?: string) => void;
  addSchemaDiffCheck: () => void;
  cancel: () => void;
  actionState: {
    mode: "per_node" | "multi_nodes";
    status: "pending" | "running" | "canceling" | "canceled" | "completed";
    currentRun?: Partial<Run>;
    completed: number;
    total: number;
  };

  // advancedImpactRadius
  advancedImpactRadius: boolean;
  setAdvancedImpactRadius: (value: boolean) => void;

  // Column Level Lineage
  showColumnLevelLineage: (nodeId: string, column: string) => Promise<void>;
  resetColumnLevelLinage: () => void;
}

export const LineageViewContext = createContext<LineageViewContextType | undefined>(undefined);

export const useLineageViewContextSafe = (): LineageViewContextType => {
  const context = useContext(LineageViewContext);
  if (!context) {
    throw new Error("useLineageViewContext must be used within a LineageViewProvider");
  }
  return context;
};

export const useLineageViewContext = (): LineageViewContextType | undefined => {
  return useContext(LineageViewContext);
};
