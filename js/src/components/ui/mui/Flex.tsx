"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { forwardRef, type ReactNode } from "react";

/**
 * Flex Component - MUI equivalent of Chakra's Flex
 *
 * A Box component with display: flex applied by default.
 * Provides common flexbox props as shortcuts.
 */

export interface FlexProps extends Omit<MuiBoxProps, "ref"> {
  children?: ReactNode;
  /** Shorthand for alignItems */
  align?: MuiBoxProps["alignItems"];
  /** Shorthand for justifyContent */
  justify?: MuiBoxProps["justifyContent"];
  /** Shorthand for flexWrap */
  wrap?: MuiBoxProps["flexWrap"];
  /** Shorthand for flexDirection */
  direction?: MuiBoxProps["flexDirection"];
  /** Gap between flex items */
  gap?: number | string;
}

export const Flex = forwardRef<HTMLDivElement, FlexProps>(function Flex(
  { children, align, justify, wrap, direction, gap, sx, ...props },
  ref,
) {
  return (
    <MuiBox
      ref={ref}
      sx={{
        display: "flex",
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap,
        flexDirection: direction,
        gap,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiBox>
  );
});

export default Flex;
