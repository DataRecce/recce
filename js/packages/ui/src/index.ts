// @datarecce/ui - React component library for data validation interfaces

// Version
export const VERSION = "0.2.0";

// API utilities
export type {
  CatalogMetadata,
  GitInfo,
  LineageData,
  LineageDataFromMetadata,
  LineageDiffData,
  ManifestMetadata,
  NodeColumnData,
  NodeData,
  PullRequestInfo,
  RecceInstanceInfo,
  RecceServerFlags,
  RunsAggregated,
  ServerInfoResult,
  ServerMode,
  SQLMeshInfo,
  StateMetadata,
} from "./api";
export {
  aggregateRuns,
  cacheKeys,
  getLastKeepAliveTime,
  getRecceInstanceInfo,
  getServerFlag,
  getServerInfo,
  markRelaunchHintCompleted,
  resetKeepAliveState,
  sendKeepAlive,
  setKeepAliveCallback,
} from "./api";

// Components - UI components for data validation interfaces
export type { LineageViewProps, LineageViewRef } from "./components";
export { LineageView } from "./components";

// Contexts - React contexts for state management
export type {
  // Action context
  AxiosQueryParams,
  // Lineage graph
  EnvInfo,
  // Idle timeout
  IdleTimeoutContextType,
  // Instance info
  InstanceInfoType,
  LineageGraph,
  LineageGraphColumnNode,
  LineageGraphContextType,
  LineageGraphEdge,
  LineageGraphNode,
  LineageGraphNodes,
  LineageGraphProviderProps,
  // Lineage utilities
  NodeColumnSetMap,
  RecceActionContextType,
  RecceActionOptions,
  RecceActionProviderProps,
  RecceFeatureMode,
  RecceFeatureToggles,
  SubmitRunTrackProps,
} from "./contexts";
export {
  // Lineage graph utilities
  buildLineageGraph,
  COLUMN_HEIGHT,
  // Instance info
  defaultFeatureToggles,
  defaultInstanceInfo,
  getNeighborSet,
  // Idle timeout
  IdleTimeoutProvider,
  intersect,
  isLineageGraphColumnNode,
  isLineageGraphNode,
  // Lineage graph
  LineageGraphProvider,
  layoutWithDagre,
  // Action context
  RecceActionProvider,
  RecceInstanceInfoProvider,
  selectDownstream,
  selectUpstream,
  toReactFlowBasic,
  union,
  useIdleDetection,
  useIdleTimeout,
  useIdleTimeoutSafe,
  useLineageGraphContext,
  useRecceActionContext,
  useRecceInstanceContext,
  useRecceInstanceInfo,
  useRecceServerFlag,
  useRunsAggregated,
} from "./contexts";
// Hooks - utility hooks for theming and data
export type { ThemeColors } from "./hooks";
export { useThemeColors } from "./hooks";
// Provider (main entry point) and Hooks - from providers module
export type {
  Check,
  CheckContextType,
  CheckProviderProps,
  NavigateOptions,
  QueryContextType,
  QueryProviderProps,
  QueryResult,
  RoutingConfig,
  RoutingContextValue,
} from "./providers";
export {
  CheckProvider,
  QueryProvider,
  RecceProvider,
  type RecceProviderProps,
  useApiClient,
  useApiConfig,
  useAppLocation,
  useCheckContext,
  useQueryContext,
  useRecceTheme,
  useRouting,
} from "./providers";

// Theme - colors palette and MUI theme with CSS Variables
export type { Theme } from "./theme";
export { colors, theme } from "./theme";
