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
  /** Font size */
  fontSize?: string;
  /** Padding */
  p?: string | number;
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

export const AlertBase = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { status = "info", title, variant = "subtle", fontSize, p, children, sx, ...props },
  ref,
) {
  const severity = statusToSeverity[status] || "info";
  const muiVariant = variantToMui[variant] || "standard";

  return (
    <MuiAlert
      ref={ref}
      severity={severity}
      variant={muiVariant}
      sx={{
        ...(fontSize && { fontSize }),
        ...(p !== undefined && { p }),
        ...sx,
      }}
      {...props}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {children}
    </MuiAlert>
  );
});

// Compound components for Chakra compatibility
export interface AlertRootProps extends AlertProps {}

interface AlertDescriptionProps {
  children?: ReactNode;
}

function AlertDescription({ children }: AlertDescriptionProps) {
  return <>{children}</>;
}

const AlertRoot = forwardRef<HTMLDivElement, AlertRootProps>(function AlertRoot(
  props,
  ref,
) {
  return <AlertBase ref={ref} {...props} />;
});

function AlertIndicator() {
  // MUI Alert has built-in icon, this is for API compatibility
  return null;
}

// Compound Alert export
type AlertWithCompound = typeof AlertBase & {
  Root: typeof AlertRoot;
  Indicator: typeof AlertIndicator;
  Title: typeof AlertTitle;
  Description: typeof AlertDescription;
};

export const Alert = Object.assign(AlertBase, {
  Root: AlertRoot,
  Indicator: AlertIndicator,
  Title: AlertTitle,
  Description: AlertDescription,
}) as AlertWithCompound;

export { AlertTitle };

export default Alert;
