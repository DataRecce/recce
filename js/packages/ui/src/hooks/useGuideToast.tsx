/**
 * @recce-migration NOT_APPLICABLE
 *
 * This hook is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: Onboarding guide toasts are tied to OSS-specific feature flags and
 * user onboarding flows. Cloud has different onboarding patterns.
 *
 * If this changes in the future, consider:
 * - Creating a generic toast system in @datarecce/ui
 * - Keeping onboarding logic in host applications
 */

import { useState } from "react";
import { toaster } from "../components/ui/Toaster";

export function useGuideToast(options: {
  guideId: string;
  description: string;
  externalLink?: string;
  externalLinkText?: string;
  onExternalLinkClick?: () => void;
}) {
  const [toastId, setToastId] = useState<string | undefined>(undefined);
  const { guideId, description, externalLinkText, onExternalLinkClick } =
    options;

  function guideToast() {
    if (toastId != null) {
      // Don't show the toast again if it's already active
      return;
    }

    setToastId(
      toaster.create({
        id: guideId,
        duration: 3000,
        type: "success",
        description: description,
        action: {
          label: externalLinkText ?? "link",
          onClick: () => {
            if (onExternalLinkClick) {
              onExternalLinkClick();
            }
          },
        },
      }),
    );
  }

  return {
    guideToast: guideToast,
    closeGuideToast: () => {
      if (toastId) toaster.dismiss(toastId);
    },
  };
}
