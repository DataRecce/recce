import type { Run, RunType } from "@datarecce/ui/api";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import MuiPopover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ComponentType, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { IconInfo } from "@/components/icons";
import { RunFormParamTypes } from "@/components/run/registry";
import {
  EXPLORE_FORM_EVENT,
  isExploreAction,
  trackExploreActionForm,
} from "@/lib/api/track";
import { RunFormProps } from "./types";

interface RunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (type: RunType, params: RunFormParamTypes) => void;
  title: string;
  type: RunType;
  params?: RunFormParamTypes;
  initialRun?: Run;
  RunForm?: ComponentType<RunFormProps<RunFormParamTypes>>;
}

const getDocumentationUrl = (type: RunType): string | null => {
  const urlMap: Record<string, string> = {
    value_diff: "https://docs.datarecce.io/features/lineage/#value-diff",
    profile_diff: "https://docs.datarecce.io/features/lineage/#profile-diff",
    histogram_diff:
      "https://docs.datarecce.io/features/lineage/#histogram-diff",
    top_k_diff: "https://docs.datarecce.io/features/lineage/#top-k-diff",
  };
  return urlMap[type] || null;
};

export const RunModal = ({
  isOpen,
  onClose,
  onExecute,
  type,
  title,
  params: defaultParams,
  RunForm,
}: RunModalProps) => {
  const [params, setParams] = useState<Partial<RunFormParamTypes>>(
    defaultParams ?? {},
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isReadyToExecute, setIsReadyToExecute] = useState(false);
  const documentationUrl = getDocumentationUrl(type);
  const executeClicked = useRef(false);

  const handleClose = () => {
    if (!executeClicked.current && isExploreAction(type)) {
      trackExploreActionForm({
        action: type,
        event: EXPLORE_FORM_EVENT.CANCEL,
      });
    }
    executeClicked.current = false; // Reset for next open
    onClose();
  };

  return (
    <MuiDialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      slotProps={{
        paper: { sx: { height: "75%", minHeight: "400px" } },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
        {title}{" "}
        {documentationUrl && (
          <>
            <IconButton
              size="small"
              aria-label="Click this button to learn more about the SQL behind"
              onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
              onMouseLeave={() => setAnchorEl(null)}
              onClick={() => window.open(documentationUrl, "_blank")}
            >
              <Box component={IconInfo} sx={{ fontSize: "16px" }} />
            </IconButton>
            <MuiPopover
              open={Boolean(anchorEl)}
              anchorEl={anchorEl}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              disableRestoreFocus
              sx={{ pointerEvents: "none" }}
              slotProps={{
                paper: {
                  sx: { bgcolor: "black", color: "white", p: 1 },
                },
              }}
            >
              <Typography sx={{ fontSize: "0.875rem" }}>
                Click{" "}
                <Link
                  href={documentationUrl}
                  target="_blank"
                  sx={{
                    textDecoration: "underline",
                    color: "white",
                    "&:hover": { color: "iochmara.300" },
                  }}
                >
                  here
                </Link>{" "}
                to learn more about the SQL behind
              </Typography>
            </MuiPopover>
          </>
        )}
      </DialogTitle>
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: "grey.500",
        }}
      >
        <IoClose />
      </IconButton>
      <DialogContent
        sx={{
          p: 0,
          overflow: "auto",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ contain: "layout" }}>
          {RunForm && (
            <RunForm
              params={params}
              onParamsChanged={setParams}
              setIsReadyToExecute={setIsReadyToExecute}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing="10px">
          <Button
            disabled={!isReadyToExecute}
            color="iochmara"
            variant="contained"
            onClick={() => {
              executeClicked.current = true;
              if (isExploreAction(type)) {
                trackExploreActionForm({
                  action: type,
                  event: EXPLORE_FORM_EVENT.EXECUTE,
                });
              }
              onExecute(type, params as RunFormParamTypes);
            }}
          >
            Execute
          </Button>
        </Stack>
      </DialogActions>
    </MuiDialog>
  );
};
