import { LineageGraph, buildLineageGraph } from "@/components/lineage/lineage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cacheKeys } from "../api/cacheKeys";
import {
  ManifestMetadata,
  SQLMeshInfo,
  getServerInfo,
  gitInfo,
  pullRequestInfo,
  stateMetadata,
} from "../api/info";
import { Button, CloseButton, Dialog, Portal, Text, useDisclosure } from "@chakra-ui/react";
import { PUBLIC_API_URL } from "../const";
import path from "path";
import { aggregateRuns, RunsAggregated } from "../api/runs";
import { markRelaunchHintCompleted } from "../api/flag";
import { useRecceServerFlag } from "./useRecceServerFlag";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { trackSingleEnvironment } from "../api/track";
import {
  RecceInstanceDisconnectedModalContent,
  ServerDisconnectedModalContent,
} from "@/components/lineage/SeverDisconnectedModalContent";
import { toaster } from "@/components/ui/toaster";

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
  isDemoSite?: boolean;
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
  position?: "top" | "top-right" | "top-left" | "bottom" | "bottom-right" | "bottom-left";
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
  const [artifactsUpdatedToastId, setArtifactsUpdatedToastId] = useState<string | undefined>(
    undefined,
  );

  // use ref so that the callbacks can access the latest values
  const ref = useRef<{
    ws: WebSocket | undefined;
    status: LineageWatcherStatus;
  }>({
    ws: undefined,
    status: "pending",
  });

  const [status, setStatus] = useState<LineageWatcherStatus>("pending");
  const [envStatus, setEnvStatus] = useState<EnvWatcherStatus>(undefined);
  ref.current.status = status;
  const queryClient = useQueryClient();

  const invalidateCaches = () => {
    void queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
    void queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    void queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
  };

  const connect = () => {
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
          if (artifactsUpdatedToastId == null) {
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
          const { id, title, description, status, position, duration } = data.event;
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
      console.error(err);
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
  };

  useEffect(() => {
    const refObj = ref.current;
    connect();
    return () => {
      if (refObj.ws) {
        refObj.ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!lineage?.base || !lineage.current) {
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
    review_mode: reviewMode,
    cloud_mode: cloudMode,
    file_mode: fileMode,
    filename: fileName,
    adapter_type: adapterType,
    git,
    pull_request: pullRequest,
    support_tasks: supportTasks,
  } = queryServerInfo.data ?? {};

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

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (envStatus === "relaunch" && flags?.single_env_onboarding && flags.show_relaunch_hint) {
      // User has added a target-base folder
      setRelaunchHintOpen(true);
      trackSingleEnvironment({ action: "target_base_added" });
    } else {
      setRelaunchHintOpen(false);
    }
  }, [flags, envStatus, isLoading]);

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
          error: errorMessage,
          supportTasks,
          isActionAvailable,
          isLoading: queryServerInfo.isLoading,
          runsAggregated: queryRunAggregated.data,
          refetchRunsAggregated: () => {
            void queryRunAggregated.refetch();
          },
        }}>
        {children}
      </LineageGraphContext.Provider>

      <Dialog.Root
        open={connectionStatus === "disconnected"}
        onOpenChange={() => {}}
        placement="center">
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
          placement="center">
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
                      void queryClient.invalidateQueries({ queryKey: cacheKeys.flag() });
                    }}>
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
  return [runsAggregated, refetchRunsAggregated] as [RunsAggregated | undefined, () => void];
};
