"use client";

// API context - axios client and configuration
export { ApiProvider } from "../providers/contexts/ApiContext";

// Action context - run execution and result management
export type {
  AxiosQueryParams,
  RecceActionContextType,
  RecceActionOptions,
  RecceActionProviderProps,
  SubmitRunTrackProps,
} from "./action";
export { RecceActionProvider, useRecceActionContext } from "./action";

// Idle timeout context - session management and keep-alive
export type { IdleTimeoutContextType } from "./idle";
export {
  IdleTimeoutProvider,
  useIdleDetection,
  useIdleTimeout,
  useIdleTimeoutSafe,
} from "./idle";

// Instance context - feature toggles and session info
export type {
  InstanceInfoType,
  RecceFeatureMode,
  RecceFeatureToggles,
} from "./instance";
export {
  defaultFeatureToggles,
  defaultInstanceInfo,
  RecceInstanceInfoProvider,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "./instance";

// Lineage graph context - lineage data and utilities
export type {
  EnvInfo,
  LineageGraph,
  LineageGraphColumnNode,
  LineageGraphContextType,
  LineageGraphEdge,
  LineageGraphNode,
  LineageGraphNodes,
  LineageGraphProviderProps,
  NodeColumnSetMap,
} from "./lineage";
export {
  buildLineageGraph,
  COLUMN_HEIGHT,
  getNeighborSet,
  intersect,
  isLineageGraphColumnNode,
  isLineageGraphNode,
  LineageGraphProvider,
  layoutWithDagre,
  selectDownstream,
  selectUpstream,
  toReactFlowBasic,
  union,
  useLineageGraphContext,
  useRecceServerFlag,
  useRunsAggregated,
} from "./lineage";
