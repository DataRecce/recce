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
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { children, isExternal, ...props },
  ref,
) {
  const externalProps = isExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <MuiLink ref={ref} {...externalProps} {...props}>
      {children}
    </MuiLink>
  );
});

export default Link;
