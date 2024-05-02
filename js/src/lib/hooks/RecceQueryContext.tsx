import React, { createContext, useContext } from "react";

export interface QueryContext {
  sqlQuery: string;
  setSqlQuery: (sqlQuery: string) => void;
}

export const defaultSqlQuery = 'select * from {{ ref("mymodel") }}';

const defaultQueryContext: QueryContext = {
  sqlQuery: defaultSqlQuery,
  setSqlQuery: () => {},
};

const RecceQueryContext = createContext(defaultQueryContext);

interface QueryContextProps {
  children: React.ReactNode;
}

export function RecceQueryContextProvider({ children }: QueryContextProps) {
  const [sqlQuery, setSqlQuery] = React.useState<string>(defaultSqlQuery);
  return (
    <RecceQueryContext.Provider value={{ setSqlQuery, sqlQuery }}>
      {children}
    </RecceQueryContext.Provider>
  );
}

export const useRecceQueryContext = () => useContext(RecceQueryContext);

export interface RowCountStateContext {
  isNodesFetching: string[];
  setIsNodesFetching: (nodes: string[]) => void;
}

const defaultRowCountStateContext: RowCountStateContext = {
  isNodesFetching: [],
  setIsNodesFetching: () => {},
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
