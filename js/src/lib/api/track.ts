import { initAll, track } from "@amplitude/unified";

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
    } catch (e) {
      console.error(e);
    }
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
