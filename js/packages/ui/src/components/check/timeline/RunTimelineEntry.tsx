import { Box, Typography } from "@mui/material";
import { formatDistanceToNow } from "date-fns";

export interface RunEntry {
  run_id: string;
  run_at: string;
  status: string;
  summary?: string;
  triggered_by?: string; // "user" | "recce_ai"
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
  const isInteractive = Boolean(onClick);

  return (
    <Box
      component={isInteractive ? "button" : "div"}
      type={isInteractive ? "button" : undefined}
      onClick={isInteractive ? () => onClick?.(run.run_id) : undefined}
      aria-label={isInteractive ? `View run #${index} — ${label}` : undefined}
      sx={{
        p: 1,
        border: "none",
        borderLeft: `3px solid ${color}`,
        borderRadius: 1,
        bgcolor: "action.hover",
        cursor: isInteractive ? "pointer" : "default",
        "&:hover": isInteractive ? { bgcolor: "action.selected" } : {},
        textAlign: "left",
        width: "100%",
        font: "inherit",
        color: "inherit",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
        Run #{index} — {label}
        {run.triggered_by === "recce_ai" && (
          <Typography
            component="span"
            sx={{
              ml: 0.75,
              fontSize: "0.65rem",
              fontWeight: 500,
              color: "#7c3aed",
            }}
          >
            by AI
          </Typography>
        )}
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
