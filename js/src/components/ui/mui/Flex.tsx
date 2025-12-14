"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { forwardRef, type ReactNode, useMemo } from "react";

import { token } from "@/components/ui/mui-theme";

/**
 * Resolves Chakra-style color tokens to actual color values.
 */
function resolveColor(colorValue: string | undefined): string | undefined {
  if (!colorValue) return undefined;
  const resolved = token(`colors.${colorValue}`);
  if (resolved) return resolved;
  return colorValue;
}

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
  minH?: string | number;
  /** Border */
  border?: string;
  /** Border radius (alias for rounded) */
  borderRadius?: string;
  /** Border color */
  borderColor?: string;
  /** Background color */
  bg?: string;
  /** Background color (alias) */
  backgroundColor?: string;
  /** Width (shorthand) */
  w?: string | number;
  /** Height (shorthand) */
  h?: string | number;
  /** Padding (shorthand) */
  p?: string | number;
  /** Cursor style */
  cursor?: string;
  /** Hover styles */
  _hover?: Record<string, unknown>;
  /** Text style preset */
  textStyle?: string;
  /** Border block end width */
  borderBlockEndWidth?: string;
  /** Border left width */
  borderLeftWidth?: string;
  /** Border left color */
  borderLeftColor?: string;
  /** CSS filter */
  filter?: string;
  /** Transition */
  transition?: string;
  /** Border width */
  borderWidth?: string;
  /** Border top radius */
  borderTopRadius?: number | string;
  /** Border bottom radius */
  borderBottomRadius?: number | string;
  /** Border right width */
  borderRightWidth?: string;
  /** Visibility */
  visibility?: "visible" | "hidden" | "inherit";
  /** Padding string */
  padding?: string | number;
  /** Align self */
  alignSelf?: string;
  /** Text align */
  textAlign?: "left" | "center" | "right" | "justify" | "start" | "end";
  /** Font weight */
  fontWeight?: string | number;
  /** Flex property */
  flex?: string | number;
  /** Margin X */
  mx?: string | number;
  /** Padding bottom */
  paddingBottom?: string | number;
  /** Overflow Y */
  overflowY?: string;
  /** Overflow */
  overflow?: string;
  /** Box shadow */
  boxShadow?: string;
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
    backgroundColor,
    w,
    h,
    p,
    cursor,
    _hover,
    textStyle,
    borderBlockEndWidth,
    borderLeftWidth,
    borderLeftColor,
    filter,
    transition,
    borderWidth,
    borderTopRadius,
    borderBottomRadius,
    borderRightWidth,
    visibility,
    padding,
    alignSelf,
    textAlign,
    fontWeight,
    flex,
    mx,
    paddingBottom,
    overflowY,
    overflow,
    boxShadow,
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
    if (minH !== undefined) styles.minHeight = minH;
    if (border) styles.border = border;
    if (borderRadius) styles.borderRadius = borderRadius;
    if (borderColor) styles.borderColor = resolveColor(borderColor);
    if (bg) styles.backgroundColor = resolveColor(bg);
    if (backgroundColor) styles.backgroundColor = resolveColor(backgroundColor);
    if (w !== undefined) styles.width = w;
    if (h !== undefined) styles.height = h;
    if (p !== undefined) styles.padding = p;
    if (cursor) styles.cursor = cursor;
    if (_hover) styles["&:hover"] = _hover;
    if (borderBlockEndWidth) styles.borderBlockEndWidth = borderBlockEndWidth;
    if (borderLeftWidth) styles.borderLeftWidth = borderLeftWidth;
    if (borderLeftColor) styles.borderLeftColor = resolveColor(borderLeftColor);
    if (filter) styles.filter = filter;
    if (transition) styles.transition = transition;
    if (borderWidth) styles.borderWidth = borderWidth;
    if (borderTopRadius !== undefined) {
      styles.borderTopLeftRadius = borderTopRadius;
      styles.borderTopRightRadius = borderTopRadius;
    }
    if (borderBottomRadius !== undefined) {
      styles.borderBottomLeftRadius = borderBottomRadius;
      styles.borderBottomRightRadius = borderBottomRadius;
    }
    if (borderRightWidth) styles.borderRightWidth = borderRightWidth;
    if (visibility) styles.visibility = visibility;
    if (padding !== undefined) styles.padding = padding;
    if (alignSelf) styles.alignSelf = alignSelf;
    if (textAlign) styles.textAlign = textAlign;
    if (fontWeight !== undefined) styles.fontWeight = fontWeight;
    if (flex !== undefined) styles.flex = flex;
    if (mx !== undefined) styles.mx = mx;
    if (paddingBottom !== undefined) styles.paddingBottom = paddingBottom;
    if (overflowY) styles.overflowY = overflowY;
    if (overflow) styles.overflow = overflow;
    if (boxShadow) styles.boxShadow = boxShadow;

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
    backgroundColor,
    w,
    h,
    p,
    cursor,
    _hover,
    borderBlockEndWidth,
    borderLeftWidth,
    borderLeftColor,
    filter,
    transition,
    borderWidth,
    borderTopRadius,
    borderBottomRadius,
    borderRightWidth,
    visibility,
    padding,
    alignSelf,
    textAlign,
    fontWeight,
    flex,
    mx,
    paddingBottom,
    overflowY,
    overflow,
    boxShadow,
    sx,
  ]);

  return (
    <MuiBox ref={ref} sx={combinedSx} {...props}>
      {children}
    </MuiBox>
  );
});

export default Flex;
