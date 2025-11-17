import { useState } from "react";
import { toaster } from "@/components/ui/toaster";

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
      toaster.dismiss(toastId);
    },
  };
}
