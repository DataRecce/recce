"use client";

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
  };
}

export const PopoverRoot = forwardRef<HTMLDivElement, PopoverRootProps>(
  function PopoverRoot({ children, defaultOpen = false, positioning }, ref) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleOpen = (event: MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
      setAnchorEl(null);
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

// Popover Content
export interface PopoverContentProps
  extends Omit<MuiPopoverProps, "ref" | "open"> {
  children?: ReactNode;
  open?: boolean;
  positioning?: PopoverRootProps["positioning"];
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

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    { children, open = false, positioning, anchorEl, onClose, sx, ...props },
    ref,
  ) {
    const anchorOrigin =
      placementToAnchorOrigin[positioning?.placement || "bottom-start"];

    return (
      <MuiPopover
        ref={ref}
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={anchorOrigin}
        sx={{ "& .MuiPopover-paper": { p: 2 }, ...sx }}
        {...props}
      >
        {children}
      </MuiPopover>
    );
  },
);

// Combined Popover namespace
export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Content: PopoverContent,
};

export default Popover;
