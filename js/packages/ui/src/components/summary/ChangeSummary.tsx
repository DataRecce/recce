/**
 * @file ChangeSummary.tsx
 * @description Change summary component for displaying node and column changes
 *
 * This component displays an overview of changes detected in a lineage graph,
 * including:
 * - Code changes (added, removed, modified nodes)
 * - Column changes (added, removed, modified columns)
 *
 * Each change type is displayed with its corresponding icon and count.
 */

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { FiInfo } from "react-icons/fi";

import type { ChangeStatus, ChangeSummaryProps } from "./types";
import { NODE_CHANGE_STATUS_MSGS } from "./types";
import { calculateChangeSummary, getIconForChangeStatus } from "./utils";

/**
 * Summary text display with optional tooltip
 *
 * @internal
 */
function SummaryText({
  name,
  value,
  tip,
}: {
  name: ReactNode;
  value: ReactNode;
  tip?: ReactNode;
}) {
  return (
    <Stack alignItems="stretch">
      <Typography sx={{ fontSize: "0.875rem", color: "grey.600" }}>
        {name}
        {tip && (
          <MuiTooltip title={tip}>
            <Box sx={{ display: "inline-block" }}>
              <Box
                component={FiInfo}
                sx={{ mx: "2px", fontSize: 12, verticalAlign: "middle" }}
              />
            </Box>
          </MuiTooltip>
        )}
      </Typography>
      {value}
    </Stack>
  );
}

/**
 * Label for a change status count with icon
 *
 * @internal
 */
function ChangeStatusCountLabel({
  changeStatus,
  value,
}: {
  changeStatus: ChangeStatus;
  value: number;
}) {
  const [label] = changeStatus ? NODE_CHANGE_STATUS_MSGS[changeStatus] : [""];
  const { icon, color } = getIconForChangeStatus(changeStatus);

  return (
    <Stack alignItems="stretch">
      <Stack
        direction="row"
        alignItems="center"
        sx={{ fontSize: "0.875rem", color: "grey.600" }}
      >
        {icon && (
          <Box component={icon} sx={{ mr: "5px", color, fontSize: "1rem" }} />
        )}
        {label}
      </Stack>
      <Typography sx={{ fontSize: "0.875rem" }}>{value}</Typography>
    </Stack>
  );
}

/**
 * ChangeSummary component
 *
 * Displays a summary of all changes in a lineage graph, split into two sections:
 * - Code Changes: Added, removed, and modified nodes
 * - Column Changes: Added, removed, and modified columns
 *
 * @example
 * ```tsx
 * <ChangeSummary lineageGraph={lineageGraph} />
 * ```
 */
export function ChangeSummary({ lineageGraph }: ChangeSummaryProps) {
  const { adds, removes, modifies, col_added, col_removed, col_changed } =
    calculateChangeSummary(lineageGraph);

  return (
    <Grid
      container
      sx={{
        mb: "10px",
        borderTop: "1px solid",
        borderColor: "divider",
        p: "2.5vw",
      }}
    >
      <Grid size={6} sx={{ borderColor: "divider" }}>
        <SummaryText
          name="Code Changes"
          value={
            <Grid container sx={{ width: "100%" }}>
              <Grid size={4}>
                <ChangeStatusCountLabel changeStatus="added" value={adds} />
              </Grid>
              <Grid size={4}>
                <ChangeStatusCountLabel
                  changeStatus="removed"
                  value={removes}
                />
              </Grid>
              <Grid size={4}>
                <ChangeStatusCountLabel
                  changeStatus="modified"
                  value={modifies}
                />
              </Grid>
            </Grid>
          }
        />
      </Grid>
      <Grid
        size={6}
        sx={{ borderLeft: "1px solid", borderLeftColor: "divider", pl: "12px" }}
      >
        <SummaryText
          name="Column Changes"
          value={
            <Grid container sx={{ width: "100%" }}>
              <Grid size={4}>
                <ChangeStatusCountLabel
                  changeStatus="col_added"
                  value={col_added}
                />
              </Grid>
              <Grid size={4}>
                <ChangeStatusCountLabel
                  changeStatus="col_removed"
                  value={col_removed}
                />
              </Grid>
              <Grid size={4}>
                <ChangeStatusCountLabel
                  changeStatus="col_changed"
                  value={col_changed}
                />
              </Grid>
            </Grid>
          }
        />
      </Grid>
    </Grid>
  );
}
