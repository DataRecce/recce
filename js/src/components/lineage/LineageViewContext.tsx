import React, { createContext, useContext, useState, ReactNode } from "react";

interface LineageViewContextType {
  selectNodeMulti: (nodeId: string) => void;
  selectMode: "action" | "detail" | "action_result";
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
