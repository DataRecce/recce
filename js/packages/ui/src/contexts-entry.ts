"use client";

/**
 * Contexts barrel export for @datarecce/ui
 *
 * This module exports all React contexts for OSS consumption:
 * - ApiContext: API client configuration and hooks
 * - RecceInstanceContext: Feature toggles and session information
 * - IdleTimeoutContext: Session management and keep-alive
 *
 * @example
 * ```tsx
 * import {
 *   ApiProvider,
 *   useApiConfig,
 *   useApiConfigOptional,
 *   RecceInstanceInfoProvider,
 *   useRecceInstanceContext,
 *   IdleTimeoutProvider,
 *   useIdleTimeout,
 * } from "@datarecce/ui/contexts";
 * ```
 */

export { RecceActionProvider, useRecceActionContext } from "./contexts/action";
// IdleTimeoutContext exports - session management and keep-alive
export type { IdleTimeoutContextType } from "./contexts/idle";
export {
  IdleTimeoutProvider,
  useIdleDetection,
  useIdleTimeout,
  useIdleTimeoutSafe,
} from "./contexts/idle";
// RecceInstanceContext exports - feature toggles and session info
export type {
  InstanceInfoType,
  RecceFeatureMode,
  RecceFeatureToggles,
} from "./contexts/instance";
export {
  defaultFeatureToggles,
  defaultInstanceInfo,
  RecceInstanceInfoProvider,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "./contexts/instance";
// LineageGraphContext exports - lineage data and utilities
export type {
  ActionMode,
  ActionState,
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
} from "./contexts/lineage";
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
} from "./contexts/lineage";
// ApiContext exports - API client configuration
export {
  ApiProvider,
  useApiClient,
  useApiConfig,
  useApiConfigOptional,
} from "./providers/contexts/ApiContext";
// RouteConfigContext exports - path prefixing for cloud routing
export type {
  RouteConfig,
  RouteConfigContextType,
  RouteConfigProviderProps,
} from "./providers/contexts/RouteConfigContext";
export {
  RouteConfigProvider,
  useRouteConfig,
  useRouteConfigSafe,
} from "./providers/contexts/RouteConfigContext";
