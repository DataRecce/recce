"use client";

import type { DividerProps as MuiDividerProps } from "@mui/material/Divider";
import MuiDivider from "@mui/material/Divider";
import { forwardRef } from "react";

/**
 * Divider Component - MUI equivalent of Chakra's Divider/Separator
 *
 * A visual separator for content.
 */

export interface DividerProps extends Omit<MuiDividerProps, "ref"> {
  /** Border color */
  borderColor?: string;
}

export const Divider = forwardRef<HTMLHRElement, DividerProps>(function Divider(
  { borderColor, sx, ...props },
  ref,
) {
  return (
    <MuiDivider
      ref={ref}
      sx={{
        ...(borderColor && { borderColor }),
        ...sx,
      }}
      {...props}
    />
  );
});

// Alias for Separator (Chakra naming)
export const Separator = Divider;

export default Divider;
