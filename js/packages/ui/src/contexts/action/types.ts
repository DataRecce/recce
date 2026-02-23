"use client";

import type { Dispatch, SetStateAction } from "react";

/**
 * Query parameters for API requests
 */
export type AxiosQueryParams = Record<
  string,
  string | string[] | number | number[] | object | undefined
>;

/**
 * Explore action sources - matches EXPLORE_SOURCE in track.ts
 */
export type ExploreSource =
  | "lineage_view_top_bar"
  | "lineage_view_context_menu"
  | "node_kebab_menu"
  | "node_sidebar_single_env"
  | "node_sidebar_multi_env"
  | "schema_row_count_button"
  | "schema_column_menu"
  | "lineage_model_node"
  | "lineage_column_node";

/**
 * Explore action types - matches EXPLORE_ACTION in track.ts
 */
export type ExploreAction =
  | "row_count"
  | "row_count_diff"
  | "profile"
  | "profile_diff"
  | "value_diff"
  | "schema_diff"
  | "lineage_diff"
  | "query"
  | "histogram_diff"
  | "top_k_diff";

/**
 * Tracking properties for run submissions
 */
export interface SubmitRunTrackProps {
  /** The explore action type being performed */
  action?: ExploreAction;
  /** The source UI element triggering the action */
  source?: ExploreSource;
  /** Number of nodes involved in the action */
  node_count?: number;
  /** Whether breaking change analysis is enabled */
  breaking_change_analysis?: boolean;
  /** Additional tracking properties */
  [key: string]: unknown;
}

/**
 * Options for running an action
 */
export interface RecceActionOptions {
  /** Whether to show a form before executing */
  showForm: boolean;
  /** Whether to show the last run with matching params */
  showLast?: boolean;
  /** Tracking properties for analytics */
  trackProps?: SubmitRunTrackProps;
}

/**
 * Context type for run actions.
 *
 * This context manages run execution, run result display,
 * and history panel state.
 */
export interface RecceActionContextType {
  /**
   * Execute a run action.
   * @param type - The run type (e.g., "row_count_diff", "value_diff")
   * @param params - Query parameters for the run
   * @param actionOptions - Action options (showForm, trackProps)
   */
  runAction: (
    type: string,
    params?: AxiosQueryParams,
    actionOptions?: RecceActionOptions,
  ) => void;

  /** Currently displayed run ID */
  runId?: string;

  /**
   * Show a specific run result.
   * @param runId - The run ID to display
   * @param refreshHistory - Whether to refresh the history list
   */
  showRunId: (runId: string, refreshHistory?: boolean) => void;

  /** Whether the run result pane is open */
  isRunResultOpen: boolean;

  /** Close the run result pane */
  closeRunResult: () => void;

  /** Whether the history panel is open */
  isHistoryOpen: boolean;

  /** Close the history panel */
  closeHistory: () => void;

  /** Open the history panel */
  showHistory: () => void;

  /** Set the history panel open state */
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;

  /** Clear the current run result and close the pane */
  clearRunResult: () => void;
}
