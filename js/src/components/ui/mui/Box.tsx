"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { forwardRef, type ReactNode, useMemo } from "react";

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
  /** Overflow X */
  overflowX?: string;
  /** Overflow Y */
  overflowY?: string;
  /** Block size */
  blockSize?: string;
  /** Background color (alias for bg) */
  backgroundColor?: string;
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box(
  {
    children,
    bg,
    rounded,
    cursor,
    shadow,
    overflowX,
    overflowY,
    blockSize,
    backgroundColor,
    sx,
    ...props
  },
  ref,
) {
  const combinedSx = useMemo((): SxProps<Theme> => {
    const styles: Record<string, unknown> = {};
    if (bg) styles.backgroundColor = bg;
    if (backgroundColor) styles.backgroundColor = backgroundColor;
    if (rounded) styles.borderRadius = rounded === "full" ? "9999px" : rounded;
    if (cursor) styles.cursor = cursor;
    if (shadow) styles.boxShadow = shadow;
    if (overflowX) styles.overflowX = overflowX;
    if (overflowY) styles.overflowY = overflowY;
    if (blockSize) styles.blockSize = blockSize;
    if (sx && typeof sx === "object" && !Array.isArray(sx)) {
      return { ...styles, ...sx } as SxProps<Theme>;
    }
    return styles as SxProps<Theme>;
  }, [bg, backgroundColor, rounded, cursor, shadow, overflowX, overflowY, blockSize, sx]);

  return (
    <MuiBox ref={ref} sx={combinedSx} {...props}>
      {children}
    </MuiBox>
  );
});

export default Box;
