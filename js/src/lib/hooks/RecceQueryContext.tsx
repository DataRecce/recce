import React, { createContext, useContext } from "react";

export interface RowCountStateContext {
  isNodesFetching: string[];
  setIsNodesFetching: (nodes: string[]) => void;
}

const defaultRowCountStateContext: RowCountStateContext = {
  isNodesFetching: [],
  setIsNodesFetching: () => {
    return void 0;
  },
};

const RowCountStateContext = createContext(defaultRowCountStateContext);

interface RowCountStateContextProps {
  children: React.ReactNode;
}

export function RowCountStateContextProvider({
  children,
}: RowCountStateContextProps) {
  const [isNodesFetching, setIsNodesFetching] = React.useState<string[]>([]);
  return (
    <RowCountStateContext.Provider
      value={{ isNodesFetching, setIsNodesFetching }}
    >
      {children}
    </RowCountStateContext.Provider>
  );
}

export const useRowCountStateContext = () => useContext(RowCountStateContext);
