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
  type ConnectionInfo,
  getCloudProjectBaseStatus,
  getConnectionInfo,
  listCloudOrganizations,
  listCloudProjects,
  setupWarehouse,
  uploadToCloud,
} from "../../lib/api/cloudUpload";
import { PUBLIC_CLOUD_WEB_URL } from "../../lib/const";
import {
  buildPrefillValues,
  getDefaultAuthMethod,
  getFieldsForAuthMethod,
  isSupportedAdapter,
  SUPPORTED_ADAPTERS,
} from "../../lib/warehouseAdapters";

type DialogState =
  | "select"
  | "uploading"
  | "dw_setup"
  | "dw_saving"
  | "success"
  | "error"
  | "dw_error";

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
  const [sessionName, setSessionName] = useState("");
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [sessionUrl, setSessionUrl] = useState("");
  const [baseNeedsUpload, setBaseNeedsUpload] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(
    null,
  );
  const [dwFormValues, setDwFormValues] = useState<Record<string, string>>({});
  const [dwAuthMethod, setDwAuthMethod] = useState("");
  const [uploadResult, setUploadResult] = useState<{
    sessionUrl: string;
    baseUploaded: boolean;
  } | null>(null);

  // Load organizations when dialog opens
  useEffect(() => {
    if (!open) return;
    setDialogState("select");
    setSessionName(
      `dev-${new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "")}`,
    );
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
        setUploadResult({
          sessionUrl: result.session_url,
          baseUploaded: baseNeedsUpload,
        });

        // Skip DW setup if the project already has a warehouse connection
        const projectHasWarehouse = !!selectedProjectData?.warehouse_connection;
        const connInfo = projectHasWarehouse
          ? null
          : await getConnectionInfo(apiClient);
        if (connInfo && isSupportedAdapter(connInfo.type)) {
          setConnectionInfo(connInfo);
          setDwFormValues(buildPrefillValues(connInfo.type, connInfo));
          setDwAuthMethod(getDefaultAuthMethod(connInfo.type));
          setDialogState("dw_setup");
        } else {
          // Unsupported adapter — skip DW setup
          setSessionUrl(result.session_url);
          setDialogState("success");
          window.open(result.session_url, "_blank");
        }
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

  const handleDwSetup = async () => {
    if (!connectionInfo || !uploadResult) return;

    // Validate required fields before submitting
    const fields = getFieldsForAuthMethod(connectionInfo.type, dwAuthMethod);
    const missingFields = fields.filter(
      (f) => f.required && !dwFormValues[f.name]?.trim(),
    );
    if (missingFields.length > 0) {
      setErrorMessage(
        `Please fill in: ${missingFields.map((f) => f.label).join(", ")}`,
      );
      setDialogState("dw_error");
      return;
    }

    setDialogState("dw_saving");
    try {
      const config: Record<string, unknown> = { type: connectionInfo.type };
      // For Databricks OAuth, Cloud expects auth_type field
      if (connectionInfo.type === "databricks" && dwAuthMethod === "oauth") {
        config.auth_type = "oauth";
      }
      // For BigQuery, Cloud expects method field
      if (connectionInfo.type === "bigquery") {
        config.method = "service-account-json";
      }
      for (const field of fields) {
        const value = dwFormValues[field.name];
        if (value) {
          if (field.type === "number") {
            const num = Number(value);
            if (Number.isNaN(num)) continue;
            config[field.name] = num;
          } else {
            config[field.name] = value;
          }
        }
      }

      await setupWarehouse(apiClient, {
        org_id: selectedOrg,
        project_id: selectedProject,
        connection_name: `${selectedProjectData?.display_name || selectedProjectData?.name || "Project"} DW`,
        config,
      });

      setSessionUrl(uploadResult.sessionUrl);
      setDialogState("success");
      window.open(uploadResult.sessionUrl, "_blank");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to set up warehouse connection",
      );
      setDialogState("dw_error");
    }
  };

  const handleSkipDw = () => {
    if (!uploadResult) return;
    setSessionUrl(uploadResult.sessionUrl);
    setDialogState("success");
    window.open(uploadResult.sessionUrl, "_blank");
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
      onClose={
        dialogState === "uploading" || dialogState === "dw_saving"
          ? undefined
          : onClose
      }
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: "1rem" } },
      }}
    >
      {dialogState === "select" && (
        <>
          <DialogTitle
            sx={{ textAlign: "center", fontSize: "1.25rem", pb: 0.5 }}
          >
            Upload to Recce Cloud
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
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
          <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={36} />
            <Typography sx={{ fontWeight: 500, fontSize: "1rem" }}>
              Uploading artifacts...
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              {baseNeedsUpload
                ? "Uploading base and current artifacts. This may take a moment."
                : "This may take a moment."}
            </Typography>
          </Stack>
        </DialogContent>
      )}

      {dialogState === "dw_setup" &&
        connectionInfo &&
        (() => {
          const adapterDef = SUPPORTED_ADAPTERS[connectionInfo.type];
          if (!adapterDef) return null;
          const hasMultipleAuthMethods = adapterDef.authMethods.length > 1;
          const activeAuthMethod = adapterDef.authMethods.find(
            (m) => m.value === dwAuthMethod,
          );

          return (
            <>
              <DialogTitle
                sx={{ textAlign: "center", fontSize: "1.25rem", pb: 0.5 }}
              >
                Set Up Data Warehouse
              </DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 0.5 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Connect your {adapterDef.label} warehouse so Recce Cloud can
                    query your data. You can skip this and set it up later.
                  </Typography>

                  {adapterDef.commonFields.map((field) => (
                    <TextField
                      key={field.name}
                      fullWidth
                      size="small"
                      label={field.label}
                      type={field.type === "textarea" ? "text" : field.type}
                      multiline={field.type === "textarea"}
                      minRows={field.type === "textarea" ? 3 : undefined}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={dwFormValues[field.name] ?? ""}
                      onChange={(e) =>
                        setDwFormValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                    />
                  ))}

                  {hasMultipleAuthMethods && (
                    <FormControl fullWidth size="small">
                      <InputLabel>Authentication</InputLabel>
                      <Select
                        value={dwAuthMethod}
                        label="Authentication"
                        onChange={(e) => {
                          setDwAuthMethod(e.target.value);
                          // Clear auth-specific field values when switching
                          setDwFormValues((prev) => {
                            const next = { ...prev };
                            for (const method of adapterDef.authMethods) {
                              for (const field of method.fields) {
                                delete next[field.name];
                              }
                            }
                            return next;
                          });
                        }}
                      >
                        {adapterDef.authMethods.map((method) => (
                          <MenuItem key={method.value} value={method.value}>
                            {method.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {activeAuthMethod?.fields.map((field) => (
                    <TextField
                      key={field.name}
                      fullWidth
                      size="small"
                      label={field.label}
                      type={field.type === "textarea" ? "text" : field.type}
                      multiline={field.type === "textarea"}
                      minRows={field.type === "textarea" ? 3 : undefined}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={dwFormValues[field.name] ?? ""}
                      onChange={(e) =>
                        setDwFormValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                    />
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="neutral"
                  onClick={handleSkipDw}
                  sx={{ borderRadius: 2, fontWeight: 500 }}
                >
                  Skip
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleDwSetup}
                  sx={{ borderRadius: 2, fontWeight: 500 }}
                >
                  Setup & Continue
                </Button>
              </DialogActions>
            </>
          );
        })()}

      {dialogState === "dw_saving" && (
        <DialogContent>
          <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={36} />
            <Typography sx={{ fontWeight: 500, fontSize: "1rem" }}>
              Setting up warehouse connection...
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
          <Stack spacing={1.5} alignItems="center" sx={{ pt: 2, pb: 1 }}>
            <Box
              component={PiCheckCircle}
              sx={{ fontSize: 36, color: "success.main" }}
            />
            <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>
              Upload Complete
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              Your artifacts have been uploaded to Recce Cloud.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              href={sessionUrl}
              target="_blank"
              component="a"
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                mt: 1,
              }}
            >
              Open in Recce Cloud
            </Button>
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

      {dialogState === "dw_error" && (
        <>
          <DialogContent>
            <Stack spacing={1.5} alignItems="center" sx={{ py: 2 }}>
              <Typography sx={{ fontWeight: 500, fontSize: "1rem" }}>
                Warehouse Setup Failed
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", textAlign: "center" }}
              >
                {errorMessage}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              color="neutral"
              onClick={handleSkipDw}
              sx={{ borderRadius: 2, fontWeight: 500 }}
            >
              Skip
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={() => setDialogState("dw_setup")}
              sx={{ borderRadius: 2, fontWeight: 500 }}
            >
              Retry Setup
            </Button>
          </DialogActions>
        </>
      )}

      {dialogState === "error" && (
        <>
          <DialogContent>
            <Stack spacing={1.5} alignItems="center" sx={{ py: 2 }}>
              <Typography sx={{ fontWeight: 500, fontSize: "1rem" }}>
                Upload Failed
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", textAlign: "center" }}
              >
                {errorMessage}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
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
