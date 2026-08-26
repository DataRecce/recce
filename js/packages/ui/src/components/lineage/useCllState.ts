import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CllInput, type ColumnLineageData, getCll } from "../../api/cll";
import type { ApiClient } from "../../lib/fetchClient";
import {
  type CllFetcher,
  type CllLifecycleRequest,
  type CllLifecycleResolution,
  createCllCachePatchLifecycle,
} from "./cllCachePatchLifecycle";
import {
  type ImpactSets,
  usePublishedImpactSets,
} from "./hooks/usePublishedImpactSets";

export type CllStateRequest = Pick<
  CllLifecycleRequest,
  "cllInput" | "changeAnalysis"
>;

export interface CllHistoryEntry {
  input: CllInput | undefined;
}

export interface CllHistory {
  push(input: CllInput | undefined): void;
  peek(): CllHistoryEntry | undefined;
  pop(): CllHistoryEntry | undefined;
  reset(): void;
}

export interface UseCllStateOptions {
  apiClient: ApiClient;
  queryClient: QueryClient;
}

export interface UseCllStateResult {
  cll: ColumnLineageData | undefined;
  commit(cll: ColumnLineageData | undefined): void;
  resolveForLayout(request: CllStateRequest): Promise<CllLifecycleResolution>;
  refresh(request: CllStateRequest): Promise<CllLifecycleResolution>;
  invalidate(): void;
  supersedeInteraction(): number;
  isInteractionCurrent(generation: number): boolean;
  history: CllHistory;
  impactedNodeIds: Set<string>;
  impactedColumnIds: Set<string>;
  wholeModelImpactedNodeIds: Set<string>;
  wholeModelChangedNodeIds: Set<string>;
  publishImpactSets(sets: ImpactSets): void;
  reset(): void;
}

function createCllHistory(): CllHistory {
  const entries: CllHistoryEntry[] = [];

  return {
    push(input) {
      entries.push({ input });
    },
    peek() {
      return entries.at(-1);
    },
    pop() {
      return entries.pop();
    },
    reset() {
      entries.length = 0;
    },
  };
}

export function useCllState({
  apiClient,
  queryClient,
}: UseCllStateOptions): UseCllStateResult {
  const [cll, setCll] = useState<ColumnLineageData>();
  const history = useRef(createCllHistory()).current;
  const lifecycle = useRef(createCllCachePatchLifecycle()).current;
  const interactionGeneration = useRef(0);
  const {
    impactedNodeIds,
    impactedColumnIds,
    wholeModelImpactedNodeIds,
    wholeModelChangedNodeIds,
    publish: publishImpactSets,
    reset: resetImpactSets,
  } = usePublishedImpactSets();

  const actionGetCll = useMemo<CllFetcher>(
    () => ({
      mutateAsync: (input) => getCll(input, apiClient),
    }),
    [apiClient],
  );

  const bindRequest = useCallback(
    (request: CllStateRequest): CllLifecycleRequest => ({
      ...request,
      actionGetCll,
      queryClient,
    }),
    [actionGetCll, queryClient],
  );

  const resolveForLayout = useCallback(
    (request: CllStateRequest) =>
      lifecycle.resolveCllForLayout(bindRequest(request)),
    [bindRequest, lifecycle],
  );

  const refresh = useCallback(
    (request: CllStateRequest) => lifecycle.refreshCll(bindRequest(request)),
    [bindRequest, lifecycle],
  );

  const commit = useCallback((nextCll: ColumnLineageData | undefined) => {
    setCll(nextCll);
  }, []);

  const supersedeInteraction = useCallback(
    () => ++interactionGeneration.current,
    [],
  );

  const isInteractionCurrent = useCallback(
    (generation: number) => interactionGeneration.current === generation,
    [],
  );

  const invalidate = useCallback(() => {
    ++interactionGeneration.current;
    lifecycle.invalidate();
  }, [lifecycle]);

  const reset = useCallback(() => {
    invalidate();
    history.reset();
    setCll(undefined);
    resetImpactSets();
  }, [history, invalidate, resetImpactSets]);

  useEffect(
    () => () => {
      ++interactionGeneration.current;
      lifecycle.invalidate();
      history.reset();
    },
    [history, lifecycle],
  );

  return {
    cll,
    commit,
    resolveForLayout,
    refresh,
    invalidate,
    supersedeInteraction,
    isInteractionCurrent,
    history,
    impactedNodeIds,
    impactedColumnIds,
    wholeModelImpactedNodeIds,
    wholeModelChangedNodeIds,
    publishImpactSets,
    reset,
  };
}
