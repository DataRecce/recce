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
import { useTheme } from "@mui/material/styles";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { IconType } from "react-icons";
import { IoClose } from "react-icons/io5";
import { isDisabledByNoResult } from "@/components/check/utils";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, updateCheck } from "@/lib/api/checks";
import { useApiConfig } from "@/lib/hooks/ApiConfigContext";
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
  onMarkAsApproved: (checkId: string) => void;
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { featureToggles } = useRecceInstanceContext();
  const queryClient = useQueryClient();
  const { apiClient } = useApiConfig();
  const checkId = check.check_id;
  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) =>
      updateCheck(checkId, check, apiClient),
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
          p: "0.25rem 1.25rem",
          cursor: "pointer",
          "&:hover": { bgcolor: isDark ? "grey.800" : "Cornsilk" },
          bgcolor: selected ? (isDark ? "grey.900" : "Floralwhite") : "inherit",
          borderBottom: "1px solid",
          borderBottomColor: isDark ? "grey.700" : "divider",
          borderLeft: "3px solid",
          borderLeftColor: selected ? "orange" : "transparent",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
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

        <MuiTooltip
          title={
            isNoResult ? "Run the check first" : "Click to mark as approved"
          }
          placement="top"
          arrow
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
                  onMarkAsApproved(checkId);
                }
              }}
              disabled={isMarkAsApprovedDisabled}
              onClick={(e) => e.stopPropagation()}
              sx={{
                borderColor: "border.inverted",
                bgcolor: isMarkAsApprovedDisabled
                  ? isDark
                    ? "grey.700"
                    : "grey.200"
                  : undefined,
              }}
            />
          </Box>
        </MuiTooltip>
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
  const [pendingApprovalCheckId, setPendingApprovalCheckId] = useState<
    string | null
  >(null);
  const queryClient = useQueryClient();
  const { apiClient } = useApiConfig();
  const { mutate: markCheckedByID } = useMutation({
    mutationFn: (checkId: string) =>
      updateCheck(checkId, { is_checked: true }, apiClient),
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
  const handleClose = () => {
    setOpen(false);
    setPendingApprovalCheckId(null);
  };

  const { markedAsApprovedToast } = useCheckToast();
  const handleOnMarkAsApproved = (checkId: string) => {
    const bypassMarkAsApprovedWarning = localStorage.getItem(
      "bypassMarkAsApprovedWarning",
    );
    if (bypassMarkAsApprovedWarning === "true") {
      markCheckedByID(checkId);
      markedAsApprovedToast();
    } else {
      setPendingApprovalCheckId(checkId);
      handleOpen();
    }
  };

  const handleMarkAsApprovedConfirmed = () => {
    if (pendingApprovalCheckId) {
      markCheckedByID(pendingApprovalCheckId);
      if (bypassModal) {
        localStorage.setItem("bypassMarkAsApprovedWarning", "true");
      }
      markedAsApprovedToast();
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
