import {
  AmplitudeReturn,
  BaseEvent,
  EventOptions,
  Result,
} from "@amplitude/analytics-core";
import { initAll, track as trk } from "@amplitude/unified";

function track(
  eventInput: string | BaseEvent,
  // biome-ignore lint/suspicious/noExplicitAny: Amplitude library uses any for event properties
  eventProperties?: Record<string, any> | undefined,
  eventOptions?: EventOptions | undefined,
): AmplitudeReturn<Result> {
  // If Amplitude isn't initialized, log to console instead
  if (!amplitudeInitialized) {
    console.log("[Tracking]", eventInput, eventProperties, eventOptions);
  }
  return trk(eventInput, eventProperties, eventOptions);
}

let amplitudeInitialized = false;

export function trackInit() {
  function getCookie(key: string) {
    const b = document.cookie.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)");
    return b ? b.pop() : "";
  }

  const userId =
    process.env.NODE_ENV === "development"
      ? "web_dev"
      : getCookie("recce_user_id");
  const apiKey = process.env.AMPLITUDE_API_KEY;
  if (userId && apiKey) {
    try {
      void initAll(apiKey, {
        analytics: {
          userId,
          autocapture: true,
        },
        sessionReplay: {
          sampleRate: 1,
        },
      });
      amplitudeInitialized = true;
    } catch (e) {
      console.error(e);
    }
  }

  // Log when Amplitude is not initialized (for development/debugging)
  if (!amplitudeInitialized) {
    console.log(
      "[Tracking] Amplitude not initialized (missing API key or user ID). Events will be logged to console instead.",
    );
  }
}

interface MultiNodeActionProps {
  type:
    | "row_count"
    | "row_count_diff"
    | "value_diff"
    | "schema_diff"
    | "lineage_diff";
  selected: "single" | "multi" | "none";
}

export function trackMultiNodesAction(props: MultiNodeActionProps) {
  track("[Web] multi_nodes_action", props);
}

interface HistoryActionProps {
  name: "show" | "hide" | "click_run" | "add_to_checklist" | "go_to_check";
}

export function trackHistoryAction(props: HistoryActionProps) {
  track("[Web] history_action", props);
}

interface PreviewChangeProps {
  action: "explore" | "run" | "close";
  node?: string;
  status?: "success" | "failure";
}

export function trackPreviewChange(props: PreviewChangeProps) {
  track("[Experiment] preview_change", props);
}

interface PreviewChangeFeedbackProps {
  feedback: "like" | "dislike" | "form";
  node?: string;
}

export function trackPreviewChangeFeedback(props: PreviewChangeFeedbackProps) {
  track("[Experiment] preview_change", props);
}

interface SingleEnvironmentProps {
  action:
    | "onboarding"
    | "external_link"
    | "preview_changes"
    | `target_base_added`;
  from?: "onboarding" | "preview_changes";
  node?: string;
}

export function trackSingleEnvironment(props: SingleEnvironmentProps) {
  track("[Experiment] single_environment", props);
}

export function getExperimentTrackingBreakingChangeEnabled() {
  return false;
}

interface ColumnLevelLineageProps {
  action: "view";
  source: "schema_column" | "changed_column" | "cll_column";
}

export function trackColumnLevelLineage(props: ColumnLevelLineageProps) {
  track("[Web] column_level_lineage", props);
}

interface ShareStateProps {
  name: "enable" | "create" | "copy";
}

export function trackShareState(props: ShareStateProps) {
  track("[Web] share_state", props);
}

interface StateActionProps {
  name: "import" | "export";
}

export function trackStateAction(props: StateActionProps) {
  track("[Web] state_action", props);
}

interface CopyToClipboardProps {
  from: "run" | "check" | "lineage_view";
  type: string;
}

export function trackCopyToClipboard(props: CopyToClipboardProps) {
  track("[Click] copy_to_clipboard", props);
}

interface TrackNavProps {
  from: string;
  to: string;
}

export function trackNavigation(props: TrackNavProps) {
  track("[Web] navigation_change", props);
}

export interface LineageViewRenderProps {
  node_count: number;
  view_mode: string;
  impact_radius_enabled: boolean;
  cll_column_active?: boolean;
  right_sidebar_open: boolean;
  [status: string]: number | string | boolean | undefined;
}

export function trackLineageViewRender(props: LineageViewRenderProps) {
  track("[Web] lineage_view_render", props);
}

export interface EnvironmentConfigProps {
  review_mode: boolean;
  adapter_type: string | null;
  has_git_info: boolean;
  has_pr_info: boolean;
  // Adapter-specific (shape varies by adapter_type)
  base?: {
    schema_count?: number;
    dbt_version?: string | null;
    timestamp?: string | null;
    has_env?: boolean;
  };
  current?: {
    schema_count?: number;
    dbt_version?: string | null;
    timestamp?: string | null;
    has_env?: boolean;
  };
  schemas_match?: boolean;
}

export function trackEnvironmentConfig(props: EnvironmentConfigProps) {
  track("[Web] environment_config", props);
}

// Explore action types
export const EXPLORE_ACTION = {
  ROW_COUNT: "row_count",
  ROW_COUNT_DIFF: "row_count_diff",
  PROFILE: "profile",
  PROFILE_DIFF: "profile_diff",
  VALUE_DIFF: "value_diff",
  SCHEMA_DIFF: "schema_diff",
  LINEAGE_DIFF: "lineage_diff",
  QUERY: "query",
  HISTOGRAM_DIFF: "histogram_diff",
  TOP_K_DIFF: "top_k_diff",
} as const;

// Explore action sources
export const EXPLORE_SOURCE = {
  LINEAGE_VIEW_TOP_BAR: "lineage_view_top_bar",
  LINEAGE_VIEW_CONTEXT_MENU: "lineage_view_context_menu",
  NODE_KEBAB_MENU: "node_kebab_menu",
  NODE_SIDEBAR_SINGLE_ENV: "node_sidebar_single_env",
  NODE_SIDEBAR_MULTI_ENV: "node_sidebar_multi_env",
  SCHEMA_ROW_COUNT_BUTTON: "schema_row_count_button",
  SCHEMA_COLUMN_MENU: "schema_column_menu",
} as const;

export type ExploreActionType =
  (typeof EXPLORE_ACTION)[keyof typeof EXPLORE_ACTION];
export type ExploreSourceType =
  (typeof EXPLORE_SOURCE)[keyof typeof EXPLORE_SOURCE];

interface ExploreActionProps {
  action: ExploreActionType;
  source: ExploreSourceType;
  node_count?: number;
}

export function trackExploreAction(props: ExploreActionProps) {
  track("[Web] explore_action", props);
}

// Explore action form events
export const EXPLORE_FORM_EVENT = {
  EXECUTE: "execute",
  CANCEL: "cancel",
} as const;

export type ExploreFormEventType =
  (typeof EXPLORE_FORM_EVENT)[keyof typeof EXPLORE_FORM_EVENT];

interface ExploreActionFormProps {
  action: ExploreActionType;
  event: ExploreFormEventType;
}

export function trackExploreActionForm(props: ExploreActionFormProps) {
  track("[Web] explore_action_form", props);
}

// Helper to check if a run type is an explore action
export function isExploreAction(type: string): type is ExploreActionType {
  return Object.values(EXPLORE_ACTION).includes(type as ExploreActionType);
}

// Lineage selection action types
export const LINEAGE_SELECTION_ACTION = {
  SELECT_PARENT_NODES: "select_parent_nodes",
  SELECT_CHILD_NODES: "select_child_nodes",
  SELECT_ALL_UPSTREAM: "select_all_upstream",
  SELECT_ALL_DOWNSTREAM: "select_all_downstream",
} as const;

export type LineageSelectionActionType =
  (typeof LINEAGE_SELECTION_ACTION)[keyof typeof LINEAGE_SELECTION_ACTION];

interface LineageSelectionProps {
  action: LineageSelectionActionType;
  node_count?: number;
}

export function trackLineageSelection(props: LineageSelectionProps) {
  track("[Web] lineage_selection", props);
}
