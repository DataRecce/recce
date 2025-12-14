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
import type { SxProps, Theme } from "@mui/material/styles";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useMemo,
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
  onOpenChange?: (details: { open: boolean }) => void;
  /** Chakra-style onClose */
  onClose?: () => void;
  /** Chakra size prop */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "full" | "cover";
  /** Chakra placement prop */
  placement?: "center" | "top" | "bottom";
  /** Initial focus element function */
  initialFocusEl?: () => HTMLElement | null;
  /** Lazy mount - only render content when open */
  lazyMount?: boolean;
  /** Scroll behavior - where scrollbar appears */
  scrollBehavior?: "inside" | "outside";
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
      lazyMount: _lazyMount,
      scrollBehavior: _scrollBehavior,
      ...props
    },
    ref,
  ) {
    const handleClose = () => {
      onOpenChange?.({ open: false });
      onClose?.();
    };

    return (
      <MuiDialog
        ref={ref}
        onClose={handleClose}
        maxWidth={sizeToMaxWidth[size] ?? "md"}
        fullWidth
        fullScreen={size === "full" || size === "cover"}
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
  /** Border radius */
  borderRadius?: string;
  /** Minimum height */
  minHeight?: string;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  function DialogContent({ children, overflowY, height, width, borderRadius, minHeight }, ref) {
    return (
      <Box
        ref={ref}
        sx={{
          display: "flex",
          flexDirection: "column",
          ...(overflowY && { overflowY }),
          ...(height && { height }),
          ...(width && { width }),
          ...(borderRadius && { borderRadius }),
          ...(minHeight && { minHeight }),
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
  /** Font size */
  fontSize?: string;
  /** Background color */
  bg?: string;
  /** Padding X */
  px?: number | string;
  /** Padding Y */
  py?: number | string;
  /** Height */
  height?: string | number;
}

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  function DialogHeader({ children, fontSize, bg, px, py, height, sx, ...props }, ref) {
    return (
      <MuiDialogTitle
        ref={ref}
        sx={{
          display: "flex",
          alignItems: "center",
          ...(fontSize && { fontSize }),
          ...(bg && { backgroundColor: bg }),
          ...(px !== undefined && { px }),
          ...(py !== undefined && { py }),
          ...(height !== undefined && { height }),
          ...sx,
        }}
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
  /** Element type to render as */
  as?: string;
  /** Font family */
  fontFamily?: string;
  /** Font size */
  fontSize?: string;
  /** Color */
  color?: string;
  /** Display */
  display?: string;
  /** Align items */
  alignItems?: string;
  /** Gap */
  gap?: string | number;
}

export const DialogTitle = forwardRef<HTMLSpanElement, DialogTitleProps>(
  function DialogTitle({ children, as: _as, fontFamily, fontSize, color, display, alignItems, gap }, ref) {
    return (
      <span
        ref={ref}
        style={{
          flex: 1,
          ...(fontFamily && { fontFamily }),
          ...(fontSize && { fontSize }),
          ...(color && { color }),
          ...(display && { display }),
          ...(alignItems && { alignItems }),
          ...(gap !== undefined && { gap }),
        }}
      >
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
  /** Border Y shorthand */
  borderY?: string;
  /** Padding */
  p?: number | string;
  /** Gap */
  gap?: string | number;
  /** Render as component (Chakra compatibility) */
  as?: React.ElementType;
  /** Flex direction */
  direction?: string;
  /** Height shorthand */
  h?: string | number;
  /** Overflow */
  overflow?: string;
}

export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(
  function DialogBody(
    { children, borderTop, borderBottom, borderY, p, gap, as: _as, direction, h, overflow, sx, ...props },
    ref,
  ) {
    const combinedSx = useMemo((): SxProps<Theme> => {
      const styles: Record<string, unknown> = {};
      if (borderTop) styles.borderTop = borderTop;
      if (borderBottom) styles.borderBottom = borderBottom;
      if (borderY) {
        styles.borderTop = borderY;
        styles.borderBottom = borderY;
      }
      if (p !== undefined) styles.p = p;
      if (gap !== undefined) {
        styles.gap = gap;
        styles.display = "flex";
        styles.flexDirection = direction || "column";
      }
      if (h !== undefined) styles.height = h;
      if (overflow) styles.overflow = overflow;
      if (sx && typeof sx === "object" && !Array.isArray(sx)) {
        return { ...styles, ...sx } as SxProps<Theme>;
      }
      return styles as SxProps<Theme>;
    }, [borderTop, borderBottom, borderY, p, gap, direction, h, overflow, sx]);

    return (
      <MuiDialogContent
        ref={ref}
        sx={combinedSx}
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

// Dialog Action Trigger - wraps action buttons that should close the dialog
export interface DialogActionTriggerProps {
  children?: ReactNode;
  /** Render as child element (Chakra compatibility) */
  asChild?: boolean;
}

export const DialogActionTrigger = forwardRef<
  HTMLDivElement,
  DialogActionTriggerProps
>(function DialogActionTrigger({ children, asChild }, ref) {
  // ActionTrigger typically wraps a button that closes the dialog when clicked
  // In MUI, the parent Dialog handles this through onClose
  // This wrapper maintains API compatibility with Chakra
  if (asChild && children && isValidElement(children)) {
    return children;
  }
  return <div ref={ref}>{children}</div>;
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
  ActionTrigger: DialogActionTrigger,
};

export default Dialog;
