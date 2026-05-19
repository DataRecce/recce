import { Box, type BoxProps } from "@mui/material";
import type React from "react";
import type { JSX } from "react";
import type { WholeModelTreatmentTokens } from "./wholeModelTreatment";

export interface TreatmentChipProps extends Omit<BoxProps, "children"> {
  tokens: WholeModelTreatmentTokens;
  testId?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

export function TreatmentChip({
  tokens,
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
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.65rem",
        fontWeight: 700,
        lineHeight: 1,
        height: 16,
        minWidth: 16,
        px: 0.5,
        borderRadius: "3px",
        backgroundColor: tokens.badgeBg,
        border: `1px solid ${tokens.badgeBorder}`,
        color: tokens.fg,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
