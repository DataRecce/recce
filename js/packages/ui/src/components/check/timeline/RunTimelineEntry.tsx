import { Box, Typography } from "@mui/material";
import { formatDistanceToNow } from "date-fns";

export interface RunEntry {
  run_id: string;
  run_at: string;
  status: string;
  summary?: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: "#059669",
  failure: "#ef4444",
  error: "#ef4444",
  warning: "#f59e0b",
};

const STATUS_LABELS: Record<string, string> = {
  success: "PASSED",
  failure: "FAILED",
  error: "ERROR",
  warning: "WARNING",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#6b7280";
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.toUpperCase();
}

interface RunTimelineEntryProps {
  run: RunEntry;
  index: number;
  onClick?: (runId: string) => void;
}

export function RunTimelineEntry({
  run,
  index,
  onClick,
}: RunTimelineEntryProps) {
  const color = getStatusColor(run.status);
  const label = getStatusLabel(run.status);
  const timeAgo = formatDistanceToNow(new Date(run.run_at), {
    addSuffix: true,
  });

  return (
    <Box
      onClick={() => onClick?.(run.run_id)}
      sx={{
        p: 1,
        borderLeft: `3px solid ${color}`,
        borderRadius: 1,
        bgcolor: "action.hover",
        cursor: onClick ? "pointer" : "default",
        "&:hover": onClick ? { bgcolor: "action.selected" } : {},
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
        Run #{index} — {label}
      </Typography>
      {run.summary && (
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", fontSize: "0.7rem", mt: 0.25 }}
        >
          {run.summary}
        </Typography>
      )}
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", fontSize: "0.65rem", mt: 0.25 }}
      >
        {timeAgo}
      </Typography>
    </Box>
  );
}
