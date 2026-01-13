"use client";

/**
 * @file useValueDiffAlertDialogOss.tsx
 * @description OSS wrapper for useValueDiffAlertDialog that adds tracking.
 *
 * This is a thin wrapper around the base hook that injects
 * tracking callbacks for analytics.
 */

import {
  EXPLORE_ACTION,
  EXPLORE_FORM_EVENT,
  trackExploreActionForm,
} from "../lib/api/track";
import { useValueDiffAlertDialog as useBaseDialog } from "./useValueDiffAlertDialog";

/**
 * Hook for displaying a value diff confirmation dialog with tracking.
 *
 * This wrapper adds tracking callbacks to the base hook.
 */
function useValueDiffAlertDialogOss() {
  return useBaseDialog({
    onConfirm: () =>
      trackExploreActionForm({
        action: EXPLORE_ACTION.VALUE_DIFF,
        event: EXPLORE_FORM_EVENT.EXECUTE,
      }),
    onCancel: () =>
      trackExploreActionForm({
        action: EXPLORE_ACTION.VALUE_DIFF,
        event: EXPLORE_FORM_EVENT.CANCEL,
      }),
  });
}

export default useValueDiffAlertDialogOss;
