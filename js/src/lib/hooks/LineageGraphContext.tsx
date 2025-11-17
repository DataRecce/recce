import {
  Button,
  CloseButton,
  Dialog,
  Portal,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import path from "path";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildLineageGraph, LineageGraph } from "@/components/lineage/lineage";
import {
  RecceInstanceDisconnectedModalContent,
  ServerDisconnectedModalContent,
} from "@/components/lineage/SeverDisconnectedModalContent";
import { toaster } from "@/components/ui/toaster";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { cacheKeys } from "../api/cacheKeys";
import { markRelaunchHintCompleted } from "../api/flag";
import {
  getServerInfo,
  gitInfo,
  ManifestMetadata,
  pullRequestInfo,
  SQLMeshInfo,
  stateMetadata,
} from "../api/info";
import { aggregateRuns, RunsAggregated } from "../api/runs";
import { trackSingleEnvironment } from "../api/track";
import { PUBLIC_API_URL } from "../const";
import { useRecceServerFlag } from "./useRecceServerFlag";

interface EnvInfo {
  stateMetadata?: stateMetadata;
  adapterType?: string;
  git?: gitInfo;
  pullRequest?: pullRequestInfo;
  dbt?: {
    base: ManifestMetadata | undefined | null;
    current: ManifestMetadata | undefined | null;
  };
  sqlmesh?: SQLMeshInfo | null;
}

export interface LineageGraphContextType {
  lineageGraph?: LineageGraph;
  envInfo?: EnvInfo;
  reviewMode?: boolean;
  cloudMode?: boolean;
  fileMode?: boolean;
  fileName?: string;
  isDemoSite: boolean;
  isCodespace?: boolean;
  isLoading?: boolean;
  error?: string;
  supportTasks?: Record<string, boolean>;
  retchLineageGraph?: () => void;
  isActionAvailable: (actionName: string) => boolean;

  runsAggregated?: RunsAggregated;
  refetchRunsAggregated?: () => void;
}

const defaultLineageGraphsContext: LineageGraphContextType = {
  isActionAvailable: () => true,
  isDemoSite: false,
};

const LineageGraphContext = createContext(defaultLineageGraphsContext);

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

function useLineageWatcher() {
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

  const [status, setStatus] = useState<LineageWatcherStatus>("pending");
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

    const ws = new WebSocket(`${httpUrlToWebSocketUrl(PUBLIC_API_URL)}/api/ws`);
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
          const name = path.parse(fileName).name;
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
  }, [invalidateCaches]);

  useEffect(() => {
    const refObj = ref.current;
    connect();
    return () => {
      if (refObj.ws) {
        refObj.ws.close();
      }
    };
  }, [connect]);

  return {
    connectionStatus: status,
    connect,
    envStatus: envStatus,
  };
}

interface LineageGraphProps {
  children: React.ReactNode;
}

export function LineageGraphContextProvider({ children }: LineageGraphProps) {
  const queryServerInfo = useQuery({
    queryKey: cacheKeys.lineage(),
    queryFn: getServerInfo,
  });

  const queryRunAggregated = useQuery({
    queryKey: cacheKeys.runsAggregated(),
    queryFn: aggregateRuns,
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

  const { connectionStatus, connect, envStatus } = useLineageWatcher();
  const { data: flags, isLoading } = useRecceServerFlag();
  const { featureToggles, shareUrl } = useRecceInstanceContext();
  const { onClose } = useDisclosure();
  const [relaunchHintOpen, setRelaunchHintOpen] = useState<boolean>(false);
  const [prevRelaunchCondition, setPrevRelaunchCondition] =
    useState<boolean>(false);
  const queryClient = useQueryClient();

  const isActionAvailable = useCallback(
    (name: string) => {
      if (supportTasks) {
        return supportTasks[name] ?? true; // default to true if action not found in supportTasks
      }
      // If the supportTasks does not be provided, all actions are available
      return true;
    },
    [supportTasks],
  );

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

  return (
    <>
      <LineageGraphContext.Provider
        value={{
          lineageGraph,
          retchLineageGraph: () => {
            void queryRunAggregated.refetch();
          },
          envInfo,
          reviewMode,
          cloudMode,
          fileMode,
          fileName,
          isDemoSite,
          isCodespace,
          error: errorMessage,
          supportTasks,
          isActionAvailable,
          isLoading: queryServerInfo.isLoading,
          runsAggregated: queryRunAggregated.data,
          refetchRunsAggregated: () => {
            void queryRunAggregated.refetch();
          },
        }}
      >
        {children}
      </LineageGraphContext.Provider>

      <Dialog.Root
        open={connectionStatus === "disconnected"}
        onOpenChange={() => {
          return void 0;
        }}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            {shareUrl && featureToggles.mode !== null ? (
              <RecceInstanceDisconnectedModalContent
                shareUrl={shareUrl}
                mode={featureToggles.mode}
              />
            ) : (
              <ServerDisconnectedModalContent connect={connect} />
            )}
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {flags?.single_env_onboarding && (
        <Dialog.Root
          open={relaunchHintOpen}
          onOpenChange={() => {
            onClose();
            void markRelaunchHintCompleted();
            void queryClient.invalidateQueries({ queryKey: cacheKeys.flag() });
          }}
          placement="center"
        >
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Target-base Added</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Text>Please restart the Recce server.</Text>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    colorPalette="blue"
                    onClick={() => {
                      onClose();
                      void markRelaunchHintCompleted();
                      void queryClient.invalidateQueries({
                        queryKey: cacheKeys.flag(),
                      });
                    }}
                  >
                    Got it!
                  </Button>
                </Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </>
  );
}

export const useLineageGraphContext = () => useContext(LineageGraphContext);

export const useRunsAggregated = () => {
  const { runsAggregated, refetchRunsAggregated } = useLineageGraphContext();
  return [runsAggregated, refetchRunsAggregated] as [
    RunsAggregated | undefined,
    () => void,
  ];
};
