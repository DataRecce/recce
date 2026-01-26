import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import React, { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { LuSave } from "react-icons/lu";
import { PiPencil } from "react-icons/pi";
import {
  cacheKeys,
  LOCAL_STORAGE_KEYS,
  rename,
  saveAs,
  useChecks,
} from "../../api";
import {
  useLineageGraphContext,
  useRecceInstanceContext,
} from "../../contexts";
import { useApiConfig } from "../../hooks";
import { formatRunDateTime } from "../run";
import { toaster } from "../ui";

const useRecceToast = () => {
  const toastSuccess = (message: string) => {
    toaster.create({
      description: message,
      type: "success",
      duration: 5000,
      closable: true,
    });
  };

  const toastError = (message: string, error?: Error) => {
    let errorMessage = message;
    if (error != null) {
      if (isAxiosError<{ detail?: string }>(error)) {
        errorMessage = `${message}. ${String(error.response?.data?.detail)}`;
      } else {
        errorMessage = `${message}. ${error}`;
      }
    }

    toaster.create({
      description: errorMessage,
      type: "error",
      duration: 5000,
      closable: true,
    });
  };

  return { toastSuccess, toastError };
};

const useClosePrompt = (prompt: boolean) => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    if (prompt) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      if (prompt) {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
    };
  }, [prompt]);
};

interface FilenameState {
  newFileName: string;
  errorMessage?: string;
  modified?: boolean;
  overwriteWithMethod?: "save" | "rename";
  bypass?: boolean;
}

export const Filename = () => {
  const { featureToggles } = useRecceInstanceContext();
  const { fileName, cloudMode, isDemoSite, envInfo } = useLineageGraphContext();
  const { apiClient } = useApiConfig();
  const [modalOpen, setModalOpen] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const isStateless = !fileName && !cloudMode && !isDemoSite;
  const { data: checks } = useChecks(isStateless);
  const hasNonPresetChecks =
    checks != undefined &&
    checks.filter((check) => !check.is_preset).length > 0;
  useClosePrompt(isStateless && hasNonPresetChecks);

  const [
    { newFileName, errorMessage, modified, overwriteWithMethod, bypass },
    setState,
  ] = useState<FilenameState>({
    newFileName: fileName ?? "recce_state.json",
    bypass: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const { toastSuccess, toastError } = useRecceToast();
  const queryClient = useQueryClient();

  const handleOpen = () => {
    setState({
      newFileName: fileName ?? "recce_state.json",
      modified: !fileName,
      bypass: false,
    });

    setModalOpen(true);
  };

  const handleModalClose = () => setModalOpen(false);
  const handleOverwriteClose = () => setOverwriteOpen(false);

  const handleAction = async (
    method: "save" | "rename",
    overwrite?: boolean,
  ) => {
    if (!newFileName) {
      return;
    }

    const bypassOverwrite =
      localStorage.getItem(LOCAL_STORAGE_KEYS.bypassSaveOverwrite) === "true";

    try {
      if (method === "save") {
        await saveAs(
          {
            filename: newFileName,
            overwrite: overwrite ?? bypassOverwrite,
          },
          apiClient,
        );
      } else {
        await rename(
          {
            filename: newFileName,
            overwrite: overwrite ?? bypassOverwrite,
          },
          apiClient,
        );
      }
      toastSuccess(
        method === "save"
          ? "Save file successfully"
          : "Rename file successfully",
      );
      await queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
      if (bypass) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.bypassSaveOverwrite, "true");
      }
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 409) {
          setState((s) => ({
            ...s,
            overwriteWithMethod: method,
          }));

          setOverwriteOpen(true);
          return;
        }
      }
      toastError(
        method === "save" ? "Save file failed" : "Rename file failed",
        error as Error,
      );
    } finally {
      handleModalClose();
    }
  };

  const handleOvewriteBack = () => {
    handleOverwriteClose();
    setModalOpen(true);
    setState((s) => {
      return {
        ...s,
        overwriteWithMethod: undefined,
      };
    });
  };

  if (cloudMode || isDemoSite) {
    return <></>;
  }

  const titleNewInstance =
    "New Instance" + (hasNonPresetChecks ? " (unsaved)" : "");
  let titleReadOnlyState;
  if (featureToggles.disableSaveToFile && fileName) {
    const generatedAt = envInfo?.stateMetadata?.generated_at;
    const formattedDate = generatedAt
      ? formatRunDateTime(new Date(generatedAt))
      : null;
    titleReadOnlyState = formattedDate
      ? `${fileName} (${formattedDate})`
      : null;
  }

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="center">
        <Box sx={{ fontWeight: 600 }}>
          {titleReadOnlyState ?? fileName ?? titleNewInstance}
        </Box>
        {!featureToggles.disableSaveToFile && (
          <MuiTooltip
            title={fileName ? "Change Filename" : "Save"}
            enterDelay={1000}
          >
            <IconButton
              onClick={handleOpen}
              aria-label={fileName ? "Change Filename" : "Save"}
              size="small"
            >
              <Box
                component={fileName ? PiPencil : LuSave}
                sx={{ fontSize: 16, verticalAlign: "middle" }}
              />
            </IconButton>
          </MuiTooltip>
        )}
      </Stack>
      <MuiDialog open={modalOpen} onClose={handleModalClose}>
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          {fileName ? "Change Filename" : "Save File"}
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={handleModalClose}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <DialogContent
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          <TextField
            inputRef={inputRef}
            value={newFileName}
            label="File name"
            placeholder="Enter filename"
            error={!!errorMessage}
            helperText={errorMessage}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            onChange={(e) => {
              const value = e.target.value;
              let newErrorMessage: string | undefined = undefined;

              if (!value) {
                newErrorMessage = "Filename cannot be empty.";
              } else if (!value.endsWith(".json")) {
                newErrorMessage = "Filename must end with .json.";
              } else if (!/^[a-zA-Z0-9 _-]+\.json$/.test(value)) {
                newErrorMessage =
                  "Invalid filename. Only alphanumeric, space, _ and - are allowed.";
              } else if (fileName && value === fileName) {
                newErrorMessage = "Filename is the same as the current one.";
              }

              setState((s) => {
                return {
                  ...s,
                  modified: true,
                  newFileName: value,
                  errorMessage: newErrorMessage,
                };
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (errorMessage) {
                  return;
                }

                if (!fileName) {
                  void handleAction("save");
                } else {
                  void handleAction("rename");
                }
              } else if (e.key === "Escape") {
                handleModalClose();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ gap: "5px" }}>
          <Button
            size="small"
            color={fileName ? "inherit" : "iochmara"}
            variant="contained"
            onClick={async () => {
              await handleAction("save");
            }}
            disabled={!newFileName || !!errorMessage || !modified}
          >
            {fileName ? "Save as New File" : "Confirm"}
          </Button>
          {fileName && (
            <Button
              size="small"
              color="iochmara"
              variant="contained"
              onClick={async () => {
                await handleAction("rename");
              }}
              disabled={!newFileName || !!errorMessage || !modified}
            >
              Rename
            </Button>
          )}
        </DialogActions>
      </MuiDialog>
      <MuiDialog open={overwriteOpen} onClose={handleOverwriteClose}>
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          Overwrite File?
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={handleOverwriteClose}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            borderTop: "solid 1px",
            borderBottom: "solid 1px",
            borderColor: "divider",
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          <Typography sx={{ fontSize: "12pt" }}>
            {overwriteWithMethod === "save"
              ? "Saving a file with this name will overwrite the existing file. Are you sure you wish to continue?"
              : "Renaming the file with this name will overwrite the existing file. Are you sure you wish to continue?"}
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={bypass}
                onChange={(e) => {
                  setState((s) => ({ ...s, bypass: e.target.checked }));
                }}
              />
            }
            label={
              <Typography sx={{ fontWeight: "bold", pt: "8px" }}>
                Don&apos;t show this again
              </Typography>
            }
          />
        </DialogContent>
        <DialogActions sx={{ gap: "5px" }}>
          <Button variant="outlined" onClick={handleOvewriteBack} size="small">
            Back
          </Button>
          <Button
            size="small"
            color="iochmara"
            variant="contained"
            onClick={() => {
              if (!overwriteWithMethod) {
                return;
              }

              void handleAction(overwriteWithMethod, true);
              handleOverwriteClose();
            }}
          >
            Overwrite
          </Button>
        </DialogActions>
      </MuiDialog>
    </>
  );
};
