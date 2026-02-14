import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  LOCAL_STORAGE_KEYS,
  type QueryParams,
  type SubmitOptions,
  submitQueryDiff,
  waitRun,
} from "../../api";
import { useRecceActionContext, useRecceServerFlag } from "../../contexts";
import {
  useApiConfig,
  useFeedbackCollectionToast,
  useGuideToast,
  useIsDark,
  useRecceQueryContext,
} from "../../hooks";
import {
  trackPreviewChange,
  trackPreviewChangeFeedback,
  trackSingleEnvironment,
} from "../../lib/api/track";
import { DiffEditor } from "../../primitives";
import { QueryForm } from "../query";
import { RunResultPaneOss as RunResultPane } from "../run";
import {
  SandboxView as BaseSandboxView,
  type SandboxNodeData,
} from "./SandboxView";

interface SandboxViewProps {
  isOpen: boolean;
  onClose: () => void;
  current?: SandboxNodeData;
  height?: string;
}

/**
 * OSS wrapper for SandboxView that injects OSS-specific implementations.
 *
 * This wrapper:
 * 1. Handles query execution with React Query mutations
 * 2. Injects OSS-specific components (DiffEditor, QueryForm, RunResultPane)
 * 3. Provides OSS-specific tracking and feedback toasts
 * 4. Manages run state via useRecceActionContext
 *
 * The underlying BaseSandboxView from @datarecce/ui is framework-agnostic
 * and accepts components as props for dependency injection.
 */
export function SandboxViewOss({ isOpen, onClose, current }: SandboxViewProps) {
  const [modifiedCode, setModifiedCode] = useState<string>(
    current?.raw_code ?? "",
  );
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const { showRunId, clearRunResult } = useRecceActionContext();
  const { primaryKeys, setPrimaryKeys } = useRecceQueryContext();
  const { data: flags, isLoading } = useRecceServerFlag();
  const { apiClient } = useApiConfig();
  const isDark = useIsDark();

  // Reset modifiedCode when modal opens
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setModifiedCode(current?.raw_code ?? "");
    }
  }

  const queryFn = async () => {
    const sqlTemplate = modifiedCode;
    const runFn = submitQueryDiff;
    const params: QueryParams = {
      current_model: current?.name ?? "",
      primary_keys: primaryKeys,
      sql_template: sqlTemplate,
    };
    const options: SubmitOptions = { nowait: true };

    const { run_id } = await runFn(params, options, apiClient);

    showRunId(run_id);

    return await waitRun(run_id, undefined, apiClient);
  };

  const { mutate: runQuery, isPending } = useMutation({
    mutationFn: queryFn,
    onSuccess(data) {
      if (data.error) {
        trackPreviewChange({
          action: "run",
          node: current?.name,
          status: "failure",
        });
      } else {
        trackPreviewChange({
          action: "run",
          node: current?.name,
          status: "success",
        });
        setTimeout(() => {
          feedbackToast();
        }, 1000);
        if (!isLoading && flags?.single_env_onboarding) {
          setTimeout(() => {
            prepareEnvToast();
          }, 2000);
        }
      }
    },
  });

  const { feedbackToast, closeToast } = useFeedbackCollectionToast({
    feedbackId: LOCAL_STORAGE_KEYS.previewChangeFeedbackID,
    description: "Enjoy preview change?",

    onFeedbackSubmit: (feedback: string) => {
      switch (feedback) {
        case "like":
          trackPreviewChangeFeedback({ feedback: "like", node: current?.name });
          break;
        case "dislike":
          trackPreviewChangeFeedback({
            feedback: "dislike",
            node: current?.name,
          });
          break;
        case "link":
          trackPreviewChangeFeedback({ feedback: "form", node: current?.name });
          break;
        default:
          console.log("Not support feedback type");
      }
    },
    externalLink:
      "https://docs.google.com/forms/d/e/1FAIpQLSd7Lei7Ijwo7MinWaI0K6rzZi_21gV1BKetmiNEX254kDziDA/viewform?usp=header",
    externalLinkText: "Give us feedback",
  });

  const { guideToast: prepareEnvToast, closeGuideToast } = useGuideToast({
    guideId: LOCAL_STORAGE_KEYS.prepareEnvGuideID,
    description: "Want to compare data changes with production data?",
    externalLink: "https://docs.reccehq.com/get-started/#prepare-dbt-artifacts",
    externalLinkText: "Learn how.",
    onExternalLinkClick: () => {
      trackSingleEnvironment({
        action: "external_link",
        from: "preview_changes",
        node: current?.name,
      });
    },
  });

  const handleClose = () => {
    onClose();
    clearRunResult();
    closeToast();
    closeGuideToast();
  };

  return (
    <BaseSandboxView
      isOpen={isOpen}
      onClose={handleClose}
      current={current}
      DiffEditor={DiffEditor}
      QueryForm={QueryForm}
      RunResultPane={RunResultPane}
      isDark={isDark}
      primaryKeys={primaryKeys ?? []}
      onPrimaryKeysChange={setPrimaryKeys}
      isPending={isPending}
      onRunQuery={runQuery}
      onModifiedCodeChange={setModifiedCode}
      onShowFeedback={() => feedbackToast(true)}
      tracking={{
        onPreviewChange: trackPreviewChange,
      }}
    />
  );
}
