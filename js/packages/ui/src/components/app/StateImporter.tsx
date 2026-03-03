import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import React, { ChangeEvent, useCallback, useRef, useState } from "react";
import { FaFileImport } from "react-icons/fa6";
import { IoClose } from "react-icons/io5";
import { PiInfo } from "react-icons/pi";
import { cacheKeys, importState } from "../../api";
import {
  useLineageGraphContext,
  useRecceInstanceContext,
  useRouteConfig,
  useRunsAggregated,
} from "../../contexts";
import { useApiConfig, useIsDark } from "../../hooks";
import { trackStateAction } from "../../lib/api/track";
import { toaster } from "../ui";

export function StateImporter({ checksOnly = true }: { checksOnly?: boolean }) {
  const isDark = useIsDark();
  const { featureToggles } = useRecceInstanceContext();
  const queryClient = useQueryClient();
  const { apiClient } = useApiConfig();
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { basePath } = useRouteConfig();
  const [, refetchRunsAggregated] = useRunsAggregated();

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      return;
    }

    try {
      const { runs, checks } = await importState(
        selectedFile,
        checksOnly,
        apiClient,
      );
      refetchRunsAggregated?.();
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
      if (pathname.includes("/checks")) {
        router.push(`${basePath}/checks`);
      }
      const description = checksOnly
        ? `${checks} checks imported successfully`
        : `${runs} runs and ${checks} checks imported successfully`;
      toaster.create({
        description: description,
        type: "info",
        duration: 5000,
        closable: true,
      });
    } catch (error) {
      console.error("Import failed", error);
      toaster.create({
        title: "Import failed",
        description: String(error),
        type: "error",
        duration: 5000,
        closable: true,
      });
    }

    setOpen(false);
  }, [
    queryClient,
    selectedFile,
    pathname,
    refetchRunsAggregated,
    checksOnly,
    apiClient,
    router.push,
    basePath,
  ]);

  const handleClick = () => {
    if (hiddenFileInput.current) {
      hiddenFileInput.current.click();
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length === 1) {
      setSelectedFile(event.target.files[0]);
      setOpen(true);
    }

    if (hiddenFileInput.current) {
      hiddenFileInput.current.value = "";
    }
  };

  const handleClose = () => setOpen(false);

  const warningSubject = checksOnly ? "checks" : "runs and checks";
  const { isDemoSite } = useLineageGraphContext();
  return (
    <>
      <MuiTooltip
        title={
          "Import Checklist from State File" +
          (isDemoSite ? " (Disabled in the demo site)" : "")
        }
      >
        <IconButton
          sx={{
            pt: "6px",
            color: isDark ? "grey.300" : "grey.600",
            "&:hover": { color: isDark ? "grey.100" : "grey.800" },
            fontSize: 20,
          }}
          aria-label="Import state"
          onClick={() => {
            handleClick();
            trackStateAction({ name: "import" });
          }}
          disabled={featureToggles.disableImportStateFile || isDemoSite}
        >
          <FaFileImport />
        </IconButton>
      </MuiTooltip>
      <input
        type="file"
        style={{ display: "none" }}
        ref={hiddenFileInput}
        onChange={handleFileSelect}
      />
      <MuiDialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="import-dialog-title"
      >
        <DialogTitle
          id="import-dialog-title"
          sx={{ display: "flex", alignItems: "center", fontWeight: "bold" }}
        >
          Import state
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={handleClose}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack
            direction="column"
            spacing={1}
            sx={{ px: "5px", borderRadius: 1 }}
          >
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Box component={PiInfo} sx={{ color: "error.main" }} />
              <Typography
                component="span"
                sx={{ fontWeight: 500, color: "error.main" }}
              >
                Caution!
              </Typography>
            </Stack>
            <Typography>
              The current {warningSubject} will be{" "}
              <Typography component="span" sx={{ fontWeight: 600 }}>
                merged
              </Typography>{" "}
              with the imported state
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button ref={cancelRef} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color="iochmara"
            variant="contained"
            onClick={handleImport}
            sx={{ ml: "5px" }}
          >
            Import
          </Button>
        </DialogActions>
      </MuiDialog>
    </>
  );
}
