import { LineageGraph, buildLineageGraph } from "@/components/lineage/lineage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cacheKeys } from "../api/cacheKeys";
import { getLineageDiff } from "../api/lineage";
import { useToast } from "@chakra-ui/react";
import { PUBLIC_API_URL } from "../const";
import path from "path";
import { aggregateRuns, RunsAggregated } from "../api/runs";

interface EnvMetadata {
  pr_url: string | null;
}

export interface LineageGraphsContext {
  // lineageGraphSets?: DefaultLineageGraphSets;
  lineageGraph?: LineageGraph;
  metadata?: EnvMetadata;
  isDemoSite?: boolean;
  isLoading?: boolean;
  error?: string;

  runsAggregated?: RunsAggregated;
  refetchRunsAggregated?: () => void;
}

const defaultLineageGraphsContext: LineageGraphsContext = {};

const LineageGraphSets = createContext(defaultLineageGraphsContext);

interface LineageGraphSetsProps {
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

export function LineageGraphsContextProvider({
  children,
}: LineageGraphSetsProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: cacheKeys.lineage(),
    queryFn: getLineageDiff,
  });

  const { data: runsAggregated, refetch: refetchRunsAggregated } = useQuery({
    queryKey: cacheKeys.runsAggregated(),
    queryFn: aggregateRuns,
  });

  const lineageGraph = useMemo(() => {
    if (!data) {
      return undefined;
    }

    return buildLineageGraph(data.base, data.current);
  }, [data]);

  const errorMessage =
    error?.message || data?.current_error || data?.base_error;

  return (
    <>
      <LineageWatcher refetch={refetch} />
      <LineageGraphSets.Provider
        value={{
          lineageGraph,
          metadata: data?.current.metadata,
          isDemoSite: !!data?.current.metadata.pr_url,
          error: errorMessage,
          isLoading,
          runsAggregated,
          refetchRunsAggregated: () => {
            refetchRunsAggregated();
          },
        }}
      >
        {children}
      </LineageGraphSets.Provider>
    </>
  );
}

export const useLineageGraphsContext = () => useContext(LineageGraphSets);

export const useRunsAggregated = () => {
  const { runsAggregated, refetchRunsAggregated } = useLineageGraphsContext();
  return [runsAggregated, refetchRunsAggregated] as [
    RunsAggregated | undefined,
    () => void
  ];
};
