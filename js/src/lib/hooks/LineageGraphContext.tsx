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
} from "../api/info";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useToast,
  Text,
} from "@chakra-ui/react";
import { PUBLIC_API_URL } from "../const";
import path from "path";
import { aggregateRuns, RunsAggregated } from "../api/runs";

interface EnvInfo {
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
  isDemoSite?: boolean;
  isLoading?: boolean;
  error?: string;
  supportTasks?: { [key: string]: boolean };
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

function useLineageWatcher() {
  const artifactsUpdatedToast = useToast();

  // use ref so that the callbacks can access the latest values
  const ref = useRef<{
    ws: WebSocket | undefined;
    status: LineageWatcherStatus;
  }>({
    ws: undefined,
    status: "pending",
  });

  const [status, setStatus] = useState<LineageWatcherStatus>("pending");
  ref.current.status = status;
  const queryClient = useQueryClient();

  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
  };

  const connect = () => {
    function httpUrlToWebSocketUrl(url: string): string {
      return url.replace(/(http)(s)?\:\/\//, "ws$2://");
    }
    const ws = new WebSocket(`${httpUrlToWebSocketUrl(PUBLIC_API_URL)}/api/ws`);
    ref.current.ws = ws;

    ws.onopen = () => {
      ws.send("ping"); // server will respond with 'pong'
    };
    ws.onmessage = (event) => {
      if (event.data === "pong") {
        if (ref.current.status === "disconnected") {
          invalidateCaches();
        }
        setStatus("connected");
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.command === "refresh") {
          const { eventType, srcPath } = data.event;
          const [targetName, fileName] = srcPath.split("/").slice(-2);
          const name = path.parse(fileName).name;
          artifactsUpdatedToast({
            description: `Detected ${targetName} ${name} ${eventType}`,
            status: "info",
            variant: "left-accent",
            position: "bottom-right",
            duration: 5000,
            isClosable: true,
          });
          invalidateCaches();
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
  };
}

interface LineageGraphProps {
  children: React.ReactNode;
}

export function LineageGraphContextProvider({ children }: LineageGraphProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: cacheKeys.lineage(),
    queryFn: getServerInfo,
  });

  const { data: runsAggregated, refetch: refetchRunsAggregated } = useQuery({
    queryKey: cacheKeys.runsAggregated(),
    queryFn: aggregateRuns,
  });

  const lineageGraph = useMemo(() => {
    const lineage = data?.lineage;
    if (!lineage || !lineage.base || !lineage.current) {
      return undefined;
    }

    return buildLineageGraph(lineage.base, lineage.current);
  }, [data]);

  const errorMessage = error?.message;
  const lineage = data?.lineage;
  const isDemoSite = data?.demo;
  const reviewMode = data?.review_mode;
  const cloudMode = data?.cloud_mode;
  const fileMode = data?.file_mode;
  const adapterType = data?.adapter_type;
  const git = data?.git;
  const pullRequest = data?.pull_request;
  const dbtBase = lineage?.base?.manifest_metadata;
  const dbtCurrent = lineage?.current?.manifest_metadata;
  const supportTasks = data?.support_tasks;

  const envInfo: EnvInfo = {
    adapterType,
    git,
    pullRequest,
    dbt: {
      base: dbtBase,
      current: dbtCurrent,
    },
    sqlmesh: data?.sqlmesh,
  };

  const { connectionStatus, connect } = useLineageWatcher();

  const isActionAvailable = useCallback(
    (name: string) => {
      if (supportTasks) {
        return supportTasks[name] ?? true; // default to true if action not found in supportTasks
      }
      // If the supportTasks does not be provided, all actions are available
      return true;
    },
    [supportTasks]
  );

  return (
    <>
      <LineageGraphContext.Provider
        value={{
          lineageGraph,
          retchLineageGraph: () => {
            refetch();
          },
          envInfo,
          reviewMode,
          cloudMode,
          fileMode,
          isDemoSite,
          error: errorMessage,
          isLoading,
          runsAggregated,
          supportTasks,
          isActionAvailable,
          refetchRunsAggregated: () => {
            refetchRunsAggregated();
          },
        }}
      >
        {children}
      </LineageGraphContext.Provider>

      <Modal
        isOpen={connectionStatus === "disconnected"}
        onClose={() => {}}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Server Disconnected</ModalHeader>
          <ModalBody>
            <Text>
              The server connection has been lost. Please restart the Recce
              server and try again.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              onClick={() => {
                connect();
              }}
            >
              Retry
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export const useLineageGraphContext = () => useContext(LineageGraphContext);

export const useRunsAggregated = () => {
  const { runsAggregated, refetchRunsAggregated } = useLineageGraphContext();
  return [runsAggregated, refetchRunsAggregated] as [
    RunsAggregated | undefined,
    () => void
  ];
};
