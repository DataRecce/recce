// @datarecce/ui - React component library for data validation interfaces

// Version
export const VERSION = "0.2.0";

export type { RecceInstanceInfo, ServerMode } from "./api";
// API utilities
export { cacheKeys, getRecceInstanceInfo } from "./api";
export type { LineageViewProps, LineageViewRef } from "./components";
// Components - UI components for data validation interfaces
export { LineageView } from "./components";
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
