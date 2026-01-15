"use client";

/**
 * @file useValueDiffAlertDialog.tsx
 * @description Hook for displaying a value diff confirmation dialog.
 *
 * This hook provides a callback-based API for confirming value diff operations
 * on multiple nodes. The actual tracking/analytics can be injected via callbacks.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import type { JSX } from "react";
import { useCallback, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";

/**
 * Options for useValueDiffAlertDialog hook
 */
export interface UseValueDiffAlertDialogOptions {
  /** Callback invoked when user confirms the value diff operation */
  onConfirm?: (nodeCount: number) => void;
  /** Callback invoked when user cancels the value diff operation */
  onCancel?: (nodeCount: number) => void;
}

/**
 * Return type for useValueDiffAlertDialog hook
 */
export interface UseValueDiffAlertDialogReturn {
  /** Function to trigger the confirmation dialog. Returns a promise that resolves to true if confirmed, false if cancelled. */
  confirm: (nodeCount: number) => Promise<boolean>;
  /** The dialog component to render in your component tree */
  AlertDialog: JSX.Element;
}

/**
 * Hook for displaying a confirmation dialog before executing value diff on multiple nodes.
 *
 * @param options - Optional callbacks for tracking/analytics
 * @returns Object containing `confirm` function and `AlertDialog` component
 *
 * @example Basic usage without tracking
 * ```tsx
 * import { useValueDiffAlertDialog } from '@datarecce/ui/hooks';
 *
 * function MyComponent() {
 *   const { confirm, AlertDialog } = useValueDiffAlertDialog();
 *
 *   const handleValueDiff = async () => {
 *     const confirmed = await confirm(5); // 5 nodes
 *     if (confirmed) {
 *       // Execute value diff
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleValueDiff}>Run Value Diff</button>
 *       {AlertDialog}
 *     </>
 *   );
 * }
 * ```
 *
 * @example With tracking callbacks
 * ```tsx
 * import { useValueDiffAlertDialog } from '@datarecce/ui/hooks';
 *
 * function MyComponent() {
 *   const { confirm, AlertDialog } = useValueDiffAlertDialog({
 *     onConfirm: (nodeCount) => {
 *       analytics.track('value_diff_confirmed', { nodeCount });
 *     },
 *     onCancel: (nodeCount) => {
 *       analytics.track('value_diff_cancelled', { nodeCount });
 *     },
 *   });
 *
 *   return (
 *     <>
 *       <button onClick={() => confirm(10)}>Run Value Diff</button>
 *       {AlertDialog}
 *     </>
 *   );
 * }
 * ```
 */
export function useValueDiffAlertDialog(
  options?: UseValueDiffAlertDialogOptions,
): UseValueDiffAlertDialogReturn {
  const [open, setOpen] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [resolvePromise, setResolvePromise] =
    useState<(value: boolean) => void>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((count: number) => {
    setNodeCount(count);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    options?.onConfirm?.(nodeCount);
    resolvePromise?.(true);
    setOpen(false);
  };

  const handleCancel = () => {
    options?.onCancel?.(nodeCount);
    resolvePromise?.(false);
    setOpen(false);
  };

  const AlertDialog = (
    <MuiDialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="value-diff-alert-dialog-title"
    >
      <DialogTitle
        id="value-diff-alert-dialog-title"
        sx={{ fontSize: "1.125rem", fontWeight: "bold" }}
      >
        Value Diff on {nodeCount} nodes
      </DialogTitle>
      <IconButton
        aria-label="close"
        onClick={handleCancel}
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
        <Stack spacing="20px">
          <Box>
            Value diff will be executed on {nodeCount} nodes in the Lineage,
            which can add extra costs to your bill.
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ gap: 0.5 }}>
        <Button
          ref={cancelRef}
          onClick={handleCancel}
          variant="outlined"
          color="neutral"
        >
          Cancel
        </Button>
        <Button
          color="iochmara"
          variant="contained"
          onClick={handleConfirm}
          sx={{ ml: 1.5 }}
        >
          Execute
        </Button>
      </DialogActions>
    </MuiDialog>
  );

  return { confirm, AlertDialog };
}
