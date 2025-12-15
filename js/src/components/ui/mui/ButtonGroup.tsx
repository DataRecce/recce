"use client";

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import { forwardRef, type ReactNode } from "react";

/**
 * ButtonGroup Component - MUI equivalent of Chakra's ButtonGroup
 *
 * Groups buttons together with optional attached styling.
 */

export interface ButtonGroupProps extends Omit<BoxProps, "ref"> {
  /** Whether buttons should be attached (no gap) */
  attached?: boolean;
  /** Variant to apply to children */
  variant?:
    | "solid"
    | "outline"
    | "ghost"
    | "link"
    | "contained"
    | "outlined"
    | "text";
  /** Size for the button group */
  size?: "xs" | "sm" | "md" | "lg";
  /** Border radius for attached groups */
  borderRadius?: number | "full";
  children?: ReactNode;
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  function ButtonGroup(
    { children, attached, variant, size, borderRadius, sx, ...props },
    ref,
  ) {
    return (
      <Box
        ref={ref}
        sx={{
          display: "inline-flex",
          ...(attached && {
            "& > button": {
              borderRadius: 0,
            },
            "& > button:first-of-type": {
              borderTopLeftRadius:
                borderRadius === "full" ? 9999 : (borderRadius ?? 4),
              borderBottomLeftRadius:
                borderRadius === "full" ? 9999 : (borderRadius ?? 4),
            },
            "& > button:last-of-type": {
              borderTopRightRadius:
                borderRadius === "full" ? 9999 : (borderRadius ?? 4),
              borderBottomRightRadius:
                borderRadius === "full" ? 9999 : (borderRadius ?? 4),
            },
            "& > button:not(:first-of-type)": {
              marginLeft: "-1px",
            },
          }),
          ...(!attached && {
            gap: 1,
          }),
          ...sx,
        }}
        {...props}
      >
        {children}
      </Box>
    );
  },
);

export default ButtonGroup;
