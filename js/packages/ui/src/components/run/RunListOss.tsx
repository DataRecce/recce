"use client";

/**
 * @file run/RunListOss.tsx
 * @description OSS wrapper for RunList that injects OSS-specific dependencies.
 *
 * This component wraps the @datarecce/ui RunList with:
 * - Data fetching via React Query
 * - OSS-specific tracking
 * - Context integration (RecceActionContext, RecceInstanceContext)
 * - Navigation and check creation
 */

import IconButton from "@mui/material/IconButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { FaCheckCircle, FaRegCheckCircle } from "react-icons/fa";
import { PiX } from "react-icons/pi";
import { cacheKeys, createCheckByRun, listRuns, type Run } from "../../api";
import {
  useRecceActionContext,
  useRecceInstanceContext,
  useRouteConfig,
} from "../../contexts";
import { useApiConfig } from "../../hooks";
import { trackHistoryAction } from "../../lib/api/track";
import { RunList as BaseRunList, type RunListItemData } from "./RunList";
import { findByRunType } from "./registry";

/**
 * Transform API Run to RunListItemData for the UI component
 */
function mapRunToListItem(run: Run): RunListItemData {
  return {
    id: run.run_id,
    name: run.name,
    type: run.type,
    // Default to "Finished" if status is not set (shouldn't happen in practice)
    status: run.status ?? "Finished",
    runAt: run.run_at,
    checkId: run.check_id,
  };
}

/**
 * RunListOss Component - OSS wrapper
 *
 * Provides the History panel with run list, integrating with OSS-specific
 * contexts, tracking, and navigation.
 *
 * @example
 * ```tsx
 * <RunListOss />
 * ```
 */
export function RunListOss() {
  const { closeHistory, showRunId, runId } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const { apiClient } = useApiConfig();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { basePath } = useRouteConfig();

  // Fetch all runs
  const { data: runs, isLoading } = useQuery({
    queryKey: cacheKeys.runs(),
    queryFn: async () => {
      // Cast from library Run[] to OSS Run[] for discriminated union support
      return (await listRuns(apiClient)) as Run[];
    },
    retry: false,
  });

  // Transform runs to list item data format
  const runListItems = useMemo(() => {
    return (runs ?? []).map(mapRunToListItem);
  }, [runs]);

  // Handle run selection with tracking
  const handleRunSelect = useCallback(
    (selectedRunId: string) => {
      trackHistoryAction({ name: "click_run" });
      showRunId(selectedRunId, false);
    },
    [showRunId],
  );

  // Handle add to checklist with tracking and navigation
  const handleAddToChecklist = useCallback(
    async (clickedRunId: string) => {
      trackHistoryAction({ name: "add_to_checklist" });
      const check = await createCheckByRun(clickedRunId, undefined, apiClient);
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      router.push(`${basePath}/checks/?id=${check.check_id}`);
    },
    [apiClient, queryClient, router.push, basePath],
  );

  // Handle go to check with tracking
  const handleGoToCheck = useCallback(
    (checkId: string) => {
      trackHistoryAction({ name: "go_to_check" });
      router.push(`${basePath}/checks/?id=${checkId}`);
    },
    [router.push, basePath],
  );

  // Handle close history with tracking
  const handleCloseHistory = useCallback(() => {
    trackHistoryAction({ name: "hide" });
    closeHistory();
  }, [closeHistory]);

  // Get icon for run type
  const getRunIcon = useCallback((runType: string) => {
    const registryEntry = findByRunType(
      runType as Parameters<typeof findByRunType>[0],
    );
    const IconComponent = registryEntry?.icon;
    return IconComponent ? <IconComponent /> : null;
  }, []);

  // Header action - close button
  const headerActions = (
    <IconButton aria-label="Close History" onClick={handleCloseHistory}>
      <PiX />
    </IconButton>
  );

  return (
    <BaseRunList
      runs={runListItems}
      selectedId={runId}
      isLoading={isLoading}
      onRunSelect={handleRunSelect}
      onAddToChecklist={handleAddToChecklist}
      onGoToCheck={handleGoToCheck}
      getRunIcon={getRunIcon}
      hideAddToChecklist={featureToggles.disableUpdateChecklist}
      title="History"
      headerActions={headerActions}
      emptyMessage="No runs"
      loadingMessage="Loading..."
      groupByDate={true}
      addToChecklistIcon={<FaRegCheckCircle />}
      goToCheckIcon={<FaCheckCircle color="green" />}
    />
  );
}
