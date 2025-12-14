"use client";

import type { TypographyProps as MuiTypographyProps } from "@mui/material/Typography";
import MuiTypography from "@mui/material/Typography";
import { forwardRef, type ReactNode } from "react";

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
    sx,
    ...props
  },
  ref,
) {
  const mappedVariant = variant || sizeMap[size] || "body1";

  return (
    <MuiTypography
      ref={ref}
      variant={mappedVariant}
      sx={{
        fontWeight,
        ...(truncate && {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }),
        ...(lineClamp && {
          display: "-webkit-box",
          WebkitLineClamp: lineClamp,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiTypography>
  );
});

export default Text;
