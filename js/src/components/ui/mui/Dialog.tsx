"use client";

import Box from "@mui/material/Box";
import MuiDialog, {
  type DialogProps as MuiDialogProps,
} from "@mui/material/Dialog";
import MuiDialogActions, {
  type DialogActionsProps as MuiDialogActionsProps,
} from "@mui/material/DialogActions";
import MuiDialogContent, {
  type DialogContentProps as MuiDialogContentProps,
} from "@mui/material/DialogContent";
import MuiDialogTitle, {
  type DialogTitleProps as MuiDialogTitleProps,
} from "@mui/material/DialogTitle";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { CloseButton } from "./CloseButton";

/**
 * Dialog Components - MUI equivalent of Chakra's Dialog compound components
 *
 * MUI Dialog already handles:
 * - Portal rendering (renders to body)
 * - Backdrop overlay
 * - Positioning (centered by default)
 *
 * So the Chakra patterns like Portal/Backdrop/Positioner are no-ops here.
 */

// Context to pass onClose handler down to CloseTrigger
const DialogCloseContext = createContext<(() => void) | undefined>(undefined);

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

/**
 * Recursively extracts the actual dialog content from Chakra's
 * Portal/Backdrop/Positioner/Content wrapper pattern.
 */
function extractDialogContent(children: ReactNode): ReactNode {
  const childArray = Children.toArray(children);

  // Process each child
  return childArray.flatMap((child) => {
    if (!isValidElement(child)) return child;

    const displayName =
      (child.type as { displayName?: string })?.displayName ||
      (child.type as { name?: string })?.name ||
      "";

    // Skip Backdrop (MUI handles this)
    if (displayName === "DialogBackdrop") {
      return [];
    }

    // Unwrap Portal, Positioner, and Content - just extract their children
    if (
      displayName === "Portal" ||
      displayName === "DialogPositioner" ||
      displayName === "DialogContent"
    ) {
      const nestedChildren = (child.props as { children?: ReactNode }).children;
      return extractDialogContent(nestedChildren);
    }

    // Keep Header, Body, Footer, and other elements
    return child;
  });
}

export const DialogRoot = forwardRef<HTMLDivElement, DialogRootProps>(
  function DialogRoot(
    {
      children,
      onOpenChange,
      onClose,
      size = "md",
      placement: _placement,
      initialFocusEl: _initialFocusEl,
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

    // Extract the actual content from Portal/Positioner/Content wrappers
    const dialogContent = extractDialogContent(children);

    return (
      <DialogCloseContext.Provider value={handleClose}>
        <MuiDialog
          ref={ref}
          onClose={handleClose}
          maxWidth={sizeToMaxWidth[size] ?? "md"}
          fullWidth
          fullScreen={size === "full" || size === "cover"}
          {...props}
        >
          {dialogContent}
        </MuiDialog>
      </DialogCloseContext.Provider>
    );
  },
);

// Dialog Backdrop (no-op for MUI, handled internally)
export const DialogBackdrop = forwardRef<
  HTMLDivElement,
  { bg?: string; backdropFilter?: string }
>(function DialogBackdrop(_props, _ref) {
  // MUI handles backdrop internally, this is for API compatibility
  return null;
});
DialogBackdrop.displayName = "DialogBackdrop";

// Dialog Positioner (wrapper for API compatibility)
export const DialogPositioner = forwardRef<
  HTMLDivElement,
  { children?: ReactNode }
>(function DialogPositioner({ children }, _ref) {
  // MUI handles positioning internally
  return <>{children}</>;
});
DialogPositioner.displayName = "DialogPositioner";

// Dialog Content (wrapper for API compatibility)
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
  function DialogContent({ children }, _ref) {
    // Just pass through children - MUI Paper handles the content container
    return <>{children}</>;
  },
);
DialogContent.displayName = "DialogContent";

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
  function DialogHeader(
    { children, fontSize, bg, px, py, height, sx, ...props },
    ref,
  ) {
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
DialogHeader.displayName = "DialogHeader";

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
  function DialogTitle(
    {
      children,
      as: _as,
      fontFamily,
      fontSize,
      color,
      display,
      alignItems,
      gap,
    },
    ref,
  ) {
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
DialogTitle.displayName = "DialogTitle";

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
    {
      children,
      borderTop,
      borderBottom,
      borderY,
      p,
      gap,
      as: _as,
      direction,
      h,
      overflow,
      sx,
      ...props
    },
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
      <MuiDialogContent ref={ref} sx={combinedSx} {...props}>
        {children}
      </MuiDialogContent>
    );
  },
);
DialogBody.displayName = "DialogBody";

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
DialogFooter.displayName = "DialogFooter";

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
  const contextOnClose = useContext(DialogCloseContext);

  const handleClick = () => {
    onClick?.();
    contextOnClose?.();
  };

  if (asChild && children && isValidElement(children)) {
    // Clone the child and pass onClick
    return cloneElement(children as ReactElement<{ onClick?: () => void }>, {
      onClick: handleClick,
    });
  }
  if (children) {
    return <Box onClick={handleClick}>{children}</Box>;
  }
  return <CloseButton ref={ref} onClick={handleClick} />;
});
DialogCloseTrigger.displayName = "DialogCloseTrigger";

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
  const contextOnClose = useContext(DialogCloseContext);

  // ActionTrigger wraps a button that closes the dialog when clicked
  if (asChild && children && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onClick?: () => void }>, {
      onClick: () => {
        // Call original onClick if present
        const originalOnClick = (
          children as ReactElement<{ onClick?: () => void }>
        ).props.onClick;
        originalOnClick?.();
        contextOnClose?.();
      },
    });
  }
  return <div ref={ref}>{children}</div>;
});
DialogActionTrigger.displayName = "DialogActionTrigger";

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
