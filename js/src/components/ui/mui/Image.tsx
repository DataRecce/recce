"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import { forwardRef } from "react";

/**
 * Image Component - MUI equivalent of Chakra's Image
 *
 * Renders an image with styling support.
 */

export interface ImageProps
  extends Omit<MuiBoxProps<"img">, "ref" | "component" | "color"> {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Fallback element to show if image fails to load */
  fallback?: React.ReactElement;
  /** Fallback src to use if image fails to load */
  fallbackSrc?: string;
  /** How the image should be fit within its container */
  fit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  /** Alignment of the image within its container */
  align?: string;
  /** Whether to ignore fallback */
  ignoreFallback?: boolean;
  /** Error handler */
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  /** Height (shorthand) */
  h?: string | number;
  /** Box size (sets both width and height) */
  boxSize?: string | number;
  /** Margin left */
  ml?: string | number;
}

export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { fit, align, fallbackSrc, onError, h, boxSize, ml, sx, ...props },
  ref,
) {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
      e.currentTarget.src = fallbackSrc;
    }
    onError?.(e);
  };

  return (
    <MuiBox
      ref={ref}
      component="img"
      sx={{
        objectFit: fit,
        objectPosition: align,
        ...(h !== undefined && { height: h }),
        ...(boxSize !== undefined && { width: boxSize, height: boxSize }),
        ...(ml !== undefined && { ml }),
        ...sx,
      }}
      onError={handleError}
      {...props}
    />
  );
});

export default Image;
