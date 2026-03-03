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
 * - Analytics tracking (Amplitude via trackCopyToClipboard, trackShareState)
 * - Share state context (RecceShareStateContext)
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
  useRecceShareStateContext,
  useRun,
} from "../../hooks";
import { trackCopyToClipboard, trackShareState } from "../../lib/api/track";
import AuthModal from "../app/AuthModal";
import { LearnHowLink, RecceNotification } from "../onboarding-guide";
import { DualSqlEditor, SqlEditor } from "../query";
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
// Auth Modal Adapter Component
// ============================================================================

const AuthModalAdapter = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => (
  <AuthModal
    parentOpen={open}
    handleParentClose={() => onClose()}
    ignoreCookie
    variant="enable-share"
  />
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
  const { featureToggles, authed } = useRecceInstanceContext();
  const { runAction } = useRecceActionContext();
  const { error, run, onCancel, isRunning } = useRun(runId);
  const [viewOptions, setViewOptions] = useState<ViewOptionTypes>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { apiClient } = useApiConfig();
  const { basePath } = useRouteConfig();
  const { handleShareClick } = useRecceShareStateContext();

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
    viewOptions: viewOptions as Record<string, unknown>,
  });

  // Rerun handler
  const handleRerun = useCallback(() => {
    if (run) {
      runAction(run.type, run.params as unknown as AxiosQueryParams);
    }
  }, [run, runAction]);

  // Share to cloud handler
  const handleShareToCloud = useCallback(async () => {
    await handleShareClick();
    trackShareState({ name: "create" });
  }, [handleShareClick]);

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
    const check = await createCheckByRun(
      runId,
      viewOptions as Record<string, unknown>,
      apiClient,
    );
    await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    router.push(`${basePath}/checks/?id=${check.check_id}`);
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
      // Event handlers
      onClose={onClose}
      onCancel={onCancel}
      onRerun={handleRerun}
      // Export/Share handlers
      onCopyAsImage={handleCopyAsImage}
      onCopyMouseEnter={onMouseEnter}
      onCopyMouseLeave={onMouseLeave}
      csvExport={csvExport}
      authed={authed}
      onShareToCloud={handleShareToCloud}
      // Checklist handlers
      onGoToCheck={handleGoToCheck}
      onAddToChecklist={handleAddToChecklist}
      // Custom components (OSS-specific)
      SingleEnvironmentNotification={SingleEnvironmentSetupNotification}
      SqlEditorComponent={SqlEditorAdapter}
      DualSqlEditorComponent={DualSqlEditorAdapter}
      AuthModalComponent={AuthModalAdapter}
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
