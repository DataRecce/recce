"use client";

import type { SxProps, Theme } from "@mui/material/styles";
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
  /** Delay before showing the tooltip in milliseconds */
  openDelay?: number;
  /** Props to style the tooltip content */
  contentProps?: {
    width?: string | number;
    padding?: number | string;
    shadow?: string;
    borderWidth?: number | string;
    rounded?: string;
    color?: string;
    backgroundColor?: string;
    sx?: SxProps<Theme>;
  };
  /** Whether to close the tooltip on click */
  closeOnClick?: boolean;
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(
    {
      content,
      children,
      showArrow = false,
      disabled = false,
      positioning,
      openDelay,
      contentProps,
      closeOnClick,
      slotProps,
      ...props
    },
    ref,
  ) {
    if (disabled || !content) {
      return children;
    }

    // Convert contentProps to MUI sx styles
    const tooltipSx: SxProps<Theme> | undefined = contentProps
      ? {
          width: contentProps.width,
          padding: contentProps.padding,
          boxShadow: contentProps.shadow === "md" ? 2 : undefined,
          borderWidth: contentProps.borderWidth,
          borderStyle: contentProps.borderWidth ? "solid" : undefined,
          borderColor: contentProps.borderWidth ? "divider" : undefined,
          borderRadius: contentProps.rounded === "md" ? 1 : undefined,
          color: contentProps.color,
          backgroundColor: contentProps.backgroundColor,
          ...contentProps.sx,
        }
      : undefined;

    return (
      <MuiTooltip
        ref={ref}
        title={content}
        arrow={showArrow}
        placement={positioning?.placement}
        enterDelay={openDelay}
        disableInteractive={closeOnClick === false ? false : undefined}
        slotProps={{
          ...slotProps,
          tooltip: tooltipSx
            ? {
                ...slotProps?.tooltip,
                sx: tooltipSx,
              }
            : slotProps?.tooltip,
        }}
        {...props}
      >
        {children}
      </MuiTooltip>
    );
  },
);

export default Tooltip;
