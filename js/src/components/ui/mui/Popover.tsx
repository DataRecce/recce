"use client";

import MuiBox from "@mui/material/Box";
import type { PopoverProps as MuiPopoverProps } from "@mui/material/Popover";
import MuiPopover from "@mui/material/Popover";
import {
  forwardRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";

/**
 * Popover Components - MUI equivalent of Chakra's Popover compound components
 */

// Popover Root
export interface PopoverRootProps {
  children?: ReactNode;
  /** Initial open state */
  defaultOpen?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Callback when focus leaves the popover */
  onFocusOutside?: () => void;
  /** Positioning configuration */
  positioning?: {
    placement?:
      | "bottom-start"
      | "bottom-end"
      | "top-start"
      | "top-end"
      | "bottom"
      | "top"
      | "left"
      | "right";
    /** Custom anchor rect getter */
    getAnchorRect?: () => DOMRect | null;
  };
  /** Lazy mount - only render content when open */
  lazyMount?: boolean;
  /** Unmount content when closed */
  unmountOnExit?: boolean;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg";
  /** Auto focus when opened */
  autoFocus?: boolean;
}

export const PopoverRoot = forwardRef<HTMLDivElement, PopoverRootProps>(
  function PopoverRoot(
    {
      children,
      defaultOpen = false,
      open: controlledOpen,
      onOpenChange,
      onFocusOutside,
      positioning,
      lazyMount,
      unmountOnExit,
      size,
      autoFocus,
    },
    ref,
  ) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [internalOpen, setInternalOpen] = useState(defaultOpen);

    // Use controlled state if provided
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    const handleOpen = (event: MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
      if (!isControlled) {
        setInternalOpen(true);
      }
      onOpenChange?.(true);
    };

    const handleClose = () => {
      setAnchorEl(null);
      if (!isControlled) {
        setInternalOpen(false);
      }
      onOpenChange?.(false);
    };

    // Clone children and inject context
    const childrenArray = Array.isArray(children) ? children : [children];
    const enhancedChildren = childrenArray.map((child, index) => {
      if (!child) return null;
      const childElement = child as ReactElement<{
        anchorEl?: HTMLElement | null;
        open?: boolean;
        onOpen?: (event: MouseEvent<HTMLElement>) => void;
        onClose?: () => void;
        positioning?: PopoverRootProps["positioning"];
        onFocusOutside?: () => void;
        lazyMount?: boolean;
        unmountOnExit?: boolean;
        size?: string;
        autoFocus?: boolean;
        children?: ReactNode;
      }>;

      if (childElement.type === PopoverTrigger) {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: compound component children have stable order
          <PopoverTrigger key={index} onOpen={handleOpen}>
            {childElement.props.children}
          </PopoverTrigger>
        );
      }
      if (childElement.type === PopoverContent) {
        return (
          <PopoverContent
            // biome-ignore lint/suspicious/noArrayIndexKey: compound component children have stable order
            key={index}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            positioning={positioning}
            onFocusOutside={onFocusOutside}
            lazyMount={lazyMount}
            unmountOnExit={unmountOnExit}
            size={size}
            autoFocus={autoFocus}
          >
            {childElement.props.children}
          </PopoverContent>
        );
      }
      return child;
    });

    return <div ref={ref}>{enhancedChildren}</div>;
  },
);

// Popover Trigger
export interface PopoverTriggerProps {
  children?: ReactNode;
  onOpen?: (event: MouseEvent<HTMLElement>) => void;
  asChild?: boolean;
}

export const PopoverTrigger = forwardRef<HTMLDivElement, PopoverTriggerProps>(
  function PopoverTrigger({ children, onOpen }, ref) {
    const handleClick = (event: MouseEvent<HTMLElement>) => {
      onOpen?.(event);
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        style={{ display: "inline-block", cursor: "pointer" }}
      >
        {children}
      </div>
    );
  },
);

// Popover Positioner - Wrapper for positioning (API compatibility)
interface PopoverPositionerProps {
  children?: ReactNode;
}

function PopoverPositioner({ children }: PopoverPositionerProps) {
  // MUI handles positioning internally, this is for API compatibility
  return <>{children}</>;
}

// Popover Content
export interface PopoverContentProps
  extends Omit<MuiPopoverProps, "ref" | "open"> {
  children?: ReactNode;
  open?: boolean;
  positioning?: PopoverRootProps["positioning"];
  /** Background color */
  bg?: string;
  /** Text color */
  color?: string;
  /** z-index */
  zIndex?: string | number;
  /** Width */
  width?: string;
  /** Mouse enter handler */
  onMouseEnter?: () => void;
  /** Mouse leave handler */
  onMouseLeave?: () => void;
  /** Focus outside handler */
  onFocusOutside?: () => void;
  /** Lazy mount */
  lazyMount?: boolean;
  /** Unmount on exit */
  unmountOnExit?: boolean;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg";
  /** Auto focus */
  autoFocus?: boolean;
}

const placementToAnchorOrigin: Record<string, MuiPopoverProps["anchorOrigin"]> =
  {
    "bottom-start": { vertical: "bottom", horizontal: "left" },
    "bottom-end": { vertical: "bottom", horizontal: "right" },
    "top-start": { vertical: "top", horizontal: "left" },
    "top-end": { vertical: "top", horizontal: "right" },
    bottom: { vertical: "bottom", horizontal: "center" },
    top: { vertical: "top", horizontal: "center" },
    left: { vertical: "center", horizontal: "left" },
    right: { vertical: "center", horizontal: "right" },
  };

const sizeToWidth: Record<string, string> = {
  xs: "200px",
  sm: "280px",
  md: "320px",
  lg: "400px",
};

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    {
      children,
      open = false,
      positioning,
      anchorEl,
      onClose,
      bg,
      color,
      zIndex,
      width,
      onMouseEnter,
      onMouseLeave,
      onFocusOutside,
      lazyMount,
      unmountOnExit,
      size,
      autoFocus = true,
      sx,
      ...props
    },
    ref,
  ) {
    const anchorOrigin =
      placementToAnchorOrigin[positioning?.placement || "bottom-start"];

    // Handle onFocusOutside by closing when clicking outside
    const handleClose = (
      event: object,
      reason: "backdropClick" | "escapeKeyDown",
    ) => {
      if (reason === "backdropClick" && onFocusOutside) {
        onFocusOutside();
      }
      onClose?.(event, reason);
    };

    // Use virtual element for custom anchor rect
    // MUI PopoverVirtualElement requires nodeType property
    const virtualAnchor =
      positioning?.getAnchorRect && !anchorEl
        ? {
            nodeType: 1 as const,
            getBoundingClientRect: positioning.getAnchorRect,
          }
        : anchorEl;

    return (
      <MuiPopover
        ref={ref}
        anchorEl={virtualAnchor as typeof anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={anchorOrigin}
        disableAutoFocus={!autoFocus}
        keepMounted={!unmountOnExit}
        slotProps={{
          paper: {
            onMouseEnter,
            onMouseLeave,
          },
        }}
        sx={{
          "& .MuiPopover-paper": {
            p: 2,
            ...(bg && { backgroundColor: bg }),
            ...(color && { color }),
            ...(zIndex && { zIndex }),
            ...(width && { width }),
            ...(size && { width: sizeToWidth[size] }),
          },
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiPopover>
    );
  },
);

// Popover Body - Container for popover content
export interface PopoverBodyProps {
  children?: ReactNode;
}

export const PopoverBody = forwardRef<HTMLDivElement, PopoverBodyProps>(
  function PopoverBody({ children }, ref) {
    return <MuiBox ref={ref}>{children}</MuiBox>;
  },
);

// Combined Popover namespace
export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Positioner: PopoverPositioner,
  Content: PopoverContent,
  Body: PopoverBody,
};

export default Popover;
