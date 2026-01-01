// @datarecce/ui - React component library for data validation interfaces

// Version
export const VERSION = "0.2.0";

export type { RecceInstanceInfo, ServerMode } from "./api";
// API utilities
export {
  cacheKeys,
  getLastKeepAliveTime,
  getRecceInstanceInfo,
  resetKeepAliveState,
  sendKeepAlive,
  setKeepAliveCallback,
} from "./api";
export type { LineageViewProps, LineageViewRef } from "./components";
// Components - UI components for data validation interfaces
export { LineageView } from "./components";
// Idle timeout context - session management
export type { IdleTimeoutContextType } from "./contexts";
export {
  IdleTimeoutProvider,
  useIdleDetection,
  useIdleTimeout,
  useIdleTimeoutSafe,
} from "./contexts";
// Provider (main entry point) and Hooks - from providers module
export {
  defaultFeatureToggles,
  defaultInstanceInfo,
  type InstanceInfoType,
  type RecceFeatureMode,
  type RecceFeatureToggles,
  // Instance context exports
  RecceInstanceInfoProvider,
  RecceProvider,
  type RecceProviderProps,
  useApiClient,
  useApiConfig,
  useRecceInstanceContext,
  useRecceInstanceInfo,
  useRecceTheme,
  useRouting,
} from "./providers";
// Theme - colors palette and MUI theme with CSS Variables
export type { Theme } from "./theme";
export { colors, theme } from "./theme";
