"use client";

import type { DialogProps as MuiDialogProps } from "@mui/material/Dialog";
import MuiDialog from "@mui/material/Dialog";
import type { DialogActionsProps as MuiDialogActionsProps } from "@mui/material/DialogActions";
import MuiDialogActions from "@mui/material/DialogActions";
import type { DialogContentProps as MuiDialogContentProps } from "@mui/material/DialogContent";
import MuiDialogContent from "@mui/material/DialogContent";
import type { DialogTitleProps as MuiDialogTitleProps } from "@mui/material/DialogTitle";
import MuiDialogTitle from "@mui/material/DialogTitle";
import { forwardRef, type ReactNode } from "react";
import { CloseButton } from "./CloseButton";
import { Flex } from "./Flex";

/**
 * Dialog Components - MUI equivalent of Chakra's Dialog compound components
 *
 * Provides a similar compound component API to Chakra's Dialog.
 */

// Dialog Root
export interface DialogRootProps extends Omit<MuiDialogProps, "ref"> {
  children?: ReactNode;
}

export const DialogRoot = forwardRef<HTMLDivElement, DialogRootProps>(
  function DialogRoot({ children, ...props }, ref) {
    return (
      <MuiDialog ref={ref} {...props}>
        {children}
      </MuiDialog>
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
}

export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(
  function DialogBody({ children, ...props }, ref) {
    return (
      <MuiDialogContent ref={ref} {...props}>
        {children}
      </MuiDialogContent>
    );
  },
);

// Dialog Footer (Actions area)
export interface DialogFooterProps extends Omit<MuiDialogActionsProps, "ref"> {
  children?: ReactNode;
}

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  function DialogFooter({ children, ...props }, ref) {
    return (
      <MuiDialogActions ref={ref} {...props}>
        {children}
      </MuiDialogActions>
    );
  },
);

// Dialog Close Trigger
export interface DialogCloseTriggerProps {
  children?: ReactNode;
  onClick?: () => void;
}

export const DialogCloseTrigger = forwardRef<
  HTMLButtonElement,
  DialogCloseTriggerProps
>(function DialogCloseTrigger({ children, onClick }, ref) {
  if (children) {
    return <>{children}</>;
  }
  return <CloseButton ref={ref} onClick={onClick} />;
});

// Combined Dialog namespace for Chakra-like usage
export const Dialog = {
  Root: DialogRoot,
  Header: DialogHeader,
  Title: DialogTitle,
  Body: DialogBody,
  Footer: DialogFooter,
  CloseTrigger: DialogCloseTrigger,
};

export default Dialog;
