"use client";

/**
 * @file run/RunResultPaneOss.tsx
 * @description OSS wrapper for RunResultPane component.
 *
 * This thin wrapper:
 * 1. Imports the base component from @datarecce/ui
 * 2. Injects OSS-specific context and behavior (tracking, clipboard, API client)
 *
 * OSS-specific behaviors injected:
 * - Analytics tracking (Amplitude via trackCopyToClipboard)
 * - API client configuration (useApiConfig)
 * - Screenshot/clipboard functionality (useCopyToClipboardButton)
 * - CSV export functionality (useCSVExport)
 * - Run management (useRun hook)
 * - Navigation (useRouter)
 */

import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type Ref, useCallback, useState } from "react";
import {
  type AxiosQueryParams,
  cacheKeys,
  createCheckByRun,
  runTypeHasRef,
} from "../../api";
import {
  useRecceActionContext,
  useRecceInstanceContext,
  useRouteConfig,
} from "../../contexts";
import {
  useApiConfig,
  useCopyToClipboardButton,
  useCSVExport,
  useRun,
} from "../../hooks";
import { trackCopyToClipboard } from "../../lib/api/track";
import { isHttpError } from "../../lib/fetchClient";
import { copyToClipboard } from "../../utils";
import { buildSelectedRowsTSV } from "../../utils/grid/buildSelectedRowsTSV";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { LearnHowLink, RecceNotification } from "../onboarding-guide";
import { DualSqlEditor, SqlEditor } from "../query";
import { toaster } from "../ui/Toaster";
import { RunResultPane as BaseRunResultPane } from "./RunResultPane";
import { findByRunType } from "./registry";
import { RefTypes, RegistryEntry, ViewOptionTypes } from "./types";

// ============================================================================
// OSS Props Interface
// ============================================================================

interface RunPageProps {
  onClose?: () => void;
  disableAddToChecklist?: boolean;
  isSingleEnvironment?: boolean;
}

// ============================================================================
// Single Environment Notification Component (OSS-specific)
// ============================================================================

const SingleEnvironmentSetupNotification = ({
  runType,
  onClose,
}: {
  runType?: string;
  onClose: () => void;
}) => {
  switch (runType) {
    case "row_count":
      return (
        <RecceNotification onClose={onClose}>
          <Typography>
            Enable row count diffing, and other Recce features, by configuring a
            base dbt environment to compare against. <LearnHowLink />
          </Typography>
        </RecceNotification>
      );
    case "profile":
      return (
        <RecceNotification onClose={onClose}>
          <Typography>
            Enable data-profile diffing, and other Recce features, by
            configuring a base dbt environment to compare against.{" "}
            <LearnHowLink />
          </Typography>
        </RecceNotification>
      );
    default:
      return null;
  }
};

// ============================================================================
// SQL Editor Adapter Components
// ============================================================================

interface SqlEditorAdapterProps {
  value: string;
  baseValue?: string;
  readOnly?: boolean;
}

const SqlEditorAdapter = ({ value, readOnly }: SqlEditorAdapterProps) => (
  <SqlEditor value={value} options={{ readOnly }} />
);

const DualSqlEditorAdapter = ({
  value,
  baseValue,
  readOnly,
}: SqlEditorAdapterProps) => (
  <DualSqlEditor value={value} baseValue={baseValue} options={{ readOnly }} />
);

// ============================================================================
// PrivateLoadableRunView - Main Implementation (OSS Wrapper)
// ============================================================================

/**
 * OSS implementation that loads run data and injects OSS-specific behavior
 * into the RunResultPane component.
 */
export const PrivateLoadableRunView = ({
  runId,
  onClose,
  isSingleEnvironment,
}: {
  runId?: string;
  onClose?: () => void;
  isSingleEnvironment?: boolean;
}) => {
  const { featureToggles } = useRecceInstanceContext();
  const { runAction } = useRecceActionContext();
  const { error, run, onCancel, isRunning } = useRun(runId);
  const [viewOptions, setViewOptions] = useState<ViewOptionTypes>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { apiClient } = useApiConfig();
  const { basePath } = useRouteConfig();

  // Get the result view component from registry
  let RunResultView: RegistryEntry["RunResultView"] | undefined;
  if (run && runTypeHasRef(run.type)) {
    RunResultView = findByRunType(run.type)
      .RunResultView as RegistryEntry["RunResultView"];
  }

  // Copy to clipboard functionality
  const { ref, onCopyToClipboard, onMouseEnter, onMouseLeave } =
    useCopyToClipboardButton();

  // CSV export functionality
  const csvExport = useCSVExport({
    run,
    runId,
    viewOptions: viewOptions as Record<string, unknown>,
  });

  // True only for run types whose grid has row selection enabled (query views).
  const supportsRowCopy =
    !!run?.type && ["query", "query_base", "query_diff"].includes(run.type);

  // Copy the grid's currently selected rows as TSV. Reads the live grid API
  // from the shared screenshot/result ref (DataGridHandle.api) at click time,
  // so no selection state has to be threaded through the component tree.
  const copySelectedRows = useCallback(async () => {
    const api = (ref.current as DataGridHandle | null)?.api;
    if (!api) return;
    const tsv = buildSelectedRowsTSV(api);
    if (!tsv) {
      toaster.create({
        title: "No rows selected",
        description: "Select rows with the checkboxes, then copy.",
        type: "info",
        duration: 3000,
      });
      return;
    }
    try {
      await copyToClipboard(tsv);
      toaster.create({
        title: "Copied to clipboard",
        description: "Selected rows copied — paste into any spreadsheet",
        type: "success",
        duration: 2000,
      });
      trackCopyToClipboard({
        type: run?.type ?? "unknown",
        from: "run",
      });
    } catch (error) {
      console.error("Failed to copy selected rows:", error);
      toaster.create({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        type: "error",
        duration: 3000,
      });
    }
  }, [ref, run?.type]);

  // Rerun handler
  const handleRerun = useCallback(() => {
    if (run) {
      runAction(run.type, run.params as unknown as AxiosQueryParams);
    }
  }, [run, runAction]);

  // Copy to clipboard handler with tracking
  const handleCopyAsImage = useCallback(async () => {
    await onCopyToClipboard();
    trackCopyToClipboard({
      type: run?.type ?? "unknown",
      from: "run",
    });
  }, [onCopyToClipboard, run?.type]);

  // Go to check handler
  const handleGoToCheck = useCallback(
    (checkId: string) => {
      router.push(`${basePath}/checks/?id=${checkId}`);
    },
    [router.push, basePath],
  );

  // Add to checklist handler
  const handleAddToChecklist = useCallback(async () => {
    if (!runId) {
      return;
    }
    try {
      const check = await createCheckByRun(
        runId,
        viewOptions as Record<string, unknown>,
        apiClient,
      );
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      router.push(`${basePath}/checks/?id=${check.check_id}`);
    } catch (error) {
      if (isHttpError(error) && error.status === 403) {
        toaster.error({
          title: "Permission denied",
          description:
            "You don't have permission to add checks. Contact your org admin for access.",
        });
      } else {
        toaster.error({
          title: "Failed to create check",
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        });
      }
    }
  }, [runId, viewOptions, apiClient, queryClient, router.push, basePath]);

  return (
    <BaseRunResultPane
      // Core data
      runId={runId}
      run={run}
      isRunning={isRunning}
      error={error}
      // View configuration
      viewOptions={viewOptions}
      onViewOptionsChanged={setViewOptions}
      isSingleEnvironment={isSingleEnvironment}
      // Feature toggles
      disableDatabaseQuery={featureToggles.disableDatabaseQuery}
      disableShare={featureToggles.disableShare}
      disableUpdateChecklist={featureToggles.disableUpdateChecklist}
      checklistPermissionDenied={featureToggles.checklistPermissionDenied}
      // Event handlers
      onClose={onClose}
      onCancel={onCancel}
      onRerun={handleRerun}
      // Export/Share handlers
      onCopyAsImage={handleCopyAsImage}
      onCopyMouseEnter={onMouseEnter}
      onCopyMouseLeave={onMouseLeave}
      csvExport={{
        ...csvExport,
        copySelectedRows: supportsRowCopy ? copySelectedRows : undefined,
      }}
      // Checklist handlers
      onGoToCheck={handleGoToCheck}
      onAddToChecklist={handleAddToChecklist}
      // Custom components (OSS-specific)
      SingleEnvironmentNotification={SingleEnvironmentSetupNotification}
      SqlEditorComponent={SqlEditorAdapter}
      DualSqlEditorComponent={DualSqlEditorAdapter}
      RunResultView={RunResultView}
      resultViewRef={ref as Ref<RefTypes>}
    />
  );
};

// ============================================================================
// RunResultPaneOss - Public Component (OSS Wrapper)
// ============================================================================

/**
 * OSS RunResultPane Component
 *
 * A thin wrapper around RunResultPane that injects OSS-specific
 * context and behavior including:
 * - Analytics tracking (Amplitude)
 * - Share state context
 * - API client configuration
 * - Screenshot/clipboard functionality
 * - CSV export functionality
 *
 * @example
 * ```tsx
 * import { RunResultPaneOss } from "@datarecce/ui/components/run";
 *
 * function MyRunView() {
 *   return (
 *     <RunResultPaneOss
 *       onClose={() => handleClose()}
 *       isSingleEnvironment={isSingleEnv}
 *     />
 *   );
 * }
 * ```
 */
export const RunResultPaneOss = ({
  onClose,
  isSingleEnvironment,
}: RunPageProps) => {
  const { runId } = useRecceActionContext();

  return (
    <PrivateLoadableRunView
      runId={runId}
      onClose={onClose}
      isSingleEnvironment={isSingleEnvironment}
    />
  );
};
