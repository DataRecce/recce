"use client";

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import type { BreadcrumbsProps as MuiBreadcrumbsProps } from "@mui/material/Breadcrumbs";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { forwardRef, type ReactNode } from "react";

/**
 * Breadcrumb Component - MUI equivalent of Chakra's Breadcrumb
 *
 * A navigation breadcrumb component.
 */

export interface BreadcrumbRootProps extends Omit<MuiBreadcrumbsProps, "ref"> {
  /** Separator between items */
  separator?: ReactNode;
  /** Children */
  children?: ReactNode;
}

export interface BreadcrumbItemProps extends Omit<BoxProps, "ref"> {
  /** Whether this is the current/active item */
  isCurrentPage?: boolean;
  /** Children */
  children?: ReactNode;
}

export interface BreadcrumbLinkProps {
  /** URL to link to */
  href?: string;
  /** Whether this is the current page (renders as text instead of link) */
  isCurrentPage?: boolean;
  /** Children */
  children?: ReactNode;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
}

const BreadcrumbRoot = forwardRef<HTMLElement, BreadcrumbRootProps>(
  function BreadcrumbRoot({ separator = "/", children, ...props }, ref) {
    return (
      <MuiBreadcrumbs ref={ref} separator={separator} {...props}>
        {children}
      </MuiBreadcrumbs>
    );
  },
);

const BreadcrumbItem = forwardRef<HTMLDivElement, BreadcrumbItemProps>(
  function BreadcrumbItem({ isCurrentPage, children, sx, ...props }, ref) {
    // Wrap children in a Box to support sx prop and other styling
    return (
      <Box ref={ref} component="span" sx={sx} {...props}>
        {children}
      </Box>
    );
  },
);

const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  function BreadcrumbLink(
    { href, isCurrentPage, children, onClick, ...props },
    ref,
  ) {
    if (isCurrentPage) {
      return (
        <Typography color="text.primary" aria-current="page">
          {children}
        </Typography>
      );
    }

    return (
      <MuiLink
        ref={ref}
        href={href}
        underline="hover"
        color="inherit"
        onClick={onClick}
        {...props}
      >
        {children}
      </MuiLink>
    );
  },
);

function BreadcrumbSeparator({ children }: { children?: ReactNode }) {
  // MUI handles separator in the root component, this is for compatibility
  return <>{children}</>;
}

// Compound component export
export const Breadcrumb = {
  Root: BreadcrumbRoot,
  Item: BreadcrumbItem,
  Link: BreadcrumbLink,
  Separator: BreadcrumbSeparator,
};

// Direct exports
export { BreadcrumbRoot, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator };

export default Breadcrumb;
