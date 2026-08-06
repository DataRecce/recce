"use client";

import Box from "@mui/material/Box";
import { useIsDark } from "../../hooks/useIsDark";
import {
  getSemanticColorTheme,
  STRUCTURAL_CHANGE_PRESENTATION,
  type StructuralChangeStatus,
} from "../../theme";

export interface StructuralChangeIndicatorProps {
  status: StructuralChangeStatus;
  showLabel?: boolean;
  emphasis?: "neutral" | "secondary";
  size?: "sm" | "md";
}

export function StructuralChangeIndicator({
  status,
  showLabel = false,
  emphasis = "neutral",
  size = "md",
}: StructuralChangeIndicatorProps) {
  const isDark = useIsDark();
  const semantic = getSemanticColorTheme(isDark);
  const presentation = STRUCTURAL_CHANGE_PRESENTATION[status];
  const color =
    emphasis === "secondary"
      ? semantic.structural.secondaryAccent[status]
      : semantic.structural.neutral.foreground;

  return (
    <Box
      component="span"
      aria-label={`${presentation.label} change`}
      data-emphasis={emphasis}
      data-status={status}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color }}
    >
      {presentation.symbol && (
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            minWidth: size === "sm" ? 16 : 20,
            minHeight: size === "sm" ? 16 : 20,
            fontSize: size === "sm" ? 14 : 17,
            fontWeight: 700,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {presentation.symbol}
        </Box>
      )}
      {showLabel && <span aria-hidden="true">{presentation.label}</span>}
    </Box>
  );
}
