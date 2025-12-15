import "react-data-grid/lib/styles.css";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
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
import React, { useState } from "react";
import { IconType } from "react-icons";
import { IoClose } from "react-icons/io5";
import { isDisabledByNoResult } from "@/components/check/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, updateCheck } from "@/lib/api/checks";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useCheckToast } from "@/lib/hooks/useCheckToast";
import { useRun } from "@/lib/hooks/useRun";
import { findByRunType } from "../run/registry";

const ChecklistItem = ({
  check,
  selected,
  onSelect,
  onMarkAsApproved,
}: {
  check: Check;
  selected: boolean;
  onSelect: (checkId: string) => void;
  onMarkAsApproved: () => void;
}) => {
  const { featureToggles } = useRecceInstanceContext();
  const queryClient = useQueryClient();
  const checkId = check.check_id;
  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.check(checkId),
      });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });
  const trackedRunId = check.last_run?.run_id;
  const { run } = useRun(trackedRunId);

  const icon: IconType = findByRunType(check.type).icon;
  const isMarkAsApprovedDisabled =
    isDisabledByNoResult(check.type, run) ||
    featureToggles.disableUpdateChecklist;
  const isNoResult = isDisabledByNoResult(check.type, run);

  return (
    <>
      <Box
        sx={{
          width: "100%",
          p: "10px 20px",
          cursor: "pointer",
          "&:hover": { bgcolor: "Cornsilk" },
          bgcolor: selected ? "Floralwhite" : "inherit",
          borderBottom: "1px solid",
          borderBottomColor: "divider",
          borderLeft: "3px solid",
          borderLeftColor: selected ? "orange" : "transparent",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
        onClick={() => {
          onSelect(check.check_id);
        }}
      >
        <Box component={icon} sx={{ fontSize: 20 }} />
        <Box
          sx={{
            flex: 1,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
          className="no-track-pii-safe"
        >
          {check.name}
        </Box>

        <Tooltip
          content={
            isNoResult ? "Run the check first" : "Click to mark as approved"
          }
          positioning={{ placement: "top" }}
          showArrow
        >
          <Box>
            <Checkbox
              checked={check.is_checked}
              color="success"
              size="small"
              onChange={(e) => {
                if (!e.target.checked) {
                  // If unchecking, just update the check
                  mutate({ is_checked: e.target.checked });
                } else {
                  // Show Mark as Approved warning modal
                  onMarkAsApproved();
                }
              }}
              disabled={isMarkAsApprovedDisabled}
              onClick={(e) => e.stopPropagation()}
              sx={{
                borderColor: "border.inverted",
                bgcolor: isMarkAsApprovedDisabled ? "grey.200" : undefined,
              }}
            />
          </Box>
        </Tooltip>
      </Box>
    </>
  );
};

export const CheckList = ({
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
  const queryClient = useQueryClient();
  const { mutate: markCheckedByID } = useMutation({
    mutationFn: (checkId: string) => updateCheck(checkId, { is_checked: true }),
    onSuccess: async (_, checkId: string) => {
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
  const handleClose = () => setOpen(false);

  const { markedAsApprovedToast } = useCheckToast();
  const handleOnMarkAsApproved = () => {
    if (selectedItem) {
      const bypassMarkAsApprovedWarning = localStorage.getItem(
        "bypassMarkAsApprovedWarning",
      );
      if (bypassMarkAsApprovedWarning === "true") {
        markCheckedByID(selectedItem);
        markedAsApprovedToast();
      } else {
        handleOpen();
      }
    }
  };

  const handleMarkAsApprovedConfirmed = () => {
    if (selectedItem) {
      markCheckedByID(selectedItem);
      if (bypassModal) {
        localStorage.setItem("bypassMarkAsApprovedWarning", "true");
      }
      markedAsApprovedToast();
      handleClose();
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
                    if (snapshot.isDragging) {
                      const props = provided.draggableProps;
                      if (props.style != null && "left" in props.style) {
                        const offset = { x: 0, y: 80 };
                        const x = props.style.left - offset.x;
                        const y = props.style.top - offset.y;
                        props.style.left = x;
                        props.style.top = y;
                      }
                    }

                    return (
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        sx={{ width: "100%" }}
                      >
                        <ChecklistItem
                          key={check.check_id}
                          check={check}
                          selected={check.check_id === selectedItem}
                          onSelect={onCheckSelected}
                          onMarkAsApproved={handleOnMarkAsApproved}
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
