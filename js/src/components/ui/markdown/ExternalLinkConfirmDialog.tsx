/**
 * ExternalLinkConfirmDialog - Confirmation dialog for external links.
 *
 * Shows a warning when users click on links that navigate outside of Recce.
 */

import {
  Box,
  Button,
  CloseButton,
  Code,
  Dialog,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useRef } from "react";
import { PiWarning } from "react-icons/pi";

interface ExternalLinkConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** The external URL the user is trying to navigate to */
  url: string;
  /** Callback when user confirms navigation */
  onConfirm: () => void;
  /** Callback when user cancels navigation */
  onCancel: () => void;
}

/**
 * Truncate a URL for display, keeping the domain visible
 */
function truncateUrl(url: string, maxLength = 60): string {
  if (url.length <= maxLength) return url;

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname + urlObj.search + urlObj.hash;

    // Always show the domain
    if (domain.length >= maxLength - 3) {
      return domain.substring(0, maxLength - 3) + "...";
    }

    // Calculate remaining space for path
    const remainingLength = maxLength - domain.length - 3;
    if (path.length > remainingLength) {
      return `${domain}${path.substring(0, remainingLength)}...`;
    }

    return url;
  } catch {
    // If URL parsing fails, just truncate normally
    return url.substring(0, maxLength - 3) + "...";
  }
}

export function ExternalLinkConfirmDialog({
  isOpen,
  url,
  onConfirm,
  onCancel,
}: ExternalLinkConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onCancel();
      }}
      role="alertdialog"
      initialFocusEl={() => cancelRef.current}
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title display="flex" alignItems="center" gap={2}>
                <Box as={PiWarning} color="orange.500" boxSize="20px" />
                External Link
              </Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <Text mb={3}>
                This link will take you to an external website outside of Recce.
                Are you sure you want to continue?
              </Text>
              <Box
                bg="gray.50"
                p={2}
                borderRadius="md"
                borderWidth="1px"
                borderColor="gray.200"
              >
                <Code
                  fontSize="sm"
                  wordBreak="break-all"
                  whiteSpace="pre-wrap"
                  bg="transparent"
                >
                  {truncateUrl(url, 100)}
                </Code>
              </Box>
            </Dialog.Body>

            <Dialog.Footer gap={2}>
              <Button ref={cancelRef} variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button colorPalette="blue" onClick={onConfirm}>
                Open Link
              </Button>
            </Dialog.Footer>

            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
