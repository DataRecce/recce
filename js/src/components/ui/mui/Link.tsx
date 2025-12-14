"use client";

import type { LinkProps as MuiLinkProps } from "@mui/material/Link";
import MuiLink from "@mui/material/Link";
import { forwardRef, type ReactNode } from "react";

/**
 * Link Component - MUI equivalent of Chakra's Link
 *
 * An accessible anchor element for navigation.
 */

export interface LinkProps extends Omit<MuiLinkProps, "ref" | "variant"> {
  children?: ReactNode;
  /** External link indicator */
  isExternal?: boolean;
  /** Chakra colorPalette */
  colorPalette?: "iochmara" | "blue" | "gray" | "green" | "red";
  /** Text decoration style */
  textDecoration?: string;
  /** Chakra variant */
  variant?: "underline" | "plain";
  /** Focus styles (Chakra compatibility) */
  _focus?: Record<string, unknown>;
  /** Hover styles (Chakra compatibility) */
  _hover?: Record<string, unknown>;
}

const colorPaletteToColor: Record<
  Exclude<LinkProps["colorPalette"], undefined>,
  string
> = {
  iochmara: "primary.main",
  blue: "primary.main",
  gray: "text.secondary",
  green: "success.main",
  red: "error.main",
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    children,
    isExternal,
    colorPalette,
    textDecoration,
    variant,
    _focus,
    _hover,
    sx,
    ...props
  },
  ref,
) {
  const externalProps = isExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <MuiLink
      ref={ref}
      {...externalProps}
      underline={variant === "underline" ? "always" : "hover"}
      sx={{
        ...(colorPalette && {
          color: colorPaletteToColor[colorPalette] || colorPalette,
        }),
        ...(textDecoration && { textDecoration }),
        cursor: "pointer",
        ...(_focus && { "&:focus": _focus }),
        ...(_hover && { "&:hover": _hover }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiLink>
  );
});

export default Link;
