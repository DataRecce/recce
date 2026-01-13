/**
 * @file hooks/index.ts
 * @description Barrel export for @datarecce/ui hooks
 */

export { type ApiConfigContextType, useApiConfig } from "./useApiConfig";
export { useClipBoardToast } from "./useClipBoardToast";
export { useIsDark } from "./useIsDark";
export {
  extractColumns,
  type UseModelColumnsReturn,
  unionColumns,
  useModelColumns,
} from "./useModelColumns";
export {
  type MultiNodesActionCallbacks,
  type MultiNodesActionTracking,
  type MultiNodesActionTrackProps,
  type MultiNodesActionType,
  type UseMultiNodesActionOptions,
  type UseMultiNodesActionReturn,
  useMultiNodesAction,
} from "./useMultiNodesAction";
export { type UseRunResult, useRun } from "./useRun";
export { type ThemeColors, useThemeColors } from "./useThemeColors";
export {
  type UseValueDiffAlertDialogOptions,
  type UseValueDiffAlertDialogReturn,
  useValueDiffAlertDialog,
} from "./useValueDiffAlertDialog";
