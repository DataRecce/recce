"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { type ReactNode, useMemo } from "react";

import type { RecceActionProviderProps } from "../contexts/action";
import { RecceActionProvider } from "../contexts/action";
import { IdleTimeoutProvider } from "../contexts/idle";
import { RecceInstanceInfoProvider } from "../contexts/instance";
import type { LineageGraphProviderProps } from "../contexts/lineage";
import { LineageGraphProvider } from "../contexts/lineage";
import { ApiProvider } from "./contexts/ApiContext";
import type { Check, CheckProviderProps } from "./contexts/CheckContext";
import { CheckProvider } from "./contexts/CheckContext";
import type { QueryProviderProps, QueryResult } from "./contexts/QueryContext";
import { QueryProvider } from "./contexts/QueryContext";
import { RoutingProvider } from "./contexts/RoutingContext";
import { ThemeProvider } from "./contexts/ThemeContext";

/**
 * Theme mode selection for RecceProvider.
 */
type ThemeMode = "light" | "dark" | "system";

/**
 * Props for {@link RecceProvider}.
 */
interface RecceProviderProps {
  children: ReactNode;

  /**
   * API configuration - simple config OR custom client.
   */
  api:
    | {
        baseUrl: string;
        headers?: Record<string, string>;
        timeout?: number;
      }
    | {
        client: AxiosInstance;
      };

  /**
   * Theme mode.
   *
   * @defaultValue "system"
   */
  theme?: ThemeMode;

  /**
   * Routing configuration
   *
   * @example
   * ```tsx
   * // With Next.js App Router
   * const router = useRouter();
   * const pathname = usePathname();
   *
   * <RecceProvider
   *   routing={{
   *     basePath: '/app',
   *     pathname,
   *     onNavigate: (path, options) => {
   *       options?.replace ? router.replace(path) : router.push(path);
   *     }
   *   }}
   * />
   * ```
   */
  routing?: {
    basePath?: string;
    pathname?: string;
    onNavigate?: (
      path: string,
      options?: { replace?: boolean; scroll?: boolean },
    ) => void;
  };

  /**
   * TanStack Query client configuration.
   */
  queryClient?: {
    staleTime?: number;
    gcTime?: number;
  };

  /**
   * Run action configuration
   * Props for RecceActionProvider - manages run execution and result display
   */
  runActions?: {
    /** Handler called when a run action is requested */
    onRunAction?: RecceActionProviderProps["onRunAction"];
    /** Handler called when a run result should be shown */
    onShowRunId?: RecceActionProviderProps["onShowRunId"];
    /** Initial run ID to display */
    initialRunId?: string;
    /** Initial state for history panel */
    initialHistoryOpen?: boolean;
  };

  /**
   * Lineage graph configuration
   * Props for LineageGraphProvider - manages lineage visualization
   */
  lineage?: {
    /** The processed lineage graph data */
    lineageGraph?: LineageGraphProviderProps["lineageGraph"];
    /** Environment information (git, dbt, sqlmesh metadata) */
    envInfo?: LineageGraphProviderProps["envInfo"];
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
    runsAggregated?: LineageGraphProviderProps["runsAggregated"];
    /** Callback to refetch aggregated runs */
    onRefetchRunsAggregated?: () => void;
  };

  /**
   * Check management configuration
   * Props for CheckProvider - manages check CRUD operations
   */
  checks?: {
    /** List of checks */
    checks?: Check[];
    /** Loading state */
    isLoading?: boolean;
    /** Error message */
    error?: string;
    /** Currently selected check ID */
    selectedCheckId?: string;
    /** Handler for check selection */
    onSelectCheck?: CheckProviderProps["onSelectCheck"];
    /** Handler for check creation */
    onCreateCheck?: CheckProviderProps["onCreateCheck"];
    /** Handler for check updates */
    onUpdateCheck?: CheckProviderProps["onUpdateCheck"];
    /** Handler for check deletion */
    onDeleteCheck?: CheckProviderProps["onDeleteCheck"];
    /** Handler for check reordering */
    onReorderChecks?: CheckProviderProps["onReorderChecks"];
    /** Callback to refetch checks */
    refetchChecks?: () => void;
  };

  /**
   * Query editor configuration
   * Props for QueryProvider - manages SQL query execution
   */
  query?: {
    /** Current SQL query */
    sql?: string;
    /** Whether query is executing */
    isExecuting?: boolean;
    /** Error message */
    error?: string;
    /** Query result for base environment */
    baseResult?: QueryResult;
    /** Query result for current environment */
    currentResult?: QueryResult;
    /** Handler for SQL changes */
    onSqlChange?: QueryProviderProps["onSqlChange"];
    /** Handler for query execution */
    onExecute?: QueryProviderProps["onExecute"];
    /** Handler for query cancellation */
    onCancel?: QueryProviderProps["onCancel"];
  };

  /**
   * Feature flags - control which contexts are enabled
   * Set to false to skip a context entirely (reduces overhead if unused)
   */
  features?: {
    /** Enable RecceInstanceInfoProvider (instance info and feature toggles) */
    enableInstance?: boolean;
    /** Enable IdleTimeoutProvider (session timeout and keep-alive) */
    enableIdleTimeout?: boolean;
    /** Enable LineageGraphProvider (lineage visualization) */
    enableLineage?: boolean;
    /** Enable RecceActionProvider (run execution) */
    enableRunActions?: boolean;
    /** Enable CheckProvider (check management) */
    enableChecks?: boolean;
    /** Enable QueryProvider (SQL query editor) */
    enableQuery?: boolean;
  };
}

// Create a default query client
const createDefaultQueryClient = (
  options?: RecceProviderProps["queryClient"],
) =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: options?.staleTime ?? 1000 * 60, // 1 minute
        gcTime: options?.gcTime ?? 1000 * 60 * 5, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

/**
 * RecceProvider - The single entry point for @datarecce/ui
 *
 * This provider orchestrates ALL Recce contexts in the correct order.
 * It follows a props-driven design - pass your data and callbacks, no internal fetching.
 *
 * **Architecture:**
 * - Foundation layer: QueryClient → API → Theme → Routing
 * - Data layer: Instance → Idle → Lineage → RunActions
 * - UI layer: Checks → Query
 *
 * **Feature Flags:**
 * Use `features` prop to disable unused contexts and reduce overhead.
 *
 * @example
 * ```tsx
 * // Minimal setup (only API + Theme)
 * <RecceProvider api={{ baseUrl: "/api" }}>
 *   <MyApp />
 * </RecceProvider>
 *
 * // Full setup with all features
 * <RecceProvider
 *   api={{ baseUrl: "/api" }}
 *   theme="dark"
 *   lineage={{
 *     lineageGraph: data.lineageGraph,
 *     envInfo: data.envInfo,
 *     onRefetchLineageGraph: refetch,
 *   }}
 *   runActions={{
 *     onRunAction: handleRunAction,
 *     onShowRunId: handleShowRun,
 *   }}
 *   checks={{
 *     checks: checksData,
 *     onCreateCheck: createCheck,
 *     onUpdateCheck: updateCheck,
 *   }}
 *   features={{
 *     enableLineage: true,
 *     enableRunActions: true,
 *     enableChecks: true,
 *   }}
 * >
 *   <MyApp />
 * </RecceProvider>
 * ```
 */
export function RecceProvider({
  children,
  api,
  theme = "system",
  routing,
  queryClient: queryClientConfig,
  runActions,
  lineage,
  checks,
  query,
  features = {},
}: RecceProviderProps) {
  // Extract primitive values to stabilize dependency and prevent unnecessary QueryClient recreation
  const staleTime = queryClientConfig?.staleTime;
  const gcTime = queryClientConfig?.gcTime;

  const queryClient = useMemo(
    () =>
      createDefaultQueryClient({
        staleTime,
        gcTime,
      }),
    [staleTime, gcTime],
  );

  // Default all features to true unless explicitly disabled
  const {
    enableInstance = true,
    enableIdleTimeout = true,
    enableLineage = true,
    enableRunActions = true,
    enableChecks = true,
    enableQuery = true,
  } = features;

  // Foundation layer: QueryClient → API → Theme → Routing
  let tree = children;

  // Wrap with Routing (innermost of foundation layer)
  tree = <RoutingProvider config={routing}>{tree}</RoutingProvider>;

  // Wrap with Theme
  tree = <ThemeProvider defaultMode={theme}>{tree}</ThemeProvider>;

  // Wrap with API
  tree = <ApiProvider config={api}>{tree}</ApiProvider>;

  // Wrap with QueryClient (outermost of foundation layer)
  tree = <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>;

  // Data layer: Instance → Idle → Lineage → RunActions
  // These are wrapped in reverse order (bottom-up)

  // UI layer: Query (innermost)
  if (enableQuery) {
    tree = (
      <QueryProvider
        sql={query?.sql}
        isExecuting={query?.isExecuting}
        error={query?.error}
        baseResult={query?.baseResult}
        currentResult={query?.currentResult}
        onSqlChange={query?.onSqlChange}
        onExecute={query?.onExecute}
        onCancel={query?.onCancel}
      >
        {tree}
      </QueryProvider>
    );
  }

  // UI layer: Checks
  if (enableChecks) {
    tree = (
      <CheckProvider
        checks={checks?.checks}
        isLoading={checks?.isLoading}
        error={checks?.error}
        selectedCheckId={checks?.selectedCheckId}
        onSelectCheck={checks?.onSelectCheck}
        onCreateCheck={checks?.onCreateCheck}
        onUpdateCheck={checks?.onUpdateCheck}
        onDeleteCheck={checks?.onDeleteCheck}
        onReorderChecks={checks?.onReorderChecks}
        refetchChecks={checks?.refetchChecks}
      >
        {tree}
      </CheckProvider>
    );
  }

  // Data layer: RunActions
  if (enableRunActions) {
    tree = (
      <RecceActionProvider
        onRunAction={runActions?.onRunAction}
        onShowRunId={runActions?.onShowRunId}
        initialRunId={runActions?.initialRunId}
        initialHistoryOpen={runActions?.initialHistoryOpen}
      >
        {tree}
      </RecceActionProvider>
    );
  }

  // Data layer: Lineage
  if (enableLineage) {
    tree = (
      <LineageGraphProvider
        lineageGraph={lineage?.lineageGraph}
        envInfo={lineage?.envInfo}
        reviewMode={lineage?.reviewMode}
        cloudMode={lineage?.cloudMode}
        fileMode={lineage?.fileMode}
        fileName={lineage?.fileName}
        isDemoSite={lineage?.isDemoSite}
        isCodespace={lineage?.isCodespace}
        isLoading={lineage?.isLoading}
        error={lineage?.error}
        supportTasks={lineage?.supportTasks}
        onRefetchLineageGraph={lineage?.onRefetchLineageGraph}
        runsAggregated={lineage?.runsAggregated}
        onRefetchRunsAggregated={lineage?.onRefetchRunsAggregated}
      >
        {tree}
      </LineageGraphProvider>
    );
  }

  // Data layer: Idle (depends on Instance for idle timeout config)
  if (enableIdleTimeout) {
    tree = <IdleTimeoutProvider>{tree}</IdleTimeoutProvider>;
  }

  // Data layer: Instance (outermost, provides feature toggles for all others)
  if (enableInstance) {
    tree = <RecceInstanceInfoProvider>{tree}</RecceInstanceInfoProvider>;
  }

  return tree;
}

export type { RecceProviderProps };
