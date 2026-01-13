/**
 * @file useValueDiffAlertDialog.tsx
 * @description OSS wrapper for useValueDiffAlertDialog that adds tracking.
 *
 * This is a thin wrapper around the @datarecce/ui hook that injects
 * tracking callbacks for analytics.
 */

import { useValueDiffAlertDialog as useBaseDialog } from "@datarecce/ui/hooks";
import {
  EXPLORE_ACTION,
  EXPLORE_FORM_EVENT,
  trackExploreActionForm,
} from "@datarecce/ui/lib/api/track";

/**
 * Hook for displaying a value diff confirmation dialog with tracking.
 *
 * This wrapper adds tracking callbacks to the base @datarecce/ui hook.
 */
function useValueDiffAlertDialog() {
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

export default useValueDiffAlertDialog;
