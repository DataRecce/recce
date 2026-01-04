"use client";

import {
  type QueryContextType,
  QueryProvider,
  type QueryProviderProps,
  type QueryResult,
  useQueryContext,
} from "@datarecce/ui/providers";
import { type ReactNode, useState } from "react";

interface QueryContextAdapterProps {
  children: ReactNode;
}

export const defaultSqlQuery = 'select * from {{ ref("mymodel") }}';

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

// Re-export types for backward compatibility
export type {
  QueryContextType,
  QueryProviderProps,
  QueryResult,
} from "@datarecce/ui/providers";

// Re-export hook with OSS alias for backward compatibility
export { useQueryContext, useQueryContext as useRecceQueryContext };
