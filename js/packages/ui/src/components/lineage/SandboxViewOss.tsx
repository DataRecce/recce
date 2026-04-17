import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  getModelInfo,
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
 * 2. Fetches raw_code on demand via /api/model/{model_id} when it is
 *    absent from the /info lineage payload (DRC-3263).
 * 3. Injects OSS-specific components (DiffEditor, QueryForm, RunResultPane)
 * 4. Provides OSS-specific tracking and feedback toasts
 * 5. Manages run state via useRecceActionContext
 *
 * The underlying BaseSandboxView from @datarecce/ui is framework-agnostic
 * and accepts components as props for dependency injection.
 */
export function SandboxViewOss({ isOpen, onClose, current }: SandboxViewProps) {
  const { showRunId, clearRunResult } = useRecceActionContext();
  const { primaryKeys, setPrimaryKeys } = useRecceQueryContext();
  const { data: flags, isLoading } = useRecceServerFlag();
  const { apiClient } = useApiConfig();
  const isDark = useIsDark();

  // On-demand fetch for raw_code when the lineage payload strips it.
  // Loose equality (== null) to catch both JSON null and undefined.
  const inlineRawCode = current?.raw_code;
  const needsFetch = isOpen && !!current?.id && inlineRawCode == null;

  const { data: modelDetail, isLoading: isModelDetailLoading } = useQuery({
    queryKey: ["modelDetail", current?.id ?? ""],
    queryFn: () => getModelInfo(current?.id ?? "", apiClient),
    enabled: needsFetch && !!apiClient,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const resolvedRawCode = useMemo(() => {
    if (inlineRawCode != null) {
      return inlineRawCode;
    }
    // Prefer current.raw_code; fall back to base so the editor still has
    // something meaningful to show for sources / added models.
    return (
      modelDetail?.model.current?.raw_code ??
      modelDetail?.model.base?.raw_code ??
      undefined
    );
  }, [inlineRawCode, modelDetail]);

  const resolvedCurrent: SandboxNodeData | undefined = useMemo(() => {
    if (!current) {
      return undefined;
    }
    if (resolvedRawCode === current.raw_code) {
      return current;
    }
    return { ...current, raw_code: resolvedRawCode };
  }, [current, resolvedRawCode]);

  // Track the modified code. Start empty; initialize from resolvedRawCode
  // once it is available so we never seed state with placeholder text.
  const [modifiedCode, setModifiedCode] = useState<string>("");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevResolvedRawCode, setPrevResolvedRawCode] = useState<
    string | undefined
  >(resolvedRawCode);

  // Track whether the user has manually edited the buffer since the dialog
  // opened. Prevents overwriting a deliberate clear with fetched code.
  const userHasEdited = useRef(false);
  const handleUserEdit = useCallback((code: string) => {
    userHasEdited.current = true;
    setModifiedCode(code);
  }, []);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      userHasEdited.current = false;
      setModifiedCode(resolvedRawCode ?? "");
      setPrevResolvedRawCode(resolvedRawCode);
    }
  } else if (
    isOpen &&
    resolvedRawCode !== prevResolvedRawCode &&
    !userHasEdited.current
  ) {
    // Fetch resolved after the dialog was already open — seed the editor
    // with the freshly resolved raw_code, but only if the user hasn't
    // edited the modified buffer.
    setPrevResolvedRawCode(resolvedRawCode);
    setModifiedCode(resolvedRawCode ?? "");
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
      current={resolvedCurrent}
      DiffEditor={DiffEditor}
      QueryForm={QueryForm}
      RunResultPane={RunResultPane}
      isDark={isDark}
      primaryKeys={primaryKeys ?? []}
      onPrimaryKeysChange={setPrimaryKeys}
      isPending={isPending}
      isCodeLoading={needsFetch && isModelDetailLoading}
      onRunQuery={runQuery}
      onModifiedCodeChange={handleUserEdit}
      onShowFeedback={() => feedbackToast(true)}
      tracking={{
        onPreviewChange: trackPreviewChange,
      }}
    />
  );
}
