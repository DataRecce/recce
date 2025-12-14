"use client";

import MuiGrid from "@mui/material/Grid";
import type { GridProps as MuiGridProps } from "@mui/material/Grid";
import { forwardRef, type ReactNode } from "react";

/**
 * SimpleGrid Component - MUI equivalent of Chakra's SimpleGrid
 *
 * A responsive grid that automatically calculates column widths.
 */

export interface SimpleGridProps extends Omit<MuiGridProps, "ref"> {
  children?: ReactNode;
  /** Minimum width for each child */
  minChildWidth?: string;
  /** Gap between items */
  gap?: string | number;
  /** Padding */
  padding?: string | number;
  /** Width */
  width?: string;
  /** Background color */
  backgroundColor?: string;
}

export const SimpleGrid = forwardRef<HTMLDivElement, SimpleGridProps>(
  function SimpleGrid(
    { children, minChildWidth, gap, padding, width, backgroundColor, sx, ...props },
    ref,
  ) {
    return (
      <MuiGrid
        ref={ref}
        container
        spacing={gap ? 0 : 2}
        sx={{
          display: "grid",
          gridTemplateColumns: minChildWidth
            ? `repeat(auto-fill, minmax(${minChildWidth}, 1fr))`
            : undefined,
          ...(gap && { gap }),
          ...(padding && { padding }),
          ...(width && { width }),
          ...(backgroundColor && { backgroundColor }),
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiGrid>
    );
  },
);

export default SimpleGrid;
