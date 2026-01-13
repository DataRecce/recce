"use client";

import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import { IoWarning } from "react-icons/io5";
import { useIdleTimeout } from "../../contexts";
import { formatDuration } from "../../utils";

/**
 * Warning threshold in seconds - badge appears when remaining time is below this
 */
const WARNING_THRESHOLD_SECONDS = 60;

/**
 * Badge component that displays idle timeout warning countdown
 * Only shows when remaining time is below the warning threshold
 * Styled as a warning indicator to draw user attention
 */
export function IdleTimeoutBadge() {
  const { remainingSeconds, isEnabled } = useIdleTimeout();

  // Don't render if idle timeout is not configured
  if (!isEnabled || remainingSeconds === null) {
    return null;
  }

  // Only show when below warning threshold
  if (remainingSeconds > WARNING_THRESHOLD_SECONDS) {
    return null;
  }

  return (
    <Badge
      color="warning"
      variant="standard"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        fontSize: "0.75rem",
        mr: 2,
      }}
    >
      <Box component={IoWarning} sx={{ display: "inline-flex" }} />
      Idle timeout: {formatDuration(remainingSeconds, "compact")}
    </Badge>
  );
}
