"use client";

import { Badge, Icon } from "@chakra-ui/react";
import { IoWarning } from "react-icons/io5";
import { useIdleTimeout } from "@/lib/hooks/IdleTimeoutContext";

/**
 * Warning threshold in seconds - badge appears when remaining time is below this
 */
const WARNING_THRESHOLD_SECONDS = 60;

/**
 * Format seconds into MM:SS or HH:MM:SS format
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

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
      display="flex"
      alignItems="center"
      gap={1}
      fontSize="sm"
      colorPalette="orange"
      variant="solid"
      mr={2}
    >
      <Icon as={IoWarning} />
      Idle timeout: {formatTime(remainingSeconds)}
    </Badge>
  );
}
