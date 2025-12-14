"use client";

import type { TypographyProps as MuiTypographyProps } from "@mui/material/Typography";
import MuiTypography from "@mui/material/Typography";
import { forwardRef, type ReactNode } from "react";

/**
 * Heading Component - MUI equivalent of Chakra's Heading
 *
 * A typography component for rendering headings (h1-h6).
 */

export interface HeadingProps extends Omit<MuiTypographyProps, "ref"> {
  children?: ReactNode;
  /** Heading size - maps to h1-h6 */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  /** HTML heading level - overrides size if provided */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const sizeToVariant: Record<string, MuiTypographyProps["variant"]> = {
  xs: "h6",
  sm: "h5",
  md: "h4",
  lg: "h3",
  xl: "h2",
  "2xl": "h1",
  "3xl": "h1",
  "4xl": "h1",
};

const asToVariant: Record<string, MuiTypographyProps["variant"]> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
};

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  function Heading({ children, size = "xl", as, variant, sx, ...props }, ref) {
    // Priority: variant prop > as prop > size prop
    const mappedVariant =
      variant || (as && asToVariant[as]) || sizeToVariant[size] || "h2";

    return (
      <MuiTypography
        ref={ref}
        variant={mappedVariant}
        component={as}
        sx={sx}
        {...props}
      >
        {children}
      </MuiTypography>
    );
  },
);

export default Heading;
