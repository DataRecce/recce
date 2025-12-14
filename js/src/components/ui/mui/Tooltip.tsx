"use client";

import type { TooltipProps as MuiTooltipProps } from "@mui/material/Tooltip";
import MuiTooltip from "@mui/material/Tooltip";
import { forwardRef, type ReactElement, type ReactNode } from "react";

/**
 * Tooltip Component - MUI equivalent of Chakra's Tooltip
 *
 * Displays informative text when users hover over an element.
 */

export interface TooltipProps
  extends Omit<
    MuiTooltipProps,
    "ref" | "title" | "children" | "content" | "open"
  > {
  /** Content to display in the tooltip */
  content?: ReactNode;
  /** The element that triggers the tooltip */
  children: ReactElement;
  /** Whether to show an arrow */
  showArrow?: boolean;
  /** Whether the tooltip is disabled */
  disabled?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Placement of the tooltip */
  positioning?: {
    placement?: MuiTooltipProps["placement"];
  };
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(
    {
      content,
      children,
      showArrow = false,
      disabled = false,
      positioning,
      ...props
    },
    ref,
  ) {
    if (disabled || !content) {
      return children;
    }

    return (
      <MuiTooltip
        ref={ref}
        title={content}
        arrow={showArrow}
        placement={positioning?.placement}
        {...props}
      >
        {children}
      </MuiTooltip>
    );
  },
);

export default Tooltip;
