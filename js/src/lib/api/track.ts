import * as amplitude from "@amplitude/analytics-browser";
import { sessionReplayPlugin } from "@amplitude/plugin-session-replay-browser";

export function trackInit() {
  function getCookie(key: string) {
    const b = document.cookie.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)");
    return b ? b.pop() : "";
  }

  const userId = process.env.NODE_ENV === "development" ? "web_dev" : getCookie("recce_user_id");
  const apiKey = process.env.AMPLITUDE_API_KEY;
  if (userId && apiKey) {
    try {
      // Create and Install Session Replay Plugin
      const sessionReplayTracking = sessionReplayPlugin();
      amplitude.add(sessionReplayTracking);
      // Initialize Amplitude
      amplitude.init(apiKey, userId, {
        autocapture: true,
      });
    } catch (e) {
      console.error(e);
    }
  }
}

interface MultiNodeActionProps {
  type: "row_count" | "row_count_diff" | "value_diff" | "schema_diff" | "lineage_diff";
  selected: "single" | "multi" | "none";
}

export function trackMultiNodesAction(props: MultiNodeActionProps) {
  amplitude.track("[Web] multi_nodes_action", props);
}

interface HistoryActionProps {
  name: "show" | "hide" | "click_run" | "add_to_checklist" | "go_to_check";
}

export function trackHistoryAction(props: HistoryActionProps) {
  amplitude.track("[Web] history_action", props);
}

interface PreviewChangeProps {
  action: "explore" | "run" | "close";
  node?: string;
  status?: "success" | "failure";
}

export function trackPreviewChange(props: PreviewChangeProps) {
  amplitude.track("[Experiment] preview_change", props);
}

interface PreviewChangeFeedbackProps {
  feedback: "like" | "dislike" | "form";
  node?: string;
}

export function trackPreviewChangeFeedback(props: PreviewChangeFeedbackProps) {
  amplitude.track("[Experiment] preview_change", props);
}

interface SingleEnvironmentProps {
  action: "onboarding" | "external_link" | "preview_changes" | `target_base_added`;
  from?: "onboarding" | "preview_changes";
  node?: string;
}

export function trackSingleEnvironment(props: SingleEnvironmentProps) {
  amplitude.track("[Experiment] single_environment", props);
}

interface RecommendPresetCheckProps {
  action: "recommend" | "ignore" | "perform" | "execute" | "close";
  from?: "initial" | "rerun";
  nodes?: number;
}

export function trackRecommendCheck(props: RecommendPresetCheckProps) {
  amplitude.track("[Experiment] recommend_preset_check", props);
}

interface BreakingChangeAnalysisProps {
  enabled: boolean;
}

let _breakingChangeEnabled = false;

export function trackBreakingChange(props: BreakingChangeAnalysisProps) {
  amplitude.track("[Experiment] breaking_change_analysis", props);
  _breakingChangeEnabled = props.enabled;
}

export function getExperimentTrackingBreakingChangeEnabled() {
  return _breakingChangeEnabled;
}

interface ColumnLevelLineageProps {
  action: "view";
  source: "schema_column" | "changed_column" | "cll_column";
}

export function trackColumnLevelLineage(props: ColumnLevelLineageProps) {
  amplitude.track("Column level lineage", props);
}

interface ShareStateProps {
  name: "enable" | "create" | "copy";
}

export function trackShareState(props: ShareStateProps) {
  amplitude.track("share_state", props);
}

interface StateActionProps {
  name: "import" | "export";
}

export function trackStateAction(props: StateActionProps) {
  amplitude.track("state_action", props);
}

interface CopyToClipboardProps {
  from: "run" | "check" | "lineage_view";
  type: string;
}

export function trackCopyToClipboard(props: CopyToClipboardProps) {
  amplitude.track("[Click] copy_to_clipboard", props);
}
