"use client";

import MuiSkeleton from "@mui/material/Skeleton";
import type { SkeletonProps as MuiSkeletonProps } from "@mui/material/Skeleton";
import { forwardRef, type ReactNode } from "react";

/**
 * Skeleton Components - MUI equivalent of Chakra's Skeleton components
 */

// Skeleton
export interface SkeletonProps extends Omit<MuiSkeletonProps, "ref"> {
  children?: ReactNode;
  /** Loading state */
  loading?: boolean;
}

export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(
  function Skeleton({ children, loading = true, ...props }, ref) {
    if (!loading) {
      return <>{children}</>;
    }

    return <MuiSkeleton ref={ref} {...props} />;
  },
);

// SkeletonText - Multiple line skeleton text
export interface SkeletonTextProps extends Omit<MuiSkeletonProps, "ref"> {
  children?: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Number of lines */
  noOfLines?: number;
  /** Line clamp (alias for noOfLines) */
  lineClamp?: number;
  /** Font size */
  fontSize?: string;
  /** Minimum width */
  minWidth?: string;
}

export const SkeletonText = forwardRef<HTMLDivElement, SkeletonTextProps>(
  function SkeletonText(
    {
      children,
      loading = true,
      noOfLines = 3,
      lineClamp,
      fontSize,
      minWidth,
      ...props
    },
    ref,
  ) {
    const lines = lineClamp ?? noOfLines;

    if (!loading) {
      return <>{children}</>;
    }

    return (
      <div ref={ref} style={{ minWidth }}>
        {Array.from({ length: lines }).map((_, index) => (
          <MuiSkeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton lines have stable order
            key={index}
            variant="text"
            sx={{
              ...(fontSize && { fontSize }),
              // Make last line shorter for natural look
              ...(index === lines - 1 && lines > 1 && { width: "80%" }),
            }}
            {...props}
          />
        ))}
      </div>
    );
  },
);

// SkeletonCircle - Circular skeleton
export interface SkeletonCircleProps extends Omit<MuiSkeletonProps, "ref"> {
  children?: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Size of the circle */
  size?: string | number;
}

export const SkeletonCircle = forwardRef<HTMLSpanElement, SkeletonCircleProps>(
  function SkeletonCircle({ children, loading = true, size = 40, ...props }, ref) {
    if (!loading) {
      return <>{children}</>;
    }

    return (
      <MuiSkeleton
        ref={ref}
        variant="circular"
        width={size}
        height={size}
        {...props}
      />
    );
  },
);

export default Skeleton;
