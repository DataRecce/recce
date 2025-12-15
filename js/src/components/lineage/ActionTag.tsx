import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { PiInfo, PiWarning } from "react-icons/pi";
import { LineageGraphNode } from "@/components/lineage/lineage";
import { Tooltip } from "@/components/ui/tooltip";
import {
  isRowCountDiffRun,
  isRowCountRun,
  isValueDiffRun,
} from "@/lib/api/types";
import { ActionState } from "./LineageViewContext";
import { RowCountDiffTag, RowCountTag } from "./NodeTag";

interface ActionTagProps {
  node: LineageGraphNode;
  action: ActionState["actions"][string];
}

export const ActionTag = ({ node, action }: ActionTagProps) => {
  const { status, skipReason, run } = action;

  if (status === "pending") {
    return <CircularProgress size={16} />;
  }

  if (status === "skipped") {
    return (
      <Chip
        size="small"
        label={
          <Stack
            direction="row"
            sx={{
              fontSize: "10pt",
              color: "grey.500",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <Box>Skipped</Box>
            {skipReason && (
              <Tooltip content={skipReason}>
                <Box component="span" sx={{ display: "flex" }}>
                  <PiInfo />
                </Box>
              </Tooltip>
            )}
          </Stack>
        }
        sx={{ bgcolor: "grey.100" }}
      />
    );
  }

  if (!run) {
    return <CircularProgress size={16} />;
  }

  const { error, run_id, progress } = run;

  if (status === "running") {
    if (progress?.percentage === undefined) {
      return <CircularProgress size={16} />;
    } else {
      return (
        <CircularProgress
          variant="determinate"
          value={progress.percentage * 100}
          size={16}
        />
      );
    }
  }

  if (error) {
    return (
      <Stack
        direction="row"
        sx={{ fontSize: "10pt", color: "gray", alignItems: "center" }}
      >
        <Box>Error</Box>
        {skipReason && (
          <Tooltip content={error}>
            <Box component="span" sx={{ display: "flex" }}>
              <PiWarning />
            </Box>
          </Tooltip>
        )}
      </Stack>
    );
  }

  if (isValueDiffRun(run) && run.result) {
    const r = run.result;
    let mismatched = 0;

    for (const c of r.data.data) {
      if ((c[2] as number) < 1) {
        mismatched++;
      }
    }

    return (
      <Chip
        size="small"
        sx={{
          bgcolor: mismatched > 0 ? "error.light" : "success.light",
        }}
        label={
          <Stack
            direction="row"
            sx={{
              fontSize: "10pt",
              color: mismatched > 0 ? "error.main" : "success.main",
              alignItems: "center",
              gap: "3px",
            }}
          >
            {mismatched > 0
              ? `${mismatched} columns mismatched`
              : "All columns match"}
          </Stack>
        }
      />
    );
  }

  if (isRowCountDiffRun(run) && run.result) {
    const result = run.result;
    return <RowCountDiffTag rowCount={result[node.data.name]} node={node} />;
  }

  if (isRowCountRun(run) && run.result) {
    const result = run.result;
    return <RowCountTag rowCount={result[node.data.name]} node={node} />;
  }

  return <>{run_id}</>;
};
