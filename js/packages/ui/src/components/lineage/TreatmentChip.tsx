import { Box, type BoxProps, type SxProps, type Theme } from "@mui/material";
import type React from "react";
import type { JSX } from "react";
import type { WholeModelTreatmentTokens } from "./wholeModelTreatment";

export type TreatmentChipVariant = "badge" | "titleChip";

export interface TreatmentChipProps extends Omit<BoxProps, "children"> {
  tokens: WholeModelTreatmentTokens;
  /**
   * - `badge` (default) — compact 16px square corner chip used on the
   *   LineageNode graph node.
   * - `titleChip` — taller pill used to wrap the model name in NodeView's
   *   header.
   */
  variant?: TreatmentChipVariant;
  testId?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<TreatmentChipVariant, SxProps<Theme>> = {
  badge: {
    fontSize: "0.65rem",
    fontWeight: 700,
    lineHeight: 1,
    height: 16,
    minWidth: 16,
    px: 0.5,
    borderRadius: "3px",
  },
  titleChip: {
    fontSize: "1rem",
    fontWeight: 600,
    lineHeight: 1.4,
    height: "auto",
    minWidth: 0,
    px: 1,
    py: 0.25,
    borderRadius: "6px",
  },
};

export function TreatmentChip({
  tokens,
  variant = "badge",
  testId,
  ariaLabel,
  children,
  sx,
  ...rest
}: TreatmentChipProps): JSX.Element {
  return (
    <Box
      data-testid={testId}
      aria-label={ariaLabel}
      sx={[
        {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.badgeBg,
          border: `1px solid ${tokens.badgeBorder}`,
          color: tokens.fg,
        },
        VARIANT_STYLES[variant],
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}
