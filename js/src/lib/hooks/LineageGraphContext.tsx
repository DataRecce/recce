import { LineageGraph, buildLineageGraph } from "@/components/lineage/lineage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cacheKeys } from "../api/cacheKeys";
import { getLineageDiff, getServerInfo } from "../api/lineage";
import { useToast } from "@chakra-ui/react";
import { PUBLIC_API_URL } from "../const";
import path from "path";
import { aggregateRuns, RunsAggregated } from "../api/runs";

interface EnvMetadata {
  pr_url: string | null;
}

export interface LineageGraphContextType {
  lineageGraph?: LineageGraph;
  metadata?: EnvMetadata;
  isDemoSite?: boolean;
  isLoading?: boolean;
  error?: string;
  retchLineageGraph?: () => void;

  runsAggregated?: RunsAggregated;
  refetchRunsAggregated?: () => void;
}

const defaultLineageGraphsContext: LineageGraphContextType = {};

const LineageGraphContext = createContext(defaultLineageGraphsContext);

interface LineageGraphProps {
  children: React.ReactNode;
}

function LineageWatcher({ refetch }: { refetch: () => void }) {
  const artifactsUpdatedToast = useToast();
  const [webSocket, setWebSocket] = useState<WebSocket>();

  const queryClient = useQueryClient();

  useEffect(() => {
    function httpUrlToWebSocketUrl(url: string): string {
      return url.replace(/(http)(s)?\:\/\//, "ws$2://");
    }
    const ws = new WebSocket(`${httpUrlToWebSocketUrl(PUBLIC_API_URL)}/api/ws`);
    setWebSocket(ws);
    ws.onopen = () => {
      ws.send("ping"); // server will respond with 'pong'
    };
    ws.onmessage = (event) => {
      if (event.data === "pong") {
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
          queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
        }
      } catch (err) {
        console.error(err);
      }
    };
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [artifactsUpdatedToast, queryClient]);

  return <></>;
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

  return (
    <>
      <LineageWatcher refetch={refetch} />
      <LineageGraphContext.Provider
        value={{
          lineageGraph,
          retchLineageGraph: () => {
            refetch();
          },
          metadata: lineage?.current?.metadata,
          isDemoSite: !!lineage?.current?.metadata.pr_url,
          error: errorMessage,
          isLoading,
          runsAggregated,
          refetchRunsAggregated: () => {
            refetchRunsAggregated();
          },
        }}
      >
        {children}
      </LineageGraphContext.Provider>
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
