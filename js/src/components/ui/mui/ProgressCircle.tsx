"use client";

import Box from "@mui/material/Box";
import type { CircularProgressProps } from "@mui/material/CircularProgress";
import CircularProgress from "@mui/material/CircularProgress";
import { forwardRef, type ReactNode } from "react";

/**
 * ProgressCircle Component - MUI equivalent of Chakra's Progress Circle
 *
 * A circular progress indicator component.
 */

const sizeMap: Record<string, number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 48,
  xl: 64,
};

export interface ProgressCircleRootProps
  extends Omit<CircularProgressProps, "ref" | "size" | "value"> {
  /** Progress value (0-100), null for indeterminate */
  value?: number | null;
  /** Size preset or number */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Children for compound pattern */
  children?: ReactNode;
  /** Margin right */
  mr?: string | number;
}

const ProgressCircleRoot = forwardRef<HTMLDivElement, ProgressCircleRootProps>(
  function ProgressCircleRoot(
    { value, size = "md", children, mr, sx, ...props },
    ref,
  ) {
    const pixelSize = typeof size === "number" ? size : sizeMap[size] || 40;
    const isIndeterminate = value === null || value === undefined;

    // If children are provided (compound pattern), render with children
    if (children) {
      return (
        <Box
          ref={ref}
          sx={{
            position: "relative",
            display: "inline-flex",
            ...(mr !== undefined && { mr }),
            ...sx,
          }}
        >
          <CircularProgress
            variant={isIndeterminate ? "indeterminate" : "determinate"}
            value={isIndeterminate ? undefined : value}
            size={pixelSize}
            {...props}
          />
          {children}
        </Box>
      );
    }

    // Simple usage without compound pattern
    return (
      <CircularProgress
        ref={ref as React.Ref<HTMLSpanElement>}
        variant={isIndeterminate ? "indeterminate" : "determinate"}
        value={isIndeterminate ? undefined : value}
        size={pixelSize}
        sx={{
          ...(mr !== undefined && { mr }),
          ...sx,
        }}
        {...props}
      />
    );
  },
);

// Sub-components for compound pattern (mostly no-ops for compatibility)
function ProgressCircleCircle({ children }: { children?: ReactNode }) {
  // In MUI, the circle is part of the main component, this is for API compatibility
  return <>{children}</>;
}

function ProgressCircleTrack() {
  // MUI CircularProgress handles this internally
  return null;
}

function ProgressCircleRange() {
  // MUI CircularProgress handles this internally
  return null;
}

// Compound component export
export const ProgressCircle = {
  Root: ProgressCircleRoot,
  Circle: ProgressCircleCircle,
  Track: ProgressCircleTrack,
  Range: ProgressCircleRange,
};

// Direct exports
export {
  ProgressCircleRoot,
  ProgressCircleCircle,
  ProgressCircleTrack,
  ProgressCircleRange,
};

export default ProgressCircle;
