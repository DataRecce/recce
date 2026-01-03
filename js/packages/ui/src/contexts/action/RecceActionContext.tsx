"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type {
  AxiosQueryParams,
  RecceActionContextType,
  RecceActionOptions,
} from "./types";

/**
 * Props for RecceActionProvider
 *
 * This is a props-driven provider - pass your own run execution handler.
 * The provider manages UI state (result pane, history panel) internally.
 */
export interface RecceActionProviderProps {
  children: ReactNode;

  /**
   * Handler called when a run action is requested.
   * Implement this to submit runs to your backend.
   *
   * @param type - The run type (e.g., "row_count_diff", "value_diff")
   * @param params - Query parameters for the run
   * @param options - Action options (showForm, trackProps)
   * @returns Promise that resolves to the run ID, or void if handled differently
   */
  onRunAction?: (
    type: string,
    params?: AxiosQueryParams,
    options?: RecceActionOptions,
  ) => Promise<string | undefined> | string | undefined;

  /**
   * Handler called when a run result should be shown.
   * Called by showRunId when displaying a specific run.
   *
   * @param runId - The run ID to display
   * @param refreshHistory - Whether to refresh the history list
   */
  onShowRunId?: (runId: string, refreshHistory?: boolean) => void;

  /** Initial run ID to display (optional) */
  initialRunId?: string;

  /** Initial state for history panel (default: false) */
  initialHistoryOpen?: boolean;
}

const defaultContext: RecceActionContextType = {
  runAction: () => void 0,
  showRunId: () => void 0,
  isRunResultOpen: false,
  closeRunResult: () => void 0,
  isHistoryOpen: false,
  closeHistory: () => void 0,
  showHistory: () => void 0,
  setHistoryOpen: () => void 0,
  clearRunResult: () => void 0,
};

const RecceActionContext =
  createContext<RecceActionContextType>(defaultContext);
RecceActionContext.displayName = "RecceActionContext";

/**
 * Provider for run action context.
 *
 * This is a props-driven provider designed for library consumers.
 * Pass your own `onRunAction` handler to execute runs.
 *
 * @example
 * ```tsx
 * const handleRunAction = async (type, params, options) => {
 *   const response = await api.submitRun(type, params);
 *   return response.run_id;
 * };
 *
 * <RecceActionProvider onRunAction={handleRunAction}>
 *   <LineageView />
 * </RecceActionProvider>
 * ```
 */
export function RecceActionProvider({
  children,
  onRunAction,
  onShowRunId,
  initialRunId,
  initialHistoryOpen = false,
}: RecceActionProviderProps) {
  // Run result pane state
  const [isRunResultOpen, setRunResultOpen] = useState(!!initialRunId);
  const [runId, setRunId] = useState<string | undefined>(initialRunId);

  // History panel state
  const [isHistoryOpen, setHistoryOpen] = useState(initialHistoryOpen);

  // Close run result pane
  const closeRunResult = useCallback(() => {
    setRunResultOpen(false);
  }, []);

  // Clear run result and close pane
  const clearRunResult = useCallback(() => {
    setRunId(undefined);
    setRunResultOpen(false);
  }, []);

  // History panel controls
  const showHistory = useCallback(() => {
    setHistoryOpen(true);
  }, []);

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  // Show a specific run result
  const showRunId = useCallback(
    (newRunId: string, refreshHistory?: boolean) => {
      setRunId(newRunId);
      setRunResultOpen(true);
      onShowRunId?.(newRunId, refreshHistory);
    },
    [onShowRunId],
  );

  // Execute a run action
  const runAction = useCallback(
    async (
      type: string,
      params?: AxiosQueryParams,
      options?: RecceActionOptions,
    ) => {
      if (!onRunAction) {
        console.warn(
          "RecceActionProvider: onRunAction not provided, cannot execute run",
        );
        return;
      }

      const result = await onRunAction(type, params, options);

      // If the handler returns a run ID, show the result
      if (typeof result === "string") {
        showRunId(result);
      }
    },
    [onRunAction, showRunId],
  );

  const contextValue = useMemo<RecceActionContextType>(
    () => ({
      runAction,
      runId,
      showRunId,
      isRunResultOpen,
      closeRunResult,
      isHistoryOpen,
      closeHistory,
      showHistory,
      setHistoryOpen,
      clearRunResult,
    }),
    [
      runAction,
      runId,
      showRunId,
      isRunResultOpen,
      closeRunResult,
      isHistoryOpen,
      closeHistory,
      showHistory,
      clearRunResult,
    ],
  );

  return (
    <RecceActionContext.Provider value={contextValue}>
      {children}
    </RecceActionContext.Provider>
  );
}

/**
 * Hook to access the RecceAction context.
 *
 * @returns RecceActionContextType with run action methods and state
 */
export function useRecceActionContext(): RecceActionContextType {
  return useContext(RecceActionContext);
}
