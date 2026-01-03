// Re-export instance context from contexts module
export type {
  InstanceInfoType,
  RecceFeatureMode,
  RecceFeatureToggles,
} from "../contexts/instance";
export {
  defaultFeatureToggles,
  defaultInstanceInfo,
  RecceInstanceInfoProvider,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "../contexts/instance";

// Re-export provider-level contexts
export { useApiClient, useApiConfig } from "./contexts/ApiContext";
// Export new context hooks and types
export type {
  Check,
  CheckContextType,
  CheckProviderProps,
} from "./contexts/CheckContext";
export { CheckProvider, useCheckContext } from "./contexts/CheckContext";
export type {
  QueryContextType,
  QueryProviderProps,
  QueryResult,
} from "./contexts/QueryContext";
export { QueryProvider, useQueryContext } from "./contexts/QueryContext";
export type {
  NavigateOptions,
  RoutingConfig,
  RoutingContextValue,
} from "./contexts/RoutingContext";
export { useAppLocation, useRouting } from "./contexts/RoutingContext";
export { useRecceTheme, useRecceThemeOptional } from "./contexts/ThemeContext";

// Main provider
export { RecceProvider, type RecceProviderProps } from "./RecceProvider";
