import type { NodeData } from "@datarecce/ui/api";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ReactNode } from "react";
import { IconType } from "react-icons";
import { FiInfo } from "react-icons/fi";
import { token } from "@/components/ui/mui-theme";
import { LineageGraph } from "../lineage/lineage";
import {
  IconAdded,
  IconChanged,
  IconModified,
  IconRemoved,
} from "../lineage/styles";

export type ChangeStatus =
  // node change
  // code change (user edit)
  | "added"
  | "removed"
  | "modified"

  // column change
  | "col_added"
  | "col_removed"
  | "col_changed"

  // folder change
  | "folder_changed"
  | null;

export const NODE_CHANGE_STATUS_MSGS = {
  added: ["Model Added", "Added resource"],
  removed: ["Model Removed", "Removed resource"],
  modified: ["Model Modified", "Modified resource"],
  col_added: ["Column Added", "Added column"],
  col_removed: ["Column Removed", "Removed column"],
  col_changed: ["Column Modified", "Modified column"],
  folder_changed: ["Modified", "Modified folder"],
};

export function getIconForChangeStatus(changeStatus?: ChangeStatus): {
  color: string;
  icon: IconType | undefined;
} {
  const greenColor = String(token("colors.green.solid"));
  const redColor = String(token("colors.red.solid"));
  const amberColor = String(token("colors.amber.emphasized"));

  if (changeStatus === "added") {
    return { color: greenColor, icon: IconAdded };
  } else if (changeStatus === "removed") {
    return { color: redColor, icon: IconRemoved };
  } else if (changeStatus === "modified") {
    return { color: amberColor, icon: IconModified };
  } else if (changeStatus === "col_added") {
    return { color: greenColor, icon: IconAdded };
  } else if (changeStatus === "col_removed") {
    return { color: redColor, icon: IconRemoved };
  } else if (changeStatus === "col_changed") {
    return { color: amberColor, icon: IconModified };
  } else if (changeStatus === "folder_changed") {
    return { color: amberColor, icon: IconChanged };
  }

  return { color: "inherit", icon: undefined };
}

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

function calculateColumnChange(
  base: NodeData | undefined,
  current: NodeData | undefined,
) {
  let adds = 0;
  let removes = 0;
  let modifies = 0;
  if (!base && !current) return { adds, removes, modifies };

  // Add columns
  if (current) {
    Object.keys(current.columns ?? {}).forEach((col) => {
      if (!base?.columns?.[col]) adds++;
    });
  }

  // Remove columns
  if (base) {
    Object.keys(base.columns ?? {}).forEach((col) => {
      if (!current?.columns?.[col]) removes++;
    });
  }

  // Modify columns
  if (current && base) {
    Object.keys(current.columns ?? {}).forEach((col) => {
      if (base.columns && current.columns?.[col] && base.columns[col]) {
        if (base.columns[col].type !== current.columns[col].type) modifies++;
      }
    });
  }

  return { adds, removes, modifies };
}

function calculateChangeSummary(lineageGraph: LineageGraph) {
  const modifiedSet = lineageGraph.modifiedSet;
  let adds = 0;
  let removes = 0;
  let modifies = 0;
  let col_added = 0;
  let col_removed = 0;
  let col_changed = 0;

  modifiedSet.forEach((nodeId) => {
    if (lineageGraph.nodes[nodeId].data.changeStatus === "added") adds++;
    else if (lineageGraph.nodes[nodeId].data.changeStatus === "removed")
      removes++;
    else if (lineageGraph.nodes[nodeId].data.changeStatus === "modified")
      modifies++;

    const base = lineageGraph.nodes[nodeId].data.data.base;
    const current = lineageGraph.nodes[nodeId].data.data.current;
    const columnChange = calculateColumnChange(base, current);
    col_added += columnChange.adds;
    col_removed += columnChange.removes;
    col_changed += columnChange.modifies;
  });

  return { adds, removes, modifies, col_added, col_removed, col_changed };
}

export interface Props {
  lineageGraph: LineageGraph;
}

export function ChangeSummary({ lineageGraph }: Props) {
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
