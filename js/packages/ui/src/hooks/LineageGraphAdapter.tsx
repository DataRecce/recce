"use client";

import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IoClose } from "react-icons/io5";
import {
  aggregateRuns,
  cacheKeys,
  getServerInfo,
  markRelaunchHintCompleted,
} from "../api";
import {
  RecceInstanceDisconnectedModalContent,
  ServerDisconnectedModalContent,
} from "../components/lineage";
import { toaster } from "../components/ui/Toaster";
import {
  buildLineageGraph,
  type EnvInfo,
  LineageGraphProvider,
  useIdleTimeout,
  useRecceInstanceContext,
  useRecceServerFlag,
} from "../contexts";
import { trackSingleEnvironment } from "../lib/api/track";
import { PUBLIC_API_URL, RECCE_SUPPORT_CALENDAR_URL } from "../lib/const";
import { useApiConfig } from "./useApiConfig";

type LineageWatcherStatus = "pending" | "connected" | "disconnected";
type EnvWatcherStatus = undefined | "relaunch";

interface WebSocketRefreshEvent {
  eventType: "created" | "updated" | "deleted";
  srcPath: string;
}

interface WebSocketBroadcastEvent {
  id: string;
  title?: string;
  description: string;
  status?: "info" | "warning" | "success" | "error";
  position?:
    | "top"
    | "top-right"
    | "top-left"
    | "bottom"
    | "bottom-right"
    | "bottom-left";
  duration?: number;
}

type WebSocketPayload =
  | {
      command: "refresh";
      event: WebSocketRefreshEvent;
    }
  | {
      command: "relaunch";
    }
  | {
      command: "broadcast";
      event: WebSocketBroadcastEvent;
    };

interface UseLineageWatcherOptions {
  /**
   * Whether to enable WebSocket connection.
   * Set to false for cloud mode where WebSocket is not used.
   */
  enabled?: boolean;

  /**
   * Base URL for WebSocket connection.
   * If not provided, uses PUBLIC_API_URL.
   */
  baseUrl?: string;

  /**
   * API prefix to replace /api in WebSocket URL.
   * If not provided, uses default /api/ws path.
   */
  apiPrefix?: string;
}

function useLineageWatcher({
  enabled = true,
  baseUrl,
  apiPrefix,
}: UseLineageWatcherOptions = {}) {
  const [artifactsUpdatedToastId, setArtifactsUpdatedToastId] = useState<
    string | undefined
  >(undefined);

  // use ref so that the callbacks can access the latest values
  const ref = useRef<{
    ws: WebSocket | undefined;
    status: LineageWatcherStatus;
    artifactsUpdatedToastId: string | undefined;
  }>({
    ws: undefined,
    status: "pending",
    artifactsUpdatedToastId: undefined,
  });

  // If disabled, always return "connected" status to avoid showing disconnect modal
  const [status, setStatus] = useState<LineageWatcherStatus>(
    enabled ? "pending" : "connected",
  );
  const [envStatus, setEnvStatus] = useState<EnvWatcherStatus>(undefined);

  // Update ref in useEffect to avoid updating during render
  useEffect(() => {
    ref.current.status = status;
  }, [status]);

  // Keep artifactsUpdatedToastId in sync with ref
  useEffect(() => {
    ref.current.artifactsUpdatedToastId = artifactsUpdatedToastId;
  }, [artifactsUpdatedToastId]);

  const queryClient = useQueryClient();

  const invalidateCaches = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
    void queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    void queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
  }, [queryClient]);

  const connect = useCallback(() => {
    function httpUrlToWebSocketUrl(url: string): string {
      return url.replace(/(http)(s)?:\/\//, "ws$2://");
    }

    // Use baseUrl if provided, otherwise fall back to PUBLIC_API_URL
    const effectiveBaseUrl = baseUrl ?? PUBLIC_API_URL;
    // Construct WebSocket path with apiPrefix if provided
    const wsPath = apiPrefix ? `${apiPrefix}/ws` : "/api/ws";
    const ws = new WebSocket(
      `${httpUrlToWebSocketUrl(effectiveBaseUrl)}${wsPath}`,
    );
    ref.current.ws = ws;

    ws.onopen = () => {
      ws.send("ping"); // server will respond with 'pong'
    };

    // Handling websocket messages from the server
    ws.onmessage = (event) => {
      if (event.data === "pong") {
        if (ref.current.status === "disconnected") {
          invalidateCaches();
        }
        setStatus("connected");
        return;
      }
      try {
        const data = JSON.parse(event.data as string) as WebSocketPayload;
        if (data.command === "refresh") {
          const { eventType, srcPath } = data.event;
          const [targetName, fileName] = srcPath.split("/").slice(-2);
          // Extract filename without extension (browser-compatible alternative to path.parse)
          const name = fileName.replace(/\.[^/.]+$/, "");
          const eventId = `${targetName}-${name}-${eventType}`;
          if (ref.current.artifactsUpdatedToastId == null) {
            setArtifactsUpdatedToastId(
              toaster.create({
                id: eventId,
                description: `Detected ${targetName} ${name} ${eventType}`,
                type: "info",
                duration: 5000,
                closable: true,
              }),
            );
          }
          invalidateCaches();
        } else if (data.command === "relaunch") {
          setEnvStatus("relaunch");
        } else {
          // Handle broadcast events
          const { id, title, description, status, duration } = data.event;
          setArtifactsUpdatedToastId(
            toaster.create({
              id: id || "broadcast",
              title,
              description,
              type: status ?? "info",
              duration: duration ?? 5000,
              closable: true,
            }),
          );
        }
      } catch (err) {
        console.error(err);
      }
    };
    ws.onerror = (err) => {
      console.error("An error occurred during Handling WebSockets", err);
    };
    ws.onclose = () => {
      setStatus((status) => {
        if (status === "connected") {
          return "disconnected";
        }
        return status;
      });

      ref.current.ws = undefined;
    };
  }, [invalidateCaches, baseUrl, apiPrefix]);

  useEffect(() => {
    // Skip WebSocket connection if disabled (e.g., cloud mode)
    if (!enabled) {
      return;
    }

    const refObj = ref.current;
    connect();
    return () => {
      if (refObj.ws) {
        refObj.ws.close();
      }
    };
  }, [connect, enabled]);

  return {
    connectionStatus: status,
    connect,
    envStatus: envStatus,
  };
}

interface LineageGraphAdapterProps {
  children: React.ReactNode;
}

/**
 * LineageGraphAdapter - Bridges OSS data fetching with @datarecce/ui's LineageGraphProvider
 *
 * This adapter:
 * 1. Does data fetching (useQuery for lineage data)
 * 2. Handles WebSocket connection for real-time updates
 * 3. Renders disconnect/relaunch modals
 * 4. Wraps @datarecce/ui's LineageGraphProvider, passing fetched data as props
 *
 * The separation allows @datarecce/ui to be reusable (props-driven, no fetching)
 * while OSS app handles its own data fetching needs.
 */
export function LineageGraphAdapter({ children }: LineageGraphAdapterProps) {
  const {
    idleTimeout,
    remainingSeconds,
    isEnabled,
    setDisconnected,
    resetConnection,
  } = useIdleTimeout();

  // Get configured API client from context
  const { apiClient, apiPrefix, baseUrl } = useApiConfig();

  const queryServerInfo = useQuery({
    queryKey: cacheKeys.lineage(),
    queryFn: () => getServerInfo(apiClient),
  });

  const queryRunAggregated = useQuery({
    queryKey: cacheKeys.runsAggregated(),
    queryFn: () => aggregateRuns(apiClient),
  });

  const lineageGraph = useMemo(() => {
    const lineage = queryServerInfo.data?.lineage;
    if (!lineage?.base) {
      return undefined;
    }

    return buildLineageGraph(lineage.base, lineage.current, lineage.diff);
  }, [queryServerInfo.data]);

  const errorMessage = queryServerInfo.error?.message;
  const {
    state_metadata: stateMetadata,
    lineage,
    sqlmesh,
    demo: isDemoSite,
    codespace: isCodespace,
    review_mode: reviewMode,
    cloud_mode: cloudMode,
    file_mode: fileMode,
    filename: fileName,
    adapter_type: adapterType,
    git,
    pull_request: pullRequest,
    support_tasks: supportTasks,
  } = queryServerInfo.data ?? {
    demo: false,
  };

  const dbtBase = lineage?.base.manifest_metadata;
  const dbtCurrent = lineage?.current.manifest_metadata;

  const envInfo: EnvInfo = {
    stateMetadata,
    adapterType,
    git,
    pullRequest,
    dbt: {
      base: dbtBase,
      current: dbtCurrent,
    },
    sqlmesh,
  };

  // Pass apiPrefix and baseUrl to useLineageWatcher for WebSocket connection
  const { connectionStatus, connect, envStatus } = useLineageWatcher({
    enabled: true,
    baseUrl,
    apiPrefix,
  });

  // Handle connection status changes for idle timeout
  useEffect(() => {
    if (connectionStatus === "disconnected") {
      // Stop countdown and keep-alive when disconnected
      setDisconnected();
    } else if (connectionStatus === "connected") {
      // Reset countdown when reconnected (e.g., after Retry)
      resetConnection();
    }
  }, [connectionStatus, setDisconnected, resetConnection]);

  const { data: flags, isLoading } = useRecceServerFlag();
  const { featureToggles, shareUrl } = useRecceInstanceContext();
  const [relaunchHintOpen, setRelaunchHintOpen] = useState<boolean>(false);
  const [prevRelaunchCondition, setPrevRelaunchCondition] =
    useState<boolean>(false);
  const queryClient = useQueryClient();

  // Calculate if modal should be open (during render)
  const shouldShowRelaunch =
    !isLoading &&
    envStatus === "relaunch" &&
    flags?.single_env_onboarding === true &&
    flags.show_relaunch_hint;

  // Adjust state during render when condition changes
  if (shouldShowRelaunch !== prevRelaunchCondition) {
    setPrevRelaunchCondition(shouldShowRelaunch);
    setRelaunchHintOpen(shouldShowRelaunch);
  }

  // Track side effect only when modal opens (remains in effect)
  useEffect(() => {
    if (shouldShowRelaunch && relaunchHintOpen) {
      trackSingleEnvironment({ action: "target_base_added" });
    }
  }, [shouldShowRelaunch, relaunchHintOpen]);

  const handleRelaunchClose = () => {
    setRelaunchHintOpen(false);
    void markRelaunchHintCompleted(apiClient);
    void queryClient.invalidateQueries({ queryKey: cacheKeys.flag() });
  };

  // Callback handlers for the provider
  const handleRefetchLineageGraph = useCallback(() => {
    void queryRunAggregated.refetch();
  }, [queryRunAggregated]);

  const handleRefetchRunsAggregated = useCallback(() => {
    void queryRunAggregated.refetch();
  }, [queryRunAggregated]);

  return (
    <>
      <LineageGraphProvider
        lineageGraph={lineageGraph}
        envInfo={envInfo}
        reviewMode={reviewMode}
        cloudMode={cloudMode}
        fileMode={fileMode}
        fileName={fileName}
        isDemoSite={isDemoSite ?? false}
        isCodespace={isCodespace}
        isLoading={queryServerInfo.isLoading}
        error={errorMessage}
        supportTasks={supportTasks}
        onRefetchLineageGraph={handleRefetchLineageGraph}
        runsAggregated={queryRunAggregated.data}
        onRefetchRunsAggregated={handleRefetchRunsAggregated}
      >
        {children}
      </LineageGraphProvider>

      <MuiDialog
        open={connectionStatus === "disconnected"}
        onClose={() => void 0}
      >
        {shareUrl && featureToggles.mode !== null ? (
          <RecceInstanceDisconnectedModalContent
            shareUrl={shareUrl}
            mode={featureToggles.mode}
            supportCalendarUrl={RECCE_SUPPORT_CALENDAR_URL}
            LinkComponent={({
              href,
              children,
            }: {
              href: string;
              children: ReactNode;
            }) => {
              return (
                <NextLink href={href} passHref>
                  {children}
                </NextLink>
              );
            }}
          />
        ) : (
          <ServerDisconnectedModalContent
            connect={connect}
            idleSeconds={
              // Only show idle time if disconnected due to idle timeout
              // (idle timeout enabled AND remaining time was near zero)
              isEnabled &&
              idleTimeout !== null &&
              remainingSeconds !== null &&
              remainingSeconds <= 5
                ? idleTimeout - Math.max(0, remainingSeconds)
                : undefined
            }
          />
        )}
      </MuiDialog>

      {flags?.single_env_onboarding && (
        <MuiDialog open={relaunchHintOpen} onClose={handleRelaunchClose}>
          <DialogTitle>Target-base Added</DialogTitle>
          <IconButton
            aria-label="close"
            onClick={handleRelaunchClose}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: "grey.500",
            }}
          >
            <IoClose />
          </IconButton>
          <DialogContent>
            <Typography>Please restart the Recce server.</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              color="iochmara"
              variant="contained"
              onClick={handleRelaunchClose}
            >
              Got it!
            </Button>
          </DialogActions>
        </MuiDialog>
      )}
    </>
  );
}

// Note: useLineageGraphContext and useRunsAggregated are now imported directly from @datarecce/ui/contexts
// This adapter only exports LineageGraphAdapter component and OSS-specific types (EnvInfo)
