import * as amplitude from "@amplitude/analytics-browser";

export function trackInit() {
  function getCookie(key: string) {
    var b = document.cookie.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)");
    return b ? b.pop() : "";
  }

  const userId =
    process.env.NODE_ENV === "development"
      ? "web_dev"
      : getCookie("recce_user_id");
  const apiKey = process.env.AMPLITUDE_API_KEY;
  if (userId && apiKey) {
    try {
      // Initialize Amplitude
      amplitude.init(apiKey, userId, {
        defaultTracking: true,
      });
    } catch (e) {
      console.error(e);
    }
  }
}

interface MultiNodeActionProps {
  type: "row_count_diff" | "value_diff" | "schema_diff" | "lineage_diff";
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
