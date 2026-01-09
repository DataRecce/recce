"use client";

/**
 * ExternalLinkConfirmDialog - Confirmation dialog for external links.
 *
 * Shows a warning when users click on links that navigate outside of Recce.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useRef } from "react";
import { IoClose } from "react-icons/io5";
import { PiWarning } from "react-icons/pi";

/**
 * Props for ExternalLinkConfirmDialog
 */
export interface ExternalLinkConfirmDialogProps {
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
export function truncateUrl(url: string, maxLength = 60): string {
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

/**
 * ExternalLinkConfirmDialog Component
 *
 * A dialog that asks users to confirm before navigating to external URLs.
 *
 * @example Basic usage
 * ```tsx
 * import { ExternalLinkConfirmDialog } from '@datarecce/ui/primitives';
 *
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const [pendingUrl, setPendingUrl] = useState('');
 *
 *   return (
 *     <ExternalLinkConfirmDialog
 *       isOpen={isOpen}
 *       url={pendingUrl}
 *       onConfirm={() => {
 *         window.open(pendingUrl, '_blank');
 *         setIsOpen(false);
 *       }}
 *       onCancel={() => setIsOpen(false)}
 *     />
 *   );
 * }
 * ```
 */
export function ExternalLinkConfirmDialog({
  isOpen,
  url,
  onConfirm,
  onCancel,
}: ExternalLinkConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <MuiDialog
      open={isOpen}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="external-link-dialog-title"
    >
      <DialogTitle
        id="external-link-dialog-title"
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <Box component={PiWarning} sx={{ color: "amber.500", fontSize: 20 }} />
        External Link
      </DialogTitle>
      <IconButton
        aria-label="close"
        onClick={onCancel}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: "grey.500",
        }}
      >
        <IoClose />
      </IconButton>

      <DialogContent>
        <Typography sx={{ mb: 1.5 }}>
          This link will take you to an external website outside of Recce. Are
          you sure you want to continue?
        </Typography>
        <Box
          sx={{
            bgcolor: "grey.50",
            p: 1,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "grey.200",
          }}
        >
          <Box
            component="code"
            sx={{
              fontSize: "0.875rem",
              wordBreak: "break-all",
              whiteSpace: "pre-wrap",
              bgcolor: "transparent",
              fontFamily: "monospace",
            }}
          >
            {truncateUrl(url, 100)}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ gap: 1 }}>
        <Button ref={cancelRef} variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="iochmara" variant="contained" onClick={onConfirm}>
          Open Link
        </Button>
      </DialogActions>
    </MuiDialog>
  );
}
