"use client";

/**
 * @file ScreenshotBox.tsx
 * @description A wrapper component for content that can be captured as a screenshot.
 *
 * This component provides a ref-forwardable container that can be used with
 * html-to-image or similar libraries to capture its contents as an image.
 */

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import { forwardRef, type Ref } from "react";

export interface ScreenshotBoxProps extends BoxProps {
  /** Background color for the screenshot area */
  backgroundColor?: string;
  /** Block size (height in block direction) */
  blockSize?: string;
  /** Content to render inside the screenshot area */
  children?: React.ReactNode;
}

/**
 * A container component that can be captured as a screenshot.
 *
 * The component forwards its ref to the outer container, allowing parent
 * components to capture the element using html-to-image or similar libraries.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 *
 * const captureScreenshot = async () => {
 *   if (ref.current) {
 *     const dataUrl = await toPng(ref.current);
 *     // Use dataUrl...
 *   }
 * };
 *
 * return (
 *   <ScreenshotBox ref={ref} backgroundColor="white">
 *     <Chart data={data} />
 *   </ScreenshotBox>
 * );
 * ```
 */
export const ScreenshotBox = forwardRef(function ScreenshotBox(
  {
    backgroundColor = "white",
    blockSize,
    children,
    ...restProps
  }: ScreenshotBoxProps,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <Box
      ref={ref}
      {...restProps}
      sx={{ overflowY: "auto", overflowX: "hidden", ...restProps.sx }}
    >
      <Box
        sx={{
          backgroundColor,
          height: "100%",
          blockSize,
        }}
      >
        {children}
      </Box>
    </Box>
  );
});
