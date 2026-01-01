// @datarecce/ui - React component library for data validation interfaces

// Version
export const VERSION = "0.2.0";

export type { LineageViewProps, LineageViewRef } from "./components";
// Components - UI components for data validation interfaces
export { LineageView } from "./components";
// Provider (main entry point) and Hooks - from providers module
export {
  RecceProvider,
  type RecceProviderProps,
  useApiClient,
  useRecceTheme,
  useRouting,
} from "./providers";
// Theme - colors palette and MUI theme with CSS Variables
export type { Theme } from "./theme";
export { colors, theme } from "./theme";
