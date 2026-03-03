import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useState } from "react";
import { IoClose, IoSync } from "react-icons/io5";
import { PiInfo } from "react-icons/pi";
import {
  cacheKeys,
  isStateSyncing,
  type SyncStateInput,
  syncState,
} from "../../api";
import { useRecceInstanceInfo, useRouteConfig } from "../../contexts";
import { useApiConfig } from "../../hooks";
import { toaster } from "../ui";

function isCheckDetailPage(href: string): boolean {
  const pattern =
    /^\/checks\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  return pattern.test(href);
}

export function StateSpinner() {
  return (
    <MuiTooltip title="Syncing">
      <Box sx={{ mx: "10px" }}>
        <CircularProgress size={20} />
      </Box>
    </MuiTooltip>
  );
}

export function StateSynchronizer() {
  const [isSyncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const { apiClient } = useApiConfig();
  const router = useRouter();
  const pathname = usePathname();
  const { basePath } = useRouteConfig();
  const [open, setOpen] = useState(false);
  const [syncOption, setSyncOption] = useState<
    "overwrite" | "revert" | "merge" | ""
  >("");
  const { data: instanceInfo } = useRecceInstanceInfo();

  const handleClose = () => setOpen(false);

  const handleSync = useCallback(
    async (input: SyncStateInput) => {
      setOpen(false);
      setSyncing(true);

      const response = await syncState(input, apiClient);
      if (response.status === "conflict") {
        setOpen(true);
        setSyncing(false);
        return;
      }

      while (await isStateSyncing(apiClient)) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      toaster.create({
        description: "Sync Completed",
        type: "success",
        duration: 5000,
        closable: true,
      });

      setSyncing(false);
      setSyncOption("");

      await queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });

      if (isCheckDetailPage(pathname)) {
        router.push(`${basePath}/checks`);
      }
    },
    [queryClient, pathname, apiClient, router.push, basePath],
  );

  if (isSyncing) return <StateSpinner />;
  return (
    <>
      <MuiTooltip title="Sync with Cloud">
        <IconButton
          size="small"
          aria-label="Sync state"
          onClick={() =>
            handleSync(instanceInfo?.session_id ? { method: "merge" } : {})
          }
        >
          <Box
            component={IoSync}
            sx={{ fontSize: 16, verticalAlign: "middle" }}
          />
        </IconButton>
      </MuiTooltip>
      <MuiDialog open={open} onClose={handleClose}>
        <DialogTitle
          sx={{ display: "flex", alignItems: "center", fontWeight: "bold" }}
        >
          Sync with Cloud
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={handleClose}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography>
            New changes have been detected in the cloud. Please choose a method
            to sync your state
          </Typography>
          <Box sx={{ mt: "5px" }}>
            <RadioGroup
              value={syncOption}
              onChange={(e) => {
                setSyncOption(
                  e.target.value as "merge" | "overwrite" | "revert",
                );
              }}
            >
              <Stack direction="column">
                {/* Merge */}
                <FormControlLabel
                  value="merge"
                  control={<Radio />}
                  label={
                    <Stack direction="row" alignItems="center">
                      Merge
                      <MuiTooltip title="This will merge the local and remote states.">
                        <Box
                          component={PiInfo}
                          sx={{ ml: 2, cursor: "pointer" }}
                        />
                      </MuiTooltip>
                    </Stack>
                  }
                />

                {/* Overwrite */}
                <FormControlLabel
                  value="overwrite"
                  control={<Radio />}
                  label={
                    <Stack direction="row" alignItems="center">
                      Overwrite
                      <MuiTooltip title="This will overwrite the remote state file with the local state.">
                        <Box
                          component={PiInfo}
                          sx={{ ml: 2, cursor: "pointer" }}
                        />
                      </MuiTooltip>
                    </Stack>
                  }
                />

                {/* Revert */}
                <FormControlLabel
                  value="revert"
                  control={<Radio />}
                  label={
                    <Stack direction="row" alignItems="center">
                      Revert
                      <MuiTooltip title="This will discard local changes and revert to the cloud state.">
                        <Box
                          component={PiInfo}
                          sx={{ ml: 2, cursor: "pointer" }}
                        />
                      </MuiTooltip>
                    </Stack>
                  }
                />
              </Stack>
            </RadioGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} sx={{ mr: 1 }}>
            Cancel
          </Button>
          <Button
            color="iochmara"
            variant="contained"
            onClick={() => handleSync({ method: syncOption || undefined })}
            disabled={!syncOption}
          >
            Sync
          </Button>
        </DialogActions>
      </MuiDialog>
    </>
  );
}
