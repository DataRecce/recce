"use client";

import type { SxProps, Theme } from "@mui/material/styles";
import type { TypographyProps as MuiTypographyProps } from "@mui/material/Typography";
import MuiTypography from "@mui/material/Typography";
import { forwardRef, type ReactNode, useMemo } from "react";

/**
 * Text Component - MUI equivalent of Chakra's Text
 *
 * A typography component for rendering text content.
 */

export interface TextProps extends Omit<MuiTypographyProps, "ref"> {
  children?: ReactNode;
  /** Text size - maps to MUI typography variants */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Font weight */
  fontWeight?: string | number;
  /** Text truncation */
  truncate?: boolean;
  /** Number of lines before truncation */
  lineClamp?: number;
  /** Render as a different element */
  as?: React.ElementType;
  /** Word break style */
  wordBreak?: string;
  /** Display property */
  display?: string;
  /** Gap between items */
  gap?: number | string;
  /** Font size override */
  fontSize?: string | number;
  /** Text alignment */
  textAlign?: "left" | "center" | "right" | "justify";
}

const sizeMap: Record<string, MuiTypographyProps["variant"]> = {
  xs: "caption",
  sm: "body2",
  md: "body1",
  lg: "body1",
  xl: "h6",
  "2xl": "h5",
};

export const Text = forwardRef<HTMLSpanElement, TextProps>(function Text(
  {
    children,
    size = "md",
    fontWeight,
    truncate,
    lineClamp,
    variant,
    as,
    wordBreak,
    display,
    gap,
    fontSize,
    textAlign,
    sx,
    ...props
  },
  ref,
) {
  const mappedVariant = variant || sizeMap[size] || "body1";

  const combinedSx = useMemo((): SxProps<Theme> => {
    const styles: Record<string, unknown> = {};

    if (fontWeight !== undefined) {
      styles.fontWeight = fontWeight;
    }

    if (truncate) {
      styles.overflow = "hidden";
      styles.textOverflow = "ellipsis";
      styles.whiteSpace = "nowrap";
    }

    if (lineClamp) {
      styles.display = "-webkit-box";
      styles.WebkitLineClamp = lineClamp;
      styles.WebkitBoxOrient = "vertical";
      styles.overflow = "hidden";
    }

    if (wordBreak) {
      styles.wordBreak = wordBreak;
    }

    if (display) {
      styles.display = display;
    }

    if (gap !== undefined) {
      styles.gap = gap;
    }

    if (fontSize) {
      styles.fontSize = fontSize;
    }

    if (textAlign) {
      styles.textAlign = textAlign;
    }

    if (sx && typeof sx === "object" && !Array.isArray(sx)) {
      return { ...styles, ...sx } as SxProps<Theme>;
    }

    return styles as SxProps<Theme>;
  }, [fontWeight, truncate, lineClamp, wordBreak, display, gap, fontSize, textAlign, sx]);

  return (
    <MuiTypography
      ref={ref}
      variant={mappedVariant}
      component={as}
      sx={combinedSx}
      {...props}
    >
      {children}
    </MuiTypography>
  );
});

export default Text;
