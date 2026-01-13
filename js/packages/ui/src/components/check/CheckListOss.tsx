"use client";

import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { cacheKeys } from "../../api/cacheKeys";
import { type Check, updateCheck } from "../../api/checks";
import { useRecceInstanceContext } from "../../contexts";
import { useApiConfig, useRun } from "../../hooks";
import { toaster } from "../ui";
import {
  CheckCard,
  type CheckCardData,
  type CheckRunStatus,
  type CheckType,
} from "./CheckCard";
import { isDisabledByNoResult } from "./utils";

/**
 * Wrapper component that adapts Check data to CheckCard props.
 * Handles run data fetching and maps to UI primitive expectations.
 */
const ChecklistItem = ({
  check,
  selected,
  onSelect,
  onApprovalChange,
}: {
  check: Check;
  selected: boolean;
  onSelect: (checkId: string) => void;
  onApprovalChange: (checkId: string, isApproved: boolean) => void;
}) => {
  const { featureToggles } = useRecceInstanceContext();
  const trackedRunId = check.last_run?.run_id;
  const { run } = useRun(trackedRunId);

  const isNoResult = isDisabledByNoResult({
    type: check.type,
    hasResult: !!run?.result,
    hasError: !!run?.error,
  });

  const isApprovalDisabled =
    isNoResult || featureToggles.disableUpdateChecklist;

  // Map run status if available
  const getRunStatus = (): CheckRunStatus | undefined => {
    if (!run) return undefined;
    if (run.error) return "error";
    if (run.result) return "success";
    return undefined;
  };

  // Adapt Check to CheckCardData
  const checkCardData: CheckCardData = {
    id: check.check_id,
    name: check.name,
    type: check.type as CheckType,
    isApproved: check.is_checked,
    runStatus: getRunStatus(),
    isPreset: check.is_preset,
  };

  return (
    <CheckCard
      check={checkCardData}
      isSelected={selected}
      onClick={onSelect}
      onApprovalChange={onApprovalChange}
      disableApproval={isApprovalDisabled}
      disabledApprovalTooltip={isNoResult ? "Run the check first" : undefined}
    />
  );
};

export const CheckListOss = ({
  checks,
  selectedItem,
  onCheckSelected,
  onChecksReordered,
}: {
  checks: Check[];
  selectedItem: string | null;
  onCheckSelected: (checkId: string) => void;
  onChecksReordered: (source: number, destination: number) => void;
}) => {
  const [bypassModal, setBypassModal] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingApprovalCheckId, setPendingApprovalCheckId] = useState<
    string | null
  >(null);
  const queryClient = useQueryClient();
  const { apiClient } = useApiConfig();

  // Mutation for updating check approval status
  const { mutate: updateApproval } = useMutation({
    mutationFn: ({
      checkId,
      isChecked,
    }: {
      checkId: string;
      isChecked: boolean;
    }) => updateCheck(checkId, { is_checked: isChecked }, apiClient),
    onSuccess: async (_, { checkId }) => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.check(checkId),
      });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    onChecksReordered(result.source.index, result.destination.index);
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setPendingApprovalCheckId(null);
  };

  const showApprovedToast = () => {
    toaster.create({
      title: "Marked as approved",
      type: "success",
      duration: 2000,
    });
  };

  /**
   * Handle approval change from CheckCard.
   * If approving (true), show modal or bypass based on localStorage.
   * If unapproving (false), update directly.
   */
  const handleApprovalChange = (checkId: string, isApproved: boolean) => {
    if (!isApproved) {
      // Unapproving - update directly
      updateApproval({ checkId, isChecked: false });
    } else {
      // Approving - check for bypass
      const bypassMarkAsApprovedWarning = localStorage.getItem(
        "bypassMarkAsApprovedWarning",
      );
      if (bypassMarkAsApprovedWarning === "true") {
        updateApproval({ checkId, isChecked: true });
        showApprovedToast();
      } else {
        setPendingApprovalCheckId(checkId);
        handleOpen();
      }
    }
  };

  const handleMarkAsApprovedConfirmed = () => {
    if (pendingApprovalCheckId) {
      updateApproval({ checkId: pendingApprovalCheckId, isChecked: true });
      if (bypassModal) {
        localStorage.setItem("bypassMarkAsApprovedWarning", "true");
      }
      showApprovedToast();
      handleClose();
      setPendingApprovalCheckId(null);
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="checklist">
          {(provided) => (
            <Stack
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="no-track-pii-safe"
              sx={{
                width: "100%",
                flex: 1,
                overflow: "auto",
              }}
              spacing={0}
            >
              {checks.map((check, index) => (
                <Draggable
                  key={check.check_id}
                  draggableId={check.check_id}
                  index={index}
                >
                  {(provided, snapshot) => {
                    // see https://github.com/atlassian/react-beautiful-dnd/issues/1881#issuecomment-691237307
                    // Create a new style object instead of mutating the read-only one
                    let style = provided.draggableProps.style;
                    if (snapshot.isDragging && style && "left" in style) {
                      const offset = { x: 0, y: 80 };
                      style = {
                        ...style,
                        left: (style.left as number) - offset.x,
                        top: (style.top as number) - offset.y,
                      };
                    }

                    return (
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={style}
                        sx={{ width: "100%" }}
                        borderBottom="1px solid"
                        borderColor="divider"
                      >
                        <ChecklistItem
                          key={check.check_id}
                          check={check}
                          selected={check.check_id === selectedItem}
                          onSelect={onCheckSelected}
                          onApprovalChange={handleApprovalChange}
                        />
                      </Box>
                    );
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </Stack>
          )}
        </Droppable>
      </DragDropContext>
      <MuiDialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          Mark as Approved?
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={handleClose}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ fontSize: "0.875rem" }}>
          <Typography>
            Please ensure you have reviewed the contents of this check before
            marking it as approved.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={bypassModal}
                onChange={(e) => {
                  setBypassModal(e.target.checked);
                }}
                size="small"
              />
            }
            label={
              <Typography sx={{ fontWeight: "bold", pt: "8px" }}>
                Don&apos;t show this again
              </Typography>
            }
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ gap: 0 }}>
          <Button variant="outlined" size="small" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color="iochmara"
            variant="contained"
            size="small"
            onClick={handleMarkAsApprovedConfirmed}
          >
            Mark as approved
          </Button>
        </DialogActions>
      </MuiDialog>
    </>
  );
};
