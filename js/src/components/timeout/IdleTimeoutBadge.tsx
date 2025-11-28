"use client";

import { Badge, Icon } from "@chakra-ui/react";
import { IoWarning } from "react-icons/io5";
import { useIdleTimeout } from "@/lib/hooks/IdleTimeoutContext";
import { formatDuration } from "@/lib/utils/formatTime";

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
      display="flex"
      alignItems="center"
      gap={1}
      fontSize="sm"
      colorPalette="orange"
      variant="solid"
      mr={2}
    >
      <Icon as={IoWarning} />
      Idle timeout: {formatDuration(remainingSeconds, "compact")}
    </Badge>
  );
}
