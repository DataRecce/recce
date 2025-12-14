"use client";

import type { PortalProps as MuiPortalProps } from "@mui/material/Portal";
import MuiPortal from "@mui/material/Portal";
import type { ReactNode } from "react";

/**
 * Portal Component - MUI equivalent of Chakra's Portal
 *
 * Renders children into a DOM node that exists outside the parent hierarchy.
 */

export interface PortalProps extends Omit<MuiPortalProps, "ref"> {
  /** Content to render in the portal */
  children: ReactNode;
}

export function Portal({ children, ...props }: PortalProps) {
  return <MuiPortal {...props}>{children}</MuiPortal>;
}

export default Portal;
