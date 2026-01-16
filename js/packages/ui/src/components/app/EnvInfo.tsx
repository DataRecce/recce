import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { isEmpty } from "lodash";
import React, { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { LuExternalLink } from "react-icons/lu";
import { PiInfo } from "react-icons/pi";
import {
  type EnvInfo as EnvInfoType,
  useLineageGraphContext,
} from "../../contexts";
import {
  type EnvironmentConfigProps,
  trackEnvironmentConfig,
} from "../../lib/api/track";
import { extractSchemas, formatTimestamp, formatTimeToNow } from "../../utils";

function buildEnvironmentTrackingData(
  envInfo: EnvInfoType | undefined,
  reviewMode: boolean | undefined,
  baseSchemas: Set<string>,
  currentSchemas: Set<string>,
): EnvironmentConfigProps {
  const git = envInfo?.git;
  const pr = envInfo?.pullRequest;
  const dbtBase = envInfo?.dbt?.base;
  const dbtCurrent = envInfo?.dbt?.current;

  const trackingData: EnvironmentConfigProps = {
    review_mode: reviewMode || false,
    adapter_type: envInfo?.adapterType || null,
    has_git_info: !isEmpty(git),
    has_pr_info: !isEmpty(pr),
  };

  // DBT-specific tracking
  if (envInfo?.adapterType === "dbt") {
    trackingData.base = {
      schema_count: baseSchemas.size,
      dbt_version: dbtBase?.dbt_version || null,
      timestamp: dbtBase?.generated_at || null,
    };
    trackingData.current = {
      schema_count: currentSchemas.size,
      dbt_version: dbtCurrent?.dbt_version || null,
      timestamp: dbtCurrent?.generated_at || null,
    };
    trackingData.schemas_match =
      baseSchemas.size === currentSchemas.size &&
      Array.from(baseSchemas).every((s) => currentSchemas.has(s));
  }

  // SQLMesh-specific tracking
  if (envInfo?.adapterType === "sqlmesh") {
    trackingData.base = {
      has_env: !!envInfo.sqlmesh?.base_env,
    };
    trackingData.current = {
      has_env: !!envInfo.sqlmesh?.current_env,
    };
  }

  return trackingData;
}

function renderInfoEntries(info: object): React.JSX.Element[] {
  if (Object.values(info).every((value) => value === null)) {
    return [
      <Box key={"no info"} sx={{ ml: "10px" }}>
        No information
      </Box>,
    ];
  }

  return Object.entries(info)
    .filter(
      ([key, value]) => key !== "url" && value !== null && value !== undefined,
    )
    .map(([key, value]) => (
      <li key={key} style={{ marginLeft: "10px" }}>
        {key}: {value}
      </li>
    ));
}

export function EnvInfo() {
  const { envInfo, reviewMode, lineageGraph } = useLineageGraphContext();
  const [open, setOpen] = useState(false);
  const git = envInfo?.git;
  const pr = envInfo?.pullRequest;
  const reviewInfo = { ...git, ...pr };

  const dbtBase = envInfo?.dbt?.base;
  const dbtCurrent = envInfo?.dbt?.current;

  const baseTime = dbtBase?.generated_at
    ? formatTimestamp(dbtBase.generated_at)
    : "";
  const currentTime = dbtCurrent?.generated_at
    ? formatTimestamp(dbtCurrent.generated_at)
    : "";
  let baseRelativeTime = "";
  let currentRelativeTime = "";
  if (dbtBase) {
    baseRelativeTime = dbtBase.generated_at
      ? formatTimeToNow(dbtBase.generated_at)
      : "";
  }
  if (dbtCurrent) {
    currentRelativeTime = dbtCurrent.generated_at
      ? formatTimeToNow(dbtCurrent.generated_at)
      : "";
  }
  const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

  // Track environment configuration once at startup
  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (!hasTrackedRef.current && envInfo) {
      hasTrackedRef.current = true;
      const trackingData = buildEnvironmentTrackingData(
        envInfo,
        reviewMode,
        baseSchemas,
        currentSchemas,
      );
      trackEnvironmentConfig(trackingData);
    }
  }, [envInfo, reviewMode, baseSchemas, currentSchemas]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <MuiTooltip title="Environment Info" placement="bottom-end">
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            "&:hover": {
              color: "text.primary",
            },
          }}
          onClick={handleOpen}
        >
          <Stack
            direction="column"
            sx={{
              display: { xs: "none", lg: "flex" },
              fontSize: "0.875rem",
            }}
          >
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Typography
                component="span"
                noWrap
                sx={{ color: "warning.main", maxWidth: 128 }}
                className="no-track-pii-safe"
              >
                {Array.from(baseSchemas).join(", ")}
              </Typography>{" "}
              ({baseRelativeTime})
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Typography
                component="span"
                noWrap
                sx={{ color: "primary.main", maxWidth: 128 }}
                className="no-track-pii-safe"
              >
                {Array.from(currentSchemas).join(", ")}
              </Typography>{" "}
              ({currentRelativeTime})
            </Box>
          </Stack>
          <IconButton size="small" aria-label="Environment Info">
            <Box
              component={PiInfo}
              sx={{ fontSize: 16, verticalAlign: "middle" }}
            />
          </IconButton>
        </Box>
      </MuiTooltip>
      <MuiDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          Environment Information
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={handleClose}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack direction="column" spacing={1}>
            {reviewMode ? (
              <Stack direction="column" spacing={0.5}>
                <Typography variant="h6" sx={{ fontSize: "1rem" }}>
                  Review Information
                </Typography>
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  {reviewInfo.url && (
                    <li style={{ marginLeft: "10px" }}>
                      url:{" "}
                      <Link
                        href={reviewInfo.url}
                        target="_blank"
                        sx={{ color: "primary.main" }}
                      >
                        {reviewInfo.url} <LuExternalLink />
                      </Link>
                    </li>
                  )}
                  {!isEmpty(reviewInfo) && renderInfoEntries(reviewInfo)}
                </ul>
              </Stack>
            ) : (
              <Stack direction="column" spacing={0.5}>
                <Typography variant="h6" sx={{ fontSize: "1rem" }}>
                  Dev Information
                </Typography>
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  {git && renderInfoEntries(git)}
                </ul>
              </Stack>
            )}
            <Divider />
            {envInfo?.adapterType === "dbt" && (
              <Stack direction="column" spacing={0.5}>
                <Typography variant="h6" sx={{ fontSize: "1rem" }}>
                  DBT
                </Typography>
                <TableContainer
                  sx={{ border: 1, borderColor: "divider", maxHeight: "30rem" }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell>base</TableCell>
                        <TableCell>current</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>schema</TableCell>
                        <TableCell className="no-track-pii-safe">
                          {Array.from(baseSchemas).map((item) => (
                            <MuiTooltip
                              key={item}
                              title={item}
                              placement="bottom"
                            >
                              <div className="max-w-72 truncate">{item}</div>
                            </MuiTooltip>
                          ))}
                        </TableCell>
                        <TableCell className="no-track-pii-safe">
                          {Array.from(currentSchemas).map((item) => (
                            <MuiTooltip
                              key={item}
                              title={item}
                              placement="bottom"
                            >
                              <div className="max-w-72 truncate">{item}</div>
                            </MuiTooltip>
                          ))}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>version</TableCell>
                        <TableCell>{dbtBase?.dbt_version}</TableCell>
                        <TableCell>{dbtCurrent?.dbt_version}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>timestamp</TableCell>
                        <TableCell>{baseTime}</TableCell>
                        <TableCell>{currentTime}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
            {envInfo?.adapterType === "sqlmesh" && (
              <Stack direction="column" spacing={0.5}>
                <Typography variant="h6" sx={{ fontSize: "1rem" }}>
                  SQLMesh
                </Typography>
                <TableContainer
                  sx={{ border: 1, borderColor: "divider", maxHeight: "30rem" }}
                >
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell>base</TableCell>
                        <TableCell>current</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Environment</TableCell>
                        <TableCell className="no-track-pii-safe">
                          {envInfo.sqlmesh?.base_env}
                        </TableCell>
                        <TableCell className="no-track-pii-safe">
                          {envInfo.sqlmesh?.current_env}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="iochmara" onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </MuiDialog>
    </>
  );
}
