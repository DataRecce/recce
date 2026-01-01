// @datarecce/ui - React component library for data validation interfaces

// Version
export const VERSION = "0.2.0";

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

// Note: Components will be added in subsequent tasks as they are migrated
// from src/components/ to packages/ui/src/components/
