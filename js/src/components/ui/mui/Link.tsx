"use client";

import type { LinkProps as MuiLinkProps } from "@mui/material/Link";
import MuiLink from "@mui/material/Link";
import { forwardRef, type ReactNode } from "react";

/**
 * Link Component - MUI equivalent of Chakra's Link
 *
 * An accessible anchor element for navigation.
 */

export interface LinkProps extends Omit<MuiLinkProps, "ref"> {
  children?: ReactNode;
  /** External link indicator */
  isExternal?: boolean;
  /** Chakra colorPalette */
  colorPalette?: "blue" | "gray" | "green" | "red";
  /** Text decoration style */
  textDecoration?: string;
}

const colorPaletteToColor: Record<string, string> = {
  blue: "primary.main",
  gray: "text.secondary",
  green: "success.main",
  red: "error.main",
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { children, isExternal, colorPalette, textDecoration, sx, ...props },
  ref,
) {
  const externalProps = isExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <MuiLink
      ref={ref}
      {...externalProps}
      sx={{
        ...(colorPalette && {
          color: colorPaletteToColor[colorPalette] || colorPalette,
        }),
        ...(textDecoration && { textDecoration }),
        cursor: "pointer",
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiLink>
  );
});

export default Link;
