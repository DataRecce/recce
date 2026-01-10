import { type LineageViewContextType } from "@datarecce/ui";
import { createContext, useContext } from "react";

// Re-export types from @datarecce/ui for backward compatibility
export type {
  ActionMode,
  ActionState,
  LineageViewContextType,
  NodeAction,
  SelectMode,
} from "@datarecce/ui";

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
