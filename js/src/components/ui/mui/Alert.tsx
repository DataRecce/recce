"use client";

import type { AlertProps as MuiAlertProps } from "@mui/material/Alert";
import MuiAlert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import { forwardRef, type ReactNode } from "react";

/**
 * Alert Component - MUI equivalent of Chakra's Alert
 *
 * Displays feedback messages to users.
 */

export interface AlertProps
  extends Omit<MuiAlertProps, "ref" | "severity" | "variant" | "title"> {
  /** Status/severity of the alert */
  status?: "info" | "warning" | "success" | "error";
  /** Title of the alert */
  title?: ReactNode;
  /** Content of the alert */
  children?: ReactNode;
  /** Chakra variant - maps to MUI variant */
  variant?: "subtle" | "solid" | "outline" | "surface";
}

const statusToSeverity: Record<string, MuiAlertProps["severity"]> = {
  info: "info",
  warning: "warning",
  success: "success",
  error: "error",
};

const variantToMui: Record<string, MuiAlertProps["variant"]> = {
  subtle: "standard",
  solid: "filled",
  outline: "outlined",
  surface: "standard",
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { status = "info", title, variant = "subtle", children, ...props },
  ref,
) {
  const severity = statusToSeverity[status] || "info";
  const muiVariant = variantToMui[variant] || "standard";

  return (
    <MuiAlert ref={ref} severity={severity} variant={muiVariant} {...props}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {children}
    </MuiAlert>
  );
});

// Sub-components for compound pattern compatibility
export { AlertTitle };

export default Alert;
