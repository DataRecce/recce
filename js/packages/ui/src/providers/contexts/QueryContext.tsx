"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface QueryResult {
  columns: string[];
  data: Record<string, unknown>[];
  rowCount: number;
}

export interface QueryContextType {
  // --- @datarecce/ui execution state ---
  sql: string;
  isExecuting: boolean;
  error?: string;
  baseResult?: QueryResult;
  currentResult?: QueryResult;
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;

  // --- OSS input state (merged for backward compatibility) ---
  /** @remarks Alias of sql (OSS backward compatibility). */
  sqlQuery?: string;
  /** @remarks Alias of onSqlChange (OSS backward compatibility). */
  setSqlQuery?: (sql: string) => void;
  /** Primary key columns for diff matching */
  primaryKeys?: string[];
  /** Setter for primary keys */
  setPrimaryKeys?: (pks: string[] | undefined) => void;
  /** Whether using custom SQL queries vs model-generated */
  isCustomQueries?: boolean;
  /** Setter for isCustomQueries */
  setCustomQueries?: (isCustom: boolean) => void;
  /** Base SQL query for diff comparison */
  baseSqlQuery?: string;
  /** Setter for base SQL query */
  setBaseSqlQuery?: (sql: string) => void;
}

const defaultContext: QueryContextType = {
  sql: "",
  isExecuting: false,
};

const QueryContext = createContext<QueryContextType>(defaultContext);
QueryContext.displayName = "RecceQueryContext";

export interface QueryProviderProps {
  children: ReactNode;
  // --- @datarecce/ui execution state ---
  sql?: string;
  isExecuting?: boolean;
  error?: string;
  baseResult?: QueryResult;
  currentResult?: QueryResult;
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;

  // --- OSS input state ---
  sqlQuery?: string;
  setSqlQuery?: (sql: string) => void;
  primaryKeys?: string[];
  setPrimaryKeys?: (pks: string[] | undefined) => void;
  isCustomQueries?: boolean;
  setCustomQueries?: (isCustom: boolean) => void;
  baseSqlQuery?: string;
  setBaseSqlQuery?: (sql: string) => void;
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
  // OSS fields
  sqlQuery,
  setSqlQuery,
  primaryKeys,
  setPrimaryKeys,
  isCustomQueries,
  setCustomQueries,
  baseSqlQuery,
  setBaseSqlQuery,
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
      // OSS fields
      sqlQuery,
      setSqlQuery,
      primaryKeys,
      setPrimaryKeys,
      isCustomQueries,
      setCustomQueries,
      baseSqlQuery,
      setBaseSqlQuery,
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
      sqlQuery,
      setSqlQuery,
      primaryKeys,
      setPrimaryKeys,
      isCustomQueries,
      setCustomQueries,
      baseSqlQuery,
      setBaseSqlQuery,
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
