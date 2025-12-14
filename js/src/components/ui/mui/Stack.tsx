"use client";

import MuiDivider from "@mui/material/Divider";
import type { StackProps as MuiStackProps } from "@mui/material/Stack";
import MuiStack from "@mui/material/Stack";
import type { SxProps, Theme } from "@mui/material/styles";
import { forwardRef, type ReactNode, useMemo } from "react";

/**
 * Stack Component - MUI equivalent of Chakra's Stack/VStack/HStack
 *
 * A component that lays out children with consistent spacing.
 */

export interface StackProps extends Omit<MuiStackProps, "ref" | "divider"> {
  children?: ReactNode;
  /** Shorthand for alignItems */
  align?: MuiStackProps["alignItems"];
  /** Shorthand for justifyContent */
  justify?: MuiStackProps["justifyContent"];
  /** Chakra separator prop - adds divider between children */
  separator?: ReactNode;
  /** Padding shorthand */
  p?: string | number;
  /** Padding top */
  pt?: string | number;
  /** Padding bottom */
  pb?: string | number;
  /** Padding left */
  pl?: string | number;
  /** Padding right */
  pr?: string | number;
  /** Padding X (horizontal) */
  px?: string | number;
  /** Padding Y (vertical) */
  py?: string | number;
  /** Margin top */
  mt?: string | number;
  /** Margin bottom */
  mb?: string | number;
  /** Background color */
  bg?: string;
  /** Border radius */
  rounded?: string;
  /** Box shadow */
  shadow?: string;
  /** Width (shorthand) */
  w?: string | number;
  /** Height (shorthand) */
  h?: string | number;
  /** Opacity */
  opacity?: number;
  /** Group hover styles */
  _groupHover?: Record<string, unknown>;
  /** Transition */
  transition?: string;
  /** Position */
  position?: "relative" | "absolute" | "fixed" | "sticky" | "static";
  /** Top */
  top?: string | number;
  /** Right */
  right?: string | number;
  /** Border left */
  borderLeft?: string;
  /** Border color */
  borderColor?: string;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  {
    children,
    align,
    justify,
    separator,
    p,
    pt,
    pb,
    pl,
    pr,
    px,
    py,
    mt,
    mb,
    bg,
    rounded,
    shadow,
    w,
    h,
    opacity,
    _groupHover,
    transition,
    position,
    top,
    right,
    borderLeft,
    borderColor,
    sx,
    ...props
  },
  ref,
) {
  const combinedSx = useMemo((): SxProps<Theme> => {
    const styles: Record<string, unknown> = {};
    if (align !== undefined) styles.alignItems = align;
    if (justify !== undefined) styles.justifyContent = justify;
    if (p !== undefined) styles.p = p;
    if (pt !== undefined) styles.pt = pt;
    if (pb !== undefined) styles.pb = pb;
    if (pl !== undefined) styles.pl = pl;
    if (pr !== undefined) styles.pr = pr;
    if (px !== undefined) styles.px = px;
    if (py !== undefined) styles.py = py;
    if (mt !== undefined) styles.mt = mt;
    if (mb !== undefined) styles.mb = mb;
    if (bg !== undefined) styles.backgroundColor = bg;
    if (rounded !== undefined)
      styles.borderRadius = rounded === "md" ? "4px" : rounded;
    if (shadow !== undefined) styles.boxShadow = shadow;
    if (w !== undefined) styles.width = w;
    if (h !== undefined) styles.height = h;
    if (opacity !== undefined) styles.opacity = opacity;
    if (_groupHover) styles[".group:hover &"] = _groupHover;
    if (transition) styles.transition = transition;
    if (position) styles.position = position;
    if (top !== undefined) styles.top = top;
    if (right !== undefined) styles.right = right;
    if (borderLeft) styles.borderLeft = borderLeft;
    if (borderColor) styles.borderColor = borderColor;
    if (sx && typeof sx === "object" && !Array.isArray(sx)) {
      return { ...styles, ...sx } as SxProps<Theme>;
    }
    return styles as SxProps<Theme>;
  }, [
    align,
    justify,
    p,
    pt,
    pb,
    pl,
    pr,
    px,
    py,
    mt,
    mb,
    bg,
    rounded,
    shadow,
    w,
    h,
    opacity,
    _groupHover,
    transition,
    position,
    top,
    right,
    borderLeft,
    borderColor,
    sx,
  ]);

  return (
    <MuiStack ref={ref} divider={separator} sx={combinedSx} {...props}>
      {children}
    </MuiStack>
  );
});

/**
 * VStack - Vertical Stack (column direction)
 * Equivalent to Chakra's VStack
 */
export const VStack = forwardRef<HTMLDivElement, StackProps>(function VStack(
  { children, align = "stretch", ...props },
  ref,
) {
  return (
    <Stack ref={ref} direction="column" align={align} {...props}>
      {children}
    </Stack>
  );
});

/**
 * HStack - Horizontal Stack (row direction)
 * Equivalent to Chakra's HStack
 */
export const HStack = forwardRef<HTMLDivElement, StackProps>(function HStack(
  { children, align = "center", ...props },
  ref,
) {
  return (
    <Stack ref={ref} direction="row" align={align} {...props}>
      {children}
    </Stack>
  );
});

/**
 * StackSeparator - Divider component for use with Stack separator prop
 * Equivalent to Chakra's StackSeparator
 */
export interface StackSeparatorProps {
  borderColor?: string;
  orientation?: "horizontal" | "vertical";
}

export const StackSeparator = forwardRef<HTMLHRElement, StackSeparatorProps>(
  function StackSeparator({ borderColor, orientation = "vertical" }, ref) {
    return (
      <MuiDivider
        ref={ref}
        orientation={orientation}
        flexItem
        sx={{
          ...(borderColor && { borderColor }),
        }}
      />
    );
  },
);

export default Stack;
