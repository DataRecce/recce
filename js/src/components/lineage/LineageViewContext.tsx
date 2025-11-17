import React, { createContext, useContext } from "react";
import { CllInput, ColumnLineageData } from "@/lib/api/cll";
import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { Run } from "@/lib/api/types";
import { LineageGraphNode, LineageGraphNodes } from "./lineage";

type NewType = LineageDiffViewOptions;
type ActionMode = "per_node" | "multi_nodes";

interface NodeAction {
  mode: ActionMode;
  status?: "pending" | "running" | "success" | "failure" | "skipped";
  skipReason?: string;
  run?: Run;
}

export interface ActionState {
  mode: ActionMode;
  status: "pending" | "running" | "canceling" | "canceled" | "completed";
  currentRun?: Partial<Run>;
  completed: number;
  total: number;
  actions: Record<string, NodeAction>;
}

export interface LineageViewContextType {
  interactive: boolean;
  nodes: LineageGraphNodes[];
  focusedNode?: LineageGraphNode;
  selectedNodes: LineageGraphNode[];
  cll: ColumnLineageData | undefined;

  // context menu
  showContextMenu: (event: React.MouseEvent, node: LineageGraphNodes) => void;

  // filter
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: NewType) => void;

  // Multi nodes selection
  selectMode: "selecting" | "action_result" | undefined;
  selectNode: (nodeId: string) => void;
  selectParentNodes: (nodeId: string, degree?: number) => void;
  selectChildNodes: (nodeId: string, degree?: number) => void;
  deselect: () => void;

  // node state
  isNodeHighlighted: (nodeId: string) => boolean;
  isNodeSelected: (nodeId: string) => boolean;
  isEdgeHighlighted: (source: string, target: string) => boolean;
  getNodeAction: (nodeId: string) => NodeAction;
  getNodeColumnSet: (nodeId: string) => Set<string>;
  isNodeShowingChangeAnalysis: (nodeId: string) => boolean;

  //actions
  runRowCount: () => Promise<void>;
  runRowCountDiff: () => Promise<void>;
  runValueDiff: () => Promise<void>;
  addLineageDiffCheck: (viewMode?: string) => void;
  addSchemaDiffCheck: () => void;
  cancel: () => void;
  actionState: ActionState;

  // Column Level Lineage
  centerNode: (nodeId: string) => void;
  showColumnLevelLineage: (cll?: CllInput) => Promise<void>;
  resetColumnLevelLineage: (previous?: boolean) => Promise<void>;
}

export const LineageViewContext = createContext<
  LineageViewContextType | undefined
>(undefined);

export const useLineageViewContextSafe = (): LineageViewContextType => {
  const context = useContext(LineageViewContext);
  if (!context) {
    throw new Error(
      "useLineageViewContext must be used within a LineageViewProvider",
    );
  }
  return context;
};

export const useLineageViewContext = (): LineageViewContextType | undefined => {
  return useContext(LineageViewContext);
};
