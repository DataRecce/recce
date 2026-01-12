import { useClipBoardToast, useThemeColors } from "@datarecce/ui/hooks";
import { colors } from "@datarecce/ui/theme";
import {
  IGNORE_SCREENSHOT_CLASS,
  useCopyToClipboard,
} from "@/lib/hooks/ScreenShot";

/**
 * Hook that provides clipboard functionality for the lineage view.
 * Wraps useCopyToClipboard with lineage-specific configuration.
 *
 * @returns Object containing copyToClipboard function, ImageDownloadModal component, and ref
 */
export const useLineageCopyToClipboard = () => {
  const { isDark } = useThemeColors();
  const { successToast, failToast } = useClipBoardToast();

  return useCopyToClipboard({
    renderLibrary: "html-to-image",
    imageType: "png",
    shadowEffect: true,
    backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
    ignoreElements: (element: Element) => {
      try {
        return element.classList.contains(IGNORE_SCREENSHOT_CLASS);
      } catch {
        if (element.className) {
          return element.className.includes(IGNORE_SCREENSHOT_CLASS);
        }
        return false;
      }
    },
    onSuccess: () => {
      successToast("Copied the Lineage View as an image to clipboard");
    },
    onError: (error) => {
      console.error("Error taking screenshot", error);
      failToast("Failed to copy image to clipboard", error);
    },
  });
};
