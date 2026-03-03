import { createContext, useContext } from "react";
import type { LineageViewContextType } from "./types";

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
