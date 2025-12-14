"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import { forwardRef, type ReactNode } from "react";

/**
 * Center Component - MUI equivalent of Chakra's Center
 *
 * A Box component that centers its children both horizontally and vertically.
 */

export interface CenterProps extends Omit<MuiBoxProps, "ref"> {
  children?: ReactNode;
}

export const Center = forwardRef<HTMLDivElement, CenterProps>(function Center(
  { children, sx, ...props },
  ref,
) {
  return (
    <MuiBox
      ref={ref}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiBox>
  );
});

export default Center;
