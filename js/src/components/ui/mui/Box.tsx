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
  /** Border width */
  borderWidth?: string;
  /** Border top width */
  borderTopWidth?: number | string;
  /** Border bottom radius */
  borderBottomRadius?: number | string;
  /** Padding shorthand */
  p?: string | number;
  /** Opacity */
  opacity?: number;
  /** Border color */
  borderColor?: string;
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
    borderWidth,
    borderTopWidth,
    borderBottomRadius,
    p,
    opacity,
    borderColor,
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
    if (borderWidth) styles.borderWidth = borderWidth;
    if (borderTopWidth !== undefined) styles.borderTopWidth = borderTopWidth;
    if (borderBottomRadius !== undefined) {
      styles.borderBottomLeftRadius = borderBottomRadius;
      styles.borderBottomRightRadius = borderBottomRadius;
    }
    if (p !== undefined) styles.p = p;
    if (opacity !== undefined) styles.opacity = opacity;
    if (borderColor) styles.borderColor = borderColor;
    if (sx && typeof sx === "object" && !Array.isArray(sx)) {
      return { ...styles, ...sx } as SxProps<Theme>;
    }
    return styles as SxProps<Theme>;
  }, [bg, backgroundColor, rounded, cursor, shadow, overflowX, overflowY, blockSize, borderWidth, borderTopWidth, borderBottomRadius, p, opacity, borderColor, sx]);

  return (
    <MuiBox ref={ref} sx={combinedSx} {...props}>
      {children}
    </MuiBox>
  );
});

export default Box;
