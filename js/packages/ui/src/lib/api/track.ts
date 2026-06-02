import {
  AmplitudeReturn,
  BaseEvent,
  EventOptions,
  Result,
} from "@amplitude/analytics-core";
import { initAll, track as trk } from "@amplitude/unified";
import posthog from "posthog-js";

// Shared surface tag injected into every PostHog capture so the same flat
// snake_case event names can be disambiguated from other surfaces (cloud-web,
// CLI) that emit the same event names.
const EVENT_SOURCE = "oss-web";

// PostHog host + hardcoded prod write-only key (phc_ keys are write-only/safe to
// commit; mirrors recce_cloud/recce_cloud/telemetry.py and the P4 OSS-CLI module).
// Lands in the shared prod project 267645. NEXT_PUBLIC_POSTHOG_API_KEY allows
// dev/staging to point elsewhere (mirrors the cloud FE env-var convention).
const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_KEY_PROD = "phc_WDJMPIYB2WTasN3sVxwIasBOSTjZ9rVTkpqf5lVKeRL";

function track(
  eventInput: string | BaseEvent,
  // biome-ignore lint/suspicious/noExplicitAny: Amplitude library uses any for event properties
  eventProperties?: Record<string, any> | undefined,
  eventOptions?: EventOptions | undefined,
): AmplitudeReturn<Result> {
  // If Amplitude isn't initialized, log to console instead (but not during tests)
  if (!amplitudeInitialized && process.env.NODE_ENV !== "test") {
    console.log("[Tracking]", eventInput, eventProperties, eventOptions);
  }
  return trk(eventInput, eventProperties, eventOptions);
}

// PostHog dual-emit helper used by ALL wrappers alongside the (kept) Amplitude
// track() call. Injects event_source centrally and no-ops before init so
// wrappers called before trackInit() neither throw nor capture.
function capturePosthog(
  event: string,
  // biome-ignore lint/suspicious/noExplicitAny: PostHog accepts arbitrary event properties
  props: Record<string, any> = {},
) {
  if (!posthogInitialized) {
    return;
  }
  posthog.capture(event, { ...props, event_source: EVENT_SOURCE });
}

let amplitudeInitialized = false;
let posthogInitialized = false;

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

  // PostHog init — gated identically to Amplitude (recce_user_id cookie + key),
  // plus an explicit kill switch. Prod key is the default; env var overrides it.
  const telemetryDisabled =
    process.env.NEXT_PUBLIC_RECCE_DISABLE_TELEMETRY === "true";
  const phKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY || POSTHOG_KEY_PROD;
  if (userId && phKey && !telemetryDisabled) {
    try {
      posthog.init(phKey, {
        api_host: POSTHOG_HOST, // direct host (OSS has no /ph reverse-proxy rewrite)
        autocapture: true, // D3: autocapture ON (matches Amplitude)
        disable_session_recording: true, // D3: session replay OFF; do NOT load replay plugin
        person_profiles: "identified_only", // D6: anonymous-friendly, no person bloat
        // geoip left at DEFAULT (enabled) — do NOT set $geoip_disable; country
        // resolves from IP (recce-insight country_distribution depends on it).
        defaults: "2025-11-30", // pin posthog-js config defaults (matches cloud FE)
      });
      posthog.identify(userId); // D6: distinct_id = recce_user_id cookie value
      // Super-property so EVERY event — including autocapture ($pageview,
      // $autocapture, $pageleave) — carries event_source, keeping the shared
      // PostHog project segmentable by surface (oss-web / cloud-web / oss-cli).
      posthog.register({ event_source: EVENT_SOURCE });
      posthogInitialized = true;
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
  capturePosthog("multi_nodes_action", props);
}

interface HistoryActionProps {
  name: "show" | "hide" | "click_run" | "add_to_checklist" | "go_to_check";
}

export function trackHistoryAction(props: HistoryActionProps) {
  track("[Web] history_action", props);
  capturePosthog("history_action", props);
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
  capturePosthog("single_environment", props);
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
  capturePosthog("column_level_lineage", props);
}

interface ShareStateProps {
  name: "enable" | "create" | "copy";
}

export function trackShareState(props: ShareStateProps) {
  track("[Web] share_state", props);
  capturePosthog("share_state", props);
}

interface StateActionProps {
  name: "import" | "export";
}

export function trackStateAction(props: StateActionProps) {
  track("[Web] state_action", props);
  capturePosthog("state_action", props);
}

interface CopyToClipboardProps {
  from: "run" | "check" | "lineage_view";
  type: string;
}

export function trackCopyToClipboard(props: CopyToClipboardProps) {
  track("[Click] copy_to_clipboard", props);
  capturePosthog("copy_to_clipboard", props);
}

interface TrackNavProps {
  from: string;
  to: string;
}

export function trackNavigation(props: TrackNavProps) {
  track("[Web] navigation_change", props);
  capturePosthog("navigation_change", props);
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
  // Props are already canonical & flat at the source (useTrackLineageRender.ts
  // emits node_count, view_mode, impact_radius_enabled, right_sidebar_open,
  // optional cll_column_active, and dynamic nodes_<status> keys). Pass through.
  capturePosthog("lineage_view_render", props);
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

// Flatten the nested base/current shape into the D10 canonical flat schema for
// PostHog. The Amplitude path keeps the ORIGINAL nested props untouched.
// Nested .timestamp fields are intentionally DROPPED to match the cloud-web twin.
function flattenEnvironmentConfig(props: EnvironmentConfigProps) {
  // biome-ignore lint/suspicious/noExplicitAny: PostHog accepts arbitrary event properties
  const flat: Record<string, any> = {
    review_mode: props.review_mode,
    adapter_type: props.adapter_type,
    has_git_info: props.has_git_info,
    has_pr_info: props.has_pr_info,
    schemas_match: props.schemas_match,
    base_schema_count: props.base?.schema_count,
    current_schema_count: props.current?.schema_count,
    base_dbt_version: props.base?.dbt_version,
    current_dbt_version: props.current?.dbt_version,
    base_has_env: props.base?.has_env,
    current_has_env: props.current?.has_env,
  };
  return flat;
}

export function trackEnvironmentConfig(props: EnvironmentConfigProps) {
  track("[Web] environment_config", props);
  capturePosthog("environment_config", flattenEnvironmentConfig(props));
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
  capturePosthog("explore_action", props);
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
  capturePosthog("explore_action_form", props);
}

// Helper to check if a run type is an explore action
export function isExploreAction(type: string): type is ExploreActionType {
  return Object.values(EXPLORE_ACTION).includes(type as ExploreActionType);
}

// Onboarding flow events. The oss_onboarding_ prefix keeps these distinct from
// the cloud onboarding_* funnel while sharing the same PostHog project.
export function trackOssShareButtonClicked({ authed }: { authed: boolean }) {
  track("[CLI Onboarding] oss_share_button_clicked", { authed });
  capturePosthog("oss_onboarding_share_button_clicked", { authed });
}

export function trackSignupRedirectInitiated() {
  track("[CLI Onboarding] signup_redirect_initiated");
  capturePosthog("oss_onboarding_signup_redirect_initiated");
}

export function trackSignupCompleted() {
  track("[CLI Onboarding] signup_completed");
  capturePosthog("oss_onboarding_signup_completed");
}

export function trackArtifactUploadStarted() {
  track("[CLI Onboarding] artifact_upload_started");
  capturePosthog("oss_onboarding_artifact_upload_started");
}

export function trackRedirectToCloudSession() {
  track("[CLI Onboarding] redirect_to_cloud_session");
  capturePosthog("oss_onboarding_redirect_to_cloud_session");
}

export function trackDwSetupShown() {
  track("[CLI Onboarding] dw_setup_shown");
  capturePosthog("oss_onboarding_dw_setup_shown");
}

export function trackDwSetupCompleted() {
  track("[CLI Onboarding] dw_setup_completed");
  capturePosthog("oss_onboarding_dw_setup_completed");
}

export function trackDwSetupSkipped() {
  track("[CLI Onboarding] dw_setup_skipped");
  capturePosthog("oss_onboarding_dw_setup_skipped");
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
  capturePosthog("lineage_selection", props);
}
