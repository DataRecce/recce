"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { PiCheckCircle } from "react-icons/pi";
import { useApiConfig } from "../../hooks/useApiConfig";
import {
  type CloudOrganization,
  type CloudProject,
  listCloudOrganizations,
  listCloudProjects,
  uploadToCloud,
} from "../../lib/api/cloudUpload";

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
  const [baseUploaded, setBaseUploaded] = useState(false);
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
        setBaseUploaded(result.base_uploaded ?? false);
        setDialogState("success");
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

  const selectedProjectData = projects.find(
    (p) => String(p.id) === selectedProject,
  );
  const baseNeedsUpload = selectedProjectData?.base_needs_upload ?? false;

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
        <>
          <DialogContent>
            <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
              <Box
                component={PiCheckCircle}
                sx={{ fontSize: 48, color: "success.main" }}
              />
              <Typography sx={{ fontWeight: 500, fontSize: "1.1rem" }}>
                Upload Complete
              </Typography>
              <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
                Your artifacts have been uploaded to Recce Cloud.
              </Typography>
              {baseUploaded && (
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", textAlign: "center" }}
                >
                  Base (production) artifacts were also uploaded.
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={() => window.open(sessionUrl, "_blank")}
              sx={{ borderRadius: 2, fontWeight: 500 }}
            >
              Go to Cloud Session
            </Button>
          </DialogActions>
        </>
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
