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
  RecceFeatureMode,
  RecceFeatureToggles,
} from "./contexts";
export {
  // Instance info
  defaultFeatureToggles,
  defaultInstanceInfo,
  // Idle timeout
  IdleTimeoutProvider,
  isLineageGraphColumnNode,
  isLineageGraphNode,
  // Lineage graph
  LineageGraphProvider,
  RecceInstanceInfoProvider,
  useIdleDetection,
  useIdleTimeout,
  useIdleTimeoutSafe,
  useLineageGraphContext,
  useRecceInstanceContext,
  useRecceInstanceInfo,
  useRecceServerFlag,
  useRunsAggregated,
} from "./contexts";

// Provider (main entry point) and Hooks - from providers module
export {
  RecceProvider,
  type RecceProviderProps,
  useApiClient,
  useApiConfig,
  useRecceTheme,
  useRouting,
} from "./providers";

// Theme - colors palette and MUI theme with CSS Variables
export type { Theme } from "./theme";
export { colors, theme } from "./theme";
