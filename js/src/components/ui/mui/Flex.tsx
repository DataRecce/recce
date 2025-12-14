"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { forwardRef, type ReactNode, useMemo } from "react";

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
  /** Overflow X */
  overflowX?: string;
  /** Border radius */
  rounded?: string;
  /** Minimum height */
  minH?: string;
  /** Border */
  border?: string;
  /** Border radius (alias for rounded) */
  borderRadius?: string;
  /** Border color */
  borderColor?: string;
  /** Background color */
  bg?: string;
}

export const Flex = forwardRef<HTMLDivElement, FlexProps>(function Flex(
  {
    children,
    align,
    justify,
    wrap,
    direction,
    gap,
    overflowX,
    rounded,
    minH,
    border,
    borderRadius,
    borderColor,
    bg,
    sx,
    ...props
  },
  ref,
) {
  const combinedSx = useMemo((): SxProps<Theme> => {
    const styles: Record<string, unknown> = {
      display: "flex",
    };

    if (align !== undefined) styles.alignItems = align;
    if (justify !== undefined) styles.justifyContent = justify;
    if (wrap !== undefined) styles.flexWrap = wrap;
    if (direction !== undefined) styles.flexDirection = direction;
    if (gap !== undefined) styles.gap = gap;
    if (overflowX) styles.overflowX = overflowX;
    if (rounded) styles.borderRadius = rounded === "full" ? "9999px" : rounded;
    if (minH) styles.minHeight = minH;
    if (border) styles.border = border;
    if (borderRadius) styles.borderRadius = borderRadius;
    if (borderColor) styles.borderColor = borderColor;
    if (bg) styles.backgroundColor = bg;

    if (sx && typeof sx === "object" && !Array.isArray(sx)) {
      return { ...styles, ...sx } as SxProps<Theme>;
    }

    return styles as SxProps<Theme>;
  }, [
    align,
    justify,
    wrap,
    direction,
    gap,
    overflowX,
    rounded,
    minH,
    border,
    borderRadius,
    borderColor,
    bg,
    sx,
  ]);

  return (
    <MuiBox ref={ref} sx={combinedSx} {...props}>
      {children}
    </MuiBox>
  );
});

export default Flex;
