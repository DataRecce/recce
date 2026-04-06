"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { LuExternalLink } from "react-icons/lu";
import { PiCheckCircle, PiX } from "react-icons/pi";
import { useApiConfig } from "../../hooks/useApiConfig";
import {
  type CloudOrganization,
  type CloudProject,
  getCloudProjectBaseStatus,
  listCloudOrganizations,
  listCloudProjects,
  uploadToCloud,
} from "../../lib/api/cloudUpload";
import { PUBLIC_CLOUD_WEB_URL } from "../../lib/const";

type DialogState = "select" | "uploading" | "success" | "error";

interface CloudUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CloudUploadDialogOss({
  open,
  onClose,
}: CloudUploadDialogProps) {
  const { apiClient } = useApiConfig();
  const [dialogState, setDialogState] = useState<DialogState>("select");
  const [orgs, setOrgs] = useState<CloudOrganization[]>([]);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [sessionName, setSessionName] = useState(
    () =>
      `dev-${new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "")}`,
  );
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [sessionUrl, setSessionUrl] = useState("");
  const [baseNeedsUpload, setBaseNeedsUpload] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load organizations when dialog opens
  useEffect(() => {
    if (!open) return;
    setDialogState("select");
    setIsLoadingOrgs(true);
    listCloudOrganizations(apiClient)
      .then((orgs) => {
        setOrgs(orgs);
        if (orgs.length === 1) {
          setSelectedOrg(String(orgs[0].id));
        }
      })
      .catch(() => setOrgs([]))
      .finally(() => setIsLoadingOrgs(false));
  }, [open, apiClient]);

  // Load projects when org changes
  useEffect(() => {
    if (!selectedOrg) {
      setProjects([]);
      setSelectedProject("");
      return;
    }
    setIsLoadingProjects(true);
    setSelectedProject("");
    listCloudProjects(apiClient, selectedOrg)
      .then((projects) => {
        setProjects(projects);
        if (projects.length === 1) {
          setSelectedProject(String(projects[0].id));
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setIsLoadingProjects(false));
  }, [selectedOrg, apiClient]);

  // Check base status when project changes
  useEffect(() => {
    if (!selectedOrg || !selectedProject) {
      setBaseNeedsUpload(false);
      return;
    }
    getCloudProjectBaseStatus(apiClient, selectedOrg, selectedProject)
      .then((status) => setBaseNeedsUpload(status.base_needs_upload))
      .catch(() => setBaseNeedsUpload(false));
  }, [selectedOrg, selectedProject, apiClient]);

  const handleUpload = async () => {
    if (!selectedOrg || !selectedProject || !sessionName.trim()) return;

    setDialogState("uploading");
    try {
      const result = await uploadToCloud(apiClient, {
        org_id: selectedOrg,
        project_id: selectedProject,
        session_name: sessionName.trim(),
      });
      if (result.status === "success" && result.session_url) {
        setSessionUrl(result.session_url);
        setDialogState("success");
        window.open(result.session_url, "_blank");
      } else {
        setErrorMessage(result.message || "Upload failed");
        setDialogState("error");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An error occurred during upload",
      );
      setDialogState("error");
    }
  };

  const selectedOrgData = orgs.find((o) => String(o.id) === selectedOrg);
  const selectedProjectData = projects.find(
    (p) => String(p.id) === selectedProject,
  );
  const projectPageUrl =
    selectedOrgData && selectedProjectData
      ? `${PUBLIC_CLOUD_WEB_URL}/${selectedOrgData.name}/${selectedProjectData.name}`
      : undefined;

  const canUpload =
    selectedOrg && selectedProject && sessionName.trim() && !isLoadingOrgs;

  return (
    <MuiDialog
      open={open}
      onClose={dialogState === "uploading" ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: "1rem" } },
      }}
    >
      {dialogState === "select" && (
        <>
          <DialogTitle sx={{ textAlign: "center", fontSize: "1.5rem" }}>
            Upload to Recce Cloud
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ pt: 1 }}>
              <Typography sx={{ color: "text.secondary" }}>
                Upload your local artifacts to Recce Cloud so your team can
                review and query the data.
              </Typography>

              <FormControl fullWidth size="small">
                <InputLabel>Organization</InputLabel>
                <Select
                  value={selectedOrg}
                  label="Organization"
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  disabled={isLoadingOrgs}
                >
                  {orgs.map((org) => (
                    <MenuItem key={org.id} value={String(org.id)}>
                      {org.display_name || org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Project</InputLabel>
                <Select
                  value={selectedProject}
                  label="Project"
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={!selectedOrg || isLoadingProjects}
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={String(project.id)}>
                      {project.display_name || project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                size="small"
                label="Session Name"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., my-feature-review"
              />

              {baseNeedsUpload && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Base artifacts will also be uploaded to set up the project's
                  base environment for diffing.
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={!canUpload}
              sx={{ borderRadius: 2, fontWeight: 500 }}
            >
              Upload
            </Button>
          </DialogActions>
        </>
      )}

      {dialogState === "uploading" && (
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={48} />
            <Typography sx={{ fontWeight: 500, fontSize: "1.1rem" }}>
              Uploading artifacts...
            </Typography>
            <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
              {baseNeedsUpload
                ? "Uploading base and current artifacts. This may take a moment."
                : "This may take a moment."}
            </Typography>
          </Stack>
        </DialogContent>
      )}

      {dialogState === "success" && (
        <DialogContent sx={{ position: "relative" }}>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ position: "absolute", top: 8, right: 8 }}
            aria-label="Close"
          >
            <PiX />
          </IconButton>
          <Stack spacing={1.5} alignItems="center" sx={{ pt: 3, pb: 1 }}>
            <Box
              component={PiCheckCircle}
              sx={{ fontSize: 40, color: "success.main" }}
            />
            <Typography sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
              Upload Complete
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              Your artifacts have been uploaded to Recce Cloud.
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              Recce Cloud Web has been opened in another tab.
              <br />
              If you don&apos;t see it, click{" "}
              <Link
                href={sessionUrl}
                target="_blank"
                sx={{ fontSize: "inherit" }}
              >
                open instance directly
              </Link>
              .
            </Typography>
            {projectPageUrl && (
              <Link
                href={projectPageUrl}
                target="_blank"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "0.8125rem",
                  mt: 1,
                }}
              >
                Go to project page <LuExternalLink size={12} />
              </Link>
            )}
          </Stack>
        </DialogContent>
      )}

      {dialogState === "error" && (
        <>
          <DialogContent>
            <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
              <Typography sx={{ fontWeight: 500, fontSize: "1.1rem" }}>
                Upload Failed
              </Typography>
              <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
                {errorMessage}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              color="neutral"
              onClick={() => setDialogState("select")}
              sx={{ borderRadius: 2, fontWeight: 500 }}
            >
              Try Again
            </Button>
          </DialogActions>
        </>
      )}
    </MuiDialog>
  );
}
