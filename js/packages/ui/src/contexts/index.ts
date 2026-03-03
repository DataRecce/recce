"use client";

// API context - axios client and configuration
export { ApiProvider } from "../providers/contexts/ApiContext";

// Route configuration context - path prefixing for cloud routing
export type {
  RouteConfig,
  RouteConfigContextType,
  RouteConfigProviderProps,
} from "../providers/contexts/RouteConfigContext";
export {
  RouteConfigProvider,
  useRouteConfig,
  useRouteConfigSafe,
} from "../providers/contexts/RouteConfigContext";

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
  // LineageViewContext types
  ActionMode,
  ActionState,
  // LineageGraph types
  EnvInfo,
  LineageGraph,
  LineageGraphColumnNode,
  LineageGraphContextType,
  LineageGraphEdge,
  LineageGraphNode,
  LineageGraphNodes,
  LineageGraphProviderProps,
  LineageViewContextType,
  NodeAction,
  NodeColumnSetMap,
  SelectMode,
} from "./lineage";
export {
  buildLineageGraph,
  COLUMN_HEIGHT,
  getNeighborSet,
  intersect,
  isLineageGraphColumnNode,
  isLineageGraphNode,
  LineageGraphProvider,
  LineageViewContext,
  layoutWithDagre,
  selectDownstream,
  selectUpstream,
  toReactFlowBasic,
  union,
  useLineageGraphContext,
  useLineageViewContext,
  useLineageViewContextSafe,
  useRecceServerFlag,
  useRunsAggregated,
} from "./lineage";
