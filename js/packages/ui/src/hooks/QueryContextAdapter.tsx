"use client";

import { type ReactNode, useState } from "react";
import { QueryProvider, useQueryContext } from "../providers";

interface QueryContextAdapterProps {
  children: ReactNode;
}

export const defaultSqlQuery = 'select * from {{ ref("mymodel") }}';

/**
 * OSS-compatible QueryContext type with required fields.
 * The @datarecce/ui QueryContextType has optional OSS fields,
 * but OSS components expect them to be defined.
 */
export interface OSSQueryContext {
  sqlQuery: string;
  setSqlQuery: (sql: string) => void;
  primaryKeys: string[] | undefined;
  setPrimaryKeys: (pks: string[] | undefined) => void;
  isCustomQueries: boolean;
  setCustomQueries: (isCustom: boolean) => void;
  baseSqlQuery: string;
  setBaseSqlQuery: (sql: string) => void;
}

/**
 * QueryContextAdapter bridges OSS with @datarecce/ui's QueryProvider.
 *
 * Unlike CheckContextAdapter, this adapter manages internal state because
 * OSS's RecceQueryContext manages input state (sqlQuery, primaryKeys, etc.)
 * via useState, while @datarecce/ui's QueryProvider is props-driven.
 *
 * This adapter:
 * 1. Creates internal state matching OSS's interface
 * 2. Passes state and setters to QueryProvider as props
 * 3. Allows consumers to use the same hooks as before
 */
export function QueryContextAdapter({ children }: QueryContextAdapterProps) {
  // OSS input state
  const [sqlQuery, setSqlQuery] = useState<string>(defaultSqlQuery);
  const [baseSqlQuery, setBaseSqlQuery] = useState<string>(defaultSqlQuery);
  const [isCustomQueries, setCustomQueries] = useState<boolean>(false);
  const [primaryKeys, setPrimaryKeys] = useState<string[] | undefined>();

  return (
    <QueryProvider
      // Pass state as props to @datarecce/ui QueryProvider
      sql={sqlQuery}
      sqlQuery={sqlQuery}
      setSqlQuery={setSqlQuery}
      primaryKeys={primaryKeys}
      setPrimaryKeys={setPrimaryKeys}
      isCustomQueries={isCustomQueries}
      setCustomQueries={setCustomQueries}
      baseSqlQuery={baseSqlQuery}
      setBaseSqlQuery={setBaseSqlQuery}
    >
      {children}
    </QueryProvider>
  );
}

// Note: QueryContextType, QueryProviderProps, QueryResult are now imported directly from @datarecce/ui/providers
// This adapter only exports QueryContextAdapter, useRecceQueryContext, defaultSqlQuery, and OSSQueryContext type

// No-op fallbacks for when hook is used outside provider
const noopSetSqlQuery = (_sql: string) => {
  // Intentionally empty - fallback when used outside QueryContextAdapter
};
const noopSetPrimaryKeys = (_pks: string[] | undefined) => {
  // Intentionally empty - fallback when used outside QueryContextAdapter
};
const noopSetCustomQueries = (_isCustom: boolean) => {
  // Intentionally empty - fallback when used outside QueryContextAdapter
};
const noopSetBaseSqlQuery = (_sql: string) => {
  // Intentionally empty - fallback when used outside QueryContextAdapter
};

/**
 * OSS-compatible hook that returns the query context with guaranteed non-optional fields.
 * This wraps @datarecce/ui's useQueryContext and provides type safety for OSS components.
 */
export function useRecceQueryContext(): OSSQueryContext {
  const ctx = useQueryContext();

  // Return OSS-compatible interface with guaranteed values
  // The QueryContextAdapter ensures these are always set
  return {
    sqlQuery: ctx.sqlQuery ?? defaultSqlQuery,
    setSqlQuery: ctx.setSqlQuery ?? noopSetSqlQuery,
    primaryKeys: ctx.primaryKeys,
    setPrimaryKeys: ctx.setPrimaryKeys ?? noopSetPrimaryKeys,
    isCustomQueries: ctx.isCustomQueries ?? false,
    setCustomQueries: ctx.setCustomQueries ?? noopSetCustomQueries,
    baseSqlQuery: ctx.baseSqlQuery ?? defaultSqlQuery,
    setBaseSqlQuery: ctx.setBaseSqlQuery ?? noopSetBaseSqlQuery,
  };
}

// Note: useQueryContext is now imported directly from @datarecce/ui/providers
