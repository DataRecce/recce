import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import React, { useCallback, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import {
  EXPLORE_ACTION,
  EXPLORE_FORM_EVENT,
  trackExploreActionForm,
} from "@/lib/api/track";

function useValueDiffAlertDialog() {
  const [open, setOpen] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [resolvePromise, setResolvePromise] =
    useState<(value: boolean) => void>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((nodeCount: number) => {
    setNodeCount(nodeCount);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    trackExploreActionForm({
      action: EXPLORE_ACTION.VALUE_DIFF,
      event: EXPLORE_FORM_EVENT.EXECUTE,
    });
    resolvePromise?.(true);
    setOpen(false);
  };

  const handleCancel = () => {
    trackExploreActionForm({
      action: EXPLORE_ACTION.VALUE_DIFF,
      event: EXPLORE_FORM_EVENT.CANCEL,
    });
    resolvePromise?.(false);
    setOpen(false);
  };

  const ValueDiffAlertDialog = (
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

  return { confirm, AlertDialog: ValueDiffAlertDialog };
}

export default useValueDiffAlertDialog;
