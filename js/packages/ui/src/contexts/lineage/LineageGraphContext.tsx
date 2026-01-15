"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import type { RunsAggregated } from "../../api/runs";
import type { EnvInfo, LineageGraph, LineageGraphContextType } from "./types";

/**
 * Props for LineageGraphProvider
 *
 * This is a props-driven provider - pass data from your data fetching layer.
 * The provider does NOT fetch data internally; consumers handle data fetching
 * and pass the results via props.
 */
export interface LineageGraphProviderProps {
  children: ReactNode;

  /** The processed lineage graph data */
  lineageGraph?: LineageGraph;

  /** Environment information (git, dbt, sqlmesh metadata) */
  envInfo?: EnvInfo;

  /** Whether in review mode (read-only checks) */
  reviewMode?: boolean;

  /** Whether in cloud mode (recce cloud) */
  cloudMode?: boolean;

  /** Whether in file mode (loading from file) */
  fileMode?: boolean;

  /** The state file name if in file mode */
  fileName?: string;

  /** Whether this is the demo site */
  isDemoSite?: boolean;

  /** Whether running in GitHub Codespace */
  isCodespace?: boolean;

  /** Loading state */
  isLoading?: boolean;

  /** Error message if loading failed */
  error?: string;

  /** Supported task types from server */
  supportTasks?: Record<string, boolean>;

  /** Callback to refetch the lineage graph */
  onRefetchLineageGraph?: () => void;

  /** Pre-aggregated run results by model */
  runsAggregated?: RunsAggregated;

  /** Callback to refetch aggregated runs */
  onRefetchRunsAggregated?: () => void;
}

const defaultContext: LineageGraphContextType = {
  isActionAvailable: () => true,
  isDemoSite: false,
};

const LineageGraphContext =
  createContext<LineageGraphContextType>(defaultContext);
LineageGraphContext.displayName = "RecceLineageGraphContext";

/**
 * Provider for LineageGraph context.
 *
 * This is a props-driven provider designed for library consumers.
 * Pass data from your data fetching layer (e.g., TanStack Query).
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useQuery({
 *   queryKey: ['lineage'],
 *   queryFn: fetchLineageData,
 * });
 *
 * <LineageGraphProvider
 *   lineageGraph={data?.lineageGraph}
 *   envInfo={data?.envInfo}
 *   isLoading={isLoading}
 *   error={error?.message}
 *   onRefetchLineageGraph={refetch}
 * >
 *   <LineageView />
 * </LineageGraphProvider>
 * ```
 */
export function LineageGraphProvider({
  children,
  lineageGraph,
  envInfo,
  reviewMode,
  cloudMode,
  fileMode,
  fileName,
  isDemoSite = false,
  isCodespace,
  isLoading,
  error,
  supportTasks,
  onRefetchLineageGraph,
  runsAggregated,
  onRefetchRunsAggregated,
}: LineageGraphProviderProps) {
  // Create stable isActionAvailable function
  const isActionAvailable = useCallback(
    (name: string) => {
      if (supportTasks) {
        // Default to true if action not found in supportTasks
        return supportTasks[name] ?? true;
      }
      // If supportTasks not provided, all actions are available
      return true;
    },
    [supportTasks],
  );

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo<LineageGraphContextType>(
    () => ({
      lineageGraph,
      envInfo,
      reviewMode,
      cloudMode,
      fileMode,
      fileName,
      isDemoSite,
      isCodespace,
      isLoading,
      error,
      supportTasks,
      retchLineageGraph: onRefetchLineageGraph,
      isActionAvailable,
      runsAggregated,
      refetchRunsAggregated: onRefetchRunsAggregated,
    }),
    [
      lineageGraph,
      envInfo,
      reviewMode,
      cloudMode,
      fileMode,
      fileName,
      isDemoSite,
      isCodespace,
      isLoading,
      error,
      supportTasks,
      onRefetchLineageGraph,
      isActionAvailable,
      runsAggregated,
      onRefetchRunsAggregated,
    ],
  );

  return (
    <LineageGraphContext.Provider value={contextValue}>
      {children}
    </LineageGraphContext.Provider>
  );
}

/**
 * Hook to access the LineageGraph context.
 *
 * @returns LineageGraphContextType with lineage data and utilities
 * @throws Warning in dev mode if used outside provider (returns default context)
 */
export function useLineageGraphContext(): LineageGraphContextType {
  const context = useContext(LineageGraphContext);
  return context;
}

/**
 * Hook to access aggregated runs data.
 * Convenience wrapper around useLineageGraphContext.
 *
 * @returns Tuple of [runsAggregated, refetchRunsAggregated]
 */
export function useRunsAggregated(): [
  RunsAggregated | undefined,
  (() => void) | undefined,
] {
  const { runsAggregated, refetchRunsAggregated } = useLineageGraphContext();
  return [runsAggregated, refetchRunsAggregated];
}
