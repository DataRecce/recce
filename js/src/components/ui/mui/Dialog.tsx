"use client";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { DialogProps as MuiDialogProps } from "@mui/material/Dialog";
import MuiDialog from "@mui/material/Dialog";
import type { DialogActionsProps as MuiDialogActionsProps } from "@mui/material/DialogActions";
import MuiDialogActions from "@mui/material/DialogActions";
import type { DialogContentProps as MuiDialogContentProps } from "@mui/material/DialogContent";
import MuiDialogContent from "@mui/material/DialogContent";
import type { DialogTitleProps as MuiDialogTitleProps } from "@mui/material/DialogTitle";
import MuiDialogTitle from "@mui/material/DialogTitle";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { CloseButton } from "./CloseButton";

/**
 * Dialog Components - MUI equivalent of Chakra's Dialog compound components
 *
 * Provides a similar compound component API to Chakra's Dialog.
 */

// Dialog Root
export interface DialogRootProps
  extends Omit<MuiDialogProps, "ref" | "onClose"> {
  children?: ReactNode;
  /** Called when dialog should close (Chakra compatibility) */
  onOpenChange?: (open: boolean) => void;
  /** Chakra-style onClose */
  onClose?: () => void;
  /** Chakra size prop */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
  /** Chakra placement prop */
  placement?: "center" | "top" | "bottom";
  /** Initial focus element function */
  initialFocusEl?: () => HTMLElement | null;
}

const sizeToMaxWidth: Record<string, MuiDialogProps["maxWidth"]> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
  full: false,
};

export const DialogRoot = forwardRef<HTMLDivElement, DialogRootProps>(
  function DialogRoot(
    {
      children,
      onOpenChange,
      onClose,
      size = "md",
      placement,
      initialFocusEl,
      ...props
    },
    ref,
  ) {
    const handleClose = () => {
      onOpenChange?.(false);
      onClose?.();
    };

    return (
      <MuiDialog
        ref={ref}
        onClose={handleClose}
        maxWidth={sizeToMaxWidth[size] ?? "md"}
        fullWidth
        fullScreen={size === "full"}
        {...props}
      >
        {children}
      </MuiDialog>
    );
  },
);

// Dialog Backdrop (no-op for MUI, handled internally)
export const DialogBackdrop = forwardRef<
  HTMLDivElement,
  { bg?: string; backdropFilter?: string }
>(function DialogBackdrop({ bg, backdropFilter }, ref) {
  // MUI handles backdrop internally, this is for API compatibility
  return null;
});

// Dialog Positioner (wrapper for API compatibility)
export const DialogPositioner = forwardRef<
  HTMLDivElement,
  { children?: ReactNode }
>(function DialogPositioner({ children }, ref) {
  // MUI handles positioning internally
  return <>{children}</>;
});

// Dialog Content (the actual content wrapper)
export interface DialogContentProps {
  children?: ReactNode;
  overflowY?: string;
  height?: string;
  width?: string;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  function DialogContent({ children, overflowY, height, width }, ref) {
    return (
      <Box
        ref={ref}
        sx={{
          display: "flex",
          flexDirection: "column",
          ...(overflowY && { overflowY }),
          ...(height && { height }),
          ...(width && { width }),
        }}
      >
        {children}
      </Box>
    );
  },
);

// Dialog Header (Title area)
export interface DialogHeaderProps extends Omit<MuiDialogTitleProps, "ref"> {
  children?: ReactNode;
}

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  function DialogHeader({ children, sx, ...props }, ref) {
    return (
      <MuiDialogTitle
        ref={ref}
        sx={{ display: "flex", alignItems: "center", ...sx }}
        {...props}
      >
        {children}
      </MuiDialogTitle>
    );
  },
);

// Dialog Title
export interface DialogTitleProps {
  children?: ReactNode;
}

export const DialogTitle = forwardRef<HTMLSpanElement, DialogTitleProps>(
  function DialogTitle({ children }, ref) {
    return (
      <span ref={ref} style={{ flex: 1 }}>
        {children}
      </span>
    );
  },
);

// Dialog Body (Content area)
export interface DialogBodyProps extends Omit<MuiDialogContentProps, "ref"> {
  children?: ReactNode;
  /** Border styling */
  borderTop?: string;
  borderBottom?: string;
}

export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(
  function DialogBody(
    { children, borderTop, borderBottom, sx, ...props },
    ref,
  ) {
    return (
      <MuiDialogContent
        ref={ref}
        sx={{
          ...(borderTop && { borderTop }),
          ...(borderBottom && { borderBottom }),
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiDialogContent>
    );
  },
);

// Dialog Footer (Actions area)
export interface DialogFooterProps extends Omit<MuiDialogActionsProps, "ref"> {
  children?: ReactNode;
  /** Gap between items */
  gap?: string | number;
}

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  function DialogFooter({ children, gap, sx, ...props }, ref) {
    return (
      <MuiDialogActions
        ref={ref}
        sx={{
          ...(gap && { gap }),
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiDialogActions>
    );
  },
);

// Dialog Close Trigger
export interface DialogCloseTriggerProps {
  children?: ReactNode;
  onClick?: () => void;
  /** Render as child element (Chakra compatibility) */
  asChild?: boolean;
}

export const DialogCloseTrigger = forwardRef<
  HTMLButtonElement,
  DialogCloseTriggerProps
>(function DialogCloseTrigger({ children, onClick, asChild }, ref) {
  if (asChild && children && isValidElement(children)) {
    // Clone the child and pass onClick
    return cloneElement(children as ReactElement<{ onClick?: () => void }>, {
      onClick,
    });
  }
  if (children) {
    return <>{children}</>;
  }
  return <CloseButton ref={ref} onClick={onClick} />;
});

// Combined Dialog namespace for Chakra-like usage
export const Dialog = {
  Root: DialogRoot,
  Backdrop: DialogBackdrop,
  Positioner: DialogPositioner,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Body: DialogBody,
  Footer: DialogFooter,
  CloseTrigger: DialogCloseTrigger,
};

export default Dialog;
