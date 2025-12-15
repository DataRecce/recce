"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { forwardRef, type ReactNode, useMemo } from "react";

import { token } from "@/components/ui/mui-theme";

/**
 * Resolves Chakra-style color tokens to actual color values.
 * e.g., "green.solid" -> "#16A34A", "gray.500" -> "#737373"
 */
function resolveColor(colorValue: string | undefined): string | undefined {
  if (!colorValue) return undefined;
  // Try to resolve as a theme token first
  const resolved = token(`colors.${colorValue}`);
  if (resolved) return resolved;
  // Return as-is if not a token (could be a hex color, CSS color name, etc.)
  return colorValue;
}

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
  /** Render as different element */
  as?: React.ElementType;
  /** Background color shorthand */
  bg?: string;
  /** Border radius shorthand */
  rounded?: number | "full" | "sm" | "md" | "lg" | "xl" | "2xl";
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
  /** Border bottom width */
  borderBottomWidth?: string;
  /** Border bottom radius */
  borderBottomRadius?: number | string;
  /** Border left width */
  borderLeftWidth?: string;
  /** Border left color */
  borderLeftColor?: string;
  /** Padding shorthand */
  p?: string | number;
  /** Padding left */
  pl?: string | number;
  /** Padding x */
  px?: string | number;
  /** Padding y */
  py?: string | number;
  /** Margin y */
  my?: string | number;
  /** Margin bottom */
  mb?: number | string;
  /** Opacity */
  opacity?: number;
  /** Border color */
  borderColor?: string;
  /** Width shorthand */
  w?: string | number;
  /** Height shorthand */
  h?: string | number;
  /** Font style */
  fontStyle?: string;
  /** Font weight */
  fontWeight?: string | number;
  /** List style type */
  listStyleType?: string;
  /** Text align */
  textAlign?: "left" | "center" | "right" | "justify";
  /** Box size (sets both width and height) */
  boxSize?: string | number;
  /** Color */
  color?: string;
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box(
  {
    children,
    as,
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
    borderBottomWidth,
    borderBottomRadius,
    borderLeftWidth,
    borderLeftColor,
    p,
    pl,
    px,
    py,
    my,
    mb,
    opacity,
    borderColor,
    w,
    h,
    fontStyle,
    fontWeight,
    listStyleType,
    textAlign,
    boxSize,
    color,
    sx,
    ...props
  },
  ref,
) {
  const combinedSx = useMemo((): SxProps<Theme> => {
    const styles: Record<string, unknown> = {};
    if (bg) styles.backgroundColor = resolveColor(bg);
    if (backgroundColor) styles.backgroundColor = resolveColor(backgroundColor);
    if (rounded) {
      const roundedMap: Record<string, number> = {
        full: 9999,
        sm: 2,
        md: 4,
        lg: 8,
        xl: 12,
        "2xl": 16,
      };
      styles.borderRadius =
        typeof rounded === "number" ? rounded : (roundedMap[rounded] ?? 4);
    }
    if (cursor) styles.cursor = cursor;
    if (shadow) styles.boxShadow = shadow;
    if (overflowX) styles.overflowX = overflowX;
    if (overflowY) styles.overflowY = overflowY;
    if (blockSize) styles.blockSize = blockSize;
    if (borderWidth) styles.borderWidth = borderWidth;
    if (borderTopWidth !== undefined) styles.borderTopWidth = borderTopWidth;
    if (borderBottomWidth) styles.borderBottomWidth = borderBottomWidth;
    if (borderBottomRadius !== undefined) {
      styles.borderBottomLeftRadius = borderBottomRadius;
      styles.borderBottomRightRadius = borderBottomRadius;
    }
    if (borderLeftWidth) styles.borderLeftWidth = borderLeftWidth;
    if (borderLeftColor) styles.borderLeftColor = resolveColor(borderLeftColor);
    if (p !== undefined) styles.p = p;
    if (pl !== undefined) styles.pl = pl;
    if (px !== undefined) styles.px = px;
    if (py !== undefined) styles.py = py;
    if (my !== undefined) styles.my = my;
    if (mb !== undefined) styles.mb = mb;
    if (opacity !== undefined) styles.opacity = opacity;
    if (borderColor) styles.borderColor = resolveColor(borderColor);
    if (w !== undefined) styles.width = w;
    if (h !== undefined) styles.height = h;
    if (fontStyle) styles.fontStyle = fontStyle;
    if (fontWeight !== undefined) styles.fontWeight = fontWeight;
    if (listStyleType) styles.listStyleType = listStyleType;
    if (textAlign) styles.textAlign = textAlign;
    if (boxSize !== undefined) {
      styles.width = boxSize;
      styles.height = boxSize;
    }
    if (color) styles.color = resolveColor(color);
    if (sx && typeof sx === "object" && !Array.isArray(sx)) {
      return { ...styles, ...sx } as SxProps<Theme>;
    }
    return styles as SxProps<Theme>;
  }, [
    bg,
    backgroundColor,
    rounded,
    cursor,
    shadow,
    overflowX,
    overflowY,
    blockSize,
    borderWidth,
    borderTopWidth,
    borderBottomWidth,
    borderBottomRadius,
    borderLeftWidth,
    borderLeftColor,
    p,
    pl,
    px,
    py,
    my,
    mb,
    opacity,
    borderColor,
    w,
    h,
    fontStyle,
    fontWeight,
    listStyleType,
    textAlign,
    boxSize,
    color,
    sx,
  ]);

  return (
    <MuiBox ref={ref} component={as} sx={combinedSx} {...props}>
      {children}
    </MuiBox>
  );
});

export default Box;
