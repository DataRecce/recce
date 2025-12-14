"use client";

import type { IconButtonProps as MuiIconButtonProps } from "@mui/material/IconButton";
import MuiIconButton from "@mui/material/IconButton";
import { forwardRef } from "react";
import { IoClose } from "react-icons/io5";

/**
 * CloseButton Component - MUI equivalent of Chakra's CloseButton
 *
 * A pre-styled IconButton with a close icon, commonly used for dismissible components.
 */

export interface CloseButtonProps
  extends Omit<MuiIconButtonProps, "ref" | "children" | "size"> {
  /** Size of the button (Chakra-compatible) */
  size?: "2xs" | "xs" | "sm" | "md" | "lg";
}

const sizeMap = {
  "2xs": { button: "small", icon: 12 },
  xs: { button: "small", icon: 14 },
  sm: { button: "small", icon: 16 },
  md: { button: "medium", icon: 20 },
  lg: { button: "large", icon: 24 },
} as const;

export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(
  function CloseButton({ size = "md", sx, ...props }, ref) {
    const { button: buttonSize, icon: iconSize } = sizeMap[size];

    return (
      <MuiIconButton
        ref={ref}
        size={buttonSize}
        aria-label="Close"
        sx={{
          borderRadius: 1,
          ...sx,
        }}
        {...props}
      >
        <IoClose size={iconSize} />
      </MuiIconButton>
    );
  },
);

export default CloseButton;
