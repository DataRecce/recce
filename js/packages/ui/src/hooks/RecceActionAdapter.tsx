"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import React, {
  type ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Run, RunParamTypes, RunType } from "../api";
import {
  cacheKeys,
  type SubmitRunTrackProps,
  searchRuns,
  submitRun,
} from "../api";
import {
  findByRunType,
  type RegistryEntry,
  type RunFormParamTypes,
  type RunFormProps,
  RunModalOss,
} from "../components/run";
import { toaster } from "../components/ui/Toaster";
import {
  type AxiosQueryParams,
  RecceActionProvider,
  type RecceActionOptions as UIRecceActionOptions,
  useRouteConfig,
  useRecceActionContext as useUIRecceActionContext,
} from "../contexts";
import { useApiConfig } from "./useApiConfig";

// Note: AxiosQueryParams is now imported directly from @datarecce/ui/contexts
// This adapter only exports RecceActionAdapter component and RecceActionOptions type

/**
 * Extended options for OSS that include registry-specific features
 */
export interface RecceActionOptions {
  showForm: boolean;
  showLast?: boolean;
  trackProps?: SubmitRunTrackProps;
}

/**
 * Internal state for managing the RunModal
 */
interface RunActionInternal {
  session: string;
  title: string;
  type: RunType;
  params?: RunFormParamTypes;
  lastRun?: Run;
  options?: RecceActionOptions;
  RunForm?: ComponentType<RunFormProps<RunFormParamTypes>>;
}

/**
 * Custom hook to close modal on location changes
 */
function useCloseModalEffect(onClose: () => void) {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Specifically run on location changes
  useEffect(() => {
    onClose();
  }, [onClose, pathname]);
}

interface RecceActionAdapterProps {
  children: React.ReactNode;
}

/**
 * RecceActionAdapter - Bridges OSS action handling with @datarecce/ui's RecceActionProvider
 *
 * This adapter:
 * 1. Keeps submitRun API logic (OSS-specific)
 * 2. Keeps RunModal UI rendering (OSS-specific)
 * 3. Keeps cache invalidation via useQueryClient (OSS-specific)
 * 4. Uses findByRunType registry lookup (OSS-specific)
 * 5. Wraps @datarecce/ui's RecceActionProvider, passing callbacks as props
 *
 * The separation allows @datarecce/ui to be reusable (props-driven, no API calls)
 * while OSS app handles its own API calls, modals, and cache management.
 */
export function RecceActionAdapter({ children }: RecceActionAdapterProps) {
  const { apiClient } = useApiConfig();
  const [action, setAction] = useState<RunActionInternal>();

  // Modal state
  const [isModalOpen, setModalOpen] = useState(false);
  const onModalOpen = useCallback(() => setModalOpen(true), []);
  const onModalClose = useCallback(() => setModalOpen(false), []);

  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { basePath } = useRouteConfig();

  // Store a ref to the showRunId function from the provider
  // This is set by the inner component after the provider mounts
  const showRunIdRef = useRef<
    ((runId: string, refreshHistory?: boolean) => void) | null
  >(null);

  // Close modal on location changes
  useCloseModalEffect(onModalClose);

  /**
   * Callback for when a run result should be shown.
   * Handles cache invalidation when refreshHistory is true.
   */
  const handleShowRunId = useCallback(
    async (runId: string, refreshHistory?: boolean) => {
      if (refreshHistory !== false) {
        await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
      }
    },
    [queryClient],
  );

  /**
   * Callback for executing a run action.
   * This is the core OSS logic that the @datarecce/ui provider delegates to.
   *
   * It:
   * - Looks up the run type in the registry
   * - Either submits the run directly or shows a form modal
   * - Handles errors with toast notifications
   * - Returns the run ID for the provider to track
   */
  const handleRunAction = useCallback(
    async (
      type: string,
      params?: AxiosQueryParams,
      options?: UIRecceActionOptions,
    ): Promise<string | undefined> => {
      try {
        const session = new Date().getTime().toString();
        let lastRun: Run | undefined = undefined;

        // Cast to full OSS options type (includes showLast)
        const ossOptions = options as RecceActionOptions | undefined;

        if (ossOptions?.showLast) {
          const runs = await searchRuns(type, params, 1, apiClient);
          if (runs.length === 1) {
            lastRun = runs[0] as Run;
          }
        }

        const run = findByRunType(type as RunType);
        const RunResultView = run.RunResultView as
          | RegistryEntry["RunResultView"]
          | undefined;
        const { title, RunForm } = run;

        if (RunResultView === undefined) {
          throw new Error(`Run type ${type} does not have a result view`);
        }

        if (RunForm === undefined || !options?.showForm) {
          // Direct submission - no form needed
          const { run_id } = await submitRun(
            type as RunType,
            params,
            {
              nowait: true,
              trackProps: ossOptions?.trackProps,
            },
            apiClient,
          );

          await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });

          // Call showRunId BEFORE navigation (matching original RecceActionContext behavior)
          // This ensures state is set before any navigation-triggered re-renders
          if (showRunIdRef.current) {
            showRunIdRef.current(run_id);
          }

          // Navigate to lineage base if we're on a lineage subpath
          if (pathname.startsWith("/lineage")) {
            router.push(`${basePath}/lineage`);
          }

          // Return undefined since we already called showRunId via ref
          return undefined;
        }
        // Show form modal
        setAction({
          session,
          title,
          type: type as RunType,
          params,
          lastRun,
          options: ossOptions,
          RunForm,
        });
        onModalOpen();

        // Return undefined - the modal will handle submission
        return undefined;
      } catch (e: unknown) {
        toaster.create({
          title: "Failed to submit a run",
          description: e instanceof Error ? e.message : undefined,
          type: "error",
          duration: 5000,
          closable: true,
        });
        return undefined;
      }
    },
    [onModalOpen, queryClient, apiClient, pathname, router, basePath],
  );

  /**
   * Handle form execution from RunModal.
   * Submits the run and triggers showRunId via the ref.
   */
  const handleModalExecute = useCallback(
    async (type: RunType, params: RunParamTypes) => {
      try {
        onModalClose();
        const { run_id } = await submitRun(
          type,
          params,
          {
            nowait: true,
            trackProps: action?.options?.trackProps,
          },
          apiClient,
        );

        // Use the ref to call showRunId from the provider context
        if (showRunIdRef.current) {
          showRunIdRef.current(run_id);
        }
      } catch (e: unknown) {
        toaster.create({
          title: "Failed to submit a run",
          description: e instanceof Error ? e.message : undefined,
          type: "error",
          duration: 5000,
          closable: true,
        });
      }
    },
    [onModalClose, action?.options?.trackProps, apiClient],
  );

  return (
    <RecceActionProvider
      onRunAction={handleRunAction}
      onShowRunId={handleShowRunId}
    >
      {/* Inner component captures showRunId ref */}
      <RecceActionAdapterInner showRunIdRef={showRunIdRef}>
        {children}
      </RecceActionAdapterInner>

      {/* RunModal for form-based runs */}
      {action && (
        <RunModalOss
          key={action.session}
          isOpen={isModalOpen}
          onClose={onModalClose}
          onExecute={handleModalExecute}
          title={action.title}
          type={action.type}
          params={action.params}
          initialRun={action.lastRun}
          RunForm={
            action.options?.showForm && action.RunForm
              ? action.RunForm
              : undefined
          }
        />
      )}
    </RecceActionProvider>
  );
}

/**
 * Inner component that captures the showRunId function from context
 * and stores it in the parent's ref for use by modal execution.
 */
interface RecceActionAdapterInnerProps {
  children: React.ReactNode;
  showRunIdRef: React.MutableRefObject<
    ((runId: string, refreshHistory?: boolean) => void) | null
  >;
}

function RecceActionAdapterInner({
  children,
  showRunIdRef,
}: RecceActionAdapterInnerProps) {
  const { showRunId } = useUIRecceActionContext();

  // Store the showRunId function in the ref for parent to use
  useEffect(() => {
    showRunIdRef.current = showRunId;
    return () => {
      showRunIdRef.current = null;
    };
  }, [showRunId, showRunIdRef]);

  return <>{children}</>;
}

// Note: useRecceActionContext is now imported directly from @datarecce/ui/contexts
// This adapter only exports RecceActionAdapter component and OSS-specific types
