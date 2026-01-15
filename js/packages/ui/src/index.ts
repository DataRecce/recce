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
  ModelInfoResult,
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
  getModelInfo,
  getRecceInstanceInfo,
  getServerFlag,
  getServerInfo,
  markRelaunchHintCompleted,
  reorderChecks,
  resetKeepAliveState,
  sendKeepAlive,
  setKeepAliveCallback,
  useChecks,
} from "./api";

// Components - UI components for data validation interfaces
export type {
  // High-level views (Layer 3)
  ChecksViewProps,
  // UI primitives
  DiffTextProps,
  // Lineage
  LineageCanvasProps,
  LineageViewProps,
  LineageViewRef,
  NavItem,
  RecceLayoutProps,
  RunsViewProps,
  SplitProps,
  SquareIconProps,
} from "./components";
export {
  // High-level views (Layer 3)
  ChecksView,
  // UI primitives
  DiffText,
  HSplit,
  // Lineage
  LineageCanvas,
  LineageView,
  RecceLayout,
  RunsView,
  SquareIcon,
  VSplit,
} from "./components";

// Result view factory and types
export type {
  CreatedResultViewProps,
  ResultViewConfig,
  ResultViewData,
  ResultViewProps,
  ResultViewRef,
  ResultViewTransformOptions,
  ScreenshotWrapperType,
} from "./components/result";
export { createResultView } from "./components/result";
// Constants - reusable constant values for UI components
export {
  type DisableTooltipMessageKey,
  DisableTooltipMessages,
} from "./constants";
// Contexts - React contexts for state management
export type {
  // LineageViewContext types
  ActionMode,
  ActionState,
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
  LineageViewContextType,
  NodeAction,
  // Lineage utilities
  NodeColumnSetMap,
  RecceActionContextType,
  RecceActionOptions,
  RecceActionProviderProps,
  RecceFeatureMode,
  RecceFeatureToggles,
  SelectMode,
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
export type {
  MultiNodesActionCallbacks,
  MultiNodesActionTracking,
  MultiNodesActionTrackProps,
  MultiNodesActionType,
  OSSCheckContext,
  OSSQueryContext,
  RecceActionOptions as OSSRecceActionOptions,
  ThemeColors,
  UseModelColumnsReturn,
  UseMultiNodesActionOptions,
  UseMultiNodesActionReturn,
  UseRunResult,
} from "./hooks";
export {
  CheckContextAdapter,
  defaultSqlQuery,
  extractColumns,
  IGNORE_SCREENSHOT_CLASS,
  LineageGraphAdapter,
  QueryContextAdapter,
  RecceActionAdapter,
  RecceShareStateContextProvider,
  unionColumns,
  useCheckEvents,
  useCopyToClipboard,
  useCopyToClipboardButton,
  useCSVExport,
  useFeedbackCollectionToast,
  useImageDownloadModal,
  useIsDark,
  useModelColumns,
  useMultiNodesAction,
  useRecceCheckContext,
  useRecceQueryContext,
  useRecceShareStateContext,
  useRun,
  useThemeColors,
} from "./hooks";
export type {
  SchemaDataGridOptions,
  SchemaDataGridResult,
  SchemaDiffRow,
  SchemaRow,
  SingleEnvSchemaDataGridResult,
} from "./lib";
// Lib - library utilities including data grid generators
export {
  mergeColumns,
  toSchemaDataGrid,
  toSingleEnvDataGrid,
} from "./lib";
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
  useApiConfigOptional,
  useAppLocation,
  useCheckContext,
  useQueryContext,
  useRecceTheme,
  useRouting,
} from "./providers";
// Theme - colors palette and MUI theme with CSS Variables
export type { Theme } from "./theme";
export { colors, theme } from "./theme";
// Utils - utility functions for data manipulation and formatting
export {
  deltaPercentageString,
  extractSchemas,
  formatTimestamp,
  formatTimeToNow,
  isSchemaChanged,
} from "./utils";
