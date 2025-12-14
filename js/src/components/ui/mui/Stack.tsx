"use client";

import type { StackProps as MuiStackProps } from "@mui/material/Stack";
import MuiStack from "@mui/material/Stack";
import { forwardRef, type ReactNode } from "react";

/**
 * Stack Component - MUI equivalent of Chakra's Stack/VStack/HStack
 *
 * A component that lays out children with consistent spacing.
 */

export interface StackProps extends Omit<MuiStackProps, "ref"> {
  children?: ReactNode;
  /** Shorthand for alignItems */
  align?: MuiStackProps["alignItems"];
  /** Shorthand for justifyContent */
  justify?: MuiStackProps["justifyContent"];
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { children, align, justify, sx, ...props },
  ref,
) {
  return (
    <MuiStack
      ref={ref}
      sx={{
        alignItems: align,
        justifyContent: justify,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiStack>
  );
});

/**
 * VStack - Vertical Stack (column direction)
 * Equivalent to Chakra's VStack
 */
export const VStack = forwardRef<HTMLDivElement, StackProps>(function VStack(
  { children, align = "stretch", ...props },
  ref,
) {
  return (
    <Stack ref={ref} direction="column" align={align} {...props}>
      {children}
    </Stack>
  );
});

/**
 * HStack - Horizontal Stack (row direction)
 * Equivalent to Chakra's HStack
 */
export const HStack = forwardRef<HTMLDivElement, StackProps>(function HStack(
  { children, align = "center", ...props },
  ref,
) {
  return (
    <Stack ref={ref} direction="row" align={align} {...props}>
      {children}
    </Stack>
  );
});

export default Stack;
