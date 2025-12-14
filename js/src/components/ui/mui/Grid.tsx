"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import { forwardRef, type ReactNode } from "react";

/**
 * Grid Component - MUI equivalent of Chakra's Grid
 *
 * A CSS Grid container component for two-dimensional layouts.
 * Uses MUI Box with CSS Grid properties for maximum flexibility.
 */

export interface GridProps extends Omit<MuiBoxProps, "ref"> {
  children?: ReactNode;
  /** Number of columns in the grid template */
  templateColumns?: string;
  /** Number of rows in the grid template */
  templateRows?: string;
  /** Gap between grid items */
  gap?: number | string;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(function Grid(
  { children, templateColumns, templateRows, gap, sx, ...props },
  ref,
) {
  return (
    <MuiBox
      ref={ref}
      sx={{
        display: "grid",
        gridTemplateColumns: templateColumns,
        gridTemplateRows: templateRows,
        gap,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiBox>
  );
});

/**
 * GridItem Component - Child of Grid container
 */
export interface GridItemProps extends Omit<MuiBoxProps, "ref"> {
  children?: ReactNode;
  /** Column span */
  colSpan?: number | string;
  /** Row span */
  rowSpan?: number | string;
  /** Column start position */
  colStart?: number | string;
  /** Row start position */
  rowStart?: number | string;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  function GridItem(
    { children, colSpan, rowSpan, colStart, rowStart, sx, ...props },
    ref,
  ) {
    return (
      <MuiBox
        ref={ref}
        sx={{
          gridColumn: colSpan ? `span ${colSpan}` : undefined,
          gridRow: rowSpan ? `span ${rowSpan}` : undefined,
          gridColumnStart: colStart,
          gridRowStart: rowStart,
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiBox>
    );
  },
);

export default Grid;
