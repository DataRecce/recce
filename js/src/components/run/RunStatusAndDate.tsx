import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import { token } from "@/components/ui/mui-theme";
import { Run } from "@/lib/api/types";

export function formatRunDate(date: Date | null) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date == null) {
    return null;
  }

  if (today.toDateString() === date.toDateString()) {
    return "Today";
  } else if (yesterday.toDateString() === date.toDateString()) {
    return "Yesterday";
  } else {
    return format(date, "MMM d");
  }
}

export function formatRunDateTime(date: Date | null) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date == null) {
    return null;
  }

  if (today.toDateString() === date.toDateString()) {
    return "Today, " + format(date, "HH:mm");
  } else if (yesterday.toDateString() === date.toDateString()) {
    return "Yesterday, " + format(date, "HH:mm");
  } else {
    return format(date, "MMM d, HH:mm");
  }
}

export const RunStatusAndDate = ({ run }: { run: Run }) => {
  const isRunning = run.status === "running";

  let status = run.status;
  if (!status) {
    if (run.result) {
      status = "finished";
    } else if (run.error) {
      status = "failed";
    }
  }

  let color: string;
  let message: string;
  if (status === "finished") {
    color = "green";
    message = "Finished";
  } else if (status === "failed") {
    color = "red";
    message = "Failed";
  } else if (status === "cancelled") {
    color = "gray";
    message = "Cancelled";
  } else if (status === "running") {
    color = "blue";
    message = "Running";
  } else {
    color = "green";
    message = "Finished";
  }
  const dateTime = run.run_at ? formatRunDateTime(new Date(run.run_at)) : null;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "start",
        fontSize: "11pt",
        color: "grey.500",
        gap: "3px",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {isRunning && <CircularProgress size={12} color="primary" />}
      <Typography
        component="span"
        sx={{ fontWeight: 500, color: token(`colors.${color}.400`) }}
      >
        {message}
      </Typography>
      <Typography component="span">•</Typography>
      <Typography
        component="span"
        sx={{
          textOverflow: "ellipsis",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {dateTime}
      </Typography>
    </Box>
  );
};
