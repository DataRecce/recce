import React, { createContext, useContext } from "react";

export interface QueryContext {
  sqlQuery: string;
  setSqlQuery: (sqlQuery: string) => void;
  primaryKeys: string[] | undefined;
  setPrimaryKeys: (primaryKeys: string[] | undefined) => void;
  isCustomQueries: boolean;
  setCustomQueries: (isCustomQueries: boolean) => void;
  baseSqlQuery?: string;
  setBaseSqlQuery?: (baseSqlQuery: string) => void;
}

export const defaultSqlQuery = 'select * from {{ ref("mymodel") }}';

const defaultQueryContext: QueryContext = {
  sqlQuery: defaultSqlQuery,
  setSqlQuery: () => {},
  primaryKeys: undefined,
  setPrimaryKeys: () => {},
  isCustomQueries: false,
  setCustomQueries: () => {},
  baseSqlQuery: defaultSqlQuery,
  setBaseSqlQuery: () => {},
};

const RecceQueryContext = createContext(defaultQueryContext);

interface QueryContextProps {
  children: React.ReactNode;
}

export function RecceQueryContextProvider({ children }: QueryContextProps) {
  const [sqlQuery, setSqlQuery] = React.useState<string>(defaultSqlQuery);
  const [baseSqlQuery, setBaseSqlQuery] =
    React.useState<string>(defaultSqlQuery);
  const [isCustomQueries, setCustomQueries] = React.useState<boolean>(false);
  const [primaryKeys, setPrimaryKeys] = React.useState<string[] | undefined>();
  return (
    <RecceQueryContext.Provider
      value={{
        setSqlQuery,
        sqlQuery,
        setPrimaryKeys,
        primaryKeys,
        isCustomQueries,
        setCustomQueries,
        baseSqlQuery,
        setBaseSqlQuery,
      }}
    >
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
