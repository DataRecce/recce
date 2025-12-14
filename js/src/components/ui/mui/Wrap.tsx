"use client";

import MuiBox from "@mui/material/Box";
import { forwardRef, type ReactNode } from "react";

/**
 * Wrap Components - MUI equivalent of Chakra's Wrap/WrapItem
 *
 * A layout component that adds spacing between elements that wrap.
 */

export interface WrapProps {
  children?: ReactNode;
  /** Spacing between items */
  spacing?: string | number;
  /** Border */
  border?: string;
  /** Border radius */
  borderRadius?: string;
  /** Width */
  width?: string;
  /** Margin X */
  marginX?: string;
  /** Padding */
  padding?: string;
}

export const Wrap = forwardRef<HTMLDivElement, WrapProps>(function Wrap(
  { children, spacing = 2, border, borderRadius, width, marginX, padding },
  ref,
) {
  return (
    <MuiBox
      ref={ref}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: spacing,
        ...(border && { border }),
        ...(borderRadius && { borderRadius }),
        ...(width && { width }),
        ...(marginX && { mx: marginX }),
        ...(padding && { p: padding }),
      }}
    >
      {children}
    </MuiBox>
  );
});

export interface WrapItemProps {
  children?: ReactNode;
  /** Width */
  width?: string;
}

export const WrapItem = forwardRef<HTMLDivElement, WrapItemProps>(
  function WrapItem({ children, width }, ref) {
    return (
      <MuiBox ref={ref} sx={{ ...(width && { width }) }}>
        {children}
      </MuiBox>
    );
  },
);

export default Wrap;
