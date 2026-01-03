"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface QueryResult {
  columns: string[];
  data: Record<string, unknown>[];
  rowCount: number;
}

export interface QueryContextType {
  sql: string;
  isExecuting: boolean;
  error?: string;
  baseResult?: QueryResult;
  currentResult?: QueryResult;
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;
}

const defaultContext: QueryContextType = {
  sql: "",
  isExecuting: false,
};

const QueryContext = createContext<QueryContextType>(defaultContext);
QueryContext.displayName = "RecceQueryContext";

export interface QueryProviderProps {
  children: ReactNode;
  sql?: string;
  isExecuting?: boolean;
  error?: string;
  baseResult?: QueryResult;
  currentResult?: QueryResult;
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;
}

export function QueryProvider({
  children,
  sql = "",
  isExecuting = false,
  error,
  baseResult,
  currentResult,
  onSqlChange,
  onExecute,
  onCancel,
}: QueryProviderProps) {
  const contextValue = useMemo<QueryContextType>(
    () => ({
      sql,
      isExecuting,
      error,
      baseResult,
      currentResult,
      onSqlChange,
      onExecute,
      onCancel,
    }),
    [
      sql,
      isExecuting,
      error,
      baseResult,
      currentResult,
      onSqlChange,
      onExecute,
      onCancel,
    ],
  );

  return (
    <QueryContext.Provider value={contextValue}>
      {children}
    </QueryContext.Provider>
  );
}

export function useQueryContext(): QueryContextType {
  return useContext(QueryContext);
}
