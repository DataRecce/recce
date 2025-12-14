"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { forwardRef, type ReactNode } from "react";

/**
 * Box Component - MUI equivalent of Chakra's Box
 *
 * A fundamental building block component that renders a div by default.
 * Supports all MUI Box props plus common Chakra-style shorthand props.
 */

export interface BoxProps extends Omit<MuiBoxProps, "ref"> {
  children?: ReactNode;
  /** Chakra compatibility: className for group hover patterns */
  className?: string;
  /** Background color shorthand */
  bg?: string;
  /** Border radius shorthand */
  rounded?: string;
  /** Cursor style */
  cursor?: string;
  /** Box shadow shorthand */
  shadow?: string;
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box(
  { children, bg, rounded, cursor, shadow, sx, ...props },
  ref,
) {
  return (
    <MuiBox
      ref={ref}
      sx={{
        ...(bg && { backgroundColor: bg }),
        ...(rounded && {
          borderRadius: rounded === "full" ? "9999px" : rounded,
        }),
        ...(cursor && { cursor }),
        ...(shadow && { boxShadow: shadow }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiBox>
  );
});

export default Box;
